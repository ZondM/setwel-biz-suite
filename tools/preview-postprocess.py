import os, re, sys
root = sys.argv[1]
# 1. Clean asset names: "site.css@v=860151.css" -> "site.css", "site.js@v=860256" -> "site.js"
renames = {}
for d, _, files in os.walk(root):
    for f in files:
        if '@v=' in f:
            new = re.sub(r'@v=\d+(\.\w+)?$', '', f)
            os.rename(os.path.join(d, f), os.path.join(d, new))
            renames[f] = new
banner = ('<div style="background:#c9a84c;color:#1a2f45;text-align:center;padding:8px 12px;font:600 14px system-ui,Arial,sans-serif">'
          'PREVIEW of the Setwel Africa shop — you can click around. Cart, search, checkout and forms only work on the live website.</div>')
script = '''<script>
document.addEventListener('submit',function(e){e.preventDefault();alert('This is a preview. Cart, search, quotes and forms work once the website is live on setwelafrica.com.');},true);
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a&&/^https?:\\/\\/127\\.0\\.0\\.1/.test(a.getAttribute('href')||'')){e.preventDefault();alert('This page works once the website is live.');}},true);
try{localStorage.setItem('setwel_consent','essential');}catch(e){}
</script>'''
n = 0
for d, _, files in os.walk(root):
    for f in files:
        if not f.endswith('.html'):
            continue
        p = os.path.join(d, f)
        h = open(p, encoding='utf-8').read()
        for old, new in renames.items():
            h = h.replace(old, new)
        h = h.replace('<body>', '<body>' + banner, 1)
        h = h.replace('</body>', script + '</body>', 1)
        h = h.replace('http://127.0.0.1:8099/', 'http://127.0.0.1/')  # any leftover live-only links
        open(p, 'w', encoding='utf-8').write(h)
        n += 1
print('processed', n, 'pages; renamed', len(renames), 'assets')
