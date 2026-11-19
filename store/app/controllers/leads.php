<?php
/** Instant quotes, quote requests, call-backs, thank-you page, click tracking and the follow-up cron job. */

/** /quote — instant priced quote (pick products) or a free-text request for anything not on the website. */
function quote_page(): void
{
    $errors = [];
    $prefill = '';
    $start = [];
    if (!empty($_GET['product'])) {
        $p = product_by_id((int)$_GET['product']);
        if ($p && $p['visible']) {
            $start[] = ['p' => $p, 'qty' => max(1, (int)($_GET['qty'] ?? 1))];
            $prefill = $p['name'] . ' (' . $p['sku'] . ') × ' . max(1, (int)($_GET['qty'] ?? 1));
        }
    } elseif (!empty($_GET['cart'])) {
        foreach (cart_lines() as $l) {
            $start[] = ['p' => $l['product'], 'qty' => $l['qty']];
        }
    } elseif (!empty($_GET['item'])) {
        $prefill = mb_substr((string)$_GET['item'], 0, 200);
    }
    if (is_post()) {
        $mode = $_POST['mode'] ?? 'instant';
        $d = [
            'name' => trim($_POST['name'] ?? ''), 'company' => trim($_POST['company'] ?? ''), 'email' => trim($_POST['email'] ?? ''),
            'phone' => trim($_POST['phone'] ?? ''), 'message' => trim($_POST['message'] ?? ''), 'items' => trim($_POST['items'] ?? ''),
        ];
        if ($d['name'] === '') {
            $errors['name'] = 'Please enter your name.';
        }
        if ($d['email'] === '' && $d['phone'] === '') {
            $errors['email'] = 'Please give an email address or a WhatsApp / phone number.';
        } elseif ($d['email'] !== '' && !valid_email($d['email'])) {
            $errors['email'] = 'Please enter a valid email address.';
        }
        if (empty($_POST['consent'])) {
            $errors['consent'] = 'Please agree so we can use your details to send the quote.';
        }
        if (is_spam() || rate_limited('quote', 8, 3600)) {
            $errors['form'] = 'Too many requests. Please try again later or WhatsApp us.';
        }
        $wanted = [];
        foreach ((array)($_POST['qty'] ?? []) as $pid => $qty) {
            if ((int)$qty > 0) {
                $wanted[(int)$pid] = (int)$qty;
            }
        }
        if ($mode === 'instant' && !$wanted && $d['items'] === '') {
            $errors['items'] = 'Add at least one product (search above), or describe what you need.';
        }
        if ($mode === 'request' && $d['items'] === '') {
            $errors['items'] = 'Please tell us which products and quantities you need.';
        }
        if (!$errors) {
            $contact = $d + ['message' => trim($d['message'] . ($d['items'] !== '' ? "\n\nAlso needs:\n" . $d['items'] : ''))];
            $lead = $wanted ? instant_quote_create($wanted, $contact) : null;
            if (!$lead) {
                $lead = lead_create(['source' => 'quote_request', 'name' => $d['name'], 'company' => $d['company'], 'email' => $d['email'], 'phone' => $d['phone'], 'needs_price' => 1,
                    'message' => trim($d['items'] . ($d['message'] !== '' ? "\n\n" . $d['message'] : ''))]);
                db_insert('quotes', ['ref' => $lead['ref'], 'name' => $d['name'], 'company' => $d['company'], 'customer_type' => '', 'email' => $d['email'], 'phone' => $d['phone'],
                    'items' => mb_substr($d['items'], 0, 5000), 'message' => mb_substr($d['message'], 0, 5000), 'status' => 'new', 'created_at' => now()]);
            }
            lead_send_customer_reply($lead);
            if ($lead['source'] === 'instant_quote') {
                redirect(quote_url($lead));
            }
            redirect(url('thanks/' . $lead['ref'], ['t' => $lead['token']]));
        }
        keep_old($_POST);
        foreach ($wanted as $pid => $qty) {
            if ($p = product_by_id($pid)) {
                $start[] = ['p' => $p, 'qty' => $qty];
            }
        }
    }
    render('quote', ['errors' => $errors, 'prefill' => $prefill, 'start' => $start, 'meta' => [
        'title' => 'Instant quote',
        'description' => 'Get an instant priced quote for printers, ink, toner and office technology — download the PDF, accept and pay online, or chat on WhatsApp. Business, school and government orders welcome.',
    ]]);
}

/** /q/REF?t=TOKEN — the customer's quote with Accept & pay. */
function quote_view(string $ref): void
{
    $l = lead_by_ref($ref, (string)($_GET['t'] ?? ''));
    if (!$l || !in_array($l['source'], ['instant_quote'], true)) {
        abort(404);
    }
    track_event('quote_view', $l['ref']);
    render('quote_view', ['l' => $l, 'items' => lead_items($l), 'expired' => $l['valid_until'] && $l['valid_until'] < date('Y-m-d'),
        'meta' => ['title' => 'Quote ' . $l['ref'], 'robots' => 'noindex']]);
}

function quote_view_pdf(string $ref): void
{
    $l = lead_by_ref($ref, (string)($_GET['t'] ?? ''));
    if (!$l || !lead_items($l)) {
        abort(404);
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="Quote-' . $l['ref'] . '.pdf"');
    echo quote_pdf($l);
    exit;
}

/** Accept a quote: put the quoted items in the cart and go to checkout. Prices come from the website at checkout. */
function quote_accept(string $ref): void
{
    $l = lead_by_ref($ref, (string)($_GET['t'] ?? ''));
    if (!$l) {
        abort(404);
    }
    cart_clear();
    $changed = false;
    foreach (lead_items($l) as $it) {
        $p = product_by_id((int)$it['product_id']);
        if ($p && can_buy($p)) {
            cart_add((int)$p['id'], (int)$it['qty']);
            if (abs(effective_price($p) - (float)$it['price']) > 0.004) {
                $changed = true;
            }
        } else {
            $changed = true;
        }
    }
    $_SESSION['accepted_lead'] = (int)$l['id'];
    q('UPDATE leads SET updated_at = ? WHERE id = ?', [now(), $l['id']]);
    if ($changed) {
        flash('info', 'Some prices or stock changed since your quote. Please check your cart before paying, or WhatsApp us and we will honour your quote where we can.');
    }
    redirect('/checkout');
}

/** Thank-you page after any enquiry: shows the instant reply and a WhatsApp button that carries the reference. */
function thanks_page(string $ref): void
{
    $l = lead_by_ref($ref, (string)($_GET['t'] ?? ''));
    if (!$l) {
        abort(404);
    }
    render('thanks', ['l' => $l, 'meta' => ['title' => 'Thank you', 'robots' => 'noindex']]);
}

/** Call-back / appointment request (small form on product pages, contact page and the assistant). */
function callback_request(): void
{
    $name = trim($_POST['name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $when = trim($_POST['preferred_time'] ?? '');
    $pid = (int)($_POST['product_id'] ?? 0);
    if ($name === '' || strlen(preg_replace('/\D/', '', $phone)) < 9) {
        flash('error', 'Please enter your name and a phone number we can call.');
        back('/contact');
    }
    if (is_spam() || rate_limited('callback', 5, 3600)) {
        flash('error', 'Too many requests. Please WhatsApp us instead.');
        back('/contact');
    }
    $p = $pid ? product_by_id($pid) : null;
    $lead = lead_create(['source' => 'callback', 'name' => $name, 'phone' => $phone, 'email' => trim($_POST['email'] ?? ''), 'preferred_time' => $when ?: 'As soon as possible',
        'product_id' => $p ? (int)$p['id'] : null, 'message' => trim(($p ? 'About: ' . $p['name'] . ' (' . $p['sku'] . ")\n" : '') . ($_POST['message'] ?? ''))]);
    lead_send_customer_reply($lead);
    redirect(url('thanks/' . $lead['ref'], ['t' => $lead['token']]));
}

/** Anonymous click counter (WhatsApp clicks, chat opens). Called by the browser with navigator.sendBeacon. */
function track_api(): void
{
    $type = (string)($_POST['type'] ?? '');
    if (in_array($type, ['wa_click', 'chat_open', 'call_click'], true) && !rate_limited('track', 60, 3600)) {
        track_event($type, (string)($_POST['label'] ?? ''), (string)($_POST['path'] ?? ''));
    }
    http_response_code(204);
    exit;
}

/**
 * /cron/KEY — run every hour from cPanel → Cron Jobs.
 * - Follow-up emails to customers with an unpaid instant quote (after 1 day and 3 days).
 * - Reminder to the owner about leads nobody has contacted within 2 hours (once).
 */
function cron_run(string $key): void
{
    $saved = (string)setting('cron_key');
    if ($saved === '' || !hash_equals($saved, $key)) {
        abort(404);
    }
    $sent = 0;
    if (setting('followups_on', '1') === '1') {
        $due = q_all("SELECT * FROM leads WHERE source = 'instant_quote' AND status IN ('quoted','new','contacted') AND order_id IS NULL AND email <> ''
            AND ((followups = 0 AND created_at <= ?) OR (followups = 1 AND created_at <= ?)) AND (valid_until IS NULL OR valid_until >= ?)",
            [date('Y-m-d H:i:s', strtotime('-1 day')), date('Y-m-d H:i:s', strtotime('-3 days')), date('Y-m-d')]);
        foreach ($due as $l) {
            if (!lead_items($l)) {
                continue;
            }
            $first = trim(explode(' ', (string)$l['name'])[0]) ?: 'there';
            $wa = 'https://wa.me/' . wa_number(setting('whatsapp')) . '?text=' . rawurlencode('Hi, about my quote ' . $l['ref']);
            $body = '<p>Hi ' . e($first) . ',</p><p>' . ($l['followups'] == 0
                    ? 'Just checking in on your quote <strong>' . e($l['ref']) . '</strong> (' . money($l['total']) . '). Is there anything we can help with — another quantity, a different model, or delivery details?'
                    : 'Your quote <strong>' . e($l['ref']) . '</strong> is still reserved for you until ' . e(date('j F', strtotime($l['valid_until']))) . '. Stock on specials is limited — reply or WhatsApp us if you have any questions.')
                . '</p><p><a href="' . e(quote_url($l, '/accept')) . '" style="background:#c9a84c;color:#1a2f45;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Accept &amp; pay online</a> &nbsp; '
                . '<a href="' . e($wa) . '">WhatsApp us</a></p>';
            if (send_mail($l['email'], 'Your quote ' . $l['ref'] . ' — ' . setting('business_name'), email_layout('Still interested?', $body))) {
                $sent++;
            }
            q('UPDATE leads SET followups = followups + 1, last_followup_at = ? WHERE id = ?', [now(), $l['id']]);
        }
    }
    $stale = q_all("SELECT * FROM leads WHERE status = 'new' AND owner_alerts < 2 AND created_at <= ? AND created_at >= ?",
        [date('Y-m-d H:i:s', strtotime('-2 hours')), date('Y-m-d H:i:s', strtotime('-3 days'))]);
    foreach ($stale as $l) {
        lead_alert_owner($l, 'REMINDER — not contacted yet:');
    }
    header('Content-Type: text/plain');
    echo 'OK ' . date('Y-m-d H:i') . " — follow-ups sent: $sent, owner reminders: " . count($stale) . "\n";
    exit;
}

/** Admin → Leads: every enquiry in one list, with this month's numbers. */
function admin_leads(): void
{
    require_admin();
    $month = preg_match('/^\d{4}-\d{2}$/', (string)($_GET['month'] ?? '')) ? $_GET['month'] : date('Y-m');
    $where = ['created_at >= ?', 'created_at < ?'];
    $params = [$month . '-01 00:00:00', date('Y-m-d 00:00:00', strtotime($month . '-01 +1 month'))];
    $status = (string)($_GET['status'] ?? '');
    $source = (string)($_GET['source'] ?? '');
    if (isset(lead_statuses()[$status])) {
        $where[] = 'status = ?';
        $params[] = $status;
    }
    if (isset(lead_sources()[$source])) {
        $where[] = 'source = ?';
        $params[] = $source;
    }
    $rows = q_all('SELECT * FROM leads WHERE ' . implode(' AND ', $where) . ' ORDER BY id DESC LIMIT 500', $params);
    $months = [];
    for ($i = 0; $i < 12; $i++) {
        $months[] = date('Y-m', strtotime(date('Y-m-01') . " -$i month"));
    }
    admin_view('leads', ['title' => 'Leads', 'rows' => $rows, 'stats' => lead_stats($month), 'month' => $month, 'months' => $months, 'status' => $status, 'source' => $source]);
}

function admin_lead(string $id): void
{
    require_admin();
    $l = q_one('SELECT * FROM leads WHERE id = ?', [(int)$id]);
    if (!$l) {
        abort(404);
    }
    if (is_post()) {
        $action = $_POST['action'] ?? 'save';
        if ($action === 'save') {
            $st = isset(lead_statuses()[$_POST['status'] ?? '']) ? $_POST['status'] : $l['status'];
            lead_mark($l, $st);
            db_update('leads', ['admin_notes' => mb_substr(trim($_POST['admin_notes'] ?? ''), 0, 5000)], 'id = ?', [$l['id']]);
            flash('success', 'Lead saved.');
        } elseif ($action === 'contacted') {
            lead_mark($l, $l['status'] === 'new' ? 'contacted' : $l['status']);
            flash('success', 'Marked as contacted.');
        } elseif ($action === 'requote') {
            $items = lead_items($l);
            foreach ($items as $i => $it) {
                $np = parse_money((string)($_POST['price'][$i] ?? ''));
                $nq = max(0, (int)($_POST['qty'][$i] ?? $it['qty']));
                if ($np !== null && !is_nan($np)) {
                    $items[$i]['price'] = $np;
                }
                $items[$i]['qty'] = $nq;
                $items[$i]['line_total'] = round($items[$i]['price'] * $nq, 2);
            }
            $items = array_values(array_filter($items, fn($it) => $it['qty'] > 0));
            $sub = round(array_sum(array_column($items, 'line_total')), 2);
            $days = max(1, (int)setting('quote_valid_days', 7));
            db_update('leads', ['items' => json_encode($items), 'subtotal' => $sub, 'total' => round($sub + delivery_fee($sub, 'courier'), 2), 'needs_price' => 0,
                'status' => 'quoted', 'valid_until' => date('Y-m-d', strtotime("+$days days")), 'updated_at' => now(),
                'first_response_at' => $l['first_response_at'] ?: now()], 'id = ?', [$l['id']]);
            $l = q_one('SELECT * FROM leads WHERE id = ?', [$l['id']]);
            if ($l['email']) {
                lead_send_customer_reply($l);
            }
            flash('success', 'Quote updated' . ($l['email'] ? ' and emailed to the customer.' : '. Send the link on WhatsApp.'));
        }
        redirect('/admin/leads/' . $l['id']);
    }
    $chat = $l['chat_id'] ? q_one('SELECT * FROM chats WHERE id = ?', [$l['chat_id']]) : null;
    admin_view('lead', ['title' => 'Lead ' . $l['ref'], 'l' => $l, 'items' => lead_items($l), 'chat' => $chat]);
}
