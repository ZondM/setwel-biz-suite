<?php
/** Public shop pages. */

function home_page(): void
{
    $today = date('Y-m-d');
    $banners = q_all("SELECT * FROM banners WHERE active = 1 AND placement = 'hero' AND (starts_on IS NULL OR starts_on <= ?) AND (ends_on IS NULL OR ends_on >= ?) ORDER BY sort_order, id", [$today, $today]);
    render('home', [
        'banners' => $banners,
        'featured' => products_featured(8),
        'deals' => products_specials(8),
        'newest' => products_new(8),
        'categories' => categories_visible(),
        'brands' => array_slice(array_values(array_filter(brands_visible(), fn($b) => $b['product_count'] > 0)), 0, 12),
        'meta' => ['canonical' => abs_url('/')],
    ]);
}

function listing_filters(): array
{
    $brand = $_GET['brand'] ?? [];
    return [
        'q' => trim((string)($_GET['q'] ?? '')),
        'brand' => array_values(array_filter(is_array($brand) ? $brand : [$brand], 'is_string')),
        'min' => is_numeric($_GET['min'] ?? '') ? $_GET['min'] : '',
        'max' => is_numeric($_GET['max'] ?? '') ? $_GET['max'] : '',
        'stock' => !empty($_GET['stock']) ? 1 : '',
        'sale' => !empty($_GET['sale']) ? 1 : '',
        'sort' => in_array($_GET['sort'] ?? '', ['price_asc', 'price_desc', 'newest', 'name'], true) ? $_GET['sort'] : '',
        'page' => max(1, (int)($_GET['page'] ?? 1)),
    ];
}

function render_listing(string $title, string $intro, array $f, array $extra = []): void
{
    $res = product_search($f);
    $noindex = $f['brand'] || $f['min'] !== '' || $f['max'] !== '' || $f['stock'] || $f['sort'] || $f['q'] !== '';
    render('listing', array_merge([
        'title' => $title,
        'intro' => $intro,
        'f' => $f,
        'res' => $res,
        'categories' => categories_visible(),
        'brands' => !empty($f['category']) && ($cid = q_val('SELECT id FROM categories WHERE slug = ?', [$f['category']])) ? brands_in_category((int)$cid) : brands_visible(),
        'meta' => ['title' => $title . ($f['page'] > 1 ? ' – page ' . $f['page'] : ''), 'description' => $intro ?: $title . ' — shop online at ' . setting('business_name') . '. Nationwide delivery.', 'robots' => $noindex ? 'noindex, follow' : null],
    ], $extra));
}

function shop_page(): void
{
    $f = listing_filters();
    $f['category'] = preg_match('/^[a-z0-9-]+$/', $_GET['category'] ?? '') ? $_GET['category'] : '';
    render_listing('All products', 'Genuine printers, ink, toner, laptop bags, storage and office technology.', $f, ['base' => 'shop']);
}

function category_page(string $slug): void
{
    $cat = q_one('SELECT * FROM categories WHERE slug = ? AND visible = 1', [$slug]);
    if (!$cat) {
        abort(404);
    }
    $f = listing_filters();
    $f['category'] = $slug;
    render_listing($cat['name'], (string)$cat['description'], $f, ['base' => 'category/' . $slug, 'currentCategory' => $cat,
        'crumbs' => [['Shop', url('shop')], [$cat['name'], null]]]);
}

function brand_page(string $slug): void
{
    $brand = q_one('SELECT * FROM brands WHERE slug = ? AND visible = 1', [$slug]);
    if (!$brand) {
        abort(404);
    }
    $f = listing_filters();
    $f['brand'] = [$slug];
    $f['category'] = preg_match('/^[a-z0-9-]+$/', $_GET['category'] ?? '') ? $_GET['category'] : '';
    render_listing($brand['name'] . ' products', $brand['description'] ?: 'Genuine ' . $brand['name'] . ' products from ' . setting('business_name') . ', delivered nationwide.', $f, ['base' => 'brand/' . $slug, 'currentBrand' => $brand,
        'crumbs' => [['Shop', url('shop')], [$brand['name'], null]]]);
}

function search_page(): void
{
    $f = listing_filters();
    $f['category'] = preg_match('/^[a-z0-9-]+$/', $_GET['category'] ?? '') ? $_GET['category'] : '';
    $title = $f['q'] !== '' ? 'Search results for “' . $f['q'] . '”' : 'Search';
    render_listing($title, '', $f, ['base' => 'search', 'isSearch' => true]);
}

function specials_page(): void
{
    $items = q_all(PRODUCT_SELECT . " WHERE p.visible = 1 AND (p.is_special = 1 OR (p.sale_price > 0 AND p.sale_price < p.price AND (p.sale_ends IS NULL OR p.sale_ends >= ?))) ORDER BY c.sort_order, b.name, p.name", [date('Y-m-d')]);
    $featured = $items ? [] : products_featured(12);
    render('specials', ['items' => $items, 'featured' => $featured, 'meta' => ['title' => 'Specials — ' . date('F Y'), 'description' => 'This month\'s specials on printers, ink, toner and office technology at ' . setting('business_name') . '. While stocks last.']]);
}

function new_page(): void
{
    $items = products_new(200);
    render('new', ['items' => $items, 'meta' => ['title' => 'New in Market', 'description' => 'The newest printers, scanners, cartridges, laptops and accessories at ' . setting('business_name') . '.']]);
}

function suggest_api(): void
{
    $q = trim((string)($_GET['q'] ?? ''));
    if (mb_strlen($q) < 2) {
        json_out(['items' => []]);
    }
    $res = product_search(['q' => $q], 6);
    $items = array_map(fn($p) => [
        'name' => $p['name'],
        'sku' => $p['sku'],
        'url' => product_url($p),
        'image' => upload_url($p['thumb'] ?: $p['image']),
        'price' => effective_price($p) > 0 ? money(effective_price($p), false) : 'Quote',
    ], $res['items']);
    header('Cache-Control: public, max-age=60');
    json_out(['items' => $items, 'total' => $res['total']]);
}

function product_page(string $slug): void
{
    $p = product_by_slug($slug);
    if (!$p) {
        abort(404);
    }
    $images = product_images((int)$p['id']);
    $price = effective_price($p);
    $avail = ['in_stock' => 'InStock', 'low_stock' => 'LimitedAvailability', 'on_order' => 'BackOrder', 'out_of_stock' => 'OutOfStock'][$p['stock_status']] ?? 'InStock';
    $schema = [
        '@context' => 'https://schema.org/', '@type' => 'Product',
        'name' => $p['name'], 'sku' => $p['sku'],
        'description' => excerpt($p['short_description'] ?: $p['description'], 500),
        'image' => array_map(fn($i) => abs_url($i['path']), $images) ?: [abs_url('assets/img/placeholder.svg')],
        'url' => abs_url('product/' . $p['slug']),
    ];
    if ($p['brand_name']) {
        $schema['brand'] = ['@type' => 'Brand', 'name' => $p['brand_name']];
    }
    if ($p['mpn']) {
        $schema['mpn'] = $p['mpn'];
    }
    if ($p['gtin']) {
        $schema['gtin'] = $p['gtin'];
    }
    if ($price > 0) {
        $offer = ['@type' => 'Offer', 'priceCurrency' => 'ZAR', 'price' => number_format($price, 2, '.', ''), 'availability' => 'https://schema.org/' . $avail,
            'itemCondition' => 'https://schema.org/NewCondition', 'url' => abs_url('product/' . $p['slug']),
            'seller' => ['@type' => 'Organization', 'name' => setting('legal_name') ?: setting('business_name')]];
        if (sale_active($p) && $p['sale_ends']) {
            $offer['priceValidUntil'] = $p['sale_ends'];
        }
        $schema['offers'] = $offer;
    }
    $crumbs = [['Shop', url('shop')]];
    if ($p['category_name']) {
        $crumbs[] = [$p['category_name'], url('category/' . $p['category_slug'])];
    }
    $crumbs[] = [$p['name'], null];
    $bcSchema = ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => []];
    foreach ($crumbs as $i => [$n, $u]) {
        $bcSchema['itemListElement'][] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $n, 'item' => $u ? abs_url(substr($u, strlen(base_path()))) : abs_url('product/' . $p['slug'])];
    }
    render('product', [
        'p' => $p,
        'images' => $images,
        'specs' => parse_specs($p['specs']),
        'compatible' => parse_list($p['compatible']),
        'supplies' => products_compatible_supplies($p),
        'related' => products_related($p),
        'crumbs' => $crumbs,
        'meta' => [
            'title' => $p['meta_title'] ?: $p['name'],
            'description' => $p['meta_description'] ?: ($p['short_description'] ?: excerpt($p['description'])) . ($price > 0 ? ' ' . money($price) . '.' : '') . ' Delivered nationwide.',
            'image' => $images ? abs_url($images[0]['path']) : null,
            'type' => 'product',
            'canonical' => abs_url('product/' . $p['slug']),
            'schema' => [$schema, $bcSchema],
            'events' => [['ga' => 'view_item', 'data' => ['currency' => 'ZAR', 'value' => $price, 'items' => [['item_id' => $p['sku'], 'item_name' => $p['name']]]], 'fb' => 'ViewContent', 'fbData' => ['content_ids' => [$p['sku']], 'content_type' => 'product', 'value' => $price, 'currency' => 'ZAR']]],
        ],
    ]);
}

function content_page(string $slug): void
{
    $page = q_one('SELECT * FROM pages WHERE slug = ?', [$slug]);
    if (!$page) {
        abort(404);
    }
    render('page', ['page' => $page, 'meta' => ['title' => $page['title'], 'description' => $page['meta_description'] ?: excerpt($page['content'])]]);
}

function credentials_page(): void
{
    $docs = q_all('SELECT * FROM documents WHERE is_public = 1 ORDER BY created_at DESC');
    render('credentials', ['docs' => $docs, 'meta' => ['title' => 'Authorised reseller credentials', 'description' => setting('reseller_details')]]);
}

function credential_file(string $id): void
{
    $d = q_one('SELECT * FROM documents WHERE id = ? AND is_public = 1', [(int)$id]);
    if (!$d) {
        abort(404);
    }
    send_private_file('docs', $d['file_path'], slugify($d['title']) . '.' . pathinfo($d['file_path'], PATHINFO_EXTENSION));
}

function quote_page(): void
{
    $errors = [];
    $prefill = '';
    if (!empty($_GET['product'])) {
        $p = q_one('SELECT name, sku FROM products WHERE id = ? AND visible = 1', [(int)$_GET['product']]);
        if ($p) {
            $prefill = $p['name'] . ' (' . $p['sku'] . ') × ' . max(1, (int)($_GET['qty'] ?? 1));
        }
    } elseif (!empty($_GET['item'])) {
        $prefill = mb_substr((string)$_GET['item'], 0, 200);
    } elseif (!empty($_GET['cart'])) {
        $prefill = implode("\n", array_map(fn($l) => $l['product']['name'] . ' (' . $l['product']['sku'] . ') × ' . $l['qty'], cart_lines()));
    }
    if (is_post()) {
        $d = [
            'name' => trim($_POST['name'] ?? ''), 'company' => trim($_POST['company'] ?? ''), 'customer_type' => trim($_POST['customer_type'] ?? ''),
            'email' => trim($_POST['email'] ?? ''), 'phone' => trim($_POST['phone'] ?? ''), 'items' => trim($_POST['items'] ?? ''), 'message' => trim($_POST['message'] ?? ''),
        ];
        if ($d['name'] === '') {
            $errors['name'] = 'Please enter your name.';
        }
        if (!valid_email($d['email'])) {
            $errors['email'] = 'Please enter a valid email address.';
        }
        if ($d['items'] === '') {
            $errors['items'] = 'Please tell us which products and quantities you need.';
        }
        if (empty($_POST['consent'])) {
            $errors['consent'] = 'Please agree so we can use your details to send the quote.';
        }
        if (is_spam() || rate_limited('quote', 5, 3600)) {
            $errors['form'] = 'Too many requests. Please try again later or WhatsApp us.';
        }
        if (!$errors) {
            $d['ref'] = random_ref('Q');
            $d['status'] = 'new';
            $d['created_at'] = now();
            $id = db_insert('quotes', array_map(fn($v) => mb_substr($v, 0, 5000), $d));
            $rows = '';
            foreach (['Name' => $d['name'], 'Company / school' => $d['company'], 'Customer type' => $d['customer_type'], 'Email' => $d['email'], 'Phone' => $d['phone']] as $k => $v) {
                $rows .= '<tr><td style="color:#5b6573;padding:4px 12px 4px 0">' . e($k) . '</td><td><strong>' . e($v) . '</strong></td></tr>';
            }
            $body = '<table>' . $rows . '</table><h3>Products</h3><p>' . nl2br(e($d['items'])) . '</p>' . ($d['message'] ? '<h3>Message</h3><p>' . nl2br(e($d['message'])) . '</p>' : '')
                . '<p><a href="' . e(abs_url('admin/quotes/' . $id)) . '">Open in admin</a></p>';
            send_mail(setting('orders_email') ?: setting('email'), 'New quote request ' . $d['ref'] . ' from ' . $d['name'], email_layout('New quote request ' . $d['ref'], $body), [], $d['email']);
            send_mail($d['email'], 'We received your quote request ' . $d['ref'], email_layout('Thank you — we are preparing your quote', '<p>Hi ' . e($d['name']) . ',</p><p>Thank you for your quote request (reference <strong>' . e($d['ref']) . '</strong>). We will email your quote within one working day.</p><p><strong>You asked for:</strong><br>' . nl2br(e($d['items'])) . '</p><p>Need it urgently? WhatsApp us on ' . e(setting('whatsapp')) . '.</p>'));
            flash('success', 'Thank you! Your quote request ' . $d['ref'] . ' was sent. We will reply within one working day.');
            redirect('/quote?sent=1');
        }
        keep_old($_POST);
    }
    render('quote', ['errors' => $errors, 'prefill' => $prefill, 'meta' => ['title' => 'Request a quote', 'description' => 'Request a quote for printers, ink, toner and office technology. Bulk and business pricing for companies, schools and government.']]);
}

function contact_page(): void
{
    $errors = [];
    if (is_post()) {
        $d = ['name' => trim($_POST['name'] ?? ''), 'email' => trim($_POST['email'] ?? ''), 'phone' => trim($_POST['phone'] ?? ''), 'subject' => trim($_POST['subject'] ?? ''), 'message' => trim($_POST['message'] ?? '')];
        if ($d['name'] === '') {
            $errors['name'] = 'Please enter your name.';
        }
        if (!valid_email($d['email'])) {
            $errors['email'] = 'Please enter a valid email address.';
        }
        if (mb_strlen($d['message']) < 5) {
            $errors['message'] = 'Please type your message.';
        }
        if (empty($_POST['consent'])) {
            $errors['consent'] = 'Please agree so we can reply to you.';
        }
        if (is_spam() || rate_limited('contact', 5, 3600)) {
            $errors['form'] = 'Too many messages. Please try again later or WhatsApp us.';
        }
        if (!$errors) {
            $d['created_at'] = now();
            db_insert('messages', array_map(fn($v) => mb_substr($v, 0, 5000), $d));
            send_mail(setting('email'), 'Website message: ' . ($d['subject'] ?: 'from ' . $d['name']), email_layout('New website message', '<p><strong>' . e($d['name']) . '</strong> · ' . e($d['email']) . ' · ' . e($d['phone']) . '</p><p>' . nl2br(e($d['message'])) . '</p>'), [], $d['email']);
            flash('success', 'Thank you — your message was sent. We usually reply within a few working hours.');
            redirect('/contact');
        }
        keep_old($_POST);
    }
    render('contact', ['errors' => $errors, 'meta' => ['title' => 'Contact us', 'description' => 'Contact ' . setting('business_name') . ': phone ' . setting('phone') . ', WhatsApp ' . setting('whatsapp') . ', email ' . setting('email') . '.']]);
}

function newsletter_signup(): void
{
    $email = strtolower(trim($_POST['email'] ?? ''));
    if (is_spam() || !valid_email($email) || rate_limited('newsletter', 5, 3600)) {
        flash('error', 'Please enter a valid email address.');
        back();
    }
    if (!q_val('SELECT id FROM subscribers WHERE email = ?', [$email])) {
        db_insert('subscribers', ['email' => $email, 'name' => trim($_POST['name'] ?? ''), 'created_at' => now(), 'ip' => client_ip()]);
    }
    flash('success', 'Thanks! You will receive our monthly specials. You can unsubscribe at any time.');
    back();
}
