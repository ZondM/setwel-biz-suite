import json, re, sys, os, glob
root = sys.argv[1]
SLUGS = sys.argv[2].split(',')

# 1. data lists: remove rows, remember positions per list
removed = {}  # list code -> sorted positions
items = []    # (slug, list, sub)
for f in sorted(glob.glob(os.path.join(root, 'data/list/*.json'))):
    code = os.path.basename(f)[:-5]
    rows = json.load(open(f))
    pos = [i for i, r in enumerate(rows) if r[0] in SLUGS]
    if not pos: continue
    removed[code] = pos
    items += [(rows[i][0], code, rows[i][5]) for i in pos]
    json.dump([r for r in rows if r[0] not in SLUGS], open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
found = {s for s, _, _ in items}
assert found == set(SLUGS), set(SLUGS) - found
print('removed:', [(s, l, removed[l]) for s, l, _ in items])

# 2. search index: drop entries, shift later positions
sp = os.path.join(root, 'data/search.json')
s = json.load(open(sp)); out = []
for name, code, pos in s:
    rp = removed.get(code)
    if rp and pos in rp: continue
    if rp: pos -= sum(1 for r in rp if r < pos)
    out.append([name, code, pos])
assert len(out) == len(s) - len(SLUGS)
json.dump(out, open(sp, 'w'), ensure_ascii=False, separators=(',', ':'))
for code in removed:  # positions must still point at the right names
    names = [r[1] for r in json.load(open(os.path.join(root, 'data/list', code + '.json')))]
    for name, c, pos in out:
        if c == code: assert names[pos] == name, (name, code, pos)

# 3. catalogue counts: list category, its root, and the item's sub-category
cp = os.path.join(root, 'data/catalogue.js')
txt = open(cp).read()
dec = {}
for _, lst, sub in items:
    for code in {lst, lst.split('-')[0], sub} - {None, ''}:
        dec[code] = dec.get(code, 0) + 1
changed = {}
def repl(m):
    code, slug, n = m.group(1), m.group(2), int(m.group(3))
    if code in dec:
        changed[code] = (slug, n, n - dec[code])
        return m.group(0)[: -len(m.group(3))] + str(n - dec[code])
    return m.group(0)
txt = re.sub(r'"code":"([0-9-]+)","slug":"([^"]+)"[^{}]*?"count":(\d+)', repl, txt)
assert set(changed) == set(dec), (dec, changed)
ver = re.search(r'"version":"([a-z0-9]+)"', txt).group(1)
txt = txt.replace(f'"version":"{ver}"', f'"version":"{ver}p7"', 1)
open(cp, 'w').write(txt)
print('counts:', changed, '| data version', ver, '->', ver + 'p7')

# 4. sitemap
smp = os.path.join(root, 'sitemap.xml'); sm = open(smp).read(); n0 = sm.count('<url>')
for slug in SLUGS:
    sm = re.sub(r'\s*<url>\s*<loc>[^<]*/product/' + re.escape(slug) + r'/</loc>.*?</url>', '', sm, flags=re.S)
open(smp, 'w').write(sm); print('sitemap urls', n0, '->', sm.count('<url>'))

# 5. static "N products" on category tiles (matched by the tile's link)
for dirpath, _, files in os.walk(root):
    for f in files:
        if not f.endswith('.html'): continue
        fp = os.path.join(dirpath, f); h = open(fp).read(); h0 = h
        for code, (slug, a, b) in changed.items():
            h = re.sub(r'(href="/shop/' + re.escape(slug) + r'/"[^>]*>(?:(?!</a>).)*?ctile__n">)' + str(a) + ' products', r'\g<1>' + str(b) + ' products', h, flags=re.S)
        if h != h0: open(fp, 'w').write(h); print('tile counts updated in', os.path.relpath(fp, root))

# 6. redirect old product links to their category
cats = {c: s for c, (s, _, _) in changed.items()}
hp = os.path.join(root, '.htaccess'); ht = open(hp).read()
rules = '  # Removed products (Nov 2026)\n'
for slug, lst, _ in items:
    rules += f'  RewriteRule ^product/{re.escape(slug)}/?$ /shop/{cats[lst]}/ [R=301,L]\n'
anchor = '  # Any other shop or product page that no longer exists -> the shop\n'
assert anchor in ht and 'Removed products' not in ht
open(hp, 'w').write(ht.replace(anchor, rules + '\n' + anchor)); print('redirects added:', len(items))

# 7. nothing else may still mention them
left = []
for dirpath, _, files in os.walk(root):
    for f in files:
        fp = os.path.join(dirpath, f)
        if f == '.htaccess': continue
        try: t = open(fp, encoding='utf-8').read()
        except Exception: continue
        left += [(os.path.relpath(fp, root), s) for s in SLUGS if s in t]
print('leftover references:', left or 'none')
