<?php
/**
 * AI receipt and invoice reading for the Setwel app.
 *
 * The app sends a photo (or PDF) of a till slip, tax invoice or supplier invoice.
 * This script asks Claude to read it and returns the details as JSON so the app
 * can fill in the expense. The photo is not stored here.
 *
 * Monthly limits per plan (SCAN_LIMITS below). Trial users get 30 in total, plus
 * a daily cap per internet connection so the trial can't be abused.
 *
 * Calls the Claude API over HTTPS with PHP's built-in cURL, because shared cPanel
 * hosting has no Composer to install the PHP SDK.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';
require __DIR__ . '/usage.php';

const SCAN_LIMITS = [
    'trial' => 30,          // whole trial
    'hustler' => 30,        // per month
    'grinder' => 150,
    'builder' => null,      // unlimited
    'enterprise' => null,
    'accountant_partner' => null,
];
const TRIAL_SCANS_PER_IP_PER_DAY = 20;
const UNLIMITED_SAFETY_CAP = 2000; // per month, so a leaked key can't run up a huge bill

if (!defined('ANTHROPIC_API_KEY') || ANTHROPIC_API_KEY === '') {
    app_reply(503, ['error' => 'Receipt scanning is not switched on yet. Please type the expense in for now.']);
}

$in = app_input(8 * 1024 * 1024);
$caller = app_caller($in);

$media = (string)($in['mediaType'] ?? '');
$data = (string)($in['data'] ?? '');
$allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
if (!in_array($media, $allowed, true) || $data === '' || base64_decode($data, true) === false) {
    app_reply(400, ['error' => 'Please send a photo (JPG or PNG) or a PDF.']);
}

$categories = array_values(array_filter(array_map(
    fn($c) => substr(trim(strip_tags((string)$c)), 0, 60),
    is_array($in['categories'] ?? null) ? array_slice($in['categories'], 0, 60) : []
)));
if (!$categories) $categories = ['Other expenses'];

// ---- Limits ----
$limit = SCAN_LIMITS[$caller['plan']] ?? 30;
if ($caller['trial']) {
    if (usage_take('trial-scans-ip-' . date('Y-m-d'), client_ip(), TRIAL_SCANS_PER_IP_PER_DAY) === null) {
        app_reply(429, ['error' => 'Daily scan limit reached for the free trial. Try again tomorrow, or choose a plan.']);
    }
    $bucket = 'scans-trial';
} else {
    $bucket = 'scans-' . date('Y-m');
}
$used = usage_take($bucket, $caller['id'], $limit ?? UNLIMITED_SAFETY_CAP);
if ($used === null) {
    $msg = $caller['trial']
        ? 'You have used the 30 free scans in your trial. Choose a plan to keep scanning.'
        : "You have used this month's {$limit} scans on your plan. Upgrade for more, or type the expense in.";
    app_reply(429, ['error' => $msg]);
}

// ---- Ask Claude ----
$schema = [
    'type' => 'object',
    'properties' => [
        'is_receipt' => ['type' => 'boolean', 'description' => 'False if the picture is not a receipt, slip or invoice.'],
        'supplier_name' => ['type' => 'string', 'description' => 'Business that issued it. Empty if unreadable.'],
        'supplier_vat_number' => ['type' => 'string', 'description' => 'Supplier VAT number (10 digits starting with 4 in South Africa). Empty if none.'],
        'document_number' => ['type' => 'string', 'description' => 'Invoice or slip number. Empty if none.'],
        'date' => ['type' => 'string', 'description' => 'Date in YYYY-MM-DD. Empty if unreadable.'],
        'total' => ['type' => 'number', 'description' => 'Final amount paid, including VAT, in rand. 0 if unreadable.'],
        'vat_amount' => ['type' => 'number', 'description' => 'VAT amount shown on the document, in rand. 0 if no VAT is shown.'],
        'description' => ['type' => 'string', 'description' => 'Short description of what was bought, under 60 characters, e.g. "Diesel" or "Printer paper and toner".'],
        'category' => ['type' => 'string', 'enum' => $categories, 'description' => 'Best matching expense category.'],
        'confidence' => ['type' => 'string', 'enum' => ['high', 'medium', 'low'], 'description' => 'How clearly the document could be read.'],
    ],
    'required' => ['is_receipt', 'supplier_name', 'supplier_vat_number', 'document_number', 'date', 'total', 'vat_amount', 'description', 'category', 'confidence'],
    'additionalProperties' => false,
];

$fileBlock = $media === 'application/pdf'
    ? ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => $media, 'data' => $data]]
    : ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $media, 'data' => $data]];

$request = [
    'model' => defined('ANTHROPIC_MODEL') && ANTHROPIC_MODEL !== '' ? ANTHROPIC_MODEL : 'claude-opus-5-5',
    'max_tokens' => 4000,
    'system' => 'You read South African till slips, tax invoices and supplier invoices for a small-business bookkeeping app. '
        . 'Report only what is printed or written on the document; leave a field empty (or 0) rather than guess. '
        . 'Amounts are in rand. If VAT is not shown separately, set vat_amount to 0.',
    'messages' => [[
        'role' => 'user',
        'content' => [$fileBlock, ['type' => 'text', 'text' => 'Read this document and fill in the fields.']],
    ]],
    'output_config' => [
        'effort' => 'low', // reading a slip is simple; low effort keeps it fast and inexpensive
        'format' => ['type' => 'json_schema', 'schema' => $schema],
    ],
];

$base = defined('ANTHROPIC_BASE_URL') ? ANTHROPIC_BASE_URL : 'https://api.anthropic.com'; // override only for testing
$ch = curl_init($base . '/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($request),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 90,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2026-10-21',
    ],
]);
$raw = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

$res = is_string($raw) ? json_decode($raw, true) : null;
if ($status !== 200 || !is_array($res)) {
    usage_refund($bucket, $caller['id']);
    pf_log('Scan failed: HTTP ' . $status . ' ' . $curlError, ['error' => $res['error'] ?? null]);
    $busy = in_array($status, [429, 500, 502, 503, 529], true);
    app_reply(502, ['error' => $busy ? 'The scanner is busy. Please try again in a minute.' : 'The scanner could not read that. Please type the expense in.']);
}

if (($res['stop_reason'] ?? '') === 'refusal') {
    usage_refund($bucket, $caller['id']);
    app_reply(422, ['error' => 'The scanner could not read that document. Please type the expense in.']);
}

$text = '';
foreach ($res['content'] ?? [] as $block) {
    if (($block['type'] ?? '') === 'text') {
        $text = $block['text'];
        break;
    }
}
$fields = json_decode($text, true);
if (!is_array($fields)) {
    usage_refund($bucket, $caller['id']);
    pf_log('Scan returned no JSON', ['stop_reason' => $res['stop_reason'] ?? null]);
    app_reply(502, ['error' => 'The scanner could not read that. Please try a clearer photo.']);
}
if (empty($fields['is_receipt'])) {
    usage_refund($bucket, $caller['id']);
    app_reply(422, ['error' => "That doesn't look like a receipt or invoice. Please take a photo of the slip."]);
}

$remaining = ($limit === null) ? null : max(0, $limit - $used);
app_reply(200, ['fields' => $fields, 'remaining' => $remaining]);
