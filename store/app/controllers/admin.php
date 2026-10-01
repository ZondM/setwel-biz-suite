<?php
/** Admin: login, dashboard, settings, account, categories & brands, messages, subscribers. */

function admin_view(string $view, array $data = []): void
{
    render('admin/' . $view, $data, 'admin/layout');
}

function admin_login_page(): void
{
    if (admin_user()) {
        redirect('/admin');
    }
    $error = '';
    if (is_post()) {
        $res = admin_login(trim($_POST['email'] ?? ''), (string)($_POST['password'] ?? ''));
        if ($res === true) {
            $to = $_SESSION['after_login'] ?? url('admin');
            unset($_SESSION['after_login']);
            redirect(str_starts_with($to, base_path() . '/admin') ? $to : url('admin'));
        }
        $error = $res;
    }
    header('X-Robots-Tag: noindex');
    render('admin/login', ['error' => $error], null);
}

function admin_logout(): void
{
    unset($_SESSION['admin_id']);
    session_regenerate_id(true);
    redirect('/admin/login');
}

function admin_dashboard(): void
{
    require_admin();
    $month = date('Y-m-01 00:00:00');
    admin_view('dashboard', [
        'title' => 'Dashboard',
        'stats' => [
            'products' => (int)q_val('SELECT COUNT(*) FROM products'),
            'visible' => (int)q_val('SELECT COUNT(*) FROM products WHERE visible = 1'),
            'no_image' => (int)q_val('SELECT COUNT(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)'),
            'no_price' => (int)q_val('SELECT COUNT(*) FROM products WHERE price IS NULL OR price = 0'),
            'orders_open' => (int)q_val("SELECT COUNT(*) FROM orders WHERE status IN ('pending_payment','payment_review','processing','ready_for_collection')"),
            'sales_month' => (float)q_val("SELECT COALESCE(SUM(total),0) FROM orders WHERE payment_status = 'paid' AND created_at >= ?", [$month]),
            'quotes_new' => (int)q_val("SELECT COUNT(*) FROM quotes WHERE status = 'new'"),
            'subscribers' => (int)q_val('SELECT COUNT(*) FROM subscribers'),
        ],
        'orders' => q_all('SELECT * FROM orders ORDER BY id DESC LIMIT 8'),
        'quotes' => q_all('SELECT * FROM quotes ORDER BY id DESC LIMIT 5'),
        'warnings' => admin_setup_warnings(),
    ]);
}

/** Things still to do before launch, shown on the dashboard. */
function admin_setup_warnings(): array
{
    $w = [];
    if (setting('payfast_mode') !== 'live') {
        $w[] = 'PayFast is in TEST (sandbox) mode — no real money is collected. Switch to Live in Settings when you launch.';
    }
    if (!setting('bank_account_number')) {
        $w[] = 'Add your bank details in Settings so EFT customers know where to pay.';
    }
    if (!setting('smtp_host')) {
        $w[] = 'Email (SMTP) is not set up — emails use the server default and may land in spam. Add your mailbox in Settings → Email.';
    }
    if (!setting('registration_number')) {
        $w[] = 'Add your company registration number (required on the Terms page by the ECT Act).';
    }
    if (!setting('information_officer')) {
        $w[] = 'Add your POPIA Information Officer name in Settings.';
    }
    if (!q_val('SELECT COUNT(*) FROM documents WHERE is_public = 1')) {
        $w[] = 'Upload your authorised-reseller letters/certificates under "Certificates & letters" and tick "Show on website".';
    }
    return $w;
}

function admin_account(): void
{
    $u = require_admin();
    if (is_post()) {
        $action = $_POST['action'] ?? '';
        if ($action === 'password') {
            $row = q_one('SELECT * FROM admins WHERE id = ?', [$u['id']]);
            if (!password_verify($_POST['current'] ?? '', $row['password_hash'])) {
                flash('error', 'Your current password is wrong.');
            } elseif ($p = password_problem($_POST['new'] ?? '')) {
                flash('error', $p);
            } elseif (($_POST['new'] ?? '') !== ($_POST['new2'] ?? '')) {
                flash('error', 'The new passwords do not match.');
            } else {
                db_update('admins', ['password_hash' => password_hash($_POST['new'], PASSWORD_DEFAULT)], 'id = ?', [$u['id']]);
                flash('success', 'Password changed.');
            }
        } elseif ($action === 'add_admin') {
            $email = strtolower(trim($_POST['email'] ?? ''));
            if (!valid_email($email) || q_val('SELECT id FROM admins WHERE email = ?', [$email])) {
                flash('error', 'Enter a valid email that is not already an admin.');
            } elseif ($p = password_problem($_POST['password'] ?? '')) {
                flash('error', $p);
            } else {
                admin_create(trim($_POST['name'] ?? 'Staff'), $email, $_POST['password']);
                flash('success', 'New admin login created for ' . $email . '.');
            }
        } elseif ($action === 'remove_admin') {
            $id = (int)($_POST['id'] ?? 0);
            if ($id === (int)$u['id']) {
                flash('error', 'You cannot remove yourself.');
            } else {
                q('DELETE FROM admins WHERE id = ?', [$id]);
                flash('success', 'Admin removed.');
            }
        }
        redirect('/admin/account');
    }
    admin_view('account', ['title' => 'My account', 'me' => $u, 'admins' => q_all('SELECT id, name, email, last_login FROM admins ORDER BY id')]);
}

function settings_groups(): array
{
    return [
        'Business details' => [
            'business_name' => ['Trading name', 'text'],
            'legal_name' => ['Registered company name', 'text'],
            'registration_number' => ['Company registration number (CIPC)', 'text', 'Shown on Terms and invoices (required by ECT Act s43).'],
            'tagline' => ['Tagline', 'text'],
            'site_url' => ['Website address', 'text', 'e.g. https://setwelafrica.com — used in emails, PayFast and Google feed.'],
            'email' => ['Public email', 'text'],
            'orders_email' => ['Where new orders & quotes are emailed', 'text'],
            'phone' => ['Main phone', 'text'],
            'phone2' => ['Second phone', 'text'],
            'whatsapp' => ['WhatsApp number', 'text'],
            'address' => ['Address (one line per row)', 'textarea'],
            'hours' => ['Opening hours', 'text'],
            'map_query' => ['Map location (address for Google Maps)', 'text'],
            'information_officer' => ['POPIA Information Officer (name)', 'text'],
        ],
        'Trust & credentials' => [
            'reseller_statement' => ['Authorised reseller line (header & footer)', 'text', 'Must match what your authorisation letters say. Upload the letters under "Certificates & letters".'],
            'reseller_details' => ['Credentials page text', 'textarea'],
            'bbbee_statement' => ['Ownership / B-BBEE line', 'text', 'Leave blank to hide. Only claim what your affidavit/certificate supports.'],
            'show_brand_logos' => ['Show brand logos (only if you have written permission)', 'bool'],
        ],
        'Pricing & delivery' => [
            'markup_percent' => ['Markup on supplier cost (%)', 'number', 'Added on top of the supplier\'s price excl. VAT. The 55% already includes the 15% VAT you pay the supplier. Example: R299 + 55% = R463.45 → rounded R464.'],
            'price_rounding' => ['Round selling prices UP to the nearest (R)', 'select', '', ['0' => 'No rounding (cents)', '1' => 'R1', '5' => 'R5', '10' => 'R10']],
            'vat_registered' => ['We are VAT registered', 'bool', 'Leave OFF — you told us Setwel Africa is not VAT registered. Invoices then say "Invoice" (not "Tax invoice").'],
            'delivery_fee' => ['Courier delivery fee (R)', 'number'],
            'free_delivery_threshold' => ['Free delivery from order value (R)', 'number', '0 = never free.'],
            'delivery_note' => ['Delivery time note', 'text'],
            'allow_collection' => ['Allow customers to collect', 'bool'],
            'collection_address' => ['Collection address', 'text'],
        ],
        'Payments' => [
            'payfast_enabled' => ['Accept PayFast (card, Instant EFT, etc.)', 'bool'],
            'payfast_mode' => ['PayFast mode', 'select', 'Use Sandbox (test) until you have tested an order, then Live.', ['sandbox' => 'Sandbox (testing — no real money)', 'live' => 'Live (real payments)']],
            'payfast_merchant_id' => ['PayFast Merchant ID', 'text', 'PayFast dashboard → Settings → Developer settings.'],
            'payfast_merchant_key' => ['PayFast Merchant Key', 'text'],
            'payfast_passphrase' => ['PayFast Passphrase', 'password', 'Must be EXACTLY the same as in your PayFast developer settings (leave blank if you did not set one).'],
            'payfast_check_ip' => ['Check that payment notices come from PayFast servers', 'bool'],
            'eft_enabled' => ['Accept manual EFT with proof of payment', 'bool'],
            'bank_name' => ['Bank', 'text'],
            'bank_account_name' => ['Account name', 'text'],
            'bank_account_number' => ['Account number', 'text'],
            'bank_branch_code' => ['Branch code', 'text'],
            'bank_account_type' => ['Account type', 'text'],
        ],
        'Email' => [
            'mail_from_name' => ['Send emails as (name)', 'text'],
            'mail_from' => ['Send emails from (address)', 'text', 'Use a mailbox on your own domain, e.g. sa@setwelafrica.com.'],
            'smtp_host' => ['SMTP server', 'text', 'cPanel → Email Accounts → Connect Devices. Usually mail.setwelafrica.com'],
            'smtp_port' => ['SMTP port', 'number', '465 (SSL) is usual.'],
            'smtp_secure' => ['Encryption', 'select', '', ['ssl' => 'SSL (port 465)', 'tls' => 'STARTTLS (port 587)', 'none' => 'None']],
            'smtp_user' => ['SMTP username (full email address)', 'text'],
            'smtp_pass' => ['SMTP password', 'password'],
        ],
        'Marketing & SEO' => [
            'announcement' => ['Announcement bar (top of every page)', 'text', 'Leave blank to hide.'],
            'home_title' => ['Home page title (Google)', 'text'],
            'home_description' => ['Home page description (Google)', 'textarea'],
            'ga4_id' => ['Google Analytics 4 Measurement ID', 'text', 'Looks like G-XXXXXXXXXX. Loads only after the visitor accepts cookies.'],
            'meta_pixel_id' => ['Meta (Facebook) Pixel ID', 'text', 'Numbers only. Loads only after the visitor accepts cookies.'],
        ],
    ];
}

function admin_settings(): void
{
    require_admin();
    $groups = settings_groups();
    if (is_post()) {
        if (($_POST['action'] ?? '') === 'test_email') {
            $ok = send_mail(setting('orders_email') ?: setting('email'), 'Test email from your store', email_layout('It works!', '<p>Your store can send email. 🎉</p>'));
            flash($ok ? 'success' : 'error', $ok ? 'Test email sent to ' . (setting('orders_email') ?: setting('email')) . '. Check your inbox (and spam folder).' : 'Email failed. Check the SMTP details. Technical detail is in storage/logs/mail.log.');
            redirect('/admin/settings#Email');
        }
        foreach ($groups as $fields) {
            foreach ($fields as $key => $def) {
                $type = $def[1];
                if ($type === 'bool') {
                    setting_save($key, !empty($_POST[$key]) ? '1' : '0');
                } elseif ($type === 'password') {
                    if (($_POST[$key] ?? '') !== '') {
                        setting_save($key, $_POST[$key]);
                    } elseif (!empty($_POST['clear_' . $key])) {
                        setting_save($key, '');
                    }
                } elseif (isset($_POST[$key])) {
                    $v = trim((string)$_POST[$key]);
                    if ($type === 'number') {
                        $v = (string)max(0, (float)str_replace([',', ' ', 'R'], ['.', '', ''], $v));
                    }
                    if ($key === 'site_url') {
                        $v = rtrim($v, '/');
                    }
                    setting_save($key, $v);
                }
            }
        }
        flash('success', 'Settings saved.');
        redirect('/admin/settings');
    }
    admin_view('settings', ['title' => 'Settings', 'groups' => $groups]);
}

function admin_catalog(): void
{
    require_admin();
    if (is_post()) {
        $type = ($_POST['type'] ?? '') === 'brands' ? 'brands' : 'categories';
        $action = $_POST['action'] ?? '';
        if ($action === 'add' && trim($_POST['name'] ?? '') !== '') {
            find_or_create($type, $_POST['name']);
            flash('success', 'Added.');
        } elseif ($action === 'save') {
            foreach ((array)($_POST['rows'] ?? []) as $id => $r) {
                $data = ['name' => trim($r['name'] ?? ''), 'sort_order' => (int)($r['sort_order'] ?? 0), 'visible' => !empty($r['visible']) ? 1 : 0, 'description' => trim($r['description'] ?? '')];
                if ($type === 'categories') {
                    $data['icon'] = $r['icon'] ?? 'grid';
                }
                if ($data['name'] !== '') {
                    db_update($type, $data, 'id = ?', [(int)$id]);
                }
            }
            flash('success', 'Saved.');
        } elseif ($action === 'logo' && $type === 'brands') {
            $f = uploaded_files('logo')[0] ?? null;
            if ($f && ($res = store_image($f['tmp_name'], 'brands', 'brand-logo', 400, 200))) {
                db_update('brands', ['logo' => $res['path']], 'id = ?', [(int)$_POST['id']]);
                flash('success', 'Logo uploaded. Logos only show if "Show brand logos" is ticked in Settings.');
            } else {
                flash('error', 'Please choose an image file.');
            }
        } elseif ($action === 'delete') {
            $id = (int)($_POST['id'] ?? 0);
            $col = $type === 'brands' ? 'brand_id' : 'category_id';
            $n = (int)q_val("SELECT COUNT(*) FROM products WHERE $col = ?", [$id]);
            if ($n) {
                flash('error', "Cannot delete: $n product(s) still use it. Move them first, or just untick Visible.");
            } else {
                q("DELETE FROM $type WHERE id = ?", [$id]);
                flash('success', 'Deleted.');
            }
        }
        redirect('/admin/catalog');
    }
    admin_view('catalog', [
        'title' => 'Categories & brands',
        'categories' => q_all('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS n FROM categories c ORDER BY sort_order, name'),
        'brands' => q_all('SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS n FROM brands b ORDER BY sort_order, name'),
    ]);
}

function admin_messages(): void
{
    require_admin();
    if (is_post()) {
        q('UPDATE messages SET handled = ? WHERE id = ?', [!empty($_POST['handled']) ? 1 : 0, (int)$_POST['id']]);
        redirect('/admin/messages');
    }
    admin_view('messages', ['title' => 'Messages', 'messages' => q_all('SELECT * FROM messages ORDER BY handled, id DESC LIMIT 300')]);
}

function admin_subscribers(): void
{
    require_admin();
    if (isset($_GET['export'])) {
        $rows = [['Email', 'Name', 'Signed up']];
        foreach (q_all('SELECT * FROM subscribers ORDER BY id') as $s) {
            $rows[] = [$s['email'], $s['name'], $s['created_at']];
        }
        csv_download('newsletter-subscribers-' . date('Y-m-d') . '.csv', $rows);
    }
    if (is_post() && isset($_POST['remove'])) {
        q('DELETE FROM subscribers WHERE id = ?', [(int)$_POST['remove']]);
        flash('success', 'Subscriber removed.');
        redirect('/admin/subscribers');
    }
    admin_view('subscribers', ['title' => 'Newsletter subscribers', 'subs' => q_all('SELECT * FROM subscribers ORDER BY id DESC')]);
}
