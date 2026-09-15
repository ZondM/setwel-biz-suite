<?php
/**
 * Server configuration — TEMPLATE. Covers both PayFast (payments) and
 * Claude/Anthropic (the invoice scanner on mobile.html).
 *
 * 1. Copy this file to "config.php" in the same folder (api/config.php).
 * 2. Fill in the real values below.
 * 3. NEVER commit config.php to git. It holds real secrets — that's the
 *    whole point of this setup. Add "website/api/config.php" to
 *    .gitignore before you commit anything else.
 *
 * PayFast values: log into https://www.payfast.co.za, go to
 * Settings → Integration. merchant_id and merchant_key are shown there.
 * The passphrase is NOT shown by default — you set one yourself under
 * Settings → Integration → "Security Passphrase". If you've never set
 * one, do that now; without it, PayFast cannot verify that a payment
 * request actually came from your site instead of being tampered with.
 *
 * Anthropic value: create a key at https://console.anthropic.com
 * (Settings → API Keys). This key is billed per scan, so keep it
 * private — it's the one thing in this file that costs you money if
 * leaked.
 */

// --- Your PayFast merchant identity ---
define('PAYFAST_MERCHANT_ID', '36150721');
define('PAYFAST_MERCHANT_KEY', 'komqftyo2czhi');

// --- The secret. Set this in your PayFast dashboard, then paste it here. ---
// Leave empty ONLY while testing in sandbox mode below.
define('PAYFAST_PASSPHRASE', '');

// --- Sandbox vs live ---
// Keep this TRUE until you have tested a full payment end-to-end in
// PayFast's sandbox (https://sandbox.payfast.co.za) and confirmed the
// notify_url below is being hit successfully. Only then set to FALSE
// to accept real payments.
define('PAYFAST_SANDBOX', true);

// --- Your site's public URL (no trailing slash) ---
define('SITE_URL', 'https://setwelbusiness.co.za');

// --- Where to email order/ITN notifications ---
define('NOTIFY_EMAIL', 'sales@setwelbusiness.co.za');

// --- Claude/Anthropic API key, for the mobile invoice scanner ---
// Without this, scanning shows "Scanning service needs attention" —
// the same friendly message customers already saw as "scan failed".
define('ANTHROPIC_API_KEY', '');

// Model used for scanning. Haiku is fast and inexpensive per scan; if
// accuracy on messy/handwritten receipts isn't good enough, try a
// Sonnet model instead — costs more per scan but reads harder images
// more reliably.
define('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001');
