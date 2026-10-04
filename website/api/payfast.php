<?php
/**
 * PayFast helper functions — signature generation, ITN verification,
 * and a small flat-file store for pending payments (no database needed).
 *
 * Signature spec: https://developers.payfast.co.za/docs#step_2_signature
 * ITN spec:       https://developers.payfast.co.za/docs#step_3_itn
 */

// Field order matters for signature generation — this must match the order
// PayFast documents, not the order you happen to build the array in.
const PF_FIELD_ORDER = [
    'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
    'name_first', 'name_last', 'email_address', 'cell_number',
    'm_payment_id', 'amount', 'item_name', 'item_description',
    'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
    'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
    'email_confirmation', 'confirmation_address',
    'payment_method',
    'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles',
];

/**
 * Build the MD5 signature PayFast expects. Must be called with the SAME
 * field set (minus 'signature' itself) that gets submitted or that PayFast
 * posted back to the ITN handler.
 */
function pf_generate_signature(array $data, string $passphrase = ''): string
{
    $pairs = [];
    foreach (PF_FIELD_ORDER as $key) {
        if (isset($data[$key]) && $data[$key] !== '') {
            $pairs[] = $key . '=' . urlencode(trim((string)$data[$key]));
        }
    }
    $paramString = implode('&', $pairs);
    if ($passphrase !== '') {
        $paramString .= '&passphrase=' . urlencode(trim($passphrase));
    }
    return md5($paramString);
}

/**
 * PayFast recommends confirming the source of an ITN by reverse-DNS-resolving
 * the caller's IP and checking it belongs to payfast.co.za, rather than
 * trusting a hardcoded IP list (which changes over time).
 */
function pf_valid_source_ip(string $ip): bool
{
    if ($ip === '') return false;
    $host = gethostbyaddr($ip);
    if ($host === false || $host === $ip) return false;
    return (bool)preg_match('/\.payfast\.co\.za$/i', rtrim($host, '.'));
}

/**
 * PayFast's documented server-to-server check: POST the exact ITN data back
 * to PayFast and confirm it replies "VALID". This catches spoofed requests
 * that pass signature + IP checks (e.g. a replayed old ITN).
 */
function pf_server_validate(array $postData, bool $sandbox): bool
{
    $host = $sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
    $url  = 'https://' . $host . '/eng/query/validate';

    $body = http_build_query($postData);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        pf_log('pf_server_validate curl error: ' . $error, $postData);
        return false;
    }
    return trim($response) === 'VALID';
}

function pf_data_dir(): string
{
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    return $dir;
}

/** Record what we expect to be charged for a payment ID, before redirecting to PayFast. */
function pf_store_pending_payment(string $paymentId, array $details): void
{
    $file = pf_data_dir() . '/pending-payments.json';
    $fh = fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($all)) $all = [];
    $all[$paymentId] = $details;
    // Keep the file from growing forever — drop anything older than 90 days.
    $cutoff = time() - 90 * 86400;
    foreach ($all as $id => $d) {
        if (!empty($d['created_at']) && strtotime($d['created_at']) < $cutoff) {
            unset($all[$id]);
        }
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all, JSON_PRETTY_PRINT));
    flock($fh, LOCK_UN);
    fclose($fh);
}

function pf_get_pending_payment(string $paymentId): ?array
{
    $file = pf_data_dir() . '/pending-payments.json';
    if (!file_exists($file)) return null;
    $all = json_decode(file_get_contents($file), true);
    return is_array($all) && isset($all[$paymentId]) ? $all[$paymentId] : null;
}

function pf_mark_payment_complete(string $paymentId, array $itnData): void
{
    $file = pf_data_dir() . '/completed-payments.json';
    $fh = fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($all)) $all = [];
    $all[$paymentId] = [
        'completed_at' => date('c'),
        'amount_gross' => $itnData['amount_gross'] ?? null,
        'payment_status' => $itnData['payment_status'] ?? null,
        'pf_payment_id' => $itnData['pf_payment_id'] ?? null,
    ];
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all, JSON_PRETTY_PRINT));
    flock($fh, LOCK_UN);
    fclose($fh);
}

function pf_log(string $message, array $context = []): void
{
    $line = date('c') . ' ' . $message . ' ' . json_encode($context) . "\n";
    file_put_contents(pf_data_dir() . '/payfast.log', $line, FILE_APPEND | LOCK_EX);
}

function pf_notify_team(?array $order, array $itnData): void
{
    if (!defined('NOTIFY_EMAIL') || NOTIFY_EMAIL === '') return;
    $plan = $order['plan'] ?? 'Unknown plan';
    $name = $order['name'] ?? 'Unknown';
    $email = $order['email'] ?? 'unknown';
    $phone = $order['phone'] ?? 'unknown';
    $amount = $itnData['amount_gross'] ?? ($order['amount'] ?? '?');
    $subject = 'Payment received: ' . $plan . ' — R' . $amount;
    $body = "A payment has been confirmed by PayFast.\n\n"
        . "Plan: {$plan}\n"
        . "Amount: R{$amount}\n"
        . "Customer: {$name}\n"
        . "Email: {$email}\n"
        . "Phone: {$phone}\n"
        . "PayFast payment ID: " . ($itnData['pf_payment_id'] ?? '?') . "\n"
        . "Our payment ID: " . ($itnData['m_payment_id'] ?? '?') . "\n\n"
        . "Action: send download link / licence key as appropriate.";
    @mail(NOTIFY_EMAIL, $subject, $body, 'From: no-reply@setwelbusiness.co.za');
}

/**
 * Sign a PayFast payment data array and output the auto-submitting redirect
 * page that sends the browser on to PayFast's hosted checkout. Shared by
 * create-payment.php (once-off purchases, charged immediately) and
 * activate-subscription.php (subscriptions, charged only once a trial has
 * actually ended — never at trial signup).
 */
function pf_redirect_to_payfast(array $data, string $passphrase, bool $sandbox): void
{
    $data['signature'] = pf_generate_signature($data, $passphrase);
    $action = $sandbox
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process';
    ?>
<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="UTF-8">
<title>Redirecting to secure payment…</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#0A0808;color:#F2EDE8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
.box{padding:24px}
p{color:#A09088}
</style>
</head>
<body>
<div class="box">
<p>Redirecting you to PayFast's secure payment page&hellip;</p>
<noscript><p>JavaScript is required. <a href="#" onclick="document.getElementById('pf-form').submit();return false;" style="color:#E8801A">Click here to continue</a>.</p></noscript>
</div>
<form id="pf-form" action="<?= htmlspecialchars($action, ENT_QUOTES) ?>" method="POST">
<?php foreach ($data as $k => $v): ?>
<input type="hidden" name="<?= htmlspecialchars($k, ENT_QUOTES) ?>" value="<?= htmlspecialchars($v, ENT_QUOTES) ?>">
<?php endforeach; ?>
</form>
<script>document.getElementById('pf-form').submit();</script>
</body>
</html>
<?php
    exit;
}

/* ══════════════ FREE TRIALS (no payment taken at signup) ══════════════
   A trial signup never reaches PayFast at all — it just records who
   signed up for what, exactly matching pay.html's promise of "no card
   required, no payment taken today". 30 days later,
   send-trial-reminders.php (run from a server cron job) emails a
   PayFast activation link; activate-subscription.php is the only place
   a subscription customer is ever actually charged. */

function pf_store_trial(array $details): array
{
    $id = 'TRIAL-' . date('YmdHis') . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
    $record = array_merge($details, [
        'token' => bin2hex(random_bytes(16)),
        'created_at' => date('c'),
        'trial_ends_at' => date('Y-m-d', strtotime('+30 days')),
        'reminder_sent_at' => null,
        'activated_at' => null,
    ]);
    $file = pf_data_dir() . '/trials.json';
    $fh = fopen($file, 'c+');
    if ($fh) {
        flock($fh, LOCK_EX);
        $size = filesize($file);
        $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
        if (!is_array($all)) $all = [];
        $all[$id] = $record;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($all, JSON_PRETTY_PRINT));
        flock($fh, LOCK_UN);
        fclose($fh);
    }
    return ['id' => $id] + $record;
}

function pf_get_trial(string $id): ?array
{
    $file = pf_data_dir() . '/trials.json';
    if (!file_exists($file)) return null;
    $all = json_decode(file_get_contents($file), true);
    return is_array($all) && isset($all[$id]) ? $all[$id] : null;
}

function pf_update_trial(string $id, array $fields): void
{
    $file = pf_data_dir() . '/trials.json';
    $fh = fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($all)) $all = [];
    if (isset($all[$id])) $all[$id] = array_merge($all[$id], $fields);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all, JSON_PRETTY_PRINT));
    flock($fh, LOCK_UN);
    fclose($fh);
}

/** Trials whose 30-day period has ended, not yet reminded, not yet activated. */
function pf_trials_due_for_reminder(): array
{
    $file = pf_data_dir() . '/trials.json';
    if (!file_exists($file)) return [];
    $all = json_decode(file_get_contents($file), true);
    if (!is_array($all)) return [];
    $today = date('Y-m-d');
    $due = [];
    foreach ($all as $id => $t) {
        if (empty($t['activated_at']) && empty($t['reminder_sent_at']) && ($t['trial_ends_at'] ?? '9999-99-99') <= $today) {
            $due[$id] = $t;
        }
    }
    return $due;
}

function pf_email_trial_started(array $trial): void
{
    $to = $trial['email'] ?? '';
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) return;
    $name = $trial['first'] ?? 'there';
    $plan = $trial['plan'] ?? 'Setwel Biz Suite';
    $endsAt = isset($trial['trial_ends_at']) ? date('j F Y', strtotime($trial['trial_ends_at'])) : '';
    $subject = 'Your Setwel Biz Suite free trial has started';
    $body = "Hi {$name},\n\n"
        . "Your 30-day free trial of the {$plan} plan has started. No payment was taken today and no card was charged.\n\n"
        . "Get started here: https://setwelbusiness.co.za/download.html\n\n"
        . "Your trial ends on {$endsAt}. We'll email you a secure PayFast payment link on that date to activate your subscription — nothing happens automatically before then, and nothing is ever charged until you complete that payment yourself.\n\n"
        . "Questions? WhatsApp us any time at +27 82 082 9050.\n\n"
        . "— The Setwel team";
    @mail($to, $subject, $body, 'From: no-reply@setwelbusiness.co.za');
}

function pf_email_trial_activation_link(array $trial, string $id): void
{
    $to = $trial['email'] ?? '';
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) return;
    $name = $trial['first'] ?? 'there';
    $plan = $trial['plan'] ?? 'Setwel Biz Suite';
    $price = $trial['price'] ?? '';
    $billing = strtolower($trial['billing'] ?? 'monthly');
    $link = (defined('SITE_URL') ? SITE_URL : '') . '/api/activate-subscription.php?id=' . urlencode($id) . '&token=' . urlencode($trial['token'] ?? '');
    $subject = 'Your Setwel Biz Suite trial has ended — activate your subscription';
    $body = "Hi {$name},\n\n"
        . "Your 30-day free trial of the {$plan} plan has ended. To keep using Setwel Biz Suite without interruption, activate your R{$price} {$billing} subscription here:\n\n"
        . "{$link}\n\n"
        . "That link takes you to PayFast's secure payment page. Nothing is charged until you complete that payment yourself.\n\n"
        . "Not ready yet, or have questions? WhatsApp us at +27 82 082 9050 and we'll help.\n\n"
        . "— The Setwel team";
    @mail($to, $subject, $body, 'From: no-reply@setwelbusiness.co.za');
}

function pf_notify_team_trial_started(array $trial, string $id): void
{
    if (!defined('NOTIFY_EMAIL') || NOTIFY_EMAIL === '') return;
    $subject = 'New free trial started: ' . ($trial['plan'] ?? '?');
    $body = "A new free trial has started — no payment taken.\n\n"
        . "Trial ID: {$id}\n"
        . "Plan: " . ($trial['plan'] ?? '?') . ' (' . ($trial['billing'] ?? '?') . ")\n"
        . "Name: " . ($trial['first'] ?? '') . ' ' . ($trial['last'] ?? '') . "\n"
        . "Business: " . ($trial['biz'] ?? '') . "\n"
        . "Email: " . ($trial['email'] ?? '') . "\n"
        . "Phone: " . ($trial['phone'] ?? '') . "\n"
        . "Trial ends: " . ($trial['trial_ends_at'] ?? '?') . "\n";
    @mail(NOTIFY_EMAIL, $subject, $body, 'From: no-reply@setwelbusiness.co.za');
}
