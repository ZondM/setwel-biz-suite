<?php
/** Admin: orders, quote requests, banners, pages, certificates & letters. */

function admin_orders(): void
{
    require_admin();
    $status = $_GET['status'] ?? '';
    $q = trim((string)($_GET['q'] ?? ''));
    $where = ['1=1'];
    $params = [];
    if (isset(order_statuses()[$status])) {
        $where[] = 'status = ?';
        $params[] = $status;
    }
    if ($q !== '') {
        $where[] = '(ref LIKE ? OR customer_name LIKE ? OR email LIKE ? OR company LIKE ?)';
        array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
    }
    admin_view('orders', ['title' => 'Orders', 'orders' => q_all('SELECT * FROM orders WHERE ' . implode(' AND ', $where) . ' ORDER BY id DESC LIMIT 300', $params), 'status' => $status, 'q' => $q]);
}

function admin_order(string $id): void
{
    require_admin();
    $o = q_one('SELECT * FROM orders WHERE id = ?', [(int)$id]);
    if (!$o) {
        abort(404);
    }
    if (is_post()) {
        $action = $_POST['action'] ?? '';
        if ($action === 'mark_paid' && $o['payment_status'] !== 'paid') {
            db_update('orders', ['payment_status' => 'paid', 'paid_at' => now(), 'status' => 'processing', 'updated_at' => now()], 'id = ?', [$o['id']]);
            order_add_history((int)$o['id'], 'processing', 'Payment confirmed by admin.', !empty($_POST['notify']));
            $sent = !empty($_POST['notify']) ? order_send_email((int)$o['id'], 'paid') : null;
            flash('success', 'Order marked as paid.' . ($sent === true ? ' Receipt emailed to the customer.' : ($sent === false ? ' The receipt email could not be sent — check Settings → Email.' : '')));
        } elseif ($action === 'status') {
            $new = $_POST['status'] ?? '';
            if (isset(order_statuses()[$new])) {
                db_update('orders', ['status' => $new, 'courier' => trim($_POST['courier'] ?? $o['courier'] ?? ''), 'tracking_number' => trim($_POST['tracking_number'] ?? $o['tracking_number'] ?? ''), 'updated_at' => now()], 'id = ?', [$o['id']]);
                $note = trim($_POST['note'] ?? '');
                $notify = !empty($_POST['notify']);
                order_add_history((int)$o['id'], $new, 'Status: ' . order_status_label($new) . ($note ? ' — ' . $note : ''), $notify);
                $sent = $notify ? order_send_email((int)$o['id'], 'status', $note) : false;
                flash('success', 'Order updated.' . ($notify ? ($sent ? ' Customer emailed.' : ' Email could not be sent — check Settings → Email.') : ''));
            }
        } elseif ($action === 'resend') {
            $ok = order_send_email((int)$o['id'], $o['payment_status'] === 'paid' ? 'paid' : 'placed');
            flash($ok ? 'success' : 'error', $ok ? 'Email re-sent to ' . $o['email'] . '.' : 'Email failed — check Settings → Email.');
        } elseif ($action === 'note') {
            order_add_history((int)$o['id'], $o['status'], 'Note: ' . trim($_POST['note'] ?? ''));
        }
        redirect('/admin/orders/' . $o['id']);
    }
    admin_view('order', ['title' => 'Order ' . $o['ref'], 'o' => $o, 'items' => order_items((int)$o['id']), 'history' => q_all('SELECT * FROM order_history WHERE order_id = ? ORDER BY id DESC', [$o['id']])]);
}

function admin_order_invoice(string $id): void
{
    require_admin();
    $o = q_one('SELECT * FROM orders WHERE id = ?', [(int)$id]) ?? abort(404);
    $pdf = invoice_pdf($o, order_items((int)$o['id']));
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . ($o['payment_status'] === 'paid' ? 'Receipt-' : 'Invoice-') . $o['ref'] . '.pdf"');
    echo $pdf;
}

function admin_order_pop(string $id): void
{
    require_admin();
    $o = q_one('SELECT * FROM orders WHERE id = ?', [(int)$id]);
    if (!$o || !$o['pop_path']) {
        abort(404);
    }
    send_private_file('pop', $o['pop_path'], 'POP-' . $o['ref'] . '.' . pathinfo($o['pop_path'], PATHINFO_EXTENSION));
}

function admin_quotes(): void
{
    require_admin();
    admin_view('quotes', ['title' => 'Quote requests', 'quotes' => q_all('SELECT * FROM quotes ORDER BY id DESC LIMIT 300')]);
}

function admin_quote(string $id): void
{
    require_admin();
    $qt = q_one('SELECT * FROM quotes WHERE id = ?', [(int)$id]);
    if (!$qt) {
        abort(404);
    }
    if (is_post()) {
        db_update('quotes', ['status' => in_array($_POST['status'] ?? '', ['new', 'sent', 'won', 'lost'], true) ? $_POST['status'] : 'new', 'admin_notes' => trim($_POST['admin_notes'] ?? '')], 'id = ?', [$qt['id']]);
        flash('success', 'Quote updated.');
        redirect('/admin/quotes/' . $qt['id']);
    }
    admin_view('quote', ['title' => 'Quote ' . $qt['ref'], 'qt' => $qt]);
}

function admin_banners(): void
{
    require_admin();
    if (is_post() && ($_POST['action'] ?? '') === 'delete') {
        $b = q_one('SELECT * FROM banners WHERE id = ?', [(int)$_POST['id']]);
        if ($b && $b['image'] && str_starts_with($b['image'], 'uploads/')) {
            @unlink(ROOT_DIR . '/' . $b['image']);
        }
        q('DELETE FROM banners WHERE id = ?', [(int)$_POST['id']]);
        flash('success', 'Banner deleted.');
        redirect('/admin/banners');
    }
    admin_view('banners', ['title' => 'Banners & specials', 'banners' => q_all('SELECT * FROM banners ORDER BY placement, sort_order, id'), 'onSale' => (int)q_val("SELECT COUNT(*) FROM products WHERE sale_price > 0 AND sale_price < price AND (sale_ends IS NULL OR sale_ends >= ?)", [date('Y-m-d')])]);
}

function admin_banner_form(string $id): void
{
    require_admin();
    $b = $id === 'new' ? ['active' => 1, 'placement' => 'hero', 'sort_order' => 1] : q_one('SELECT * FROM banners WHERE id = ?', [(int)$id]);
    if (!$b) {
        abort(404);
    }
    if (is_post()) {
        $d = [
            'title' => trim($_POST['title'] ?? ''), 'subtitle' => trim($_POST['subtitle'] ?? ''), 'link_url' => trim($_POST['link_url'] ?? ''),
            'button_text' => trim($_POST['button_text'] ?? ''), 'placement' => ($_POST['placement'] ?? '') === 'strip' ? 'strip' : 'hero',
            'starts_on' => ($_POST['starts_on'] ?? '') ?: null, 'ends_on' => ($_POST['ends_on'] ?? '') ?: null,
            'active' => !empty($_POST['active']) ? 1 : 0, 'sort_order' => (int)($_POST['sort_order'] ?? 0),
        ];
        if ($d['link_url'] !== '' && !preg_match('#^(/|https?://)#', $d['link_url'])) {
            $d['link_url'] = '/' . $d['link_url'];
        }
        if ($f = uploaded_files('image')[0] ?? null) {
            if ($res = store_image($f['tmp_name'], 'banners', $d['title'] ?: 'banner', 1400, 600)) {
                $d['image'] = $res['path'];
            } else {
                flash('error', 'That file is not a valid image.');
            }
        }
        if (!empty($_POST['remove_image'])) {
            $d['image'] = null;
        }
        if ($id === 'new') {
            $d['created_at'] = now();
            db_insert('banners', $d);
        } else {
            db_update('banners', $d, 'id = ?', [(int)$id]);
        }
        flash('success', 'Banner saved.');
        redirect('/admin/banners');
    }
    admin_view('banner_form', ['title' => $id === 'new' ? 'New banner' : 'Edit banner', 'b' => $b]);
}

function admin_pages(): void
{
    require_admin();
    admin_view('pages', ['title' => 'Pages', 'pages' => q_all('SELECT * FROM pages ORDER BY title')]);
}

function admin_page_form(string $id): void
{
    require_admin();
    $pg = q_one('SELECT * FROM pages WHERE id = ?', [(int)$id]);
    if (!$pg) {
        abort(404);
    }
    if (is_post()) {
        db_update('pages', ['title' => trim($_POST['title'] ?? $pg['title']), 'content' => (string)($_POST['content'] ?? ''), 'meta_description' => trim($_POST['meta_description'] ?? ''), 'updated_at' => now()], 'id = ?', [$pg['id']]);
        flash('success', 'Page saved.');
        redirect('/admin/pages/' . $pg['id']);
    }
    admin_view('page_form', ['title' => 'Edit page', 'pg' => $pg]);
}

function admin_documents(): void
{
    require_admin();
    if (is_post()) {
        $action = $_POST['action'] ?? '';
        if ($action === 'upload') {
            $f = uploaded_files('file')[0] ?? null;
            $title = trim($_POST['title'] ?? '');
            if (!$f || $title === '') {
                flash('error', 'Give the document a title and choose a file.');
            } else {
                $res = store_private_file($f, 'docs', 10);
                if (isset($res['error'])) {
                    flash('error', $res['error']);
                } else {
                    db_insert('documents', ['title' => $title, 'description' => trim($_POST['description'] ?? ''), 'file_path' => $res['name'], 'original_name' => $f['name'], 'is_public' => !empty($_POST['is_public']) ? 1 : 0, 'created_at' => now()]);
                    flash('success', 'Document uploaded.');
                }
            }
        } elseif ($action === 'toggle') {
            q('UPDATE documents SET is_public = 1 - is_public WHERE id = ?', [(int)$_POST['id']]);
        } elseif ($action === 'delete') {
            $d = q_one('SELECT * FROM documents WHERE id = ?', [(int)$_POST['id']]);
            if ($d) {
                @unlink(STORAGE_DIR . '/docs/' . basename($d['file_path']));
                q('DELETE FROM documents WHERE id = ?', [$d['id']]);
                flash('success', 'Document deleted.');
            }
        }
        redirect('/admin/documents');
    }
    admin_view('documents', ['title' => 'Certificates & letters', 'docs' => q_all('SELECT * FROM documents ORDER BY id DESC')]);
}

function admin_document_file(string $id): void
{
    require_admin();
    $d = q_one('SELECT * FROM documents WHERE id = ?', [(int)$id]);
    if (!$d) {
        abort(404);
    }
    send_private_file('docs', $d['file_path'], $d['original_name'] ?: basename($d['file_path']));
}
