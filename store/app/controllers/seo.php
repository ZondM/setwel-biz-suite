<?php
/** Sitemap, robots.txt and the Google Merchant Center product feed. */

function sitemap_xml(): void
{
    header('Content-Type: application/xml; charset=utf-8');
    $urls = [[abs_url('/'), date('Y-m-d')], [abs_url('shop'), date('Y-m-d')], [abs_url('specials'), date('Y-m-d')], [abs_url('quote'), null], [abs_url('contact'), null], [abs_url('credentials'), null]];
    foreach (categories_visible() as $c) {
        $urls[] = [abs_url('category/' . $c['slug']), null];
    }
    foreach (brands_visible() as $b) {
        $urls[] = [abs_url('brand/' . $b['slug']), null];
    }
    foreach (q_all('SELECT slug, updated_at FROM pages') as $p) {
        $urls[] = [abs_url('page/' . $p['slug']), substr((string)$p['updated_at'], 0, 10)];
    }
    foreach (q_all('SELECT slug, updated_at FROM products WHERE visible = 1') as $p) {
        $urls[] = [abs_url('product/' . $p['slug']), substr((string)$p['updated_at'], 0, 10)];
    }
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($urls as [$u, $d]) {
        echo '<url><loc>' . e($u) . '</loc>' . ($d ? '<lastmod>' . e($d) . '</lastmod>' : '') . "</url>\n";
    }
    echo '</urlset>';
}

function robots_txt(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    echo "User-agent: *\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order/\nDisallow: /payfast/\nDisallow: /api/\n\nSitemap: " . abs_url('sitemap.xml') . "\n";
}

/** Google Merchant Center feed (RSS 2.0). Add this URL in Merchant Center → Products → Feeds → Scheduled fetch. */
function merchant_feed(): void
{
    header('Content-Type: application/xml; charset=utf-8');
    $items = q_all(PRODUCT_SELECT . ' WHERE p.visible = 1 AND p.price > 0');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>';
    echo '<title>' . e(setting('business_name')) . '</title><link>' . e(abs_url('/')) . '</link><description>' . e(setting('tagline')) . '</description>' . "\n";
    $avail = ['in_stock' => 'in_stock', 'low_stock' => 'in_stock', 'on_order' => 'backorder', 'out_of_stock' => 'out_of_stock'];
    foreach ($items as $p) {
        $img = $p['image'] ? abs_url($p['image']) : '';
        if (!$img) {
            continue; // Google requires an image
        }
        echo '<item>';
        echo '<g:id>' . e($p['sku']) . '</g:id>';
        echo '<g:title>' . e(mb_substr($p['name'], 0, 150)) . '</g:title>';
        echo '<g:description>' . e(mb_substr(trim(($p['short_description'] ?? '') . ' ' . ($p['description'] ?? '')) ?: $p['name'], 0, 5000)) . '</g:description>';
        echo '<g:link>' . e(abs_url('product/' . $p['slug'])) . '</g:link>';
        echo '<g:image_link>' . e($img) . '</g:image_link>';
        foreach (array_slice(product_images((int)$p['id']), 1, 5) as $extra) {
            echo '<g:additional_image_link>' . e(abs_url($extra['path'])) . '</g:additional_image_link>';
        }
        echo '<g:availability>' . ($avail[$p['stock_status']] ?? 'in_stock') . '</g:availability>';
        echo '<g:price>' . number_format((float)$p['price'], 2, '.', '') . ' ZAR</g:price>';
        if (sale_active($p)) {
            echo '<g:sale_price>' . number_format((float)$p['sale_price'], 2, '.', '') . ' ZAR</g:sale_price>';
            if ($p['sale_ends']) {
                echo '<g:sale_price_effective_date>' . date('Y-m-d') . 'T00:00+02:00/' . e($p['sale_ends']) . 'T23:59+02:00</g:sale_price_effective_date>';
            }
        }
        echo '<g:condition>new</g:condition>';
        if ($p['brand_name']) {
            echo '<g:brand>' . e($p['brand_name']) . '</g:brand>';
        }
        if ($p['gtin']) {
            echo '<g:gtin>' . e($p['gtin']) . '</g:gtin>';
        }
        if ($p['mpn']) {
            echo '<g:mpn>' . e($p['mpn']) . '</g:mpn>';
        }
        if (!$p['gtin'] && !$p['mpn']) {
            echo '<g:identifier_exists>no</g:identifier_exists>';
        }
        if ($p['category_name']) {
            echo '<g:product_type>' . e($p['category_name']) . '</g:product_type>';
        }
        echo '<g:shipping><g:country>ZA</g:country><g:service>Courier</g:service><g:price>' . number_format(effective_price($p) >= (float)setting('free_delivery_threshold') && (float)setting('free_delivery_threshold') > 0 ? 0 : (float)setting('delivery_fee'), 2, '.', '') . ' ZAR</g:price></g:shipping>';
        echo "</item>\n";
    }
    echo '</channel></rss>';
}
