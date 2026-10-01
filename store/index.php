<?php
/**
 * Setwel Africa online store — every page request starts here.
 * The table below says which function handles which web address.
 */

// When testing on a computer with "php -S", let real files (css, images) through.
if (PHP_SAPI === 'cli-server') {
    $f = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (is_file($f) && !preg_match('#/(app|storage)/#', $f)) {
        return false;
    }
}

require __DIR__ . '/app/bootstrap.php';

$path = '/' . trim(substr(rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH)), strlen(base_path())), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

foreach (glob(APP_DIR . '/controllers/*.php') as $file) {
    require $file;
}

if (!config('db_driver')) {
    install_controller();
    exit;
}

$routes = [
    // Shop
    ['GET', '/', 'home_page'],
    ['GET', '/shop', 'shop_page'],
    ['GET', '/category/([a-z0-9-]+)', 'category_page'],
    ['GET', '/brand/([a-z0-9-]+)', 'brand_page'],
    ['GET', '/product/([a-z0-9-]+)', 'product_page'],
    ['GET', '/search', 'search_page'],
    ['GET', '/specials', 'specials_page'],
    ['GET', '/api/suggest', 'suggest_api'],
    ['GET|POST', '/quote', 'quote_page'],
    ['GET|POST', '/contact', 'contact_page'],
    ['POST', '/newsletter', 'newsletter_signup'],
    ['GET', '/credentials', 'credentials_page'],
    ['GET', '/credentials/(\d+)', 'credential_file'],
    ['GET', '/page/([a-z0-9-]+)', 'content_page'],
    // Cart & checkout
    ['GET', '/cart', 'cart_page'],
    ['POST', '/cart/add', 'cart_add_action'],
    ['POST', '/cart/update', 'cart_update_action'],
    ['GET|POST', '/checkout', 'checkout_page'],
    ['GET', '/order/([A-Z0-9-]+)', 'order_page'],
    ['GET', '/order/([A-Z0-9-]+)/invoice', 'order_invoice'],
    ['POST', '/order/([A-Z0-9-]+)/pop', 'order_pop_upload'],
    ['GET', '/order/([A-Z0-9-]+)/pay', 'order_pay'],
    ['GET', '/payfast/return', 'payfast_return'],
    ['GET', '/payfast/cancel', 'payfast_cancel'],
    ['POST', '/payfast/notify', 'payfast_notify'],
    // SEO & feeds
    ['GET', '/sitemap.xml', 'sitemap_xml'],
    ['GET', '/robots.txt', 'robots_txt'],
    ['GET', '/feeds/google-merchant.xml', 'merchant_feed'],
    // Admin
    ['GET|POST', '/admin/login', 'admin_login_page'],
    ['POST', '/admin/logout', 'admin_logout'],
    ['GET', '/admin', 'admin_dashboard'],
    ['GET', '/admin/products', 'admin_products'],
    ['POST', '/admin/products/bulk', 'admin_products_bulk'],
    ['GET|POST', '/admin/products/new', 'admin_product_form'],
    ['GET|POST', '/admin/products/(\d+)', 'admin_product_form'],
    ['POST', '/admin/products/(\d+)/delete', 'admin_product_delete'],
    ['POST', '/admin/products/(\d+)/images', 'admin_product_images'],
    ['GET|POST', '/admin/images', 'admin_bulk_images'],
    ['GET|POST', '/admin/import', 'admin_import'],
    ['GET', '/admin/import/template.(xlsx|csv)', 'admin_import_template'],
    ['GET', '/admin/export.(xlsx|csv)', 'admin_export'],
    ['GET', '/admin/orders', 'admin_orders'],
    ['GET|POST', '/admin/orders/(\d+)', 'admin_order'],
    ['GET', '/admin/orders/(\d+)/invoice', 'admin_order_invoice'],
    ['GET', '/admin/orders/(\d+)/pop', 'admin_order_pop'],
    ['GET', '/admin/quotes', 'admin_quotes'],
    ['GET|POST', '/admin/quotes/(\d+)', 'admin_quote'],
    ['GET|POST', '/admin/messages', 'admin_messages'],
    ['GET|POST', '/admin/subscribers', 'admin_subscribers'],
    ['GET|POST', '/admin/banners', 'admin_banners'],
    ['GET|POST', '/admin/banners/(\d+|new)', 'admin_banner_form'],
    ['GET|POST', '/admin/pages', 'admin_pages'],
    ['GET|POST', '/admin/pages/(\d+)', 'admin_page_form'],
    ['GET|POST', '/admin/documents', 'admin_documents'],
    ['GET', '/admin/documents/(\d+)', 'admin_document_file'],
    ['GET|POST', '/admin/catalog', 'admin_catalog'],
    ['GET|POST', '/admin/settings', 'admin_settings'],
    ['GET|POST', '/admin/account', 'admin_account'],
];

foreach ($routes as [$methods, $pattern, $handler]) {
    if (!in_array($method, explode('|', $methods), true) && !($method === 'HEAD' && str_contains($methods, 'GET'))) {
        continue;
    }
    if (preg_match('#^' . $pattern . '$#', $path, $m)) {
        array_shift($m);
        if ($method === 'POST' && $handler !== 'payfast_notify') {
            csrf_check();
        }
        try {
            $handler(...$m);
        } catch (Throwable $e) {
            error_log($e);
            if (config('debug')) {
                throw $e;
            }
            abort(500);
        }
        exit;
    }
}
abort(404);
