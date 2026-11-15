# Install the shop on your cPanel hosting (Node.js 26)

Follow these steps in order. They take about 30 minutes. **The old website goes offline between steps 1 and 3, so do this at a quiet time.**

## 1. Back up and clear the old website
1. cPanel → **File Manager** → open the `michealsdynamics.co.za` folder.
2. Click **Select All**, then **Compress** → Zip → name it `old-site-backup.zip`.
3. **Move** `old-site-backup.zip` to your home folder (`/home/your-username`), **not** inside `michealsdynamics.co.za`.
4. Back in `michealsdynamics.co.za`, delete everything **except the `.well-known` folder** (your SSL certificate uses it).
   Also delete `website-update.zip`, which is publicly downloadable where it is.
   (To see hidden files such as `.htaccess`: **Settings** (top right) → tick **Show Hidden Files**.)

## 2. Upload the shop
1. In File Manager go to your home folder (the top level, where `public_html` is).
2. **+ Folder** → name it `michealsdynamics-app`.
3. Open it → **Upload** → choose `michealsdynamics-app.zip`.
4. Right-click the zip → **Extract** → into `/home/your-username/michealsdynamics-app`. Then delete the zip.
   You should now see `server.js`, `package.json`, `src`, `public`… inside `michealsdynamics-app`.

This folder is private: nobody can download it from the web. Orders, customers and photos are saved in its `data` folder.

## 3. Create the Node.js app
cPanel → **Setup Node.js App** → **Create Application**:

| Field | Value |
|---|---|
| Node.js version | **26.x** |
| Application mode | **Production** |
| Application root | `michealsdynamics-app` |
| Application URL | `michealsdynamics.co.za` (leave the path box empty) |
| Application startup file | `server.js` |

Under **Environment variables**, click **Add Variable** for each line below. Type the name exactly; the value goes in the second box, with no spaces before or after it.

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://michealsdynamics.co.za` |
| `ADMIN_EMAIL` | the email you'll log in to Admin with |
| `ADMIN_PASSWORD` | a long password (change it later in Admin → Settings) |
| `PAYFAST_MERCHANT_ID` | from your PayFast account |
| `PAYFAST_MERCHANT_KEY` | from your PayFast account |
| `PAYFAST_PASSPHRASE` | the passphrase you set in PayFast → Settings → Developer Settings |
| `PAYFAST_SANDBOX` | `false` |
| `SMTP_HOST` | `mail.michealsdynamics.co.za` (see step 5) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | e.g. `orders@michealsdynamics.co.za` |
| `SMTP_PASS` | that mailbox's password |
| `MAIL_FROM` | `Micheals Dynamics <orders@michealsdynamics.co.za>` |
| `ADMIN_NOTIFY_EMAIL` | where you want order alerts, e.g. `michealsdynamicresults@gmail.com` |

These values are stored privately by cPanel. You don't need a `.env` file.

Click **Create**. Then on the app's page click **Run NPM Install** and wait for it to finish. Then click **Restart**.

## 4. Check it works
1. Open `https://michealsdynamics.co.za`. The new shop should load.
2. Open `https://michealsdynamics.co.za/admin` and log in with ADMIN_EMAIL / ADMIN_PASSWORD.
3. The dashboard has a **PayFast check** box. It should say **Mode: LIVE** and **✓ PayFast settings look correct**.
   If it lists a problem, fix that variable in Setup Node.js App, click **Save**, then **Restart**.
4. cPanel → **Domains** → turn on **Force HTTPS Redirect** for michealsdynamics.co.za.

## 5. Email account for order emails
cPanel → **Email Accounts** → **Create** → `orders@michealsdynamics.co.za` with a strong password.
Use it for the SMTP_ variables above. This is more reliable than Gmail from shared hosting.
If emails don't arrive, check cPanel → **Connect Devices** for the exact mail server name and port, and update SMTP_HOST / SMTP_PORT.

## 6. Before taking real orders
1. Admin → **Settings**: delivery prices, bank details, trading hours, director name(s), Information Officer.
2. Admin → **Prices & stock** and **Products**: prices, stock and photos.
3. Put a cheap test product live, buy it with your own card, check the order shows **paid** in Admin and that the email arrives, then refund it in PayFast.

## Changing settings later
Setup Node.js App → your app → edit the variable → **Save** → **Restart**.

## Backups
Admin → Settings → **Download database backup**, weekly. Every few months, also download the `michealsdynamics-app/data/uploads` folder (product photos).
