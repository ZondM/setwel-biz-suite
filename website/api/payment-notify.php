<?php
/**
 * PayFast ITN (Instant Transaction Notification) handler.
 *
 * PayFast calls this URL server-to-server after a payment completes.
 * This is the ONLY place a payment should ever be treated as "real" —
 * never trust the browser returning to thank-you.html, since that can
 * be reached by anyone just by typing the URL.
 *
 * Verification steps, per PayFast's documented spec
 * (https://developers.payfast.co.za/docs#step_3_itn):
 *   1. Signature matches what we'd generate from the same data.
 *   2. Request genuinely came from a payfast.co.za host.
 *   3. PayFast confirms the data is valid via a server-to-server callback.
 *   4. The amount matches what we recorded when we sent the customer to
 *      PayFast (catches tampering that somehow got past 1-3).
 *   5. payment_status is actually COMPLETE.
 * All five must pass before anything is marked as paid.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';

header('Content-Type: text/plain; charset=utf-8');

// PayFast expects a 200 response to acknowledge receipt. Respond early;
// validation failures are logged, not surfaced back to PayFast (which
// would just retry a request that will fail the same way again).
http_response_code(200);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    exit;
}

$post = $_POST;
pf_log('ITN received', $post);

// 1. Signature check
$postedSignature = $post['signature'] ?? '';
$dataForSig = $post;
unset($dataForSig['signature']);
$expectedSignature = pf_generate_signature($dataForSig, PAYFAST_PASSPHRASE);
if (!hash_equals($expectedSignature, $postedSignature)) {
    pf_log('ITN REJECTED: signature mismatch', $post);
    exit;
}

// 2. Source IP check
$sourceIp = $_SERVER['REMOTE_ADDR'] ?? '';
if (!pf_valid_source_ip($sourceIp)) {
    pf_log('ITN REJECTED: source IP does not resolve to payfast.co.za — ' . $sourceIp, $post);
    exit;
}

// 3. Server-to-server validation with PayFast
if (!pf_server_validate($post, PAYFAST_SANDBOX)) {
    pf_log('ITN REJECTED: PayFast server validation returned INVALID', $post);
    exit;
}

// 4. Amount matches what we expected for this payment ID
$paymentId = $post['m_payment_id'] ?? '';
$expected = pf_get_pending_payment($paymentId);
$postedAmount = (float)($post['amount_gross'] ?? 0);
if (!$expected) {
    pf_log('ITN REJECTED: unknown m_payment_id — ' . $paymentId, $post);
    exit;
}
if (abs((float)$expected['amount'] - $postedAmount) > 0.01) {
    pf_log('ITN REJECTED: amount mismatch — expected ' . $expected['amount'] . ' got ' . $postedAmount, $post);
    exit;
}

// 5. Only fulfil on COMPLETE
if (($post['payment_status'] ?? '') !== 'COMPLETE') {
    pf_log('ITN noted, not fulfilling — status is ' . ($post['payment_status'] ?? 'unknown'), $post);
    exit;
}

// All checks passed.
pf_mark_payment_complete($paymentId, $post);
pf_notify_team($expected, $post);
pf_log('ITN ACCEPTED and fulfilled — ' . $paymentId, $post);
