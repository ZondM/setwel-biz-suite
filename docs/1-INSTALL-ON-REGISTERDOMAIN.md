# Install the Setwel Africa store on your registerdomain hosting

Time needed: about 1 hour. You only do this once.
You need: your registerdomain cPanel login, your PayFast login, and the file **`setwel-store-upload.zip`** (in the `dist` folder of this project).

> Menu names in cPanel can differ slightly between hosting plans. If you can't find something, use the **search box at the top of cPanel** and type the name.

---

## Step 1 — Buy the domain and add it to your hosting

1. Log in to registerdomain and buy **setwelafrica.com**.
2. Make sure the domain uses your hosting's nameservers (registerdomain normally does this for you when you buy the domain on the same account).
3. Log in to **cPanel** (the one for setwelbusiness.co.za).
4. Search **Domains** (newer cPanel) or **Addon Domains** (older cPanel).
5. Click **Create A New Domain** / **Add Domain** and type `setwelafrica.com`.
   - **Untick** "Share document root" if you see it.
   - Document root: leave the suggestion, e.g. `setwelafrica.com` (a folder in your home directory).
6. Click **Submit**. Write down the folder name.

It can take a few hours for a new domain to start working.

## Step 2 — Turn on the free SSL certificate (the padlock / https)

1. cPanel → search **SSL/TLS Status**.
2. Tick `setwelafrica.com` and `www.setwelafrica.com` → **Run AutoSSL**.
3. Wait until both show a green padlock. (This needs the domain to be working, so you may have to come back later.)

The store forces `https://`. PayFast also needs https.

## Step 3 — Choose PHP 8.2 or 8.3

1. cPanel → search **Select PHP Version** (or **MultiPHP Manager**).
2. For setwelafrica.com choose **PHP 8.2** or **8.3**.
3. If there is an **Extensions** tab, make sure these are ticked: `pdo_mysql`, `gd`, `zip`, `curl`, `fileinfo`, `mbstring`. Click **Save**.

## Step 4 — Create the database

1. cPanel → search **MySQL Database Wizard**.
2. Database name: `setwel` → Next. cPanel adds a prefix, so the full name looks like `cpuser_setwel`. **Write down the full name.**
3. Username: `setwel`, and click **Password Generator** for a strong password. **Write down the full username and the password.**
4. Tick **ALL PRIVILEGES** → **Next Step**.

## Step 5 — Upload the store files

1. cPanel → **File Manager**.
2. Top right → **Settings** → tick **Show Hidden Files (dotfiles)** → Save. (The `.htaccess` files are hidden and very important.)
3. Open the folder from Step 1 (e.g. `setwelafrica.com`). If there is a default `index.html` or `default.html` in it, delete it.
4. Click **Upload** → choose `setwel-store-upload.zip` → wait for 100% → go back.
5. Right-click the zip → **Extract** → into the same folder.
6. Check the folder now shows `index.php`, `.htaccess`, and the folders `app`, `assets`, `storage`, `uploads` **directly** in it (not inside another folder). If they ended up inside a sub-folder, select everything in that sub-folder → **Move** → up one level.
7. Delete the zip file.

## Step 6 — Run the setup wizard

1. Open **https://setwelafrica.com** in your browser. The **Set up your store** page appears.
2. All server checks should show ✔. If one shows ✘, see *Problems* below.
3. Choose **MySQL** and fill in the database name, user and password from Step 4 (host stays `localhost`).
4. Site URL: `https://setwelafrica.com`
5. Type your name, email and a strong password for your admin login.
6. Leave **Add the 10 sample products** ticked (you can delete them later).
7. Click **Install**. You will land on the admin login page.

⚠️ Do Step 6 right after Step 5. Until the wizard has been completed, anyone who opens the site could run it.

## Step 7 — Log in and fill in Settings

Go to **https://setwelafrica.com/admin** and log in. The dashboard shows a yellow **Before you launch** list. Work through it in **Settings**:

- **Business details:** registration number, POPIA Information Officer, address, phone numbers.
- **Payments:** bank details for EFT.
- **Email:** see Step 8.
- **PayFast:** see Step 9.

## Step 8 — Email (so order emails don't land in spam)

1. cPanel → **Email Accounts** → create `sa@setwelafrica.com` (or use one you already have).
2. Click **Connect Devices** next to it and note the **Outgoing server** (usually `mail.setwelafrica.com`, port **465**, SSL).
3. Store admin → **Settings → Email**:
   - SMTP server: `mail.setwelafrica.com`
   - Port: `465`
   - Encryption: SSL
   - Username: `sa@setwelafrica.com`
   - Password: the mailbox password
4. **Save**, then click **Send test email** and check your inbox.

## Step 9 — PayFast

1. Log in to PayFast → **Settings → Developer Settings**. Copy your **Merchant ID** and **Merchant Key**. Set a **Passphrase** there if you don't have one.
2. Store admin → **Settings → Payments**: paste the Merchant ID, Merchant Key and Passphrase. The passphrase must match **exactly**.
3. **Test first.** Create a free account at https://sandbox.payfast.co.za. Put the sandbox Merchant ID, Key and Passphrase in Settings with mode **Sandbox**. Place a test order on your site and pay with the sandbox. The order must turn **Paid** by itself within a minute.
4. When the test works, change the settings to your **real** details with mode **Live**, and do one real small order (e.g. a R5 test product, then refund it in PayFast).

You do **not** need to type a notify URL in PayFast. The store sends it with every payment.

## Step 10 — Google (free)

- **Google Search Console** (search.google.com/search-console): add `setwelafrica.com`, then submit the sitemap `https://setwelafrica.com/sitemap.xml`.
- **Google Analytics 4**: create a property and copy the `G-XXXXXXX` ID into Settings → Marketing.
- **Meta Pixel** (optional): copy the Pixel ID into Settings → Marketing.
- **Google Merchant Center** (free product listings): Products → Feeds → add a **scheduled fetch** with the URL `https://setwelafrica.com/feeds/google-merchant.xml`.

Analytics and Pixel only load after a visitor clicks **Accept all** in the cookie notice (POPIA).

## Step 11 — Backups (important)

- cPanel → **Backup** (or **JetBackup** if your plan has it). Once a month, download a **Home Directory** backup and a **MySQL database** backup of `cpuser_setwel`.
- Keep the backups on your computer or Google Drive.

---

## Problems?

| What you see | What to do |
|---|---|
| A list of files instead of the shop | The `.htaccess` file is missing. Show hidden files (Step 5.2) and extract the zip again. |
| "This store needs PHP 8.1 or newer" | Do Step 3. |
| A setup check shows ✘ "folder writable" | File Manager → right-click the folder → **Change Permissions** → `755`. |
| "Could not connect to the database" | Use the **full** database name and username with the `cpuser_` prefix. Check the user was added to the database with ALL PRIVILEGES. |
| The site keeps redirecting / "too many redirects" | SSL isn't ready yet. Wait for AutoSSL (Step 2). |
| Emails not arriving | Settings → Email → **Send test email**. The technical reason is in `storage/logs/mail.log` (open it in File Manager). |
| PayFast order stays "Awaiting payment" | Check that the passphrase matches. Open `storage/logs/payfast.log` in File Manager — it says why. |

You can also open this project in Claude Code and say: *"My store shows <the problem>, here is the log: …"*.
