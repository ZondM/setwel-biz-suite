"""Builds START-HERE.html (all guides on one page) from the docs/*.md files.
Run:  python3 build-guides-html.py   (needs: pip install markdown)"""
import markdown, re

files = ['0-START-HERE', '1-INSTALL-ON-REGISTERDOMAIN', '2-MONTHLY-UPDATE-GUIDE', '3-LAUNCH-CHECKLIST', '4-COSTS-AND-LIMITS']
ids = ['start', 'install', 'monthly', 'launch', 'costs']
names = ['Start here', '1. Install on registerdomain', '2. Monthly updates', '3. Launch checklist', '4. Costs & limits']
anchor = {f + '.md': '#' + i for f, i in zip(files, ids)}


def prepare(text):
    out, prev = [], ''
    for line in text.split('\n'):
        line = re.sub(r'^ {2,3}([-*] |\d+\. )', r'    \1', line)   # nested lists need 4 spaces
        line = line.replace('- [ ]', '- ☐')
        is_item = bool(re.match(r'^\s*([-*] |\d+\. )', line))
        prev_item = bool(re.match(r'^\s*([-*] |\d+\. )', prev))
        if is_item and prev.strip() and not prev_item and not prev.startswith('    '):
            out.append('')                                       # blank line before a list
        out.append(line)
        prev = line
    return '\n'.join(out)


sections = ''
for f, i in zip(files, ids):
    h = markdown.markdown(prepare(open(f'docs/{f}.md', encoding='utf-8').read()), extensions=['tables', 'fenced_code', 'sane_lists'])
    for md, a in anchor.items():
        h = h.replace(f'href="docs/{md}"', f'href="{a}"').replace(f'href="{md}"', f'href="{a}"')
    sections += f'<section id="{i}">{h}<p class="top"><a href="#">↑ Back to top</a></p></section>\n'
nav = ''.join(f'<a href="#{i}">{n}</a>' for i, n in zip(ids, names))
css = """:root{--navy:#1a2f45;--gold:#c9a84c}*{box-sizing:border-box}
body{margin:0;font-family:system-ui,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1d2733;background:#f3f5f8}
header{background:var(--navy);padding:16px;position:sticky;top:0;z-index:2}
header .t{margin:0 0 8px;font-size:1.3rem;font-weight:800;color:#fff}header .t span{color:var(--gold)}
nav{display:flex;flex-wrap:wrap;gap:6px}nav a{color:#fff;background:rgba(255,255,255,.1);padding:5px 10px;border-radius:6px;text-decoration:none;font-size:.9rem}nav a:hover{background:var(--gold);color:var(--navy)}
main{max-width:880px;margin:0 auto;padding:16px}
section{background:#fff;border:1px solid #e3e7ec;border-radius:10px;padding:8px 26px 18px;margin:20px 0;scroll-margin-top:120px}
h1,h2,h3{color:var(--navy)}section h1{border-bottom:3px solid var(--gold);padding-bottom:6px}
table{border-collapse:collapse;width:100%;font-size:.93rem}th,td{border:1px solid #e3e7ec;padding:7px 9px;text-align:left;vertical-align:top}th{background:#f7f5f0}
code{background:#f0f2f5;padding:1px 5px;border-radius:4px}blockquote{border-left:4px solid var(--gold);margin:0;padding:4px 14px;background:#fbf7ec}
li{margin:4px 0}.top{text-align:right;font-size:.85rem}a{color:#2c4a6e}
@media print{header{position:static}}"""
page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setwel Africa store — guides</title><style>{css}</style></head><body>
<header><p class="t">SETWEL AFRICA <span>online store — guides</span></p><nav>{nav}</nav></header><main>{sections}</main></body></html>"""
open('START-HERE.html', 'w', encoding='utf-8').write(page)
print('Built START-HERE.html')
