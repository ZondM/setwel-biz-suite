import json, re, sys, os
root = sys.argv[1]
SLUGS = ['novalac-ready-to-feed-premium-90ml-91207ea', 'novalac-ready-to-feed-premature-70ml-90153ea']
LIST = '001-003'
p = os.path.join(root, 'data/list', LIST + '.json')
rows = json.load(open(p))
removed = sorted(i for i, r in enumerate(rows) if r[0] in SLUGS)
assert len(removed) == 2, removed
subs = [rows[i][5] for i in removed]
rows = [r for r in rows if r[0] not in SLUGS]
json.dump(rows, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))

# search index: drop the 2 entries, shift later positions in this list
sp = os.path.join(root, 'data/search.json')
s = json.load(open(sp))
out = []
for name, code, pos in s:
    if code == LIST and pos in removed: continue
    if code == LIST: pos -= sum(1 for r in removed if r < pos)
    out.append([name, code, pos])
assert len(out) == len(s) - 2
json.dump(out, open(sp, 'w'), ensure_ascii=False, separators=(',', ':'))
# check positions still match names
rows_names = [r[1] for r in rows]
for name, code, pos in out:
    if code == LIST: assert rows_names[pos] == name, (name, pos)

# catalogue counts (category, its parent and its sub-category) + new data version
cp = os.path.join(root, 'data/catalogue.js')
txt = open(cp).read()
codes = {LIST, LIST.split('-')[0]} | set(subs)
changed = {}
def dec(m):
    code, n = m.group(1), int(m.group(3))
    if code in codes:
        k = sum(1 for x in subs if x == code) if code not in (LIST, LIST.split('-')[0]) else 2
        changed[code] = (n, n - k); return m.group(0)[: -len(m.group(3))] + str(n - k)
    return m.group(0)
txt = re.sub(r'"code":"([0-9-]+)"(,"[^{}]*?)"count":(\d+)', lambda m: dec(m), txt)
old_ver = re.search(r'"version":"([a-z0-9]+)"', txt).group(1)
txt = txt.replace(f'"version":"{old_ver}"', f'"version":"{old_ver}n2"', 1)
open(cp, 'w').write(txt)
print('removed list positions', removed, 'subs', subs, 'counts', changed, 'version', old_ver, '->', old_ver + 'n2')

# sitemap
smp = os.path.join(root, 'sitemap.xml')
sm = open(smp).read(); n0 = sm.count('<url>')
for slug in SLUGS:
    sm = re.sub(r'\s*<url>\s*<loc>[^<]*/product/' + re.escape(slug) + r'/</loc>.*?</url>', '', sm, flags=re.S)
open(smp, 'w').write(sm); print('sitemap urls', n0, '->', sm.count('<url>'))

# static "N products" tiles on home/category pages
fix = {}
for code, (a, b) in changed.items():
    m = re.search(r'"code":"%s","slug":"([^"]+)","name":"([^"]+)"' % re.escape(code), txt)
    fix[m.group(2)] = (a, b)
for dirpath, _, files in os.walk(root):
    for f in files:
        if not f.endswith('.html'): continue
        fp = os.path.join(dirpath, f); h = open(fp).read(); h0 = h
        for name, (a, b) in fix.items():
            h = h.replace(f'<span class="ctile__name">{name}</span><span class="ctile__n">{a} products</span>', f'<span class="ctile__name">{name}</span><span class="ctile__n">{b} products</span>')
        if h != h0: open(fp, 'w').write(h); print('updated counts in', os.path.relpath(fp, root))

# send old links for the 2 products to the formula category
hp = os.path.join(root, '.htaccess')
ht = open(hp).read()
rule = '  # Removed products (Nov 2026)\n  RewriteRule ^product/(' + '|'.join(SLUGS) + ')/?$ /shop/baby-food-and-formula/ [R=301,L]\n\n'
anchor = '  # Any other shop or product page that no longer exists -> the shop\n'
assert anchor in ht and 'Removed products' not in ht
open(hp, 'w').write(ht.replace(anchor, rule + anchor))
print('htaccess redirect added')
