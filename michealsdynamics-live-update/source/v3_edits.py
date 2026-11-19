import re, os, sys
root = sys.argv[1]
os.chdir(root)

# 1. home page: remove the moving specials section
h = open('index.html').read()
h2, n = re.subn(r'\s*<section class="spband" data-specials-section>.*?</section>', '', h, count=1, flags=re.S)
assert n == 1 and 'sp3d' not in h2
open('index.html', 'w').write(h2)
print('home: moving showcase removed')

# 2. anywhere else the showcase is used: still grid instead of the spinning ring
p = 'assets/js/app.js'
s = open(p).read()
DS = '$' + '$'
old = DS + "('[data-specials]').forEach(function (el) { el.innerHTML = R.specialsBlock(D, BUILT);"
new = (DS + "('[data-specials]').forEach(function (el) { var sp = R.specials(D); "
       "el.innerHTML = sp.length ? '<div class=\"grid\">' + sp.map(function (p) { return R.card(p, BUILT); }).join('') + '</div>' : ''; /* still grid, no motion */")
assert s.count(old) == 1
open(p, 'w').write(s.replace(old, new))
print('app.js: specials shown as a still grid')

# 3. phone number: settings file + every page in the package
p = 'data/shop-data.js'
s = open(p).read()
assert 'phone_2: "071 076 2953"' in s
open(p, 'w').write(s.replace('phone_2: "071 076 2953"', 'phone_2: "061 583 3802"'))
files = 0
for d, _, fs in os.walk('.'):
    for f in fs:
        if not f.endswith(('.html', '.js', '.php', '.json', '.xml')):
            continue
        fp = os.path.join(d, f)
        t = open(fp, encoding='utf-8', errors='surrogateescape').read()
        t2 = (t.replace('071 076 2953', '061 583 3802').replace('0710762953', '0615833802')
               .replace('27710762953', '27615833802').replace('+27 71 076 2953', '+27 61 583 3802'))
        if t2 != t:
            open(fp, 'w', encoding='utf-8', errors='surrogateescape').write(t2)
            files += 1
print('number changed in', files, 'files')
