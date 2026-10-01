# Start here

## What is in this folder

| File / folder | What it is | What you do with it |
|---|---|---|
| **START-HERE.html** | This guide (all guides on one page) | Double-click to read it in Chrome |
| **PREVIEW-WEBSITE.bat** | Shows the website on your own computer | Double-click to try the shop before uploading |
| **dist\setwel-store-upload.zip** | The finished website, packed for your hosting | The **only** file you upload to cPanel (install guide below) |
| store | The website's working files | Leave it alone — the zip above is made from it |
| docs | The same guides as plain-text (.md) files | For Claude Code — you can ignore them |
| build-store-zip.php, README.md, .gitignore | Technical files | Ignore |
| Setwel-Africa-BusinessSuite-PORTABLE.zip | Your older Business Suite app | Not part of the website |

Why is there no `.html` page to open for the shop? The shop is a **PHP** website. Its pages are created by your hosting's server when someone visits, so they can't be opened by double-clicking. To see the shop on your computer, use **PREVIEW-WEBSITE.bat**.

## Preview the website on your computer

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
