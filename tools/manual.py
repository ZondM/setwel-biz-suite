"""
The Setwel training manual (website/manual.html).

Written for business owners and staff, and for Setwel partner accountants who set
businesses up and train them. Only describes what the app really does.
Each section is (id, title, html). Edit the text here, then run tools/build_site.py.
"""

USING = [
    ("start", "1. Getting started", """
<p><strong>On a computer:</strong> download Setwel from <a href="/download.html">setwelbusiness.co.za/download.html</a> and double-click the file. Windows may say "Windows protected your PC": click <em>More info</em>, then <em>Run anyway</em>. On a Mac, drag Setwel into Applications; if the Mac says it can't verify Setwel, open <em>System Settings → Privacy &amp; Security</em> and click <em>Open Anyway</em>.</p>
<p><strong>On a phone:</strong> open <a href="/app/">setwelbusiness.co.za/app</a> and add it to your home screen.</p>
<ol>
  <li>Press <em>Get started</em>, choose a plan to try, and fill in your business name, type and province.</li>
  <li>The 30-day free trial starts now. No card is needed.</li>
  <li>Open <em>Setup checklist</em> in the menu and work through it from top to bottom. It shows what's done and what's left.</li>
</ol>
<div class="tip"><strong>Where is my data?</strong> On a computer, in a file on that computer, with a backup copy every day (<em>File → Open backups folder</em>). On a phone, inside the browser on that phone. Clearing the browser's data deletes it, so send your books to yourself or your accountant regularly (section 11).</div>
"""),
    ("people", "2. Customers and suppliers", """
<ol>
  <li><em>Customers → Add customer</em>. Add a cellphone number to send invoices and reminders on WhatsApp, and an email to send them by email.</li>
  <li>If the customer is VAT registered, tick it and add their VAT number. It prints on their tax invoices.</li>
  <li>Suppliers (Grinder plan and up) work the same way, under <em>Suppliers</em>.</li>
</ol>
<p><strong>Many customers already in Excel?</strong> In the Setup checklist, press <em>Template</em> next to Customers, paste your list into it, save it as CSV, and press <em>Load customers</em>.</p>
"""),
    ("invoices", "3. Quotes, invoices and payments", """
<ol>
  <li><em>Quotes → New quote</em>. Add lines (description, quantity, price). VAT at 15% is added if you are VAT registered.</li>
  <li>When the customer agrees, open the quote and turn it into an invoice.</li>
  <li>Or go straight to <em>Invoices → New invoice</em>.</li>
  <li>Open the invoice and press <em>Send</em>. Choose WhatsApp (Setwel types the message, you press send) or Email (Setwel sends it with the PDF attached, and replies come to your email address).</li>
  <li>When money comes in, open the invoice and press <em>Record payment</em>. Part-payments are fine: the invoice shows as part-paid until it's settled.</li>
</ol>
<div class="tip"><strong>Cash sale with no customer?</strong> Add a customer called "Cash sales" and make an invoice to it, then record the payment as cash.</div>
"""),
    ("automation", "4. Repeating invoices, reminders and Needs your attention", """
<p>The dashboard's <strong>Needs your attention</strong> list is Setwel's to-do list for you. It checks every time you open the app.</p>
<ul>
  <li><strong>Repeating invoices:</strong> open an invoice, press <em>Repeat</em>, choose how often (every week, month, 3 months or year). On each date Setwel makes the next invoice as a draft and lists it under Needs your attention, ready to send.</li>
  <li><strong>Reminders:</strong> when an invoice is overdue, it appears with <em>Send reminder</em>. The message is written for you: friendly at first, firmer after two weeks and after six weeks. A reminder shows again a week after the last one.</li>
  <li>Also listed: supplier bills due this week, VAT201 and provisional tax deadlines, budget warnings, cash running short, bank lines to check, and your monthly report.</li>
</ul>
"""),
    ("expenses", "5. Expenses and receipt scanning", """
<ol>
  <li><em>Expenses → Scan receipt</em>. Take a photo of the slip or invoice, or choose a PDF.</li>
  <li>Setwel reads the supplier, date, amount, VAT and category and fills in the form. <strong>Check every field</strong>, then press <em>Save expense</em>. If the slip was hard to read, Setwel tells you.</li>
  <li>No slip? Press <em>Record expense</em> and type it in.</li>
  <li>Only claim VAT if the slip is a valid tax invoice from a VAT-registered supplier.</li>
</ol>
<p>Scans per month: Hustler 30, Grinder 150, Builder and up unlimited; 30 during the free trial. Scanning needs internet.</p>
<div class="tip"><strong>Cost of sales or operating expense?</strong> Stock and materials you resell or build into jobs are "cost of sales". Rent, fuel, airtime and fees are operating expenses. This decides your gross profit.</div>
"""),
    ("bills", "6. Supplier bills (Grinder and up)", """
<p>Use <em>Bills</em> for supplier invoices you pay later. Enter the bill when it arrives and mark it paid when you pay. Setwel reminds you of bills due within a week, and the input VAT counts in your VAT201.</p>
"""),
    ("bank", "7. Bank statement matching (Builder and up)", """
<ol>
  <li>In your banking app or online banking, download your transactions as a <strong>CSV</strong> file (FNB, ABSA, Standard Bank, Nedbank, Capitec and most others offer this).</li>
  <li>In Setwel, <em>Bank matching → Upload statement</em>. Lines already imported before are skipped.</li>
  <li>Money in is matched to unpaid invoices by amount, invoice number and customer name. Money out is matched to expenses and bills, or Setwel suggests a category.</li>
  <li>Press <em>Accept sure matches</em>, then go through the rest: <em>Confirm</em>, choose a category and <em>Add expense</em>, or hide transfers between your own accounts.</li>
  <li>Setwel remembers your categories: next month the same supplier is categorised for you.</li>
</ol>
"""),
    ("reports", "8. Reports", """
<ul>
  <li><strong>Monthly report:</strong> invoiced, received, expenses, profit and who owes you. Download the PDF or send it on WhatsApp or by email.</li>
  <li><strong>Profit &amp; Loss</strong> for any period, <strong>VAT201</strong> for any VAT period, <strong>Aged debtors</strong> (who owes you, and how late) and <strong>Aged creditors</strong>.</li>
  <li><strong>Month-end pack</strong> (Enterprise and up): one ZIP with the month's invoices, payments, expenses, bills, VAT and the monthly report, for your accountant.</li>
</ul>
"""),
    ("tax", "9. Tax centre and deadlines", """
<p>The Tax centre estimates provisional tax and income tax from your records, and shows the VAT201 figures to copy onto eFiling. Setwel does not submit returns for you.</p>
<ul>
  <li><strong>VAT201:</strong> due by the last business day of the month after your VAT period. Set your VAT period (and which months it ends in) under <em>Settings → Company</em> so Setwel can remind you.</li>
  <li><strong>Provisional tax:</strong> first payment by 31 August, second by the end of February (for a February year-end).</li>
  <li>Not VAT registered? Setwel warns you as your sales over 12 months get close to R1 million.</li>
</ul>
<div class="tip">Tax figures are estimates from what is captured in Setwel. Check them with your accountant before you submit or pay.</div>
"""),
    ("enterprise", "10. Enterprise: several businesses, budgets, cash flow, staff", """
<ul>
  <li><strong>Several businesses or branches:</strong> click the business name at the top, then <em>Add a business or branch</em>. Switch the same way. <em>Reports → All businesses together</em> adds them up.</li>
  <li><strong>Budgets:</strong> set a monthly amount per expense category. Setwel warns you at 80% and when you go over.</li>
  <li><strong>Cash-flow forecast:</strong> enter today's bank balance. Setwel shows the next 13 weeks from unpaid invoices, bills, repeating invoices and your average spending, and warns if cash may run short.</li>
  <li><strong>Staff logins:</strong> <em>Settings → Staff logins</em>. Add yourself as owner first, then your staff, each with their own PIN. Staff can quote, invoice, record payments and expenses and send reminders. They can't delete anything or see profit, reports, tax, bank matching or settings.</li>
  <li><strong>Change history:</strong> every invoice, payment, expense, bill, quote, customer and supplier change, with who did it and when.</li>
</ul>
"""),
    ("accountant", "11. Working with your accountant", """
<ol>
  <li>Add your accountant under <em>Settings → My accountant</em>.</li>
  <li>Press <em>Send to accountant</em> in the menu, then <em>Email the file</em> (or <em>Save the file</em> and send it on WhatsApp). The file has all your books in it.</li>
  <li>If your accountant sends a corrected file back, open <em>Send to accountant → Import a business file</em> and choose it. It replaces your books with theirs, so <strong>don't capture anything new between sending and importing</strong>.</li>
</ol>
<p>The same file is a good backup: send it to yourself at the end of each month.</p>
"""),
    ("licence", "12. Paying, licences and help", """
<ul>
  <li>Choose a plan at <a href="/pricing.html">setwelbusiness.co.za/pricing</a> and pay with PayFast. Your licence key appears on screen and in your email.</li>
  <li>On a computer, Setwel asks for the key when the trial ends (or use <em>Licence → Enter licence key</em>). On a phone, type it in when asked.</li>
  <li>Help: WhatsApp 082 082 9050, or email support@setwelbusiness.co.za.</li>
</ul>
"""),
]

BY_BUSINESS = [
    ("spaza", "Spaza shops, salons and small retail", """
<ul>
  <li>Use one customer called "Cash sales" for walk-in customers. At the end of each day make one invoice for the day's cash takings and record it as paid in cash.</li>
  <li>Stock purchases go under <em>Stock / materials purchased</em> (cost of sales). Scan the wholesaler's slip as soon as you get back.</li>
  <li>Airtime, electricity and transport are operating expenses.</li>
  <li>Check the monthly report each month: is profit going up or down?</li>
  <li>Stock counting is not in Setwel yet; keep your stock book as you do now.</li>
</ul>
"""),
    ("trades", "Builders, electricians, plumbers and other trades", """
<ul>
  <li>Quote every job in Setwel, then turn the accepted quote into the invoice.</li>
  <li>Deposit first? Invoice the full job and record the deposit as a part-payment. The rest stays as owing.</li>
  <li>Materials bought for jobs are cost of sales; scan the slips on site. Fuel for the bakkie is an operating expense.</li>
  <li>Bigger suppliers who give you 30 days: capture their invoices as Bills (Grinder and up).</li>
  <li>Let Setwel chase late payers: send reminders from Needs your attention every week.</li>
</ul>
"""),
    ("services", "Consultants, tutors, creches and other services", """
<ul>
  <li>Monthly fees and retainers: make the first invoice, press <em>Repeat</em>, choose Every month. Setwel makes the next one each month.</li>
  <li>Put your banking details in Settings so every invoice and reminder tells the client how to pay.</li>
  <li>Use Bank matching (Builder) to mark the month's EFTs as paid in one go.</li>
</ul>
"""),
]

TRAINER = """
<h3>Before the session</h3>
<ul>
  <li>Install Setwel on the client's computer, or set up a client file in your own app and send it to them afterwards.</li>
  <li>Ask for: business details, VAT number and VAT period, banking details, logo, a list of customers and suppliers (Excel is fine), and what customers owe and unpaid supplier bills as at the start date.</li>
  <li>Fill in the spreadsheet templates from the Setup checklist and load them.</li>
</ul>
<h3>Session 1 (about 90 minutes): the daily work</h3>
<ol>
  <li>Tour: dashboard, Needs your attention, menu (10 min).</li>
  <li>Exercise: add a customer, make a quote, turn it into an invoice, send it on WhatsApp to the owner's own phone (20 min).</li>
  <li>Exercise: record a full payment and a part-payment (10 min).</li>
  <li>Exercise: scan three real slips; check and correct each field (20 min).</li>
  <li>Exercise: send a reminder for an overdue invoice (10 min).</li>
  <li>Staff: set up staff logins if more than one person will use Setwel, and show staff what they can and can't do (20 min).</li>
</ol>
<h3>Session 2 (about 90 minutes), two to four weeks later: the monthly work</h3>
<ol>
  <li>Review what was captured since session 1; fix categories together (20 min).</li>
  <li>Bank matching with the client's real statement (Builder and up) (25 min).</li>
  <li>Monthly report, profit and loss, and what the numbers mean for this business (20 min).</li>
  <li>VAT201 figures and deadlines, or the VAT threshold warning (15 min).</li>
  <li>Sending books to the accountant; agree how often (10 min).</li>
</ol>
<h3>Sign-off checklist</h3>
<ul class="checks">
  <li>Setup checklist essentials all ticked</li>
  <li>Owner can make and send an invoice alone</li>
  <li>Owner can record a payment and scan a receipt alone</li>
  <li>Owner knows where Needs your attention is and what to do with each item</li>
  <li>VAT period set (VAT vendors), banking details on invoices</li>
  <li>Backup agreed: books sent to the accountant every month</li>
  <li>Owner has this manual and the WhatsApp help number</li>
</ul>
<h3>Questions clients often ask</h3>
<ul>
  <li><strong>"Does Setwel submit my VAT?"</strong> No. It works out the figures to copy onto eFiling.</li>
  <li><strong>"Can my staff and I work on two computers at once?"</strong> Not on the same books yet. Staff logins are for people sharing one computer or phone.</li>
  <li><strong>"What if the computer breaks?"</strong> The daily backups are on that computer, so also send the books to your accountant or yourself every month.</li>
</ul>
"""


def manual_body() -> str:
    toc = "".join(f'<li><a href="#{sid}">{title}</a></li>' for sid, title, _ in USING)
    using = "".join(f'<section class="msec" id="{sid}"><h2>{title}</h2>{html}</section>' for sid, title, html in USING)
    types = "".join(f'<div class="card"><h3>{title}</h3>{html}</div>' for _, title, html in BY_BUSINESS)
    return f"""
<style>
  .manual h2 {{ margin-top: 0; }}
  .msec {{ padding: 26px 0; border-bottom: 1px solid var(--line); }}
  .manual ol, .manual ul {{ padding-left: 22px; }}
  .manual li {{ margin: 6px 0; }}
  .tip {{ background: #fdf4e3; border: 1px solid #f0d29a; border-radius: 8px; padding: 12px 14px; margin-top: 12px; }}
  .checks {{ list-style: none; padding-left: 0 !important; }}
  .checks li::before {{ content: "\\2610  "; font-size: 18px; }}
  @media print {{ .top, .foot, .wa, .noprint {{ display: none !important; }} .band {{ background: none !important; color: #000 !important; padding: 0 !important; }} .band p.lead {{ color: #000 !important; }} section {{ padding: 10px 0 !important; }} .msec {{ break-inside: avoid; }} }}
</style>
<div class="band">
  <div class="wrap">
    <h1>Setwel training manual</h1>
    <p class="lead">Every screen, step by step, for business owners and staff. With guides for each type of business and notes for trainers.</p>
    <p class="noprint"><button class="btn btn-main" onclick="window.print()">Print or save as PDF</button></p>
  </div>
</div>
<div class="wrap manual" style="max-width:860px">
  <section>
    <h2>Contents</h2>
    <ul style="list-style:none;padding-left:0">{toc}<li><a href="#types">Guides by type of business</a></li><li><a href="#trainers">Notes for trainers and partner accountants</a></li></ul>
    <p class="hint">Which features you see depends on your plan. Plan names are given where it matters.</p>
  </section>
  {using}
  <section class="msec" id="types"><h2>Guides by type of business</h2><div class="grid g3">{types}</div>
  <p style="margin-top:14px">Partners: copy the guide closest to your client into your session notes, and add the client's own customers, suppliers and expense categories.</p></section>
  <section class="msec" id="trainers"><h2>Notes for trainers and partner accountants</h2>{TRAINER}</section>
</div>
"""
