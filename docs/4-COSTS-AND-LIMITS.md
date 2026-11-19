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
| WhatsApp lead alerts (CallMeBot) | Free (outside service, no guarantee — email alert is the backup) |
| AI assistant (optional) | Paid per use to Anthropic. Rough guide with the default **Claude Haiku 5.5: about R0.10–R0.15 per typical chat** (Opus 5.5, if you ever switch: about R3–R5 per chat). Depends on chat length; set a monthly spend limit at console.anthropic.com and a daily chat limit in Settings (default 50 chats/day). |
| **Total extra per month** | **About R20 (domain) + PayFast fees per sale** (+ AI assistant use if switched on) |

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

## Leads, WhatsApp and AI assistant — honest limits

- **No automatic WhatsApp messages to customers.** Sending WhatsApp messages *to customers* automatically (and an AI that answers on your WhatsApp number) needs the official **WhatsApp Business Platform** from Meta: a business verification, a phone number that is not used in the normal WhatsApp app, approved message templates and a fee per conversation. Until then: customers reach you with one tap (every button opens WhatsApp with a ready message), you get an instant WhatsApp alert, and you reply with one tap from Admin → Leads. Follow-ups to customers go by email.
- **Competitor prices are entered by you** (product page → Competitor price, or a *Competitor price* column in an import). The store does not scan other websites — that breaks often and many sites forbid it. Admin → Products → filter **Dearer than competitor** shows where you are more expensive; the AI assistant may mention a recorded comparison but never promises a discount — price-match requests go to you.
- **Appointments** are call-back requests with a preferred time (alert to you), not a calendar booking.
- **The AI assistant** answers only from your product list and settings. It can still misunderstand a question — it is told to hand over to you when unsure, and every conversation that leads to a quote or call-back is saved under Leads for you to read. It could not be tested against the real AI service here (no API key); the full flow was tested with a stand-in.
- **WhatsApp alerts** could not be tested from here (CallMeBot needs your phone to activate).
- **Speed:** pages are small (about 120–170 KB, under ~1.3 s on a slow 4G test). If the live site still feels slow, the cause is usually the hosting server's response time — run **pagespeed.web.dev** on setwelafrica.com and send me the result.
