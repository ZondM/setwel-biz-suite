# Setwel Biz Suite

Invoices, money tracking and SARS-ready figures for South African businesses.

## What's in this repository

| Folder | What it is |
|---|---|
| `app/` | The Setwel app itself (already built). The desktop installers and the phone version both use it. |
| `desktop/` | Turns the app into a real Windows `.exe` and Mac `.dmg`, and adds the 30-day trial, licence keys and daily backups. |
| `website/` | Everything that goes on setwelbusiness.co.za: the pages, the phone version (`/app/`) and the PayFast/licence scripts (`/api/`). |
| `tools/build_site.py` | Builds the website pages. Edit the text there, then run `python3 tools/build_site.py`. |
| `.github/workflows/build-installers.yml` | Builds the `.exe` and `.dmg` automatically on GitHub. |

## How customers get Setwel

1. **Windows / Mac:** the download button picks the right file. They double-click it and Setwel installs and opens. There's no Node.js, ZIP or command window.
2. **Phones:** they open `setwelbusiness.co.za/app/` in the browser and add it to the home screen.
3. **Trial:** 30 days from the first time the app opens. There's no sign-up form. A reminder shows from day 23.
4. **Paying:** Pricing → pay.html → PayFast. When PayFast confirms the payment, the server creates a licence key, shows it on the thank-you page with an **Activate** button, and emails it to the customer.
5. **Renewals:** each PayFast renewal extends the licence automatically. The app re-checks whenever it's online.
6. **Referrals:** each customer gets a code (REF-XXXXXX). When someone pays with that code, the referrer's licence gets one extra month, and PayFast is asked to skip one charge. If that request fails, you get an email asking you to do it by hand.

## Getting new installers

1. GitHub → **Actions** → **Build installers** → **Run workflow** (it also runs by itself when `app/` or `desktop/` changes).
2. When it finishes, open **Releases** and download `Setwel-Setup.exe` and `Setwel-Mac.dmg`.
3. In cPanel File Manager, upload both into `public_html/downloads/`, replacing the old ones.

The installers are not code-signed yet, so Windows and Mac show a one-time warning. The download page explains the clicks to get past it. Signing removes the warning. It costs about $99 a year for Apple and about R3,000–R7,000 a year for Windows.

## Putting the website live (cPanel at registerdomain)

1. Upload the contents of `website/` into `public_html/`.
2. Create `public_html/api/config.php` from `api/config.example.php`. Fill in PayFast's merchant ID, key and passphrase, the licence signing key and the admin password. Never commit `config.php`.
3. Make sure `public_html/data/` is writable by PHP. It stores licences and payment logs, and its own `.htaccess` blocks it from the web.
4. The licence desk is at `/api/admin.php`. Use it for EFT customers, partner deals, adding months or switching a key off.

## Licence keys

The server signs licences with an Ed25519 private key (`LICENCE_SIGNING_KEY` in config.php). The app checks them with the matching public key in `desktop/licence-public.pem`. If you ever change one, you must change the other and build new installers.
