<?php
/**
 * Sends invoices, payment reminders and reports from the Setwel app by email.
 *
 * Sent from no-reply@setwelbusiness.co.za with the business owner's own address
 * as Reply-To, so replies go to them. Plain text, with one optional PDF attached.
 *
 * Daily limits stop this from ever being used to send spam: paid licences
 * 50 a day, trial devices 10 in total and 5 a day per internet connection.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';
require __DIR__ . '/usage.php';

const EMAILS_PER_DAY_PAID = 50;
const EMAILS_TRIAL_TOTAL = 10;
const EMAILS_TRIAL_PER_IP_PER_DAY = 5;

$in = app_input(4 * 1024 * 1024);
$caller = app_caller($in);

$clean = fn($v, $max) => substr(trim(str_replace(["\r", "\0"], '', (string)$v)), 0, $max);
$to = $clean($in['to'] ?? '', 200);
$replyTo = $clean($in['replyTo'] ?? '', 200);
$subject = $clean($in['subject'] ?? '', 200);
$body = substr(str_replace("\0", '', (string)($in['body'] ?? '')), 0, 20000);
$fromName = preg_replace('/[^\p{L}\p{N} .,&\'()-]/u', '', $clean($in['fromName'] ?? 'Setwel customer', 80));

// One recipient only, no header injection (new lines were removed above).
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) app_reply(400, ['error' => "Please check the customer's email address."]);
if ($replyTo !== '' && !filter_var($replyTo, FILTER_VALIDATE_EMAIL)) app_reply(400, ['error' => 'Please check your own email address.']);
if ($subject === '' || trim($body) === '') app_reply(400, ['error' => 'The email needs a subject and a message.']);

$attachment = null;
if (!empty($in['attachment']) && is_array($in['attachment'])) {
    $name = preg_replace('/[^A-Za-z0-9 ._-]/', '', (string)($in['attachment']['filename'] ?? 'document.pdf'));
    $bytes = base64_decode((string)($in['attachment']['base64'] ?? ''), true);
    if ($bytes === false || strlen($bytes) > 3 * 1024 * 1024 || substr($bytes, 0, 4) !== '%PDF') {
        app_reply(400, ['error' => 'The attachment must be a PDF under 3 MB.']);
    }
    $attachment = ['name' => $name ?: 'document.pdf', 'bytes' => $bytes];
}

// ---- Limits ----
if ($caller['trial']) {
    if (usage_take('emails-ip-' . date('Y-m-d'), client_ip(), EMAILS_TRIAL_PER_IP_PER_DAY) === null) {
        app_reply(429, ['error' => 'Daily email limit reached for the free trial. Use WhatsApp, or try tomorrow.']);
    }
    $bucket = 'emails-trial';
    $limit = EMAILS_TRIAL_TOTAL;
} else {
    $bucket = 'emails-' . date('Y-m-d');
    $limit = EMAILS_PER_DAY_PAID;
}
$used = usage_take($bucket, $caller['id'], $limit);
if ($used === null) {
    app_reply(429, ['error' => $caller['trial']
        ? 'You have used the 10 free emails in your trial. Use WhatsApp, or choose a plan.'
        : 'You have sent 50 emails today, the daily limit. Use WhatsApp or try again tomorrow.']);
}

// ---- Build and send ----
$from = 'no-reply@setwelbusiness.co.za';
$encodedName = '=?UTF-8?B?' . base64_encode($fromName . ' via Setwel') . '?=';
$headers = [
    'From: ' . $encodedName . ' <' . $from . '>',
    'MIME-Version: 1.0',
];
if ($replyTo !== '') $headers[] = 'Reply-To: ' . $replyTo;

$footer = "\n\n--\nSent with Setwel Biz Suite. Reply to this email to contact {$fromName}.";
if ($attachment) {
    $boundary = 'setwel_' . bin2hex(random_bytes(8));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $message = "--{$boundary}\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($body . $footer))
        . "--{$boundary}\r\n"
        . "Content-Type: application/pdf; name=\"{$attachment['name']}\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"{$attachment['name']}\"\r\n\r\n"
        . chunk_split(base64_encode($attachment['bytes']))
        . "--{$boundary}--";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $message = chunk_split(base64_encode($body . $footer));
}

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$ok = @mail($to, $encodedSubject, $message, implode("\r\n", $headers), '-f' . $from);
if (!$ok) {
    usage_refund($bucket, $caller['id']);
    pf_log('send-email failed', ['to' => $to, 'caller' => $caller['id']]);
    app_reply(502, ['error' => 'The email could not be sent right now.']);
}

pf_log('Email sent', ['to' => $to, 'caller' => $caller['id'], 'attachment' => $attachment ? $attachment['name'] : null]);
app_reply(200, ['ok' => true, 'remaining' => max(0, $limit - $used)]);
