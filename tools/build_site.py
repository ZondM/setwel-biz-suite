#!/usr/bin/env python3
"""
Builds the static pages of setwelbusiness.co.za into ../website.

Every page shares one header and footer, so they live here once.
Edit the text below, then run:  python3 tools/build_site.py
"""
from pathlib import Path
import html
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "website"
OLD_LEGAL = ROOT / "tools" / "legal"  # terms/refund body HTML carried over from the old site

WHATSAPP = "https://wa.me/27820829050"
PHONE = "082 082 9050"
EMAIL = "support@setwelbusiness.co.za"
WIN_FILE = "/downloads/Setwel-Setup.exe"
MAC_FILE = "/downloads/Setwel-Mac.dmg"

# Prices match the plans inside the app.
PLANS = [
    {
        "id": "hustler", "name": "Hustler", "for": "Spaza shops, hawkers and side hustles",
        "monthly": 59.99, "yearly": 599,
        "features": [
            "Quotes that turn into invoices in one click",
            "Send invoices by WhatsApp or email, PDF attached",
            "Income and expenses by category",
            "VAT worked out at 15% for you",
            "Up to 50 customers and 100 invoices a month",
            "Works with no internet",
        ],
    },
    {
        "id": "grinder", "name": "Grinder", "for": "Growing small businesses and trades",
        "monthly": 199, "yearly": 1990, "popular": True,
        "features": [
            "Everything in Hustler",
            "Unlimited customers and invoices",
            "Suppliers and bills you owe",
            "Who owes you, and who you owe (aged reports)",
            "Profit and loss statement",
            "VAT201 figures ready for eFiling",
            "Tax centre: provisional and income tax estimates, filing calendar",
        ],
    },
    {
        "id": "builder", "name": "Builder", "for": "Established businesses with staff",
        "monthly": 399, "yearly": 3990,
        "features": [
            "Everything in Grinder",
            "We help you load your customers and opening balances",
            "Coming soon, included when released: payroll and stock",
        ],
    },
    {
        "id": "enterprise", "name": "Enterprise", "for": "Larger and multi-branch businesses",
        "monthly": 999, "yearly": 9990,
        "features": [
            "Everything in Builder",
            "Several businesses or branches in one app, with a combined report",
            "Budgets for each expense category",
            "13-week cash-flow forecast",
            "Staff logins: staff can't delete or see profit",
            "Staff laptops: each does quotes and invoices for one business, synced online to yours",
            "Change history: who changed what, and when",
            "Month-end pack for your accountant",
            "Setup and training by a Setwel partner accountant",
        ],
    },
    {
        "id": "accountant_partner", "name": "Accountant Partner", "for": "Accountants and bookkeepers with clients",
        "monthly": 1499, "yearly": None,
        "features": [
            "Unlimited client files in one app",
            "Practice dashboard: every client's VAT and tax deadlines",
            "Clients send you their books in one file",
            "VAT summary for all clients in one table",
            "Your firm's name and logo on client reports",
            "Setup checklist, spreadsheet imports, opening balances",
            "Training manual and trainer notes",
            "Listed on Find an accountant: we send you clients",
            "All Enterprise features, plus a referral code",
        ],
    },
]

PLAN_IDS = ["hustler", "grinder", "builder", "enterprise", "accountant_partner"]
UNLIMITED = "Unlimited*"

# What Setwel does by itself, and on which plans. Used by the Automation page, home page and plan cards.
AUTOMATIONS = [
    ("scan", "📸", "AI receipt scanning",
     "Take a photo of a till slip or supplier invoice. Setwel reads the supplier, date, amount, VAT and category and fills in the expense. You check it and press save.",
     {"hustler": "30 a month", "grinder": "150 a month", "builder": UNLIMITED, "enterprise": UNLIMITED, "accountant_partner": UNLIMITED}),
    ("repeat", "🔁", "Repeating invoices",
     "Rent, retainers, monthly service fees: set it once. On each date Setwel makes the next invoice and puts it on your to-do list, ready to send.",
     dict.fromkeys(PLAN_IDS, True)),
    ("remind", "⏰", "Payment reminders",
     "Overdue invoices come up with the reminder already written: friendly at first, firmer after two and six weeks. Send it by WhatsApp or by email with the invoice attached.",
     dict.fromkeys(PLAN_IDS, True)),
    ("tax", "🗓️", "Tax and VAT deadline alerts",
     "VAT201 and provisional tax dates come up before they're due, with the amount Setwel has worked out. Also a warning when your sales near the VAT registration level.",
     dict.fromkeys(PLAN_IDS, True)),
    ("report", "📊", "Monthly report",
     "At month end Setwel makes a one-page report: sales, expenses, profit, who owes you and what's due. Save it as PDF or send it to your accountant.",
     dict.fromkeys(PLAN_IDS, True)),
    ("bills", "📥", "Bills due reminders",
     "Supplier bills due in the next seven days are listed, so nothing is paid late.",
     {"hustler": False, "grinder": True, "builder": True, "enterprise": True, "accountant_partner": True}),
    ("bank", "🏦", "Bank statement matching",
     "Upload the CSV statement from your bank. Setwel matches payments to your invoices and bills, and learns how you categorise everything else.",
     {"hustler": False, "grinder": False, "builder": True, "enterprise": True, "accountant_partner": True}),
    ("budget", "🚦", "Budget and cash warnings",
     "A warning when spending reaches 80% of a budget, and when the 13-week forecast shows cash running short.",
     {"hustler": False, "grinder": False, "builder": False, "enterprise": True, "accountant_partner": True}),
]
AUTOMATION_FOOTNOTE = "*Unlimited scans are fair use, up to 2 000 a month. The free trial includes 30 scans. Scanning and email need internet; everything else works offline."


def plan_automations(plan_id):
    """Plan-card lines for the automations this plan includes."""
    out = []
    for _, _, name, _, plans in AUTOMATIONS:
        v = plans[plan_id]
        if v is True:
            out.append(name)
        elif v:
            out.append(f"{name}: {v.lower().rstrip('*')}{'*' if v.endswith('*') else ''}")
    return out


NAV = [
    ("index.html", "Home"),
    ("automation.html", "Automation"),
    ("download.html", "Download"),
    ("pricing.html", "Pricing"),
    ("find-an-accountant.html", "Find an accountant"),
    ("accountants.html", "For accountants"),
    ("refer.html", "Refer a friend"),
    ("help.html", "Help"),
    ("contact.html", "Contact"),
]


def rand(amount):
    if amount is None:
        return ""
    if float(amount).is_integer():
        return "R" + f"{int(amount):,}".replace(",", " ")
    return "R" + f"{amount:,.2f}".replace(",", " ")


def page(filename, title, description, body, scripts=""):
    nav = "\n".join(
        f'<a href="/{href}"{" aria-current=\"page\"" if href == filename else ""}>{label}</a>'
        for href, label in NAV
    )
    return f"""<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(description)}">
<link rel="icon" type="image/png" href="/setwel-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<header class="top">
  <div class="wrap">
    <a class="brand" href="/index.html"><img src="/setwel-logo.png" alt="">Setwel <span>Biz Suite</span></a>
    <nav class="nav">
{nav}
    </nav>
  </div>
</header>
<main>
{body}
</main>
<footer class="foot">
  <div class="wrap">
    <div class="cols">
      <div>
        <h4>Setwel Biz Suite</h4>
        <p>Invoicing, accounting, VAT and tax for South African businesses. Made in South Africa.</p>
      </div>
      <div>
        <h4>Get Setwel</h4>
        <ul>
          <li><a href="/download.html">Download for Windows or Mac</a></li>
          <li><a href="/automation.html">Automation and AI receipt scanning</a></li>
          <li><a href="/app/">Open on your phone</a></li>
          <li><a href="/pricing.html">Pricing</a></li>
          <li><a href="/accountants.html">For accountants</a></li>
        </ul>
      </div>
      <div>
        <h4>Help</h4>
        <ul>
          <li><a href="{WHATSAPP}">WhatsApp {PHONE}</a></li>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li><a href="/help.html">Questions and answers</a></li>
          <li><a href="/manual.html">Training manual</a></li>
          <li><a href="/find-an-accountant.html">Find an accountant</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="/terms.html">Terms and conditions</a></li>
          <li><a href="/refund.html">Refunds and cancellations</a></li>
        </ul>
      </div>
    </div>
    <p class="legal">© Setwel Africa (Pty) Ltd. Payments are processed securely by PayFast.</p>
  </div>
</footer>
<a class="wa" href="{WHATSAPP}" aria-label="Chat on WhatsApp">WhatsApp us</a>
<script src="/assets/site.js"></script>
{scripts}
</body>
</html>
"""


DOWNLOAD_BUTTONS = f"""
<div class="btn-row">
  <a class="btn btn-main" data-dl href="/download.html">Download free trial</a>
</div>
<p class="note" data-dl-note>Windows and Mac. On a phone? <a href="/app/">Open Setwel in your browser</a>.</p>
"""


REEL = """<section class="showreel">
  <div class="wrap">
    <video class="reel" autoplay muted loop playsinline preload="auto" poster="/assets/automation-poster.jpg" aria-label="Setwel automation: a receipt scanned by AI, an invoice created and sent on WhatsApp, a reminder that gets an invoice paid, and VAT deadline alerts">
      <source src="/assets/automation.mp4" type="video/mp4">
    </video>
  </div>
</section>"""


def home():
    plans_teaser = "".join(
        f'<div class="card"><h3>{p["name"]}</h3><p>{p["for"]}</p>'
        f'<p style="margin-top:10px;color:var(--ink);font-weight:700">{rand(p["monthly"])} / month</p></div>'
        for p in PLANS
    )
    home_autos = "".join(
        f'<div class="card"><div class="icon">{icon}</div><h3>{name}</h3><p>{desc}</p></div>'
        for _, icon, name, desc, _ in AUTOMATIONS[:4]
    )
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Your business finances, handled with confidence.</h1>
    <p class="lead">Invoicing, accounting, VAT and tax in one simple package for South African businesses, with the routine work automated: receipts scanned by AI, invoices that repeat, reminders written for you and deadlines flagged before they arrive.</p>
    {DOWNLOAD_BUTTONS}
    <p class="note">30 days free. No card, no sign-up form. It installs in about a minute.</p>
  </div>
</div>

{REEL}

<section class="alt">
  <div class="wrap">
    <h2>Setwel does the routine work for you</h2>
    <p class="sub">Paperwork that used to take your evenings now happens by itself, or with one tap.</p>
    <div class="grid g4">{home_autos}</div>
    <div class="feature-strip">
      <div>
        <h3>📸 Snap a receipt. Setwel does the rest.</h3>
        <p>Photograph a till slip, fuel slip or supplier invoice. AI reads the supplier, amount, VAT and category and fills in the expense for you. No more shoebox of slips at year end.</p>
      </div>
      <a class="btn btn-main" href="/automation.html">See all automation</a>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>The load we take off you</h2>
    <p class="sub">Most small business owners don't hate their work. They hate the paperwork that comes with it.</p>
    <div class="before-after">
      <div class="before">
        <h3>Without Setwel</h3>
        <ul>
          <li>Long queues and waiting just to sort out returns and tax questions</li>
          <li>Invoices in a notebook, on WhatsApp and in your head</li>
          <li>Not sure who still owes you money</li>
          <li>Paying someone just to tell you what you made this month</li>
          <li>Panic before every VAT or tax deadline</li>
        </ul>
      </div>
      <div class="after">
        <h3>With Setwel</h3>
        <ul>
          <li>Professional invoices sent from your phone or PC in seconds</li>
          <li>One screen shows money in, money out and who owes you</li>
          <li>VAT201 and tax figures ready to copy onto eFiling</li>
          <li>Tax deadlines in front of you, not in a letter</li>
          <li>An accountant only when you actually need one</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>What Setwel does for you</h2>
    <div class="grid g4">
      <div class="card"><div class="icon">🧾</div><h3>Invoices that chase themselves</h3><p>Send invoices on WhatsApp or email. Repeating invoices create themselves, and Setwel reminds you who to chase, with the message already written.</p></div>
      <div class="card"><div class="icon">💰</div><h3>Your money, in control</h3><p>Snap a receipt and AI fills in the expense. Upload your bank statement and Setwel matches the payments. Your profit and loss is always up to date.</p></div>
      <div class="card"><div class="icon">🏛️</div><h3>Tax and compliance</h3><p>VAT201 figures, provisional tax estimates and alerts before each deadline, plus a monthly report you can send to your accountant.</p></div>
      <div class="card"><div class="icon">🤝</div><h3>An accountant when it matters</h3><p>Do the day-to-day yourself. When something doesn't add up, we connect you with a Setwel partner accountant.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>Up and running in three steps</h2>
    <ol class="steps">
      <li><h3>Download</h3>Click the download button. Setwel picks the right file for your computer.</li>
      <li><h3>Double-click</h3>Open the file you downloaded. Setwel installs itself and opens.</li>
      <li><h3>Send your first invoice</h3>Add your business name and logo, then make your first invoice. Your 30 free days start now.</li>
    </ol>
    <p style="margin-top:20px">Using a phone or tablet? <a href="/app/">Open Setwel in your browser</a>. There's nothing to install.</p>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>Simple prices, in rand</h2>
    <p class="sub">Every plan starts with 30 days free. Pay only if Setwel is making your life easier.</p>
    <div class="grid g3">{plans_teaser}</div>
    <p style="margin-top:20px"><a class="btn btn-green" href="/pricing.html">Compare plans</a></p>
  </div>
</section>

<section>
  <div class="wrap grid g2">
    <div>
      <h2>Refer a business, get a month free</h2>
      <p class="sub">Every paying customer gets a referral code. When a business you refer pays for Setwel, your next month is free. There's no limit.</p>
      <a class="btn btn-plain" href="/refer.html">How referrals work</a>
    </div>
    <div>
      <h2>Are you an accountant?</h2>
      <p class="sub">Run Setwel for all your clients on one partner plan, and get sent Setwel customers who need an accountant.</p>
      <a class="btn btn-plain" href="/accountants.html">The Accountant Partner plan</a>
    </div>
  </div>
</section>
"""
    return page("index.html", "Setwel Biz Suite: invoicing, accounting and tax for South African businesses",
                "Invoicing, accounting, VAT and tax figures for South African small businesses. 30 days free for Windows, Mac and phones.", body)


def automation():
    names = {p["id"]: p["name"] for p in PLANS}
    cards = []
    for sid, icon, name, desc, plans in AUTOMATIONS:
        on = [names[i] + (f" ({v.rstrip('*').lower()})" if isinstance(v, str) else "") for i, v in plans.items() if v]
        where = "Every plan" if all(plans.values()) and not any(isinstance(v, str) for v in plans.values()) else ", ".join(on)
        cards.append(f'<div class="card" id="{sid}"><div class="icon">{icon}</div><h3>{name}</h3><p>{desc}</p>'
                     f'<p class="plans-on">{where}</p></div>')
    head = "".join(f"<th>{names[i]}</th>" for i in PLAN_IDS)
    rows = ""
    for _, _, name, _, plans in AUTOMATIONS:
        cells = "".join(
            f"<td>{'✓' if v is True else (v if v else '–')}</td>" for v in (plans[i] for i in PLAN_IDS))
        rows += f"<tr><th>{name}</th>{cells}</tr>"
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Setwel works while you work.</h1>
    <p class="lead">The routine paperwork of running a business, done for you: receipts captured by AI, invoices that repeat, reminders written for you, and deadlines flagged before they arrive. Included in your plan, not sold as extras.</p>
    {DOWNLOAD_BUTTONS}
  </div>
</div>

{REEL}

<section>
  <div class="wrap">
    <h2>📸 AI receipt scanning</h2>
    <p class="sub">The fastest way to keep your expenses, and your VAT claims, up to date.</p>
    <ol class="steps">
      <li><h3>Snap</h3>In <em>Expenses</em>, press <em>Scan receipt</em> and take a photo of the slip or supplier invoice. A PDF works too.</li>
      <li><h3>Setwel reads it</h3>AI fills in the supplier, date, amount, VAT and category in a few seconds.</li>
      <li><h3>Check and save</h3>You look it over and press save. If a slip is hard to read, Setwel tells you.</li>
    </ol>
    <p style="margin-top:16px;color:var(--muted)">Hustler 30 scans a month, Grinder 150, Builder and up unlimited*. 30 scans during the free trial. Only claim VAT on valid tax invoices.</p>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <h2>Everything Setwel automates</h2>
    <p class="sub">Setwel checks every time you open it and lists what needs you under <strong>Needs your attention</strong> on the dashboard.</p>
    <div class="grid g3">{''.join(cards)}</div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>Automation by plan</h2>
    <div class="table-scroll">
      <table class="compare">
        <thead><tr><th></th>{head}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
    <p style="margin-top:12px;color:var(--muted);font-size:14px">{AUTOMATION_FOOTNOTE}</p>
    <h3 style="margin-top:28px">What stays in your hands</h3>
    <p>Setwel never sends anything or pays anyone without you. Repeating invoices are made as drafts for you to send. WhatsApp messages are typed for you and you press send. Email goes out only when you press <em>Send</em>. You always have the final say.</p>
    <div class="btn-row" style="margin-top:18px">
      <a class="btn btn-green" href="/pricing.html">See plans and prices</a>
      <a class="btn btn-plain" data-dl data-keep-text href="/download.html">Try it free for 30 days</a>
    </div>
  </div>
</section>
"""
    return page("automation.html", "Automation: AI receipt scanning, repeating invoices and reminders | Setwel Biz Suite",
                "Setwel scans receipts with AI, creates repeating invoices, writes payment reminders, flags VAT and tax deadlines and matches your bank statement.", body)


def download():
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Download Setwel Biz Suite</h1>
    <p class="lead">Free for 30 days. No card and no sign-up form. Pick your device below.</p>
  </div>
</div>
<section>
  <div class="wrap">
    <div class="dl">
      <div class="card" data-os="windows">
        <h3>Windows</h3>
        <p class="meta">Windows 10 and 11</p>
        <a class="btn btn-main btn-wide" href="{WIN_FILE}" download>Download for Windows</a>
        <ol>
          <li>Open <strong>Setwel-Setup.exe</strong> from your Downloads.</li>
          <li>Setwel installs itself and opens. A shortcut goes on your desktop.</li>
        </ol>
        <div class="advice">
          <strong>If Windows says "Windows protected your PC":</strong>
          <ol><li>Click <strong>More info</strong>.</li><li>Click <strong>Run anyway</strong>.</li></ol>
        </div>
      </div>
      <div class="card" data-os="mac">
        <h3>Mac</h3>
        <p class="meta">macOS 12 or newer, Intel and Apple chips</p>
        <a class="btn btn-main btn-wide" href="{MAC_FILE}" download>Download for Mac</a>
        <ol>
          <li>Open <strong>Setwel-Mac.dmg</strong> from your Downloads.</li>
          <li>Drag the Setwel icon onto the <strong>Applications</strong> folder.</li>
          <li>Open Setwel from Applications.</li>
        </ol>
        <div class="advice">
          <strong>If your Mac says Apple "could not verify" Setwel:</strong>
          <ol><li>Click <strong>Done</strong>.</li><li>Open <strong>System Settings → Privacy &amp; Security</strong>.</li><li>Scroll down and click <strong>Open Anyway</strong>, then enter your Mac password.</li></ol>
          You only do this once.
        </div>
      </div>
      <div class="card" data-os="phone">
        <h3>Phone or tablet</h3>
        <p class="meta">Android and iPhone. There's nothing to download.</p>
        <a class="btn btn-green btn-wide" href="/app/">Open Setwel in your browser</a>
        <ol>
          <li>Tap the button above.</li>
          <li>Add it to your home screen. On Android: menu ⋮ → <strong>Add to Home screen</strong>. On iPhone: Share → <strong>Add to Home Screen</strong>.</li>
        </ol>
      </div>
    </div>

    <div class="advice" style="margin-top:28px">
      <strong>Why might I see a warning?</strong> Windows and Mac show this message for any app that isn't registered in Microsoft's and Apple's paid publisher programmes. Setwel isn't registered with them yet. The app is safe, and your business data stays on your own computer. The steps above take about 10 seconds. If you get stuck, <a href="{WHATSAPP}">WhatsApp us on {PHONE}</a> and we'll talk you through it.
    </div>
  </div>
</section>
<section class="alt">
  <div class="wrap">
    <h2>After your 30 days</h2>
    <p class="sub">Setwel shows you a reminder a week before your trial ends. Choose a plan and pay securely with PayFast. You get a licence key by email and on screen, and one click unlocks the app. Nothing you captured is lost.</p>
    <a class="btn btn-green" href="/pricing.html">See plans</a>
  </div>
</section>
"""
    return page("download.html", "Download Setwel Biz Suite for Windows, Mac and phone",
                "Download the Setwel Biz Suite 30-day free trial for Windows or Mac, or open it on your phone.", body)


def pricing():
    cards = []
    for p in PLANS:
        yearly = (
            f'<div data-yearly hidden><div class="price">{rand(p["yearly"])}</div><div class="per">per year, about two months free</div></div>'
            if p["yearly"] else
            '<div data-yearly hidden><div class="price">' + rand(p["monthly"]) + '</div><div class="per">per month, monthly billing only</div></div>'
        )
        feats = "".join(f"<li>{f}</li>" for f in p["features"])
        autos = "".join(f"<li>{a}</li>" for a in plan_automations(p["id"]))
        cards.append(f"""
<div class="plan{' pop' if p.get('popular') else ''}">
  <h3>{p['name']}</h3>
  <div class="for">{p['for']}</div>
  <div data-monthly><div class="price">{rand(p['monthly'])}</div><div class="per">per month</div></div>
  {yearly}
  <div class="auto-box"><strong>Automation included</strong><ul>{autos}</ul></div>
  <ul>{feats}</ul>
  <a class="btn btn-green" data-buy="{p['id']}" href="/pay.html?plan={p['id']}&amp;billing=monthly">Buy {p['name']}</a>
  <a class="btn btn-plain" data-dl data-keep-text href="/download.html">Try free for 30 days</a>
</div>""")
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Pricing</h1>
    <p class="lead">Every plan starts with 30 days free. Prices include VAT. Cancel any time on WhatsApp.</p>
  </div>
</div>
<section>
  <div class="wrap">
    <div class="toggle" role="group" aria-label="Billing">
      <button type="button" class="on" data-billing="monthly">Monthly</button>
      <button type="button" data-billing="yearly">Yearly (2 months free)</button>
    </div>
    <div class="plans">{''.join(cards)}</div>
    <p style="margin-top:12px;color:var(--muted);font-size:14px">{AUTOMATION_FOOTNOTE}</p>
    <p style="margin-top:12px"><a href="/automation.html">What each automation does</a></p>
    <p style="margin-top:24px;color:var(--muted)">Payments go through PayFast: card, Instant EFT, SnapScan, Capitec Pay and more. Not sure which plan fits? <a href="{WHATSAPP}">WhatsApp us</a> and we'll tell you honestly.</p>
  </div>
</section>
"""
    return page("pricing.html", "Setwel Biz Suite pricing",
                "Setwel Biz Suite plans from R59.99 a month. 30 days free on every plan.", body)


def pay():
    plans_json = json.dumps({p["id"]: {"name": p["name"], "monthly": p["monthly"], "yearly": p["yearly"]} for p in PLANS})
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Buy Setwel</h1>
    <p class="lead">Fill this in once. You'll pay on PayFast's secure page, then get your licence key straight away.</p>
  </div>
</div>
<section>
  <div class="wrap">
    <form class="box" id="payForm" method="get" action="/api/create-payment.php">
      <div class="summary" id="summary">Loading plan…</div>
      <input type="hidden" name="plan" id="plan">
      <input type="hidden" name="billing" id="billing">
      <label for="first">First name</label>
      <input id="first" name="first" required autocomplete="given-name">
      <label for="last">Surname</label>
      <input id="last" name="last" autocomplete="family-name">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email">
      <div class="hint">We'll send your licence key here.</div>
      <label for="phone">Cellphone / WhatsApp</label>
      <input id="phone" name="phone" type="tel" required autocomplete="tel">
      <label for="biz">Business name (optional)</label>
      <input id="biz" name="biz" autocomplete="organization">
      <label for="ref">Referral code (optional)</label>
      <input id="ref" name="ref" placeholder="e.g. REF-AB12CD">
      <div class="hint">Someone told you about Setwel? Their code gets them a free month.</div>
      <p><button class="btn btn-main btn-wide" type="submit">Continue to secure payment</button></p>
      <p class="hint">By paying you agree to our <a href="/terms.html">terms</a> and <a href="/refund.html">refund policy</a>.</p>
    </form>
  </div>
</section>
"""
    script = f"<script>window.SETWEL_PLANS = {plans_json};</script>"
    return page("pay.html", "Buy Setwel Biz Suite", "Pay for Setwel Biz Suite securely with PayFast.", body, script)


def thank_you():
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Thank you. Your payment is being confirmed.</h1>
    <p class="lead">This usually takes under a minute. Keep this page open.</p>
  </div>
</div>
<section>
  <div class="wrap" style="max-width:720px">
    <div id="waiting">
      <p>Waiting for PayFast to confirm your payment…</p>
    </div>
    <div id="ready" hidden>
      <h2>Your licence key</h2>
      <div class="keybox" id="key"></div>
      <p class="hint">We've also emailed it to you. Keep it safe.</p>
      <h3 style="margin-top:28px">Unlock Setwel on this computer</h3>
      <p><a class="btn btn-green" id="activateLink" href="#">Activate Setwel now</a></p>
      <p class="hint">Your browser may ask to open Setwel. Click <strong>Open</strong>. If nothing happens, open Setwel, go to <strong>Licence → Enter licence key</strong> and paste the key above.</p>
      <p>Don't have Setwel installed yet? <a href="/download.html">Download it here</a>. On a phone, <a href="/app/">open it here</a> and enter the key when asked.</p>
      <h3 style="margin-top:28px">Your referral code: <span id="refCode"></span></h3>
      <p>Share it with other business owners. When they pay, your next month is free.</p>
      <p><a class="btn btn-plain" id="shareWa" href="#">Share on WhatsApp</a></p>
    </div>
    <div id="slow" hidden class="advice">
      <strong>It's taking longer than usual.</strong> Your payment is safe. Your key will arrive by email within a few minutes. If it doesn't, <a href="{WHATSAPP}">WhatsApp us on {PHONE}</a>.
    </div>
  </div>
</section>
"""
    return page("thank-you.html", "Thank you | Setwel Biz Suite", "Your Setwel Biz Suite licence.", body)


def accountants():
    partner = next(p for p in PLANS if p["id"] == "accountant_partner")
    feats = "".join(f"<li>{f}</li>" for f in partner["features"])
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Accountant Partner</h1>
    <p class="lead">Run all your clients' books in one app, offer Setwel setup and training as a paid service, and get new clients sent to you.</p>
    <div class="btn-row"><a class="btn btn-main" href="/pay.html?plan=accountant_partner&amp;billing=monthly">Become a partner: {rand(partner['monthly'])} / month</a></div>
    <p class="note">Includes a 30-day free trial of the app. <a href="{WHATSAPP}">Talk to us first</a></p>
  </div>
</div>
<section>
  <div class="wrap grid g2">
    <div>
      <h2>What you get in the app</h2>
      <ul>
        <li><strong>All your clients in one place.</strong> Switch between client files from the top bar; each client's books stay separate.</li>
        <li><strong>Practice dashboard.</strong> Every client's next VAT201 and provisional tax date, the estimated amount, money owed to them, and when their file was last updated.</li>
        <li><strong>Books arrive in one file.</strong> Your client presses "Send to my accountant". You import the file and their records are up to date. Send it back the same way after you've made corrections.</li>
        <li><strong>VAT summary for all clients</strong>, exported to a spreadsheet in one click.</li>
        <li><strong>Your brand.</strong> Your firm's name and logo on the reports you prepare, and "Books kept with your firm" on your clients' invoices.</li>
      </ul>
    </div>
    <div class="card">
      <h3>The partner plan includes</h3>
      <ul>{feats}</ul>
    </div>
  </div>
</section>
<section class="alt">
  <div class="wrap grid g2">
    <div>
      <h2>Offer setup and training</h2>
      <p class="sub">Many businesses want someone to set Setwel up and show them how to use it. As a partner you do that, and charge for it.</p>
      <ul>
        <li><strong>Setup checklist</strong> in the app: business details, VAT, banking, customers and suppliers from a spreadsheet, opening balances, staff logins.</li>
        <li><strong>Training manual</strong> written by Setwel, with a version for each type of business, plus trainer notes: a session plan, practice exercises and a sign-off checklist.</li>
        <li><strong>Leads from us.</strong> Businesses that ask for setup and training on our website are sent to listed partners.</li>
      </ul>
      <p><a class="btn btn-plain" href="/manual.html">Read the training manual</a></p>
    </div>
    <div>
      <h2>How it works</h2>
      <ol class="steps" style="grid-template-columns:1fr">
        <li><h3>Join</h3>Pay for the partner plan. You get your partner key and referral code by email, and we list you on Find an accountant.</li>
        <li><h3>Set up your clients</h3>Add each client in your app, or set Setwel up on their computer with the setup checklist.</li>
        <li><h3>Train and grow</h3>Train clients with the manual. Every client who pays with your code earns you a free month.</li>
      </ol>
    </div>
  </div>
</section>
"""
    return page("accountants.html", "Accountant Partner plan | Setwel Biz Suite",
                "Setwel for accountants and bookkeepers: all your clients in one app, setup and training tools, and new clients sent to you.", body)


def manual():
    """The public sign-in page. The manual itself goes to api/private/ (see manual_private)."""
    import sys
    sys.path.insert(0, str(ROOT / "tools"))
    from manual import manual_gate_body
    return page("manual.html", "Setwel training manual", "Step-by-step training manual for Setwel Biz Suite, for paying customers and partner accountants.", manual_gate_body())


def manual_private():
    """Subscriber-only files that website/manual.php fills in and serves after checking the licence key."""
    from manual import manual_body, trainer_notes
    private = OUT / "api" / "private"
    private.mkdir(exist_ok=True)
    (private / ".htaccess").write_text("# Subscriber-only content. Served by /manual.php, never directly.\nRequire all denied\n", encoding="utf-8")
    (private / "manual-page.html").write_text(
        page("manual.html", "Setwel training manual", "Setwel training manual", manual_body()), encoding="utf-8")
    (private / "manual-trainers.html").write_text(trainer_notes(), encoding="utf-8")
    (private / "manual-gate.html").write_text(manual(), encoding="utf-8")


def find_accountant():
    provinces = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"]
    opts = "".join(f"<option>{p}</option>" for p in provinces)
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Find an accountant</h1>
    <p class="lead">Setwel partner accountants set Setwel up for your business, train you and your staff, and help when the numbers don't add up.</p>
  </div>
</div>
<section>
  <div class="wrap">
    <div class="btn-row" style="margin-bottom:18px">
      <label for="pf-prov" style="margin:0">Province</label>
      <select id="pf-prov" style="max-width:260px"><option value="">All provinces</option>{opts}</select>
    </div>
    <div id="partner-list" class="grid g3"><p>Loading partner accountants…</p></div>
  </div>
</section>
<section class="alt">
  <div class="wrap grid g2">
    <div>
      <h2>Ask for setup and training</h2>
      <p class="sub">Tell us what you need. A partner accountant near you, or our team, will contact you within one business day.</p>
      <ul>
        <li><strong>Setup:</strong> your business details, VAT, banking, customers, suppliers and what people owe you, loaded for you.</li>
        <li><strong>Training:</strong> a session for you and your staff, using the Setwel training manual for your type of business.</li>
        <li><strong>Ongoing help:</strong> monthly bookkeeping, VAT201 and tax returns.</li>
      </ul>
      <p>Setup and training are included in the <a href="/pricing.html">Enterprise plan</a>. On other plans, the partner quotes you directly.</p>
    </div>
    <form class="box" id="partnerForm">
      <label for="rq-biz">Business name</label><input id="rq-biz" name="business">
      <label for="rq-name">Your name</label><input id="rq-name" name="name" required>
      <label for="rq-phone">Cellphone / WhatsApp</label><input id="rq-phone" name="phone" type="tel">
      <label for="rq-email">Email</label><input id="rq-email" name="email" type="email">
      <label for="rq-prov">Province</label><select id="rq-prov" name="province">{opts}</select>
      <label for="rq-need">What do you need?</label>
      <select id="rq-need" name="need"><option>Setup and training</option><option>Training only</option><option>Monthly bookkeeping</option><option>VAT and tax returns</option><option>Something else</option></select>
      <label for="rq-partner">Preferred partner (optional)</label><select id="rq-partner" name="partner"><option value="">Any partner near me</option></select>
      <label for="rq-msg">Anything else?</label><textarea id="rq-msg" name="message" rows="3" style="width:100%;padding:12px;font-size:16px;border:1px solid #d6ccc2;border-radius:6px"></textarea>
      <p><button class="btn btn-main btn-wide" type="submit">Send request</button></p>
      <p class="hint" id="rq-result"></p>
    </form>
  </div>
</section>
<section>
  <div class="wrap">
    <h2>Are you an accountant or bookkeeper?</h2>
    <p class="sub">Join as a Setwel partner: all your clients in one app, the setup and training tools, and a listing on this page.</p>
    <a class="btn btn-green" href="/accountants.html">The Accountant Partner plan</a>
  </div>
</section>
"""
    return page("find-an-accountant.html", "Find a Setwel partner accountant", "Find an accountant who sets up Setwel, trains your staff and helps with VAT and tax.", body)


def refer():
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Refer a business, get a month free</h1>
    <p class="lead">You know other business owners stuck with the same paperwork. Send them to Setwel. When they pay, your next month is on us.</p>
  </div>
</div>
<section>
  <div class="wrap">
    <ol class="steps">
      <li><h3>Find your code</h3>It's in your licence email and on the page you saw after paying. It looks like REF-AB12CD.</li>
      <li><h3>Share it</h3>Send it on WhatsApp with a link to setwelbusiness.co.za.</li>
      <li><h3>They pay, you save</h3>When they enter your code at checkout and pay, we credit you one free month. There's no limit.</li>
    </ol>
    <p style="margin-top:22px">Lost your code? <a href="{WHATSAPP}">WhatsApp us</a> with the email you paid with.</p>
  </div>
</section>
"""
    return page("refer.html", "Refer a friend | Setwel Biz Suite", "Get a free month of Setwel for every business you refer.", body)


FAQ = [
    ("Do I need to sign up to try Setwel?",
     "No. Download it, double-click and start working. Your 30-day trial starts the first time you open it. You only give your details if you decide to pay."),
    ("Does Setwel replace my accountant?",
     "For the day-to-day, yes: invoices, expenses, who owes you, VAT and tax estimates. For year-end, audits, disputes or anything that doesn't add up, use an accountant. We can connect you with a Setwel partner accountant."),
    ("Does Setwel submit my tax returns for me?",
     "Not yet. Setwel prepares your VAT201 and tax figures so you can copy them onto eFiling yourself in a few minutes, without queuing at a branch."),
    ("How does the receipt scanning work?",
     "Take a photo of a till slip or invoice, or upload a PDF. Setwel reads the supplier, date, amount and VAT and fills in the expense for you to check. The photo is sent securely to be read, then deleted from our server; your copy stays on your device. Each plan includes a number of scans a month."),
    ("Does Setwel connect to my bank?",
     "Not directly. Download your statement as a CSV file from your online banking and upload it on the Bank matching page (Builder plan and up). Setwel matches payments to your invoices and suggests categories for the rest, and learns from your choices."),
    ("Where is my data kept?",
     "On the Windows or Mac version, your data stays in a file on your own computer, and Setwel makes a backup copy every day (File → Open backups folder). On a phone, it's kept inside your browser on that phone. We don't see your business data."),
    ("Why does Windows or Mac show a warning when I install?",
     "Because Setwel isn't yet registered in Microsoft's and Apple's paid publisher programmes. The download page shows the two or three clicks to get past it."),
    ("What happens when my 30 days end?",
     "Setwel asks you to choose a plan. Pay with PayFast, and your licence key is shown on screen and emailed to you. Click Activate and you carry on exactly where you left off. Your data is never deleted."),
    ("How do I cancel?",
     f"WhatsApp us on {PHONE} or email {EMAIL}. Monthly plans run to the end of the month you've paid for. See the refund policy for yearly plans."),
    ("I have a Mac. Does it work?",
     "Yes. Download the Mac file (.dmg), drag Setwel into Applications, and open it. It works on Intel and Apple-chip Macs."),
]


def help_page():
    items = "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in FAQ)
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Help</h1>
    <p class="lead">Short answers to what people ask most. Still stuck? <a href="{WHATSAPP}">WhatsApp {PHONE}</a>.</p>
  </div>
</div>
<section>
  <div class="wrap" style="max-width:820px">{items}</div>
</section>
"""
    return page("help.html", "Help | Setwel Biz Suite", "Answers to common questions about Setwel Biz Suite.", body)


def contact():
    body = f"""
<div class="band">
  <div class="wrap">
    <h1>Contact us</h1>
    <p class="lead">Real people in South Africa. WhatsApp is fastest.</p>
  </div>
</div>
<section>
  <div class="wrap grid g3">
    <div class="card"><h3>WhatsApp</h3><p><a href="{WHATSAPP}">{PHONE}</a></p></div>
    <div class="card"><h3>Email</h3><p><a href="mailto:{EMAIL}">{EMAIL}</a></p></div>
    <div class="card"><h3>Offices</h3><p>124 Adderley Street, Constitution House, Cape Town, 8001<br>Snathing, Edendale, Pietermaritzburg, 3201</p></div>
  </div>
</section>
"""
    return page("contact.html", "Contact | Setwel Biz Suite", "Contact Setwel Biz Suite on WhatsApp or email.", body)


def not_found():
    body = """
<div class="band"><div class="wrap"><h1>That page isn't here</h1><p class="lead">It may have moved when we rebuilt the site.</p>
<div class="btn-row"><a class="btn btn-main" href="/download.html">Download Setwel</a><a class="btn btn-plain" href="/index.html">Home</a></div></div></div>
"""
    return page("404.html", "Page not found | Setwel Biz Suite", "Page not found.", body)


def legal(name, title):
    src = (OLD_LEGAL / f"{name}.html").read_text(encoding="utf-8")
    body = f'<section><div class="wrap legal-page" style="max-width:860px">{src}</div></section>'
    return page(f"{name}.html", f"{title} | Setwel Biz Suite", title, body)


def web_app():
    """Copy the built app to website/app for phones, with the trial/licence check added."""
    dest = OUT / "app"
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(ROOT / "app", dest, ignore=shutil.ignore_patterns("sw.js"))
    shutil.copy(ROOT / "app" / "sql-wasm.wasm", OUT / "sql-wasm.wasm")  # the app loads it from the site root

    index = (dest / "index.html").read_text(encoding="utf-8")
    index = index.replace('<script type="module"', '<script src="/assets/app-gate.js"></script>\n    <script type="module"', 1)
    (dest / "index.html").write_text(index, encoding="utf-8")

    manifest = json.loads((dest / "manifest.json").read_text(encoding="utf-8"))
    manifest["start_url"] = "/app/"
    manifest["scope"] = "/app/"
    for icon in manifest["icons"]:
        icon["src"] = "/app/" + icon["src"].lstrip("./")
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main():
    pages = {
        "index.html": home(),
        "automation.html": automation(),
        "download.html": download(),
        "pricing.html": pricing(),
        "pay.html": pay(),
        "thank-you.html": thank_you(),
        "accountants.html": accountants(),
        "refer.html": refer(),
        "find-an-accountant.html": find_accountant(),
        "manual.html": manual(),
        "help.html": help_page(),
        "contact.html": contact(),
        "404.html": not_found(),
        "terms.html": legal("terms", "Terms and Conditions"),
        "refund.html": legal("refund", "Refund and Cancellation Policy"),
    }
    for name, content in pages.items():
        (OUT / name).write_text(content, encoding="utf-8")
    manual_private()
    web_app()
    print("Built", len(pages), "pages and the phone app into", OUT)


if __name__ == "__main__":
    main()
