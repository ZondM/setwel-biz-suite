# Start here

## What is in this folder

| File / folder | What it is | What you do with it |
|---|---|---|
| **START-HERE.html** | This guide (all guides on one page) | Double-click to read it in Chrome |
| **OPEN-WEBSITE-PREVIEW.html** | A copy of the whole shop: all 652 products, every category, New in Market and Specials | Double-click to look around the shop. Nothing to install |
| website-preview | The files for the preview above | Leave it next to OPEN-WEBSITE-PREVIEW.html |
| **PREVIEW-WEBSITE.bat** | The full working shop **and admin area** on your computer (needs PHP) | Optional — use it to try the admin, import and checkout before uploading |
| **dist\setwel-store-upload.zip** | The finished website, packed for your hosting | The **only** file you upload to cPanel (install guide below) |
| store | The website's working files | Leave it alone — the zip above is made from it |
| docs | The same guides as plain-text (.md) files | For Claude Code — you can ignore them |
| build-store-zip.php, README.md, .gitignore | Technical files | Ignore |
| Setwel-Africa-BusinessSuite-PORTABLE.zip | Your older Business Suite app | Not part of the website |

## Look at the shop (easiest)

Double-click **OPEN-WEBSITE-PREVIEW.html**. The shop opens in Chrome and you can click through the home page, categories, products, specials and information pages.

It is a snapshot. Add to cart, search, checkout and the forms only work on the live website. It shows the products and prices as they will be on the day you install the website — not edits you make later in the admin.

## Try the full shop and admin area (optional)

The real shop is a **PHP** website: its pages are built by a server when someone visits. To run the real thing on your computer, including the admin area:

1. Open the folder and double-click **PREVIEW-WEBSITE.bat**.
   - If Windows shows "Windows protected your PC", click **More info → Run anyway**. The file is in your own project folder.
2. A black window opens. The first time, it downloads a free program called PHP (about 30 MB, one time only).
3. Chrome opens at **http://127.0.0.1:8080** with the **Set up your store** page:
   - Database: choose **SQLite**
   - Type any name, email and password (only for this preview)
   - Leave **Add the 10 sample products** ticked → **Install**
4. Log in. The admin area is at **http://127.0.0.1:8080/admin** and the shop is at **http://127.0.0.1:8080**.
5. To stop the preview, close the black window. Double-click the .bat file again to restart it; your preview products are kept.

Notes:
- The preview is only on your computer. Nobody else can see it.
- Emails and PayFast won't work in the preview. They work once the site is on your hosting.
- To start the preview from scratch, delete the file `store\app\config.php` and everything inside `store\storage\db`, then run the .bat again.
- If the download fails, the black window tells you how to get PHP by hand (about 2 minutes).
