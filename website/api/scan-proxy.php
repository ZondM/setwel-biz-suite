<?php
/**
 * Invoice/receipt scan proxy for mobile.html's camera scanner.
 *
 * The client already does everything else correctly (camera capture,
 * compression, and full error-handling UI for every failure mode below —
 * it was just POSTing to a URL that never existed on the server). This
 * file is the missing piece: it forwards the captured image to Claude's
 * vision API using a key that stays server-side, and returns Claude's
 * response verbatim — the client's existing parsing code
 * (d.content[0].text, e.error.message) already matches the Anthropic
 * Messages API's response shape exactly, on both success and error.
 */

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => ['message' => 'Method not allowed']]);
    exit;
}

if (!defined('ANTHROPIC_API_KEY') || ANTHROPIC_API_KEY === '') {
    http_response_code(500);
    // Deliberately includes "authentication" so the client's existing
    // "Scanning service needs attention" message (see mobile.html callAI())
    // fires instead of a confusing generic error.
    echo json_encode(['error' => ['message' => 'authentication: scanning service is not configured']]);
    exit;
}

// --- Simple per-IP rate limit: 10 scans per 10 minutes ---
// Cheap abuse control since every scan costs a real API call.
$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir)) mkdir($dataDir, 0750, true);
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = $dataDir . '/scan-rate-' . md5($ip) . '.json';
$now = time();
$window = 600; // seconds
$limit = 10;

$hits = [];
if (file_exists($rateFile)) {
    $hits = json_decode(file_get_contents($rateFile), true) ?: [];
}
$hits = array_values(array_filter($hits, function ($t) use ($now, $window) {
    return $t > $now - $window;
}));
if (count($hits) >= $limit) {
    http_response_code(429);
    echo json_encode(['error' => ['message' => 'rate limit: too many scans, please wait a minute']]);
    exit;
}
$hits[] = $now;
file_put_contents($rateFile, json_encode($hits), LOCK_EX);

// --- Read and validate the request body ---
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body) || empty($body['image'])) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'image: no image data received']]);
    exit;
}

$imageB64 = $body['image'];
$mediaType = in_array($body['media_type'] ?? '', ['image/jpeg', 'image/png', 'image/webp'], true)
    ? $body['media_type']
    : 'image/jpeg';

// Reject absurdly large payloads before spending an API call on them
// (client already compresses to ~450KB, so 8MB base64 is a generous ceiling).
if (strlen($imageB64) > 8 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'image: file too large']]);
    exit;
}

$prompt = <<<PROMPT
You are reading a photo of a South African invoice or receipt. Extract the following as STRICT JSON only — no markdown fences, no explanation, just the JSON object:

{
  "supplier": string or null,
  "invoiceNumber": string or null,
  "invoiceDate": string or null (as shown on the document),
  "vatNumber": string or null,
  "subtotal": number or null,
  "vatAmount": number or null,
  "total": number or null,
  "paymentMethod": string ("Cash", "Card", "EFT", etc.) or "Unknown",
  "confidence": "high" | "medium" | "low",
  "lineItems": [ { "description": string, "qty": number, "unitPrice": number, "lineTotal": number } ]
}

Rules:
- Only include a field's real value if you can actually read it; otherwise use null.
- lineItems: include every line you can read; use an empty array if none are legible.
- Set confidence to "low" if the image is blurry, cropped, or key totals are unclear.
- Respond with ONLY the JSON object, nothing else.
PROMPT;

$payload = [
    'model' => ANTHROPIC_MODEL,
    'max_tokens' => 1200,
    'messages' => [[
        'role' => 'user',
        'content' => [
            [
                'type' => 'image',
                'source' => [
                    'type' => 'base64',
                    'media_type' => $mediaType,
                    'data' => $imageB64,
                ],
            ],
            ['type' => 'text', 'text' => $prompt],
        ],
    ]],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => ['message' => 'network: could not reach scanning service (' . $curlError . ')']]);
    exit;
}

// Forward Claude's response (and status code) straight through — its
// success shape (content[0].text) and error shape (error.message) are
// exactly what the client already parses.
http_response_code($httpCode ?: 502);
echo $response;
