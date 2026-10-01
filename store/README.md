# Setwel Africa online store — technical notes

Plain PHP 8.1+ with MySQL/MariaDB or SQLite. No frameworks, no Composer, no build step. Upload the folder to cPanel and it runs.

```
index.php            front controller + route table (every URL is listed here)
.htaccess            rewrites, HTTPS, blocks app/ and storage/
app/bootstrap.php    loads config, libraries, session
app/config.php       created by the setup wizard (DB credentials) — never commit
app/lib/             helpers, db (schema), settings, catalog, cart, orders,
                     importer (Excel/CSV), spreadsheet (xlsx read/write), pdf (invoices),
                     payfast, mailer (SMTP), images (GD resize), text (page formatting)
app/controllers/     shop, checkout, seo (sitemap/feed), admin*, install
app/views/           PHP templates (layout.php = shop, admin/layout.php = admin)
app/seed.php         categories, brands, pages and the 10 sample products
assets/              css, js, logo
uploads/             product/banner images (public, PHP execution blocked)
storage/             database file, proof-of-payment, documents, logs (private)
```

- Settings live in the `settings` table, with defaults in `app/lib/settings.php`.
- Selling price = `price_from_cost()` in `settings.php`: cost × (1 + markup%), rounded up.
- Local test: `cd store && php -S 127.0.0.1:8080 index.php`, then open http://127.0.0.1:8080 and choose SQLite in the wizard.
- Upload zip: `php build-store-zip.php` (repo root) → `dist/setwel-store-upload.zip`.
- To upgrade a live site, upload the changed files only. Never overwrite `app/config.php`, `storage/` or `uploads/`. The database schema is created with `CREATE TABLE IF NOT EXISTS`. New columns need an `ALTER TABLE` added to `install_schema()`.
