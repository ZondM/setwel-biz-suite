<?php
/** Admin: products list, add/edit, bulk actions, images, export. */

function admin_products(): void
{
    require_admin();
    $f = [
        'q' => trim((string)($_GET['q'] ?? '')),
        'brand' => (int)($_GET['brand'] ?? 0),
        'category' => (int)($_GET['category'] ?? 0),
        'show' => $_GET['show'] ?? '',
    ];
    $where = ['1=1'];
    $params = [];
    if ($f['q'] !== '') {
        $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR p.mpn LIKE ?)';
        array_push($params, "%{$f['q']}%", "%{$f['q']}%", "%{$f['q']}%");
    }
    if ($f['brand']) {
        $where[] = 'p.brand_id = ?';
        $params[] = $f['brand'];
    }
    if ($f['category']) {
        $where[] = 'p.category_id = ?';
        $params[] = $f['category'];
    }
    $where[] = match ($f['show']) {
        'visible' => 'p.visible = 1',
        'hidden' => 'p.visible = 0',
        'sale' => 'p.sale_price > 0',
        'noprice' => '(p.price IS NULL OR p.price = 0)',
        'noimage' => 'NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)',
        'out' => "p.stock_status = 'out_of_stock'",
        default => '1=1',
    };
    $w = implode(' AND ', $where);
    $total = (int)q_val("SELECT COUNT(*) FROM products p WHERE $w", $params);
    $per = 50;
    $page = max(1, (int)($_GET['page'] ?? 1));
    $rows = q_all(PRODUCT_SELECT . " WHERE $w ORDER BY p.updated_at DESC, p.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $params);
    admin_view('products', [
        'title' => 'Products', 'rows' => $rows, 'f' => $f, 'total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $per)),
        'brands' => q_all('SELECT id, name FROM brands ORDER BY name'), 'categories' => q_all('SELECT id, name FROM categories ORDER BY name'),
    ]);
}

function admin_products_bulk(): void
{
    require_admin();
    $ids = array_map('intval', (array)($_POST['ids'] ?? []));
    $action = $_POST['action'] ?? '';
    if (!$ids) {
        flash('error', 'Tick at least one product first.');
        back('/admin/products');
    }
    $in = implode(',', $ids);
    switch ($action) {
        case 'show':
            q("UPDATE products SET visible = 1, updated_at = ? WHERE id IN ($in)", [now()]);
            break;
        case 'hide':
            q("UPDATE products SET visible = 0, updated_at = ? WHERE id IN ($in)", [now()]);
            break;
        case 'feature':
            q("UPDATE products SET featured = 1 WHERE id IN ($in)");
            break;
        case 'unfeature':
            q("UPDATE products SET featured = 0 WHERE id IN ($in)");
            break;
        case 'end_sale':
            q("UPDATE products SET sale_price = NULL, sale_ends = NULL, updated_at = ? WHERE id IN ($in)", [now()]);
            break;
        case 'reprice':
            foreach (q_all("SELECT id, cost_price FROM products WHERE id IN ($in) AND cost_price > 0") as $r) {
                q('UPDATE products SET price = ?, updated_at = ? WHERE id = ?', [price_from_cost((float)$r['cost_price']), now(), $r['id']]);
            }
            break;
        case 'stock':
            $s = $_POST['stock_status'] ?? '';
            if (isset(stock_statuses()[$s])) {
                q("UPDATE products SET stock_status = ?, updated_at = ? WHERE id IN ($in)", [$s, now()]);
            }
            break;
        case 'delete':
            foreach ($ids as $id) {
                product_delete($id);
            }
            break;
        default:
            flash('error', 'Choose an action.');
            back('/admin/products');
    }
    flash('success', count($ids) . ' product(s) updated.');
    back('/admin/products');
}

function product_delete(int $id): void
{
    foreach (product_images($id) as $img) {
        delete_product_image($img);
    }
    q('DELETE FROM products WHERE id = ?', [$id]);
}

function admin_product_form(?string $id = null): void
{
    require_admin();
    $p = $id ? q_one('SELECT * FROM products WHERE id = ?', [(int)$id]) : null;
    if ($id && !$p) {
        abort(404);
    }
    $errors = [];
    if (is_post()) {
        $d = [];
        foreach (['sku', 'name', 'short_description', 'description', 'specs', 'compatible', 'mpn', 'gtin', 'warranty', 'meta_title', 'meta_description'] as $k) {
            $d[$k] = trim((string)($_POST[$k] ?? ''));
        }
        foreach (['cost_price', 'price', 'sale_price'] as $k) {
            $v = parse_money($_POST[$k] ?? '');
            $d[$k] = ($v === null || is_nan($v)) ? null : $v;
        }
        $d['sale_ends'] = ($_POST['sale_ends'] ?? '') ?: null;
        $d['stock_status'] = isset(stock_statuses()[$_POST['stock_status'] ?? '']) ? $_POST['stock_status'] : 'in_stock';
        $d['visible'] = !empty($_POST['visible']) ? 1 : 0;
        $d['featured'] = !empty($_POST['featured']) ? 1 : 0;
        $d['brand_id'] = ($_POST['new_brand'] ?? '') !== '' ? find_or_create('brands', $_POST['new_brand']) : (((int)($_POST['brand_id'] ?? 0)) ?: null);
        $d['category_id'] = ($_POST['new_category'] ?? '') !== '' ? find_or_create('categories', $_POST['new_category']) : (((int)($_POST['category_id'] ?? 0)) ?: null);
        if (!$d['price'] && $d['cost_price']) {
            $d['price'] = price_from_cost($d['cost_price']);
        }
        if ($d['sku'] === '') {
            $errors[] = 'SKU is required (use your supplier\'s product code).';
        } elseif (q_val('SELECT id FROM products WHERE LOWER(sku) = LOWER(?) AND id <> ?', [$d['sku'], $p['id'] ?? 0])) {
            $errors[] = 'Another product already uses SKU ' . $d['sku'] . '.';
        }
        if ($d['name'] === '') {
            $errors[] = 'Product name is required.';
        }
        if ($d['sale_price'] && $d['price'] && $d['sale_price'] >= $d['price']) {
            $errors[] = 'Sale price must be lower than the selling price.';
        }
        if (!$errors) {
            $d['updated_at'] = now();
            if ($p) {
                if (!empty($_POST['regen_slug'])) {
                    $d['slug'] = unique_slug('products', $d['name'], (int)$p['id']);
                }
                db_update('products', $d, 'id = ?', [$p['id']]);
                $pid = (int)$p['id'];
            } else {
                $d['slug'] = unique_slug('products', $d['name']);
                $d['created_at'] = now();
                $pid = db_insert('products', $d);
            }
            $bad = 0;
            foreach (uploaded_files('images') as $f) {
                if (!add_product_image($pid, $f['tmp_name'], $d['name'], $d['name'])) {
                    $bad++;
                }
            }
            flash('success', 'Product saved.' . ($bad ? " $bad file(s) were not valid images." : ''));
            redirect(!empty($_POST['save_new']) ? '/admin/products/new' : '/admin/products/' . $pid);
        }
        $p = array_merge($p ?? [], $d);
    }
    admin_view('product_form', [
        'title' => $p && !empty($p['id']) ? 'Edit product' : 'Add product',
        'p' => $p ?? ['visible' => 1, 'stock_status' => 'in_stock'],
        'images' => !empty($p['id']) ? product_images((int)$p['id']) : [],
        'errors' => $errors,
        'brands' => q_all('SELECT id, name FROM brands ORDER BY name'),
        'categories' => q_all('SELECT id, name FROM categories ORDER BY name'),
    ]);
}

function admin_product_delete(string $id): void
{
    require_admin();
    product_delete((int)$id);
    flash('success', 'Product deleted.');
    redirect('/admin/products');
}

function admin_product_images(string $id): void
{
    require_admin();
    $pid = (int)$id;
    $action = $_POST['action'] ?? '';
    $img = q_one('SELECT * FROM product_images WHERE id = ? AND product_id = ?', [(int)($_POST['image_id'] ?? 0), $pid]);
    if ($img && $action === 'delete') {
        delete_product_image($img);
        flash('success', 'Image removed.');
    } elseif ($img && $action === 'main') {
        q('UPDATE product_images SET sort_order = sort_order + 1 WHERE product_id = ?', [$pid]);
        q('UPDATE product_images SET sort_order = 0 WHERE id = ?', [$img['id']]);
        flash('success', 'Main image changed.');
    }
    redirect('/admin/products/' . $pid . '#images');
}

/** Upload many photos at once: files named by SKU (e.g. CMF3010.jpg, CMF3010-2.jpg) attach automatically. */
function admin_bulk_images(): void
{
    require_admin();
    $report = null;
    if (is_post()) {
        $report = ['ok' => [], 'unmatched' => [], 'bad' => []];
        $replace = !empty($_POST['replace']);
        $cleared = [];
        foreach (uploaded_files('images') as $f) {
            $base = pathinfo($f['name'], PATHINFO_FILENAME);
            $sku = preg_replace('/[-_ ](\d{1,2})$/', '', $base);
            $p = q_one('SELECT id, name FROM products WHERE LOWER(sku) = LOWER(?)', [$sku]) ?? q_one('SELECT id, name FROM products WHERE LOWER(sku) = LOWER(?)', [$base]);
            if (!$p) {
                $report['unmatched'][] = $f['name'];
                continue;
            }
            if ($replace && !isset($cleared[$p['id']])) {
                foreach (product_images((int)$p['id']) as $old) {
                    delete_product_image($old);
                }
                $cleared[$p['id']] = true;
            }
            if (add_product_image((int)$p['id'], $f['tmp_name'], $p['name'], $p['name'])) {
                $report['ok'][] = $f['name'] . ' → ' . $p['name'];
            } else {
                $report['bad'][] = $f['name'];
            }
        }
    }
    admin_view('bulk_images', ['title' => 'Bulk images', 'report' => $report, 'max' => ini_get('max_file_uploads'), 'maxSize' => ini_get('upload_max_filesize'), 'postMax' => ini_get('post_max_size')]);
}

function admin_export(string $type): void
{
    require_admin();
    $rows = export_rows();
    $name = 'setwel-products-' . date('Y-m-d');
    if ($type === 'csv') {
        csv_download("$name.csv", $rows);
    }
    xlsx_download("$name.xlsx", $rows, [14, 48, 12, 16, 14, 12, 11, 12, 13, 8, 9, 40, 50, 50, 40, 40, 14, 14, 20, 30, 40]);
}
