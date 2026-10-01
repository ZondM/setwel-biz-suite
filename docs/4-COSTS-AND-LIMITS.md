# Running costs, why this setup, and honest limits

## Why PHP + MySQL on your own hosting (and not Next.js / Vercel / Supabase)

You already pay for registerdomain cPanel hosting, which runs PHP and MySQL. A Next.js store would need:

- Vercel (its free plan is for non-commercial use only — a shop needs the paid Pro plan, about US$20/month)
- Supabase (the free plan pauses inactive projects — a shop needs the paid plan, about US$25/month)

That is roughly R800+ a month for no benefit to you. The PHP store has the same features, is fast, and costs nothing extra to host. It uses no outside code libraries, so there is nothing to "update" or break.

## Running costs (approximate — check current prices)

| Item | Cost |
|---|---|
| Hosting | Already paid (your setwelbusiness.co.za plan, add-on domain) |
| setwelafrica.com domain | About R200–R300 per year at registerdomain |
| SSL certificate | Free (AutoSSL) |
| Email (sa@setwelafrica.com) | Free with your hosting |
| PayFast | No monthly fee on the standard account. A fee per payment, roughly 3–3.5% + about R2 for cards and about 2% for Instant EFT. See payfast.io/fees |
| Manual EFT | Your normal bank fees only |
| Google Analytics, Search Console, Merchant Center | Free |
| Newsletter sending (Mailchimp / Brevo) | Free plans for small lists |
| **Total extra per month** | **About R20 (domain) + PayFast fees per sale** |

## Honest limits — what I could not do or test

- **PayFast live test:** the sandbox I built in has no internet access to PayFast, so I could not run a real payment. The code follows PayFast's official method (signature, server check, amount check). **You must do the sandbox test** (install guide, Step 9) before going live.
- **Email sending:** tested that emails are created correctly, but this sandbox has no mail server. Use **Send test email** after setup.
- **Accounts:** I cannot buy the domain, set up cPanel, open or approve PayFast, register you with the Information Regulator, or get you authorisation letters. Those are yours to do.
- **Legal pages:** sensible South African drafts (CPA, ECTA, POPIA), but **not legal advice**. Have them checked.
- **"Authorised Reseller" claim:** the store shows the wording you set. It is your responsibility that it matches your letters.
- **Product photos:** the 9 sample photos are cropped from the distributor flyers you sent (including the blank Canon white-label flyer). Replace them with better photos when you can.
- **Stock levels:** the store tracks stock *status* (in stock / low / on order / out), not exact quantities. It does not sync automatically with the distributor's stock. You update it through the monthly import.
- **Distributor catalogue import:** the importer accepts any Excel/CSV layout through the column-matching screen, and saves the matching for next time. When you send the actual distributor catalogue file, I can pre-set the matching and test it.
- **Old .xls files:** these must be saved as .xlsx first (one click in Excel).
- **Newsletter:** the store collects sign-ups and exports the list. Sending the emails is done in Mailchimp/Brevo.
- **Courier:** a flat rate plus free delivery over a threshold. No live courier quotes or automatic waybills.
- **Tested on:** PHP 8.3 with both SQLite and MariaDB (the MySQL type cPanel uses), on desktop and mobile screen sizes.
