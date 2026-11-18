import json, re, sys, os, glob
from decimal import Decimal, ROUND_HALF_UP
root, pct = sys.argv[1], Decimal(sys.argv[2])
F = 1 + pct / 100
def up(v):
    return float((Decimal(str(v)) * F).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
def rands(v):  # "R1,224.58"
    return 'R' + '{:,.2f}'.format(v)

# 1. product lists
n = 0; samples = []
for f in sorted(glob.glob(os.path.join(root, 'data/list/*.json'))):
    rows = json.load(open(f))
    for r in rows:
        if isinstance(r[2], (int, float)):
            old = r[2]; r[2] = up(old); n += 1
            if len(samples) < 4: samples.append((r[1], old, r[2]))
    json.dump(rows, open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
print('list prices marked up:', n, samples)

# 2. featured products in catalogue.js (+ new data version so browsers fetch the new lists)
cp = os.path.join(root, 'data/catalogue.js'); t = open(cp).read()
start = t.index('{'); end = t.rstrip().rstrip(';').rindex('}') + 1
j = json.loads(t[start:end]); swap = {}
for p in j['products']:
    for o in p['options']:
        for k in ('price', 'was'):
            if isinstance(o.get(k), (int, float)):
                new = up(o[k]); swap[rands(o[k])] = rands(new); o[k] = new
j['version'] = j['version'] + 'm' + str(pct)
open(cp, 'w').write(t[:start] + json.dumps(j, ensure_ascii=False, separators=(',', ':')) + t[end:])
print('featured products:', len(j['products']), '| data version ->', j['version'])

# 3. prices written into the home page (featured cards and showcase)
hp = os.path.join(root, 'index.html'); h = open(hp).read(); cnt = 0
def rep(m):
    global cnt
    if m.group(0) in swap: cnt += 1; return swap[m.group(0)]
    return m.group(0)
h = re.sub(r'R[0-9][0-9,]*\.[0-9]{2}', rep, h)
open(hp, 'w').write(h)
left = [x for x in re.findall(r'R[0-9][0-9,]*\.[0-9]{2}', h) if x not in swap.values()]
print('home page prices updated:', cnt, '| amounts not from featured products:', left)
