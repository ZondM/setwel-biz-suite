"""
Sorts the launch videos and pictures into one folder (and zip) per platform, with numbered,
labelled file names in posting order and a WHAT TO POST note in each.

    python3 tools/video/pack.py      -> deliver/Setwel-<Platform>.zip
"""
from pathlib import Path
import shutil
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[2]
SOCIAL = ROOT / "social"
OUT = ROOT / "deliver" / "launch-pack"
V, I, C, H = SOCIAL / "videos", SOCIAL / "images", SOCIAL / "covers", SOCIAL / "hook-tests"

# Upright videos, in posting order: (label, video, cover or None, plan day, caption section in POSTING-GUIDE.txt)
UPRIGHT = [
    ("Automation - everything Setwel does (PIN THIS)", V / "setwel-automation-9x16.mp4", C / "cover-automation-9x16.jpg", "Day 4", "automation"),
    ("Receipt scan - real app", V / "setwel-short-receipt-9x16.mp4", None, "Day 6", "receipts"),
    ("Invoice on WhatsApp - real app", V / "setwel-short-invoice-9x16.mp4", None, "Day 8", "invoices"),
    ("Late payers - real app", V / "setwel-short-reminder-9x16.mp4", None, "Day 10", "reminders"),
    ("Tax and VAT alerts", V / "setwel-tax-alerts-9x16.mp4", C / "cover-tax-alerts-9x16.jpg", "Day 17", "tax-alerts"),
    ("Receipts - animated", V / "setwel-receipts-9x16.mp4", C / "cover-receipts-9x16.jpg", "Day 22 or any free day", "receipts"),
    ("Invoices - animated", V / "setwel-invoices-9x16.mp4", C / "cover-invoices-9x16.jpg", "Day 27 or any free day", "invoices"),
    ("Reminders - animated", V / "setwel-reminders-9x16.mp4", C / "cover-reminders-9x16.jpg", "any free day", "reminders"),
]
FEED = [
    ("Automation - feed video", V / "setwel-automation-4x5.mp4", C / "cover-automation-4x5.jpg"),
    ("Receipts - feed video", V / "setwel-receipts-4x5.mp4", C / "cover-receipts-4x5.jpg"),
    ("Invoices - feed video", V / "setwel-invoices-4x5.mp4", C / "cover-invoices-4x5.jpg"),
    ("Reminders - feed video", V / "setwel-reminders-4x5.mp4", C / "cover-reminders-4x5.jpg"),
    ("Tax alerts - feed video", V / "setwel-tax-alerts-4x5.mp4", C / "cover-tax-alerts-4x5.jpg"),
]
CAROUSEL = ["cover", "receipts", "invoices", "reminders", "tax-alerts", "brand"]
STORIES = ["receipts", "invoices", "reminders", "tax-alerts", "brand"]
HOOKS = [("Automation", "automation"), ("Receipts", "receipts"), ("Invoices", "invoices"), ("Reminders", "reminders"), ("Tax alerts", "tax-alerts")]


def put(src: Path, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def upright(folder: Path, kind: str, notes: list, with_covers=True):
    for n, (label, vid, cover, day, cap) in enumerate(UPRIGHT, 1):
        name = f"{n:02d} {kind} - {label}"
        put(vid, folder / f"{name}.mp4")
        if cover and with_covers:
            put(cover, folder / f"{name} - COVER.jpg")
        notes.append(f"  {n:02d}  {day:<24} {label}   (caption: '{cap}')")


def hooks(folder: Path, kind: str):
    for label, key in HOOKS:
        for letter in "BC":
            base = f"{kind} - {label} - opening {letter}"
            put(H / f"setwel-{key}-hook{letter}-9x16.mp4", folder / f"{base}.mp4")
            put(H / f"cover-{key}-hook{letter}-9x16.jpg", folder / f"{base} - COVER.jpg")


def feed(folder: Path, notes: list):
    for n, (label, vid, cover) in enumerate(FEED, 1):
        put(vid, folder / f"{n:02d} Feed - {label}.mp4")
        put(cover, folder / f"{n:02d} Feed - {label} - COVER.jpg")
        notes.append(f"  {n:02d}  {label} (use on days without a Reel; same caption as the Reel)")
    for n, key in enumerate(CAROUSEL, 1):
        put(I / f"setwel-{key}-4x5.jpg", folder / "Carousel (post all 6 together, in this order)" / f"Slide {n} - {key}.jpg")
    notes.append("  Carousel: post the 6 slides together, in order (Day 8).")


def stories(folder: Path, kind: str):
    for n, key in enumerate(STORIES, 1):
        put(I / f"setwel-{key}-9x16.jpg", folder / f"{n:02d} {kind} - {key}.jpg")


def write_notes(folder: Path, title: str, lines: list):
    text = [title, "=" * len(title), ""] + lines + [
        "",
        "Captions: the CAPTIONS file in this folder, numbered the same as the videos.",
        "Day numbers follow the 30-day launch plan.",
        "Add a trending sound inside the app when you post; the videos have no music.",
    ]
    (folder / "WHAT TO POST.txt").write_text("\n".join(text) + "\n", encoding="utf-8")
    shutil.copy2(SOCIAL / "POSTING-GUIDE.txt", folder / "Posting tips (all platforms).txt")


def build():
    shutil.rmtree(OUT, ignore_errors=True)
    profile = I / "setwel-app-icon-512.png"

    # Instagram
    ig = OUT / "Setwel-Instagram"
    notes = ["REELS (folder 1), upright 9:16. Post in this order:"]
    upright(ig / "1 Reels", "Reel", notes)
    notes += ["", "FEED POSTS (folder 2), 4:5:"]
    feed(ig / "2 Feed posts", notes)
    notes += ["", "STORIES (folder 3): one picture a day, add a poll or link sticker.",
              "TEST OPENINGS (folder 4): the same Reels with a different first line; post one a few days",
              "after the original and keep the line that holds more viewers.",
              "", "Profile picture: Profile picture - Setwel.png"]
    stories(ig / "3 Stories", "Story")
    hooks(ig / "4 Test openings (B and C)", "Reel")
    put(profile, ig / "Profile picture - Setwel.png")
    write_notes(ig, "INSTAGRAM - WHAT TO POST", notes)

    # Facebook
    fb = OUT / "Setwel-Facebook"
    put(V / "setwel-tour-16x9.mp4", fb / "1 Main video" / "01 Facebook video - Setwel tour (PIN THIS).mp4")
    put(I / "youtube-thumbnail.jpg", fb / "1 Main video" / "01 Facebook video - Setwel tour - THUMBNAIL.jpg")
    notes = ["MAIN VIDEO (folder 1): the 42-second tour, landscape 16:9. Post on Day 4 and pin it.", "",
             "REELS (folder 2), upright 9:16. Post in this order:"]
    upright(fb / "2 Reels", "Reel", notes)
    notes += ["", "FEED POSTS (folder 3), 4:5:"]
    feed(fb / "3 Feed posts", notes)
    notes += ["", "STORIES (folder 4): one picture a day.", "", "Page picture: Profile picture - Setwel.png"]
    stories(fb / "4 Stories", "Story")
    put(profile, fb / "Profile picture - Setwel.png")
    write_notes(fb, "FACEBOOK - WHAT TO POST", notes)

    # TikTok
    tt = OUT / "Setwel-TikTok"
    notes = ["VIDEOS, upright 9:16. Post in this order; set each COVER under 'Select cover':"]
    upright(tt / "1 Videos", "TikTok", notes)
    notes += ["", "TEST OPENINGS (folder 2): post one a few days after the original; keep the better line.",
              "", "Profile picture: Profile picture - Setwel.png"]
    hooks(tt / "2 Test openings (B and C)", "TikTok")
    put(profile, tt / "Profile picture - Setwel.png")
    write_notes(tt, "TIKTOK - WHAT TO POST", notes)

    # YouTube
    yt = OUT / "Setwel-YouTube"
    put(V / "setwel-tour-16x9.mp4", yt / "1 Main video" / "01 YouTube video - Setwel tour.mp4")
    put(I / "youtube-thumbnail.jpg", yt / "1 Main video" / "01 YouTube video - Setwel tour - THUMBNAIL.jpg")
    notes = ["MAIN VIDEO (folder 1): upload the tour on Day 4 and set THUMBNAIL as its custom thumbnail.",
             "  Title: How to send invoices on WhatsApp and do your VAT | Setwel Biz Suite",
             "  First line of the description: Try Setwel free for 30 days: https://setwelbusiness.co.za", "",
             "SHORTS (folder 2), upright 9:16. Post in this order:"]
    upright(yt / "2 Shorts", "Short", notes, with_covers=False)
    notes += ["", "Channel picture: Channel picture - Setwel.png"]
    put(profile, yt / "Channel picture - Setwel.png")
    write_notes(yt, "YOUTUBE - WHAT TO POST", notes)

    # WhatsApp Status
    wa = OUT / "Setwel-WhatsApp-Status"
    notes = ["STATUS VIDEOS (folder 1): one a day. Type 'Free for 30 days: setwelbusiness.co.za' over it.",
             "Reply personally to everyone who reacts."]
    upright(wa / "1 Status videos", "Status", notes, with_covers=False)
    notes += ["", "STATUS PICTURES (folder 2): for days without a video.", "",
              "WhatsApp Business profile picture: Profile picture - Setwel.png"]
    stories(wa / "2 Status pictures", "Status")
    put(profile, wa / "Profile picture - Setwel.png")
    write_notes(wa, "WHATSAPP STATUS - WHAT TO POST", notes)

    from captions import write_into
    write_into(OUT)

    # One zip per platform
    for folder in sorted(OUT.iterdir()):
        z = OUT.parent / f"{folder.name}.zip"
        z.unlink(missing_ok=True)
        with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
            for f in sorted(folder.rglob("*")):
                if f.is_file():
                    zf.write(f, f.relative_to(OUT))
        print(f"{z.name}: {z.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    build()
