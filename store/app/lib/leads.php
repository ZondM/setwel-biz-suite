<?php
/**
 * Leads: every enquiry (instant quote, quote request, contact message, AI chat, call-back, WhatsApp click)
 * is stored here so nothing gets lost, the owner is alerted at once, and the dashboard can count them.
 */

function lead_sources(): array
{
    return [
        'instant_quote' => 'Instant quote',
        'quote_request' => 'Quote request (form)',
        'contact' => 'Contact message',
        'chat' => 'AI assistant',
        'callback' => 'Call-back request',
        'order' => 'Online order',
    ];
}

function lead_statuses(): array
{
    return [
        'new' => 'New — not contacted',
        'contacted' => 'Contacted',
        'quoted' => 'Quote sent',
        'won' => 'Won (paid / ordered)',
        'lost' => 'Lost',
    ];
}

/** Save a lead, alert the owner straight away, and return the saved row. */
function lead_create(array $d, bool $alert = true): array
{
    $d += ['status' => 'new', 'created_at' => now(), 'updated_at' => now()];
    $d['ref'] = $d['ref'] ?? random_ref('L');
    $d['token'] = $d['token'] ?? bin2hex(random_bytes(16));
    foreach (['name', 'phone', 'email', 'company', 'preferred_time'] as $k) {
        if (isset($d[$k])) {
            $d[$k] = mb_substr(trim((string)$d[$k]), 0, 180);
        }
    }
    if (isset($d['message'])) {
        $d['message'] = mb_substr((string)$d['message'], 0, 5000);
    }
    $id = db_insert('leads', $d);
    $lead = q_one('SELECT * FROM leads WHERE id = ?', [$id]);
    if ($alert) {
        lead_alert_owner($lead);
    }
    return $lead;
}

function lead_by_ref(string $ref, ?string $token = null): ?array
{
    $l = q_one('SELECT * FROM leads WHERE ref = ?', [$ref]);
    if (!$l || ($token !== null && !hash_equals((string)$l['token'], $token))) {
        return null;
    }
    return $l;
}

/** Short text describing a lead, used in owner alerts. */
function lead_summary(array $l): string
{
    $src = lead_sources()[$l['source']] ?? $l['source'];
    $t = "New lead {$l['ref']} ({$src})\n";
    $t .= trim(($l['name'] ?: 'No name') . ' · ' . ($l['phone'] ?: '') . ' · ' . ($l['email'] ?: ''), ' ·') . "\n";
    if ($l['total'] !== null && (float)$l['total'] > 0) {
        $t .= 'Value: ' . money($l['total'], false) . ($l['needs_price'] ? ' (+ items needing a price!)' : '') . "\n";
    } elseif ($l['needs_price']) {
        $t .= "Needs a price from you!\n";
    }
    if ($l['preferred_time']) {
        $t .= 'Wants a call: ' . $l['preferred_time'] . "\n";
    }
    if ($l['message']) {
        $t .= mb_substr(preg_replace('/\s+/', ' ', $l['message']), 0, 300) . "\n";
    }
    return $t . abs_url('admin/leads/' . $l['id']);
}

/** Tell the owner immediately: WhatsApp (if the CallMeBot key is set) and email. */
function lead_alert_owner(array $l, string $prefix = ''): void
{
    $text = ($prefix ? $prefix . "\n" : '') . lead_summary($l);
    $sent = owner_whatsapp($text);
    if (setting('alert_email_on', '1') === '1' || !$sent) {
        $to = setting('orders_email') ?: setting('email');
        if ($to) {
            send_mail($to, ($prefix ?: 'New lead') . ' ' . $l['ref'] . ' — ' . ($l['name'] ?: 'website visitor'),
                email_layout('New lead ' . $l['ref'], '<p style="white-space:pre-line">' . e($text) . '</p>'
                    . ($l['phone'] ? '<p><a href="' . e(lead_wa_link($l)) . '" style="background:#1f9d55;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Reply on WhatsApp</a></p>' : '')
                    . '<p><a href="' . e(abs_url('admin/leads/' . $l['id'])) . '">Open in admin</a></p>'),
                [], $l['email'] ?: null);
        }
    }
    q('UPDATE leads SET owner_alerts = owner_alerts + 1 WHERE id = ?', [$l['id']]);
}

/**
 * Send a WhatsApp message to the owner's own number through CallMeBot (free, for personal alerts).
 * Returns false (and logs) when not set up or when the service does not answer within 6 seconds.
 */
function owner_whatsapp(string $text): bool
{
    $key = trim((string)setting('alert_whatsapp_apikey'));
    $phone = wa_number((string)setting('whatsapp'));
    if ($key === '' || $phone === '' || !function_exists('curl_init')) {
        return false;
    }
    $url = 'https://api.callmebot.com/whatsapp.php?' . http_build_query(['phone' => '+' . $phone, 'text' => mb_substr($text, 0, 1000), 'apikey' => $key]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $ok = $res !== false && $code >= 200 && $code < 300;
    log_message('alerts', ($ok ? 'WhatsApp alert sent' : 'WhatsApp alert FAILED (' . $code . ')') . ': ' . mb_substr(str_replace("\n", ' | ', $text), 0, 160));
    return $ok;
}

/** wa.me link for the owner to reply to the customer, with a ready-made message. */
function lead_wa_link(array $l, string $text = ''): string
{
    if ($text === '') {
        $first = trim(explode(' ', (string)$l['name'])[0]);
        $text = 'Hi ' . ($first ?: 'there') . ', this is ' . setting('business_name') . ' about your ' . strtolower(lead_sources()[$l['source']] ?? 'enquiry') . ' ' . $l['ref'] . '. ';
        if ($l['source'] === 'instant_quote' && $l['token']) {
            $text .= 'Your quote: ' . abs_url('q/' . $l['ref'], ['t' => $l['token']]) . ' — ';
        }
        $text .= 'How can we help?';
    }
    return 'https://wa.me/' . wa_number((string)$l['phone']) . '?text=' . rawurlencode($text);
}

/** Customer-facing link to an instant quote. */
function quote_url(array $l, string $extra = ''): string
{
    return abs_url('q/' . $l['ref'] . $extra, ['t' => $l['token']]);
}

/** Record that the owner has responded (first time only) and update the status. */
function lead_mark(array $l, string $status): void
{
    $fields = ['status' => $status, 'updated_at' => now()];
    if (!$l['first_response_at'] && $status !== 'new') {
        $fields['first_response_at'] = now();
    }
    db_update('leads', $fields, 'id = ?', [$l['id']]);
}

/** Anonymous click/visit counters (no personal data): WhatsApp clicks, chat opens, quote views. */
function track_event(string $type, string $label = '', string $path = ''): void
{
    try {
        db_insert('events', ['type' => mb_substr($type, 0, 30), 'label' => mb_substr($label, 0, 190), 'path' => mb_substr($path, 0, 255), 'created_at' => now()]);
    } catch (Throwable $e) {
        // never break a page because of statistics
    }
}

/**
 * Price a list of [product_id => qty] with live website prices.
 * Returns lines (same shape as cart lines), totals, and the names of items that need a price from the owner.
 */
function quote_price_lines(array $wanted): array
{
    $lines = [];
    $unpriced = [];
    foreach ($wanted as $pid => $qty) {
        $qty = max(1, min(999, (int)$qty));
        $p = product_by_id((int)$pid);
        if (!$p || !$p['visible']) {
            continue;
        }
        $price = effective_price($p);
        if ($price <= 0 || $p['stock_status'] === 'out_of_stock') {
            $unpriced[] = $p['name'] . ' (' . $p['sku'] . ') × ' . $qty . ($p['stock_status'] === 'out_of_stock' ? ' — out of stock' : '');
            continue;
        }
        if ($p['stock_qty'] !== null && $qty > (int)$p['stock_qty']) {
            $unpriced[] = $p['name'] . ' (' . $p['sku'] . ') × ' . ($qty - (int)$p['stock_qty']) . ' — more than the ' . (int)$p['stock_qty'] . ' in stock';
            $qty = (int)$p['stock_qty'];
            if ($qty < 1) {
                continue;
            }
        }
        $lines[] = ['product' => $p, 'qty' => $qty, 'price' => $price, 'total' => round($price * $qty, 2)];
    }
    return ['lines' => $lines, 'totals' => cart_totals($lines), 'unpriced' => $unpriced];
}

/** Stored items of an instant quote (JSON) → lines with names and prices as quoted. */
function lead_items(array $l): array
{
    $items = json_decode((string)$l['items'], true);
    return is_array($items) ? $items : [];
}

/**
 * Create an instant quote lead from [product_id => qty] and contact details.
 * The prices are fixed at the moment of quoting and stored with the lead.
 */
function instant_quote_create(array $wanted, array $contact, string $source = 'instant_quote', ?int $chatId = null): ?array
{
    $q = quote_price_lines($wanted);
    if (!$q['lines'] && !$q['unpriced']) {
        return null;
    }
    $items = array_map(fn($l) => [
        'product_id' => (int)$l['product']['id'], 'sku' => $l['product']['sku'], 'name' => $l['product']['name'],
        'qty' => $l['qty'], 'price' => $l['price'], 'line_total' => $l['total'],
    ], $q['lines']);
    $msg = trim((string)($contact['message'] ?? ''));
    if ($q['unpriced']) {
        $msg = trim($msg . "\n\nNeeds a price / stock check:\n- " . implode("\n- ", $q['unpriced']));
    }
    $days = max(1, (int)setting('quote_valid_days', 7));
    return lead_create([
        'source' => $source, 'status' => $q['unpriced'] ? 'new' : 'quoted',
        'name' => $contact['name'] ?? '', 'phone' => $contact['phone'] ?? '', 'email' => $contact['email'] ?? '', 'company' => $contact['company'] ?? '',
        'message' => $msg, 'items' => json_encode($items), 'subtotal' => $q['totals']['subtotal'], 'total' => $q['totals']['total'],
        'needs_price' => $q['unpriced'] ? 1 : 0, 'valid_until' => date('Y-m-d', strtotime("+$days days")), 'chat_id' => $chatId,
        'first_response_at' => $q['unpriced'] ? null : now(), // fully priced = answered instantly
    ]);
}

/** The customer's instant reply email for a new lead (with the quote PDF when there is one). */
function lead_send_customer_reply(array $l): void
{
    if (!$l['email'] || !valid_email($l['email'])) {
        return;
    }
    $first = trim(explode(' ', (string)$l['name'])[0]) ?: 'there';
    $wa = 'https://wa.me/' . wa_number(setting('whatsapp')) . '?text=' . rawurlencode('Hi, about my ' . strtolower(lead_sources()[$l['source']] ?? 'enquiry') . ' ' . $l['ref']);
    $body = '<p>Hi ' . e($first) . ',</p><p>' . nl2br(e(setting('business_hours_reply'))) . '</p><p>Your reference: <strong>' . e($l['ref']) . '</strong></p>';
    $attach = [];
    if ($l['source'] === 'instant_quote' && lead_items($l)) {
        $body .= '<p><strong>Your quote total: ' . money($l['total']) . '</strong> (valid until ' . e(date('j F Y', strtotime($l['valid_until']))) . ').</p>'
            . '<p><a href="' . e(quote_url($l, '/accept')) . '" style="background:#c9a84c;color:#1a2f45;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Accept &amp; pay online</a>'
            . ' &nbsp; <a href="' . e(quote_url($l)) . '">View quote</a></p>';
        if ($l['needs_price']) {
            $body .= '<p>Some items need a price or stock check — we will send you an updated quote shortly.</p>';
        }
        $attach[] = ['name' => 'Quote-' . $l['ref'] . '.pdf', 'type' => 'application/pdf', 'data' => quote_pdf($l)];
    }
    $body .= '<p><a href="' . e($wa) . '" style="background:#1f9d55;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Chat to us on WhatsApp</a></p>';
    send_mail($l['email'], 'We received your request ' . $l['ref'] . ' — ' . setting('business_name'), email_layout('Thank you, ' . $first . '!', $body), $attach);
}

/** Quote PDF (uses the invoice layout with the title QUOTATION). */
function quote_pdf(array $l): string
{
    $order = [
        'doc_type' => 'quote', 'ref' => $l['ref'], 'payment_status' => 'unpaid', 'payment_method' => 'quote', 'paid_at' => null,
        'customer_name' => $l['name'], 'company' => $l['company'], 'customer_vat' => '', 'delivery_method' => 'quote',
        'address1' => '', 'address2' => '', 'city' => '', 'province' => '', 'postal_code' => '', 'phone' => $l['phone'], 'email' => $l['email'],
        'created_at' => $l['created_at'], 'valid_until' => $l['valid_until'], 'accept_url' => quote_url($l, '/accept'),
        'subtotal' => $l['subtotal'], 'delivery_fee' => (float)$l['total'] - (float)$l['subtotal'], 'total' => $l['total'],
    ];
    return invoice_pdf($order, lead_items($l));
}

/** Dashboard numbers for a month (Y-m). */
function lead_stats(string $month): array
{
    $from = $month . '-01 00:00:00';
    $to = date('Y-m-d 00:00:00', strtotime($from . ' +1 month'));
    $leads = q_all('SELECT source, status, total, created_at, first_response_at FROM leads WHERE created_at >= ? AND created_at < ?', [$from, $to]);
    $bySource = array_fill_keys(array_keys(lead_sources()), 0);
    $won = 0;
    $wonValue = 0.0;
    $quoted = 0.0;
    $mins = [];
    foreach ($leads as $l) {
        $bySource[$l['source']] = ($bySource[$l['source']] ?? 0) + 1;
        if ($l['status'] === 'won') {
            $won++;
            $wonValue += (float)$l['total'];
        }
        $quoted += (float)$l['total'];
        if ($l['first_response_at']) {
            $mins[] = max(0, (strtotime($l['first_response_at']) - strtotime($l['created_at'])) / 60);
        }
    }
    $events = [];
    foreach (q_all('SELECT type, COUNT(*) AS n FROM events WHERE created_at >= ? AND created_at < ? GROUP BY type', [$from, $to]) as $r) {
        $events[$r['type']] = (int)$r['n'];
    }
    sort($mins);
    $orders = q_one("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS v FROM orders WHERE created_at >= ? AND created_at < ? AND payment_status = 'paid'", [$from, $to]);
    return [
        'total' => count($leads), 'by_source' => $bySource, 'won' => $won, 'won_value' => $wonValue, 'quoted_value' => $quoted,
        'median_response_min' => $mins ? (int)round($mins[intdiv(count($mins), 2)]) : null,
        'uncontacted' => (int)q_val("SELECT COUNT(*) FROM leads WHERE status = 'new' AND created_at >= ? AND created_at < ?", [$from, $to]),
        'wa_clicks' => $events['wa_click'] ?? 0, 'chat_opens' => $events['chat_open'] ?? 0, 'quote_views' => $events['quote_view'] ?? 0,
        'paid_orders' => (int)$orders['n'], 'paid_value' => (float)$orders['v'],
    ];
}
