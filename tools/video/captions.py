"""
Ready-to-paste captions for each platform, numbered to match the files in each platform pack
(tools/video/pack.py). Run on its own to write the files: python3 tools/video/captions.py
"""
from pathlib import Path

SITE = "https://setwelbusiness.co.za"
TAGS = {
    "automation": "#SmallBusinessSA #SMME #SouthAfricanBusiness #Entrepreneur #SetwelBizSuite",
    "receipts": "#Receipts #VAT #Bookkeeping #SmallBusinessSA #SetwelBizSuite",
    "invoices": "#Invoicing #WhatsAppBusiness #SmallBusinessSA #SMME #SetwelBizSuite",
    "reminders": "#CashFlow #GetPaid #SmallBusinessSA #Entrepreneur #SetwelBizSuite",
    "tax": "#VAT #Tax #Compliance #SmallBusinessSA #SetwelBizSuite",
}

# One entry per numbered video: (label, topic, hook line, body, question for comments, pinned comment)
VIDEOS = [
    ("Automation - everything Setwel does", "automation",
     "Your business paperwork, on autopilot 👇",
     "Setwel scans your receipts with AI, makes your monthly invoices, writes the payment reminders and tells you when VAT is due. Built for South African businesses.",
     "What takes up most of your admin time?",
     "Free for 30 days on Windows, Mac and your phone. No card needed."),
    ("Receipt scan - real app", "receipts",
     "Still keeping slips in a shoebox? 🧾",
     "Snap a photo and Setwel reads the supplier, amount, VAT and category for you. Your expense is done before you leave the shop.",
     "Be honest: how many slips are in your car right now? 😅",
     "Works with till slips, fuel slips and supplier invoices, photo or PDF."),
    ("Invoice on WhatsApp - real app", "invoices",
     "Invoice a client in 20 seconds ⚡",
     "Pick the customer, add the work, and Setwel types the WhatsApp message for you. By email, the PDF invoice with your logo and banking details is attached automatically.",
     "How do you send invoices today?",
     "VAT and totals are worked out for you."),
    ("Late payers - real app", "reminders",
     "Customers paying late? 💸",
     "Setwel shows you who owes you and writes the reminder for you: friendly first, firmer later. You just press send.",
     "What's the longest a customer has made you wait? 👇",
     "Reminders get firmer after 2 and 6 weeks, written politely for you."),
    ("Tax and VAT alerts", "tax",
     "VAT deadline sneaking up? ⏰",
     "Setwel shows your VAT201 and provisional tax dates before they're due, with the amount worked out from your own books.",
     "Do you do your own VAT, or does someone do it for you?",
     "On Grinder and up, the full VAT201 figures are ready to copy onto eFiling."),
    ("Receipts - animated", "receipts",
     "Lost slips mean lost VAT claims 🧾",
     "Capture every expense in seconds: photograph the slip and AI fills in the supplier, amount, VAT and category.",
     "Where do your slips end up at month end?",
     "Receipt scans: 30 a month on Hustler, 150 on Grinder, unlimited from Builder."),
    ("Invoices - animated", "invoices",
     "Typing the same invoice every month? ✋",
     "Set it once. Setwel makes the next invoice on the date, ready to send on WhatsApp or email with the PDF attached.",
     "Who do you invoice every month? Rent, retainers, service fees?",
     "You always press send yourself, so nothing goes out without you."),
    ("Reminders - animated", "reminders",
     "Hate asking for your money? 🙈",
     "Setwel lists every overdue invoice and writes the reminder for you, by WhatsApp or email.",
     "What do you usually say to a late payer?",
     "Every reminder is written politely, in plain English."),
]

YT_SHORT_TITLES = [
    "Invoices, receipts and VAT on autopilot | Setwel Biz Suite",
    "Scan a till slip and AI does the bookkeeping | Setwel",
    "Send an invoice on WhatsApp in 20 seconds | Setwel",
    "Customers paying late? The reminder is already written | Setwel",
    "Never miss a VAT deadline | Setwel Biz Suite",
    "Lost slips = lost VAT claims | Setwel",
    "Stop retyping the same invoice every month | Setwel",
    "How to chase late payments without the awkwardness | Setwel",
]


def instagram() -> str:
    out = ["INSTAGRAM CAPTIONS", "==================",
           "Numbers match the files in the Instagram pack. Copy everything between the lines.",
           "Instagram links can't be clicked in captions, so they say 'link in bio'. Put",
           f"{SITE} in your bio first.", ""]
    for n, (label, topic, hook, body, q, pin) in enumerate(VIDEOS, 1):
        out += [f"--- {n:02d} Reel - {label} ---", hook, body,
                "Try it free for 30 days, no card needed. Link in bio.", q, "", TAGS[topic],
                f"[Pin this comment: {pin}]", ""]
    out += ["--- Carousel (6 slides) ---",
            "Your business paperwork, sorted 👉 swipe",
            "Receipts read by AI. Invoices that repeat. Reminders written for you. VAT deadlines flagged before they arrive.",
            "Try Setwel free for 30 days. Link in bio.", "", TAGS["automation"], "",
            "--- Feed videos (Feed folder) ---",
            "Use the caption of the Reel with the same topic (Automation = 01, Receipts = 06, Invoices = 07, Reminders = 08, Tax = 05).", "",
            "--- Stories ---",
            "Add a Link sticker to setwelbusiness.co.za and one of these:",
            "  Poll: Where are your slips right now?  Wallet / Car / Lost 😅",
            "  Quiz: How long does an invoice take on Setwel?  10 min / 1 min / Seconds",
            "  Question box: What do you say to a late payer?", ""]
    return "\n".join(out)


def facebook() -> str:
    out = ["FACEBOOK CAPTIONS", "=================",
           "Numbers match the files in the Facebook pack. On Facebook the link works, so it's in the post.", "",
           "--- 01 Facebook video - Setwel tour (main video, pin it to the top of your Page) ---",
           "Your business finances, handled with confidence.",
           "Watch the 42-second tour: set up in a minute, see who owes you, send an invoice on WhatsApp, snap a receipt and get your month on one page.",
           "✔ Invoices and quotes with your logo",
           "✔ Receipts read by AI",
           "✔ Reminders written for you",
           "✔ VAT201 figures ready for eFiling",
           f"Try it free for 30 days, no card needed: {SITE}", ""]
    for n, (label, topic, hook, body, q, pin) in enumerate(VIDEOS, 1):
        out += [f"--- {n:02d} Reel - {label} ---", hook, body, q,
                f"Free for 30 days: {SITE}", "", f"[First comment: {pin}]", ""]
    out += ["--- Carousel / feed posts ---",
            "Your business paperwork, on autopilot.",
            "Receipts read by AI, invoices that repeat, reminders written for you and VAT deadlines flagged before they arrive.",
            f"30 days free, no card needed: {SITE}", "",
            "--- Referral post (brand picture) ---",
            "Already using Setwel? Share your referral code. Every business that pays with your code gives you a free month. No limit. Your code is in the email you got when you paid.", ""]
    return "\n".join(out)


def tiktok() -> str:
    out = ["TIKTOK CAPTIONS", "===============",
           "Numbers match the files in the TikTok pack. Keep them short; TikTok shows the first line.",
           f"Put {SITE} in your bio (Edit profile, Website). Set each COVER under 'Select cover'.", ""]
    for n, (label, topic, hook, body, q, pin) in enumerate(VIDEOS, 1):
        out += [f"--- {n:02d} TikTok - {label} ---", f"{hook} {body} 30 days free, link in bio. {q}", TAGS[topic],
                f"[Pin this comment: {pin}]", ""]
    out += ["Turn on Duet and Stitch when you post: more people can share your video.", ""]
    return "\n".join(out)


def youtube() -> str:
    out = ["YOUTUBE TITLES AND DESCRIPTIONS", "===============================",
           "Numbers match the files in the YouTube pack.", "",
           "--- 01 YouTube video - Setwel tour (main video) ---",
           "TITLE:",
           "Invoices, receipts and VAT on autopilot | Setwel Biz Suite (South Africa)",
           "",
           "DESCRIPTION:",
           f"Try Setwel free for 30 days, no card needed: {SITE}",
           "",
           "Setwel Biz Suite is invoicing, bookkeeping and VAT software made for South African small businesses. In this 42-second tour:",
           "- Set up in a minute",
           "- See who owes you and send a reminder",
           "- Make an invoice and send it on WhatsApp",
           "- Snap a receipt: AI fills in the expense",
           "- Your month on one page",
           "",
           "Works on Windows, Mac and your phone. Plans from R59.99 a month after your free trial.",
           "Questions? WhatsApp 082 082 9050",
           "",
           "#SmallBusinessSA #Invoicing #VAT",
           "",
           "TAGS (Video details, Show more, Tags):",
           "invoicing software south africa, small business accounting, VAT201, eFiling, whatsapp invoice, receipt scanner, bookkeeping app, SMME, Setwel",
           "",
           "THUMBNAIL: '01 YouTube video - Setwel tour - THUMBNAIL.jpg'",
           "PLAYLIST: create 'Setwel Biz Suite' and add every video and Short.", ""]
    for n, ((label, topic, hook, body, q, pin), title) in enumerate(zip(VIDEOS, YT_SHORT_TITLES), 1):
        out += [f"--- {n:02d} Short - {label} ---", "TITLE:", title, "DESCRIPTION:",
                f"{body} Try Setwel free for 30 days: {SITE}", f"#Shorts {TAGS[topic]}", ""]
    return "\n".join(out)


def whatsapp() -> str:
    out = ["WHATSAPP STATUS TEXT", "====================",
           "Type the line over each Status (the T button). Keep it short.", ""]
    for n, (label, topic, hook, *_rest) in enumerate(VIDEOS, 1):
        out += [f"{n:02d} {label}:  {hook}  Free for 30 days: setwelbusiness.co.za"]
    out += ["", "Pictures: 'Free for 30 days 👉 setwelbusiness.co.za'",
            "Reply personally to everyone who reacts to your Status.", ""]
    return "\n".join(out)


FILES = {"Setwel-Instagram": instagram, "Setwel-Facebook": facebook, "Setwel-TikTok": tiktok,
         "Setwel-YouTube": youtube, "Setwel-WhatsApp-Status": whatsapp}


def write_into(pack_dir: Path):
    """Writes 'CAPTIONS - <platform>.txt' into each platform folder."""
    for folder, fn in FILES.items():
        name = folder.replace("Setwel-", "")
        (pack_dir / folder / f"CAPTIONS - {name}.txt").write_text(fn() + "\n", encoding="utf-8")


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[2] / "social" / "captions"
    out.mkdir(parents=True, exist_ok=True)
    for folder, fn in FILES.items():
        (out / f"CAPTIONS - {folder.replace('Setwel-', '')}.txt").write_text(fn() + "\n", encoding="utf-8")
    print("Wrote", len(FILES), "caption files to", out)
