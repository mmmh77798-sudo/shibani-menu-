#!/usr/bin/env bash
# نشر محتوى المستودع على Firebase Hosting عبر REST API — بلا خروج أي رمز من بيئتك.
# يُشغَّل داخل Cloud Shell:  bash tools/firebase-deploy.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[ -z "$PROJECT" ] && PROJECT='shibani-47cdd'
SITE_ID="$PROJECT"
echo "المشروع: $PROJECT | الموقع: $SITE_ID"

export FB_PROJECT="$PROJECT" FB_SITE_ID="$SITE_ID" SRC="$REPO_ROOT"
export FB_TOKEN="$(gcloud auth print-access-token)"

python3 - <<'PYEOF'
import gzip, hashlib, json, os, sys, urllib.request, urllib.error

PROJECT = os.environ['FB_PROJECT']; SITE_ID = os.environ['FB_SITE_ID']; SRC = os.environ['SRC']
TOKEN = os.environ['FB_TOKEN']
BASE = 'https://firebasehosting.googleapis.com/v1beta1'
H = {'Authorization': 'Bearer ' + TOKEN}

def call(method, url, body=None, raw_headers=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    headers = raw_headers or dict(H, **({'Content-Type': 'application/json'} if body is not None else {}))
    rq = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(rq, timeout=timeout) as r:
            out = r.read()
            try: return r.status, json.loads(out or b'{}')
            except Exception: return r.status, out
    except urllib.error.HTTPError as e:
        out = e.read().decode('utf-8', 'replace')
        try: return e.code, json.loads(out)
        except Exception: return e.code, out

print('== 1/7 تفعيل Firebase Hosting API…')
s, b = call('POST', f'https://serviceusage.googleapis.com/v1/projects/{PROJECT}/services/firebasehosting.googleapis.com:enable', {})
print('   serviceusage:', s)

print('== 2/7 فحص/إنشاء الموقع الافتراضي…')
s, b = call('GET', f'{BASE}/projects/{PROJECT}/sites')
print('   sites.list:', s, str(b)[:200])
found = None
if isinstance(b, dict):
    for st in b.get('sites', []):
        if st.get('type') == 'DEFAULT_SITE':
            found = st['name'].split('/')[-1]; break
SITE_ID = found or SITE_ID
if not found:
    s2, b2 = call('POST', f'{BASE}/projects/{PROJECT}/sites?siteId={SITE_ID}', {})
    print('   sites.create:', s2, str(b2)[:200])
print('   SITE_ID =', SITE_ID)

print('== 3/7 إنشاء إصدار…')
cfg = {"config": {"headers": [
    {"glob": "**",            "headers": {"Cache-Control": "public, max-age=600"}},
    {"glob": "/img/**",       "headers": {"Cache-Control": "public, max-age=604800"}},
    {"glob": "/icon-512.png", "headers": {"Cache-Control": "public, max-age=86400"}},
    {"glob": "/sw.js",        "headers": {"Cache-Control": "no-cache"}}
]}}
s, ver = call('POST', f'{BASE}/sites/{SITE_ID}/versions', cfg)
print('   versions.create:', s, str(ver)[:200])
if not isinstance(ver, dict) or 'name' not in ver: sys.exit('فشل إنشاء الإصدار')
VER = ver['name'].split('/')[-1]
print('   VERSION =', VER)

print('== 4/7 تجهيز الملفات…')
EXCLUDE = ('SIGNING-INFO', '.aab', '.keystore', '.jks', '.keystore_pass', 'README.md')
SKIP_DIRS = {'tools', '.git', 'node_modules'}
files = {}
for root, dirs, names in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for n in names:
        p = os.path.join(root, n)
        rel = '/' + os.path.relpath(p, SRC).replace(os.sep, '/')
        if any(x in rel for x in EXCLUDE): continue
        raw = open(p, 'rb').read()
        gz = gzip.compress(raw, mtime=0)
        files[rel] = (hashlib.sha256(gz).hexdigest(), gz)
print('   الملفات:', len(files))

s, pop = call('POST', f'{BASE}/sites/{SITE_ID}/versions/{VER}:populateFiles',
              {"files": {k: v[0] for k, v in files.items()}})
print('   populateFiles:', s, str(pop)[:250])
required = pop.get('uploadRequiredHashes', []) if isinstance(pop, dict) else []
upload_url = pop.get('uploadUrl') if isinstance(pop, dict) else None
hash2path = {v[0]: k for k, v in files.items()}

print('== 5/7 رفع', len(required), 'ملف…')
for i, h in enumerate(required, 1):
    gz = files[hash2path[h]][1]
    s, _ = call('POST', upload_url.rstrip('/') + '/' + h, None,
                raw_headers={'Authorization': 'Bearer ' + TOKEN,
                             'Content-Type': 'application/octet-stream'},
                timeout=300) if False else (None, None)
    # رفع خام بالبايتات:
    rq = urllib.request.Request(upload_url.rstrip('/') + '/' + h, data=gz, method='POST',
        headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/octet-stream'})
    try:
        with urllib.request.urlopen(rq, timeout=300) as r:
            st = r.status; r.read()
    except urllib.error.HTTPError as e:
        st = e.code
    print(f'   [{i}/{len(required)}] {hash2path[h]} -> {st}')
    if st != 200: sys.exit('فشل رفع الملف أعلاه')

print('== 6/7 FINALIZE…')
s, fin = call('PATCH', f'{BASE}/sites/{SITE_ID}/versions/{VER}?update_mask=status', {"status": "FINALIZED"})
print('   finalize:', s, fin.get('status') if isinstance(fin, dict) else fin)

print('== 7/7 إنشاء الإصدار (Release)…')
s, rel = call('POST', f'{BASE}/sites/{SITE_ID}/releases?versionName=sites/{SITE_ID}/versions/{VER}')
print('   release:', s, str(rel)[:250])
print()
print('✅ الرابطان:')
print(f'   https://{SITE_ID}.web.app/')
print(f'   https://{SITE_ID}.firebaseapp.com/')
PYEOF
