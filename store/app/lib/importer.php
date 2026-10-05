<?php
/**
 * Product import from Excel/CSV.
 *  - Matching SKU  → product is UPDATED (empty cells never wipe existing data).
 *  - New SKU       → product is ADDED.
 *  - Columns can be named anything: you match them to store fields on the mapping screen,
 *    and can save that mapping (e.g. "Kolok price sheet") for next month.
 */

function import_fields(): array
{
    return [
        'sku' => 'SKU / product code (required)',
        'name' => 'Product name',
        'brand' => 'Brand',
        'category' => 'Category',
        'cost_price' => 'Supplier cost (excl. VAT)',
        'price' => 'Selling price',
        'sale_price' => 'Sale price',
        'sale_ends' => 'Sale ends (date)',
        'stock_status' => 'Stock status / quantity',
        'visible' => 'Visible on website (yes/no)',
        'featured' => 'Featured (yes/no)',
        'is_new' => 'New in market (yes/no)',
        'is_special' => 'On special (yes/no)',
        'short_description' => 'Short description',
        'description' => 'Full description',
        'specs' => 'Specifications',
        'compatible' => 'Compatible printers',
        'image_urls' => 'Image URLs (comma separated)',
        'mpn' => 'Manufacturer part number',
        'gtin' => 'Barcode / EAN / GTIN',
        'warranty' => 'Warranty',
        'meta_title' => 'SEO title',
        'meta_description' => 'SEO description',
    ];
}

/** Header words we recognise automatically (lower case, no punctuation). */
function import_synonyms(): array
{
    return [
        'sku' => ['sku', 'code', 'stock code', 'stockcode', 'item code', 'itemcode', 'product code', 'productcode', 'item no', 'item number', 'part code', 'article', 'kolok code', 'product id'],
        'name' => ['name', 'product name', 'product', 'title', 'item', 'item name', 'product title', 'item description'],
        'brand' => ['brand', 'manufacturer', 'make', 'vendor', 'brand name'],
        'category' => ['category', 'categories', 'product category', 'group', 'product group', 'type', 'class'],
        'cost_price' => ['cost', 'cost price', 'dealer', 'dealer price', 'price excl', 'price excl vat', 'price ex vat', 'excl vat', 'ex vat', 'nett', 'net price', 'reseller price', 'your price', 'kolok price', 'supplier price', 'cost excl vat', 'special price', 'promo price', 'buy price'],
        'price' => ['price', 'selling price', 'sell price', 'retail', 'retail price', 'our price', 'setwel price'],
        'sale_price' => ['sale price', 'sale', 'special', 'discount price', 'promo selling price'],
        'sale_ends' => ['sale ends', 'sale end', 'valid until', 'promo end', 'end date', 'expiry'],
        'stock_status' => ['stock', 'stock status', 'availability', 'qty', 'quantity', 'soh', 'stock on hand', 'available', 'in stock'],
        'visible' => ['visible', 'show', 'published', 'active', 'online', 'status'],
        'featured' => ['featured', 'feature', 'highlight', 'popular'],
        'is_new' => ['new', 'new in market', 'is new', 'new product'],
        'is_special' => ['special', 'on special', 'specials', 'promotion'],
        'short_description' => ['short description', 'summary', 'short desc', 'tagline'],
        'description' => ['description', 'long description', 'details', 'full description', 'desc'],
        'specs' => ['specs', 'specifications', 'specification', 'features', 'tech specs'],
        'compatible' => ['compatible', 'compatible printers', 'compatibility', 'fits', 'for printers', 'suitable for', 'printer models'],
        'image_urls' => ['image', 'images', 'image url', 'image urls', 'picture', 'photo', 'image link'],
        'mpn' => ['mpn', 'part number', 'part no', 'manufacturer part number', 'model', 'model number', 'oem code', 'oem'],
        'gtin' => ['gtin', 'ean', 'barcode', 'upc', 'ean13'],
        'warranty' => ['warranty', 'guarantee'],
        'meta_title' => ['seo title', 'meta title'],
        'meta_description' => ['seo description', 'meta description'],
    ];
}

function norm_header(string $h): string
{
    return trim(preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9]+/', ' ', strtolower($h))));
}

/** Find the header row (some supplier sheets have a logo/title in the first rows). */
function import_find_header(array $rows): int
{
    $syn = array_merge(...array_values(import_synonyms()));
    $best = 0;
    $bestScore = -1;
    foreach (array_slice($rows, 0, 20, true) as $i => $r) {
        $cells = array_filter($r, fn($v) => trim((string)$v) !== '');
        if (count($cells) < 2) {
            continue;
        }
        $score = 0;
        foreach ($cells as $c) {
            if (in_array(norm_header((string)$c), $syn, true)) {
                $score++;
            }
        }
        if ($score > $bestScore) {
            $best = $i;
            $bestScore = $score;
        }
    }
    return $best;
}

/** Guess which store field each column is. Returns [colIndex => field or '']. */
function import_guess_mapping(array $headers): array
{
    $syn = import_synonyms();
    $map = [];
    $used = [];
    foreach ($headers as $i => $h) {
        $n = norm_header((string)$h);
        $map[$i] = '';
        foreach ($syn as $field => $words) {
            if (!isset($used[$field]) && in_array($n, $words, true)) {
                $map[$i] = $field;
                $used[$field] = true;
                break;
            }
        }
    }
    // Supplier sheets often call the product name "Description". If there is no name column, use it as the name.
    if (!isset($used['name'])) {
        foreach ($map as $i => $f) {
            if ($f === 'description') {
                $map[$i] = 'name';
                break;
            }
        }
    }
    return $map;
}

function parse_money(?string $v): ?float
{
    $v = trim((string)$v);
    if ($v === '' || $v === '-') {
        return null;
    }
    $v = preg_replace('/[Rr]|\s|\x{00A0}/u', '', $v);
    if (str_contains($v, ',') && str_contains($v, '.')) {
        $v = str_replace(',', '', $v);
    } elseif (preg_match('/^\d+,\d{1,2}$/', $v)) {
        $v = str_replace(',', '.', $v);
    } else {
        $v = str_replace(',', '', $v);
    }
    return is_numeric($v) ? round((float)$v, 2) : NAN;
}

function parse_yes_no(?string $v): ?int
{
    $v = strtolower(trim((string)$v));
    if ($v === '') {
        return null;
    }
    if (in_array($v, ['1', 'yes', 'y', 'true', 'show', 'visible', 'active', 'on', 'published'], true)) {
        return 1;
    }
    if (in_array($v, ['0', 'no', 'n', 'false', 'hide', 'hidden', 'inactive', 'off', 'draft'], true)) {
        return 0;
    }
    return -1;
}

function parse_stock(?string $v): ?string
{
    $v = strtolower(trim((string)$v));
    if ($v === '') {
        return null;
    }
    if (is_numeric($v)) {
        $n = (float)$v;
        return $n <= 0 ? 'out_of_stock' : ($n <= 5 ? 'low_stock' : 'in_stock');
    }
    $v = str_replace(['-', '_'], ' ', $v);
    return match (true) {
        in_array($v, ['in stock', 'instock', 'yes', 'y', 'available', 'stock', 'ok'], true) => 'in_stock',
        str_contains($v, 'low') || str_contains($v, 'limited') => 'low_stock',
        str_contains($v, 'order') || str_contains($v, 'eta') || str_contains($v, 'backorder') || str_contains($v, 'transit') => 'on_order',
        str_contains($v, 'out') || in_array($v, ['no', 'n', 'none', 'nil', 'sold out'], true) => 'out_of_stock',
        default => 'invalid',
    };
}

function parse_date_cell(?string $v): ?string
{
    $v = trim((string)$v);
    if ($v === '') {
        return null;
    }
    if (is_numeric($v) && (float)$v > 30000 && (float)$v < 80000) { // Excel date serial
        return date('Y-m-d', (int)(((float)$v - 25569) * 86400));
    }
    if (preg_match('#^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$#', $v, $m)) { // 31/10/2026 (South African order)
        return checkdate((int)$m[2], (int)$m[1], (int)$m[3]) ? sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]) : 'invalid';
    }
    $t = strtotime($v);
    return $t ? date('Y-m-d', $t) : 'invalid';
}

/**
 * Check every row and work out what would happen — nothing is saved here.
 * $opts: mode = full|prices, price_calc = blank|always|never, default_brand, default_category, hide_new (0/1)
 */
function import_analyse(array $rows, array $map, array $opts): array
{
    $result = [];
    $seen = [];
    $fieldCol = [];
    foreach ($map as $col => $field) {
        if ($field !== '') {
            $fieldCol[$field] = (int)$col;
        }
    }
    foreach ($rows as $idx => $r) {
        $get = fn(string $f) => isset($fieldCol[$f]) ? trim((string)($r[$fieldCol[$f]] ?? '')) : '';
        $line = ['row' => $idx, 'errors' => [], 'warnings' => [], 'data' => [], 'changes' => [], 'action' => 'skip'];
        $sku = $get('sku');
        $name = $get('name');
        if ($sku === '' && $name === '' && trim(implode('', $r)) === '') {
            continue; // blank row
        }
        $line['sku'] = $sku;
        $line['name'] = $name;
        $filled = count(array_filter(array_keys($fieldCol), fn($f) => $get($f) !== ''));
        if ($filled === 1 && $sku !== '') {
            // Only one cell filled, e.g. a section heading like "LASER PRINTERS": skip it quietly.
            $line['warnings'][] = 'Only one cell filled — treated as a heading and skipped.';
            $result[] = $line;
            continue;
        }
        if ($sku === '') {
            // Section headings in supplier sheets (e.g. "LASER PRINTERS") have no code: skip them quietly.
            $line['warnings'][] = 'No SKU — row skipped (probably a heading).';
            $result[] = $line;
            continue;
        }
        if (strlen($sku) > 80) {
            $line['errors'][] = 'SKU is longer than 80 characters.';
        }
        $key = strtolower($sku);
        if (isset($seen[$key])) {
            $line['errors'][] = 'This SKU appears more than once in the file — only the first one is used.';
        }
        $seen[$key] = $idx;

        $existing = q_one('SELECT p.*, b.name AS brand_name, c.name AS category_name FROM products p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id WHERE LOWER(p.sku) = LOWER(?)', [$sku]);
        $d = [];

        foreach (['cost_price', 'price', 'sale_price'] as $f) {
            $raw = $get($f);
            if ($f === 'sale_price' && strtoupper($raw) === 'CLEAR') {
                $d['sale_price'] = null;
                $d['sale_ends'] = null;
                continue;
            }
            $v = parse_money($raw);
            if ($v !== null && is_nan($v)) {
                $line['errors'][] = import_fields()[$f] . ' "' . $raw . '" is not a number.';
            } elseif ($v !== null) {
                if ($v < 0) {
                    $line['errors'][] = import_fields()[$f] . ' cannot be negative.';
                }
                $d[$f] = $v;
            }
        }
        if ($v = $get('sale_ends')) {
            $dt = parse_date_cell($v);
            if ($dt === 'invalid') {
                $line['errors'][] = 'Sale end date "' . $v . '" not understood. Use e.g. 31/10/2026.';
            } else {
                $d['sale_ends'] = $dt;
            }
        }
        if (($v = $get('stock_status')) !== '') {
            $s = parse_stock($v);
            if ($s === 'invalid') {
                $line['errors'][] = 'Stock "' . $v . '" not understood. Use: in stock, low stock, on order, out of stock, or a quantity.';
            } else {
                $d['stock_status'] = $s;
            }
        }
        foreach (['visible', 'featured', 'is_new', 'is_special'] as $f) {
            if (($v = $get($f)) !== '') {
                $b = parse_yes_no($v);
                if ($b === -1) {
                    $line['errors'][] = ucfirst($f) . ' "' . $v . '" should be yes or no.';
                } else {
                    $d[$f] = $b;
                }
            }
        }

        $pricesOnly = ($opts['mode'] ?? 'full') === 'prices';
        if (!$pricesOnly) {
            foreach (['name', 'short_description', 'description', 'specs', 'compatible', 'mpn', 'gtin', 'warranty', 'meta_title', 'meta_description', 'image_urls'] as $f) {
                if (($v = $get($f)) !== '') {
                    $d[$f] = $v;
                }
            }
            // Store lists one-per-line so exported files ("a | b", "x, y") re-import without changes.
            if (isset($d['specs'])) {
                $d['specs'] = implode("\n", array_map(fn($sp) => $sp[0] !== '' ? $sp[0] . ': ' . $sp[1] : $sp[1], parse_specs($d['specs'])));
            }
            if (isset($d['compatible'])) {
                $d['compatible'] = implode("\n", parse_list($d['compatible']));
            }
            if (isset($d['image_urls'])) {
                $urls = array_filter(parse_list($d['image_urls']), fn($u) => !str_starts_with($u, abs_url('uploads/')));
                if ($urls) {
                    $d['image_urls'] = implode(', ', $urls);
                } else {
                    unset($d['image_urls']);
                }
            }
            $brand = $get('brand') ?: ($existing ? '' : trim($opts['default_brand'] ?? ''));
            $cat = $get('category') ?: ($existing ? '' : trim($opts['default_category'] ?? ''));
            if ($brand !== '') {
                $d['brand'] = $brand;
                if (!q_val('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)', [$brand])) {
                    $line['warnings'][] = 'New brand "' . $brand . '" will be created.';
                }
            }
            if ($cat !== '') {
                $d['category'] = $cat;
                if (!q_val('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [$cat])) {
                    $line['warnings'][] = 'New category "' . $cat . '" will be created.';
                }
            }
        }

        // Selling price from supplier cost, using the pricing rules for this product's brand and category.
        $calc = $opts['price_calc'] ?? 'blank';
        if (isset($d['cost_price']) && $d['cost_price'] > 0 && ($calc === 'always' || ($calc === 'blank' && !isset($d['price'])))) {
            $brandId = isset($d['brand']) ? q_val('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)', [$d['brand']]) : ($existing['brand_id'] ?? null);
            $catId = isset($d['category']) ? q_val('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [$d['category']]) : ($existing['category_id'] ?? null);
            $brandId = $brandId !== null ? (int)$brandId : null;
            $catId = $catId !== null ? (int)$catId : null;
            $d['price'] = price_from_cost($d['cost_price'], $brandId, $catId);
            $line['warnings'][] = 'Selling price: ' . money($d['cost_price']) . ' + ' . rtrim(rtrim(number_format(markup_for($brandId, $catId), 2, '.', ''), '0'), '.') . '% = ' . money($d['price']) . '.';
        }

        if ($existing && !empty($opts['keep_names'])) {
            unset($d['name']); // keep the nicer names you already wrote in the store
        }
        if ($existing) {
            $line['action'] = 'update';
            $line['product_id'] = (int)$existing['id'];
            $line['name'] = $line['name'] ?: $existing['name'];
            foreach ($d as $f => $new) {
                $old = match ($f) {
                    'brand' => $existing['brand_name'],
                    'category' => $existing['category_name'],
                    'image_urls' => null,
                    default => $existing[$f] ?? null,
                };
                $same = is_numeric($old) && is_numeric($new) ? abs((float)$old - (float)$new) < 0.005 : (string)$old === (string)$new;
                if ($f === 'image_urls' || !$same) {
                    $line['changes'][$f] = [$old, $new];
                }
            }
            if (!$line['changes']) {
                $line['action'] = 'nochange';
            }
        } else {
            if ($pricesOnly) {
                $line['action'] = 'skip';
                $line['warnings'][] = 'Not in your store yet — skipped because "update prices & stock only" is selected.';
            } else {
                $line['action'] = 'create';
                if (empty($d['name'])) {
                    $line['errors'][] = 'New product needs a name.';
                }
                if (empty($d['price'])) {
                    $line['warnings'][] = 'No selling price — product will show "Request a quote".';
                }
                if (!empty($opts['hide_new'])) {
                    $d['visible'] = 0;
                }
            }
        }
        if ($line['errors']) {
            $line['action'] = 'error';
        }
        $line['data'] = $d;
        $result[] = $line;
    }
    return $result;
}

/** Save the analysed rows. Rows with errors are never imported. Returns counts. */
function import_apply(array $analysed): array
{
    $counts = ['created' => 0, 'updated' => 0, 'images' => 0, 'image_errors' => 0];
    $imageJobs = [];
    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach ($analysed as $line) {
            if (!in_array($line['action'], ['create', 'update'], true)) {
                continue;
            }
            $d = $line['data'];
            $row = [];
            foreach (['name', 'short_description', 'description', 'specs', 'compatible', 'cost_price', 'price', 'sale_price', 'sale_ends', 'stock_status', 'visible', 'featured', 'is_new', 'is_special', 'mpn', 'gtin', 'warranty', 'meta_title', 'meta_description'] as $f) {
                if (array_key_exists($f, $d)) {
                    $row[$f] = $d[$f];
                }
            }
            if (isset($d['brand'])) {
                $row['brand_id'] = find_or_create('brands', $d['brand']);
            }
            if (isset($d['category'])) {
                $row['category_id'] = find_or_create('categories', $d['category']);
            }
            $row['updated_at'] = now();
            if ($line['action'] === 'create') {
                $row['sku'] = $line['sku'];
                $row['slug'] = unique_slug('products', $d['name'] . '-' . $line['sku']);
                $row['created_at'] = now();
                $row += ['stock_status' => 'in_stock', 'visible' => 1, 'featured' => 0];
                $id = db_insert('products', $row);
                $counts['created']++;
            } else {
                $id = $line['product_id'];
                db_update('products', $row, 'id = ?', [$id]);
                $counts['updated']++;
            }
            if (!empty($d['image_urls'])) {
                $imageJobs[$id] = parse_list($d['image_urls']);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    // Download images after saving (a slow image server must not undo the import).
    @set_time_limit(300);
    foreach ($imageJobs as $pid => $urls) {
        foreach ($urls as $u) {
            if (!preg_match('#^https?://#i', $u) || str_starts_with($u, abs_url('uploads/'))) {
                continue; // not a web link, or a photo already on this store (from an export)
            }
            if (q_val('SELECT COUNT(*) FROM product_images WHERE product_id = ? AND alt = ?', [$pid, 'src:' . substr($u, 0, 240)])) {
                continue; // already downloaded on an earlier import
            }
            $res = image_from_url($u, $pid);
            $res ? $counts['images']++ : $counts['image_errors']++;
        }
    }
    return $counts;
}

/** Column headings used by the template and by the export (so an export can be edited and re-imported). */
function export_headers(): array
{
    return ['SKU', 'Name', 'Brand', 'Category', 'Supplier cost (excl VAT)', 'Selling price', 'Sale price', 'Sale ends', 'Stock status', 'Visible', 'Featured', 'New in market', 'On special', 'Short description', 'Description', 'Specifications', 'Compatible printers', 'Image URLs', 'MPN', 'GTIN', 'Warranty', 'SEO title', 'SEO description'];
}

function export_rows(): array
{
    $rows = [export_headers()];
    $all = q_all('SELECT p.*, b.name AS brand_name, c.name AS category_name FROM products p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id ORDER BY b.name, p.name');
    foreach ($all as $p) {
        $imgs = array_map(fn($i) => abs_url($i['path']), product_images((int)$p['id']));
        $rows[] = [
            $p['sku'], $p['name'], $p['brand_name'], $p['category_name'], $p['cost_price'], $p['price'], $p['sale_price'], $p['sale_ends'],
            stock_statuses()[$p['stock_status']] ?? $p['stock_status'], $p['visible'] ? 'yes' : 'no', $p['featured'] ? 'yes' : 'no', !empty($p['is_new']) ? 'yes' : 'no', !empty($p['is_special']) ? 'yes' : 'no',
            $p['short_description'], $p['description'], str_replace("\n", ' | ', (string)$p['specs']), str_replace("\n", ', ', (string)$p['compatible']),
            implode(', ', $imgs), $p['mpn'], $p['gtin'], $p['warranty'], $p['meta_title'], $p['meta_description'],
        ];
    }
    return $rows;
}

/** Map our own export headings straight to fields (so round-trips need no manual mapping). */
function export_header_map(): array
{
    return array_combine(array_map('norm_header', export_headers()), ['sku', 'name', 'brand', 'category', 'cost_price', 'price', 'sale_price', 'sale_ends', 'stock_status', 'visible', 'featured', 'is_new', 'is_special', 'short_description', 'description', 'specs', 'compatible', 'image_urls', 'mpn', 'gtin', 'warranty', 'meta_title', 'meta_description']);
}

function template_rows(): array
{
    return [
        export_headers(),
        ['CMF3010', 'Canon i-SENSYS MF3010 Mono Laser Multifunction Printer', 'Canon', 'Printers & Scanners', '2474', '', '', '', 'in stock', 'yes', 'no', 'no', 'no', 'Compact mono laser: print, copy and scan.', 'Reliable A4 mono laser multifunction printer for home and small offices.', 'Print speed: 18 ppm | Functions: Print, Copy, Scan | Connectivity: Hi-Speed USB', '', '', 'MF3010', '', '3 years (T&Cs apply)', '', ''],
        ['CRG725', 'Canon 725 Black Toner Cartridge', 'Canon', 'Ink & Toner', '', '899', '799', '31/10/2026', 'low stock', 'yes', 'no', 'no', 'yes', 'Genuine Canon 725 toner.', '', 'Yield: approx. 1 600 pages', 'Canon i-SENSYS LBP6030, Canon i-SENSYS MF3010', '', '725', '', '', '', ''],
    ];
}
