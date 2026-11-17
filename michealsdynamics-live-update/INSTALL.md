# Update the live site: remove 2 Novalac items + PayFast payment links

You need two files from this folder:
- `michealsdynamics-site-update.zip`: the website update
- `md-payfast-config.php`: your private PayFast settings

## Step 1 — Upload the website update (5 min)
1. cPanel → **File Manager** → open the **michealsdynamics.co.za** folder.
2. **Upload** → choose `michealsdynamics-site-update.zip`.
3. Right-click it → **Extract** → extract into `/michealsdynamics.co.za` (the folder you're in) and allow it to replace existing files.
4. Delete `michealsdynamics-site-update.zip` from that folder afterwards.

**Don't delete** the `product`, `images`, `specials`, `about`, `contact` and other existing folders. They stay as they are.

## Step 2 — Remove the 2 Novalac product folders (optional tidy-up)
In `michealsdynamics.co.za/product`, delete these 2 folders:
- `novalac-ready-to-feed-premium-90ml-91207ea`
- `novalac-ready-to-feed-premature-70ml-90153ea`

(Even if you skip this, visitors who open those old links are sent to the Baby Food and Formula page.)

## Step 3 — PayFast settings (private, 10 min)
1. In File Manager go to your **home folder**: the top level, where you can see `public_html` and `michealsdynamics.co.za`.
2. **Upload** `md-payfast-config.php` **there**. **Not** inside `michealsdynamics.co.za`.
3. Right-click it → **Edit** and fill in:
   - `merchant_id` and `merchant_key` from PayFast
   - `passphrase`: the same passphrase as in PayFast → Settings → Developer Settings
   - `admin_password`: a new password for creating payment links (at least 10 characters)
   - `link_secret`: type about 40 random letters and numbers
4. **Save**.

## Step 4 — Test
1. Open **https://michealsdynamics.co.za/pay/link.php** and log in with your `admin_password`.
   (If something is missing in the settings, this page tells you exactly what.)
2. Create a link: order `TEST-1`, amount `5.00`, your own name and email.
3. Open the link, pay R5 with your card, and check you receive the **"PAID: order TEST-1"** email.
4. Refund the R5 in your PayFast account.

## Daily use
1. A customer sends their order by WhatsApp or email, as now.
2. You confirm stock, delivery and the total.
3. Go to **/pay/link.php** → enter order number, total, customer name and email → **Create payment link** → **Send on WhatsApp**.
4. When they pay, you get a **"PAID"** email. Dispatch only after that email arrives.

The amount on each link is locked: if anyone changes it, the link stops working.
A record of every payment is kept in `md-payfast-log.txt` in your home folder.
