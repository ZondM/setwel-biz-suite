<?php
/** Orders: statuses, history, customer emails. */

function order_statuses(): array
{
    return [
        'pending_payment' => 'Awaiting payment',
        'payment_review' => 'Proof of payment received — checking',
        'processing' => 'Paid — being prepared',
        'ready_for_collection' => 'Ready for collection',
        'shipped' => 'Shipped with courier',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
    ];
}

function order_status_label(string $s): string
{
    return order_statuses()[$s] ?? ucfirst(str_replace('_', ' ', $s));
}

function order_by_ref(string $ref, ?string $token = null): ?array
{
    $o = q_one('SELECT * FROM orders WHERE ref = ?', [$ref]);
    if ($o && $token !== null && !hash_equals($o['token'], $token)) {
        return null;
    }
    return $o;
}

function order_items(int $orderId): array
{
    return q_all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [$orderId]);
}

function order_add_history(int $orderId, string $status, string $note, bool $notified = false): void
{
    db_insert('order_history', ['order_id' => $orderId, 'status' => $status, 'note' => $note, 'notified' => $notified ? 1 : 0, 'created_at' => now()]);
}

function order_link(array $o): string
{
    return abs_url('order/' . $o['ref'], ['t' => $o['token']]);
}

/** Email the customer. $type: placed | paid | status */
function order_send_email(int $orderId, string $type, string $extra = ''): bool
{
    $o = q_one('SELECT * FROM orders WHERE id = ?', [$orderId]);
    if (!$o) {
        return false;
    }
    $items = order_items($orderId);
    $link = order_link($o);
    $btn = '<p style="margin:24px 0"><a href="' . e($link) . '" style="background:#c9a84c;color:#1a2f45;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">View your order</a></p>';
    $hello = '<p>Hi ' . e(explode(' ', $o['customer_name'])[0]) . ',</p>';
    switch ($type) {
        case 'placed':
            $subject = 'Order ' . $o['ref'] . ' received — ' . setting('business_name');
            $title = 'Thank you for your order';
            $body = $hello . '<p>We have received your order <strong>' . e($o['ref']) . '</strong>.</p>';
            if ($o['payment_method'] === 'eft') {
                $body .= '<p><strong>Please pay by EFT</strong> using reference <strong>' . e($o['ref']) . '</strong>, then upload your proof of payment on your order page. We dispatch once payment reflects.</p>' . bank_details_html();
            }
            $body .= email_order_table($o, $items) . $btn;
            break;
        case 'paid':
            $subject = 'Payment received for order ' . $o['ref'];
            $title = 'Payment received — thank you!';
            $body = $hello . '<p>We have received payment for order <strong>' . e($o['ref']) . '</strong> and are preparing it now. Your receipt is attached.</p>' . email_order_table($o, $items) . $btn;
            break;
        default:
            $subject = 'Order ' . $o['ref'] . ': ' . order_status_label($o['status']);
            $title = 'Order update: ' . order_status_label($o['status']);
            $body = $hello . '<p>Your order <strong>' . e($o['ref']) . '</strong> is now: <strong>' . e(order_status_label($o['status'])) . '</strong>.</p>';
            if ($o['status'] === 'shipped' && $o['tracking_number']) {
                $body .= '<p>Courier: <strong>' . e($o['courier']) . '</strong><br>Tracking number: <strong>' . e($o['tracking_number']) . '</strong></p>';
            }
            if ($o['status'] === 'ready_for_collection') {
                $body .= '<p>Collect at: <strong>' . e(setting('collection_address')) . '</strong> (' . e(setting('hours')) . '). Please bring your order number.</p>';
            }
            if ($extra !== '') {
                $body .= '<p>' . nl2br(e($extra)) . '</p>';
            }
            $body .= $btn;
    }
    $att = [];
    if ($type === 'paid' || ($type === 'placed' && $o['payment_method'] === 'eft')) {
        $att[] = ['name' => ($o['payment_status'] === 'paid' ? 'Receipt-' : 'Invoice-') . $o['ref'] . '.pdf', 'type' => 'application/pdf', 'data' => invoice_pdf($o, $items)];
    }
    return send_mail($o['email'], $subject, email_layout($title, $body), $att, setting('email'));
}

function order_notify_admin(int $orderId, string $headline): void
{
    $o = q_one('SELECT * FROM orders WHERE id = ?', [$orderId]);
    if (!$o) {
        return;
    }
    $body = '<p><strong>' . e($headline) . '</strong></p><p>' . e($o['customer_name']) . ' · ' . e($o['email']) . ' · ' . e($o['phone']) . '</p>'
        . email_order_table($o, order_items($orderId))
        . '<p><a href="' . e(abs_url('admin/orders/' . $o['id'])) . '">Open in admin</a></p>';
    send_mail(setting('orders_email') ?: setting('email'), $headline . ' — ' . $o['ref'] . ' (' . money($o['total']) . ')', email_layout($headline, $body), [], $o['email']);
}

function bank_details_html(): string
{
    if (!setting('bank_account_number')) {
        return '<p><em>Our banking details will be sent to you shortly.</em></p>';
    }
    return '<table style="font-size:14px;margin:12px 0;background:#f7f5f0;padding:12px;border-radius:6px" cellpadding="4">'
        . '<tr><td>Bank</td><td><strong>' . e(setting('bank_name')) . '</strong></td></tr>'
        . '<tr><td>Account name</td><td><strong>' . e(setting('bank_account_name')) . '</strong></td></tr>'
        . '<tr><td>Account number</td><td><strong>' . e(setting('bank_account_number')) . '</strong></td></tr>'
        . '<tr><td>Branch code</td><td><strong>' . e(setting('bank_branch_code')) . '</strong></td></tr>'
        . '<tr><td>Account type</td><td>' . e(setting('bank_account_type')) . '</td></tr></table>';
}
