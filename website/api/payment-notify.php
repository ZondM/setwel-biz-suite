<?php
/**
 * PayFast ITN (Instant Transaction Notification) handler.
 *
 * PayFast calls this URL server-to-server after every payment, including
 * each monthly or yearly renewal of a subscription. This is the ONLY place
 * a payment is treated as real; the thank-you page can be reached by anyone.
 *
 * Verification, per https://developers.payfast.co.za/docs#step_3_itn:
 *   1. Signature matches what we'd generate from the same data.
 *   2. Request genuinely came from a payfast.co.za host.
 *   3. PayFast confirms the data is valid via a server-to-server callback.
 *   4. The amount matches what we recorded for this payment ID.
 *   5. payment_status is COMPLETE.
 *
 * Then: first payment creates the licence key (and credits the referrer);
 * every renewal extends it; a cancellation is recorded (access runs to the
 * end of the paid period).
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';

header('Content-Type: text/plain; charset=utf-8');
http_response_code(200); // acknowledge receipt; failures are logged, not retried

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    exit;
}

$post = $_POST;
pf_log('ITN received', $post);

// 1. Signature
$postedSignature = $post['signature'] ?? '';
if (!hash_equals(pf_itn_signature($post, PAYFAST_PASSPHRASE), $postedSignature)) {
    pf_log('ITN REJECTED: signature mismatch', $post);
    exit;
}

// 2. Source
if (!pf_valid_source_ip($_SERVER['REMOTE_ADDR'] ?? '')) {
    pf_log('ITN REJECTED: source IP does not resolve to payfast.co.za', $post);
    exit;
}

// 3. Server-to-server validation
if (!pf_server_validate($post, PAYFAST_SANDBOX)) {
    pf_log('ITN REJECTED: PayFast server validation returned INVALID', $post);
    exit;
}

// 4. Amount. Renewals arrive with the original payment ID; the pending record
// may have been cleaned up by then, so fall back to the licence on file.
$paymentId = $post['m_payment_id'] ?? '';
$expected = pf_get_pending_payment($paymentId);
$licence = lic_find_by_payment($paymentId);
$expectedAmount = $expected['amount'] ?? ($licence['amount'] ?? null);
if ($expectedAmount === null) {
    pf_log('ITN REJECTED: unknown m_payment_id ' . $paymentId, $post);
    exit;
}

$status = $post['payment_status'] ?? '';

if ($status === 'CANCELLED') {
    if ($licence) {
        $licence['status'] = 'cancelled';
        $licence['cancelled_at'] = date('c');
        lic_save($licence);
        pf_log('Subscription cancelled; access runs to ' . $licence['paid_until'], ['key' => $licence['key']]);
    }
    exit;
}

if (abs((float)$expectedAmount - (float)($post['amount_gross'] ?? 0)) > 0.01) {
    pf_log('ITN REJECTED: amount mismatch, expected ' . $expectedAmount, $post);
    exit;
}

// 5. Only fulfil COMPLETE payments
if ($status !== 'COMPLETE') {
    pf_log('ITN noted, not fulfilling. Status: ' . $status, $post);
    exit;
}

// PayFast can send the same notification more than once; each charge has its own pf_payment_id.
$pfId = (string)($post['pf_payment_id'] ?? '');
if ($licence && in_array($pfId, $licence['pf_ids'] ?? [], true)) {
    pf_log('ITN duplicate ignored ' . $pfId, ['key' => $licence['key']]);
    exit;
}

pf_mark_payment_complete($paymentId, $post);

if ($licence) {
    // Renewal: extend by one billing period.
    $licence['pf_ids'][] = $pfId;
    $licence = lic_extend($licence, lic_period($licence['billing']));
    $licence['status'] = 'active';
    if (!empty($post['token'])) $licence['payfast_token'] = $post['token'];
    lic_save($licence);
    pf_log('Renewal: licence extended to ' . $licence['paid_until'], ['key' => $licence['key']]);
    exit;
}

// First payment: create the licence.
$referrer = !empty($expected['ref']) ? lic_find_by_ref($expected['ref']) : null;
$licence = lic_create([
    'plan' => $expected['plan'],
    'billing' => $expected['billing'] ?? 'monthly',
    'name' => $expected['name'] ?? '',
    'email' => $expected['email'] ?? '',
    'phone' => $expected['phone'] ?? '',
    'biz' => $expected['biz'] ?? '',
    'payment_id' => $paymentId,
    'payfast_token' => $post['token'] ?? '',
    'referred_by' => $referrer['key'] ?? '',
]);
$licence['amount'] = $expected['amount'];
$licence['pf_ids'] = [$pfId];
lic_save($licence);

lic_email_new($licence);
pf_notify_team($expected, $post);
pf_log('ITN ACCEPTED, licence created ' . $licence['key'], ['payment_id' => $paymentId]);

// Referral reward, but not for referring yourself.
if ($referrer && strcasecmp($referrer['email'], $licence['email']) !== 0) {
    lic_credit_referrer($referrer, $licence);
}
