<?php
/** Product, category and brand look-ups for the shop. */

function stock_statuses(): array
{
    return [
        'in_stock' => 'In stock',
        'low_stock' => 'Low stock',
        'on_order' => 'On order (3–7 days)',
        'out_of_stock' => 'Out of stock',
    ];
}

/** Can this product be bought online right now? */
function can_buy(array $p): bool
{
    return $p['stock_status'] !== 'out_of_stock' && effective_price($p) > 0;
}

function sale_active(array $p): bool
{
    if ($p['sale_price'] === null || $p['sale_price'] === '' || (float)$p['sale_price'] <= 0) {
        return false;
    }
    if ((float)$p['sale_price'] >= (float)$p['price']) {
        return false;
    }
    return empty($p['sale_ends']) || $p['sale_ends'] >= date('Y-m-d');
}

/** The price the customer pays (sale price when a sale is running). 0 = no price, quote only. */
function effective_price(array $p): float
{
    if (sale_active($p)) {
        return (float)$p['sale_price'];
    }
    return (float)($p['price'] ?? 0);
}

const PRODUCT_SELECT = "SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, c.name AS category_name, c.slug AS category_slug,
    (SELECT path FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image,
    (SELECT thumb FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS thumb
    FROM products p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id";

function product_by_slug(string $slug): ?array
{
    return q_one(PRODUCT_SELECT . ' WHERE p.slug = ? AND p.visible = 1', [$slug]);
}

function product_by_id(int $id): ?array
{
    return q_one(PRODUCT_SELECT . ' WHERE p.id = ?', [$id]);
}

function product_images(int $id): array
{
    return q_all('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id', [$id]);
}

function categories_visible(): array
{
    static $c = null;
    return $c ??= q_all('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.visible = 1) AS product_count
        FROM categories c WHERE c.visible = 1 ORDER BY sort_order, name');
}

function brands_visible(): array
{
    static $b = null;
    return $b ??= q_all('SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.visible = 1) AS product_count
        FROM brands b WHERE b.visible = 1 ORDER BY sort_order, name');
}

/** "Key: Value" lines → [[key, value], ...] */
function parse_specs(?string $specs): array
{
    $out = [];
    foreach (preg_split('/\r?\n|\s*\|\s*/', (string)$specs) as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $parts = explode(':', $line, 2);
        $out[] = count($parts) === 2 ? [trim($parts[0]), trim($parts[1])] : ['', $line];
    }
    return $out;
}

/** Compatible printers: one per line or comma separated. */
function parse_list(?string $text): array
{
    $items = preg_split('/\r?\n|,|;/', (string)$text);
    return array_values(array_filter(array_map('trim', $items), fn($s) => $s !== ''));
}

/**
 * Product search with filters.
 * $f keys: q, category (slug), brand (array of slugs), min, max, stock (1 = in stock only), sale (1), sort, page
 */
function product_search(array $f, int $perPage = 24): array
{
    $where = ['p.visible = 1'];
    $params = [];
    if (!empty($f['q'])) {
        $words = array_slice(preg_split('/\s+/', trim($f['q'])), 0, 6);
        foreach ($words as $w) {
            $like = '%' . $w . '%';
            $where[] = "(p.name LIKE ? OR p.sku LIKE ? OR p.mpn LIKE ? OR b.name LIKE ? OR p.compatible LIKE ? OR c.name LIKE ?)";
            array_push($params, $like, $like, $like, $like, $like, $like);
        }
    }
    if (!empty($f['category'])) {
        $cat = q_one('SELECT id FROM categories WHERE slug = ?', [$f['category']]);
        $ids = $cat ? array_merge([(int)$cat['id']], array_map('intval', array_column(q_all('SELECT id FROM categories WHERE parent_id = ?', [$cat['id']]), 'id'))) : [0];
        $where[] = 'p.category_id IN (' . implode(',', $ids) . ')';
    }
    if (!empty($f['brand'])) {
        $brands = (array)$f['brand'];
        $where[] = 'b.slug IN (' . implode(',', array_fill(0, count($brands), '?')) . ')';
        array_push($params, ...$brands);
    }
    $priceExpr = "(CASE WHEN p.sale_price > 0 AND p.sale_price < p.price AND (p.sale_ends IS NULL OR p.sale_ends >= ?) THEN p.sale_price ELSE p.price END)";
    $today = date('Y-m-d');
    if (isset($f['min']) && $f['min'] !== '') {
        $where[] = "$priceExpr >= ?";
        array_push($params, $today, (float)$f['min']);
    }
    if (isset($f['max']) && $f['max'] !== '') {
        $where[] = "$priceExpr <= ?";
        array_push($params, $today, (float)$f['max']);
    }
    if (!empty($f['stock'])) {
        $where[] = "p.stock_status IN ('in_stock','low_stock')";
    }
    if (!empty($f['sale'])) {
        $where[] = "p.sale_price > 0 AND p.sale_price < p.price AND (p.sale_ends IS NULL OR p.sale_ends >= ?)";
        $params[] = $today;
    }
    $whereSql = ' WHERE ' . implode(' AND ', $where);
    $order = match ($f['sort'] ?? '') {
        'price_asc' => "CASE WHEN p.price IS NULL OR p.price = 0 THEN 1 ELSE 0 END, $priceExpr ASC",
        'price_desc' => "$priceExpr DESC",
        'newest' => 'p.created_at DESC, p.id DESC',
        'name' => 'p.name ASC',
        default => "p.featured DESC, CASE p.stock_status WHEN 'out_of_stock' THEN 1 ELSE 0 END, p.name ASC",
    };
    $orderParams = in_array($f['sort'] ?? '', ['price_asc', 'price_desc'], true) ? [$today] : [];

    $base = "FROM products p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id";
    $total = (int)q_val("SELECT COUNT(*) $base $whereSql", $params);
    $page = max(1, (int)($f['page'] ?? 1));
    $pages = max(1, (int)ceil($total / $perPage));
    $page = min($page, $pages);
    $offset = ($page - 1) * $perPage;
    $rows = q_all(PRODUCT_SELECT . " $whereSql ORDER BY $order LIMIT $perPage OFFSET $offset", array_merge($params, $orderParams));
    return ['items' => $rows, 'total' => $total, 'page' => $page, 'pages' => $pages];
}

function products_featured(int $limit = 8): array
{
    return q_all(PRODUCT_SELECT . " WHERE p.visible = 1 AND p.featured = 1 ORDER BY p.updated_at DESC LIMIT $limit");
}

function products_on_sale(int $limit = 8): array
{
    return q_all(PRODUCT_SELECT . " WHERE p.visible = 1 AND p.sale_price > 0 AND p.sale_price < p.price AND (p.sale_ends IS NULL OR p.sale_ends >= ?) ORDER BY p.updated_at DESC LIMIT $limit", [date('Y-m-d')]);
}

function products_related(array $p, int $limit = 4): array
{
    return q_all(PRODUCT_SELECT . " WHERE p.visible = 1 AND p.id <> ? AND p.category_id = ? ORDER BY p.featured DESC, p.name LIMIT $limit", [$p['id'], $p['category_id']]);
}

/** Cartridges/supplies whose "compatible" list mentions this printer's model. */
function products_compatible_supplies(array $p, int $limit = 8): array
{
    $model = $p['mpn'] ?: $p['sku'];
    $terms = array_unique(array_filter([$model, preg_replace('/^(Canon|HP|Epson|Brother|Riso)\s+/i', '', $p['name'])]));
    $short = model_code($p['name']);
    if ($short) {
        $terms[] = $short;
    }
    $conds = [];
    $params = [$p['id']];
    foreach ($terms as $t) {
        if (strlen($t) < 4) {
            continue;
        }
        $conds[] = 'p.compatible LIKE ?';
        $params[] = '%' . $t . '%';
    }
    if (!$conds) {
        return [];
    }
    return q_all(PRODUCT_SELECT . ' WHERE p.visible = 1 AND p.id <> ? AND (' . implode(' OR ', $conds) . ") LIMIT $limit", $params);
}

/** Pull a printer model code like "MF3010" or "LBP6030" or "G2410" out of a product name. */
function model_code(string $name): string
{
    if (preg_match('/\b([A-Z]{1,4}-?\d{3,5}[A-Za-z]{0,4})\b/', $name, $m)) {
        return $m[1];
    }
    return '';
}

function product_url(array $p): string
{
    return url('product/' . $p['slug']);
}

function unique_slug(string $table, string $base, ?int $ignoreId = null): string
{
    $slug = slugify($base);
    $try = $slug;
    $i = 2;
    while (q_val("SELECT id FROM $table WHERE slug = ?" . ($ignoreId ? ' AND id <> ' . (int)$ignoreId : ''), [$try])) {
        $try = $slug . '-' . $i++;
    }
    return $try;
}

/** Find a brand or category by name, creating it if missing. Returns id. */
function find_or_create(string $table, string $name): ?int
{
    $name = trim($name);
    if ($name === '') {
        return null;
    }
    $row = q_one("SELECT id FROM $table WHERE LOWER(name) = LOWER(?) OR slug = ?", [$name, slugify($name)]);
    if ($row) {
        return (int)$row['id'];
    }
    return db_insert($table, ['name' => $name, 'slug' => unique_slug($table, $name), 'visible' => 1, 'sort_order' => 50]);
}
