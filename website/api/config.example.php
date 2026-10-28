<?php
/**
 * Server settings — TEMPLATE.
 *
 * 1. Copy this file to "config.php" in the same folder (api/config.php).
 * 2. Fill in the real values.
 * 3. NEVER commit config.php to git. It holds secrets. (.gitignore already excludes it.)
 *
 * PayFast values: log in at https://www.payfast.co.za → Settings → Integration.
 * Set a "Security Passphrase" there and paste the same text below.
 */

// --- PayFast merchant identity ---
define('PAYFAST_MERCHANT_ID', '');
define('PAYFAST_MERCHANT_KEY', '');

// --- PayFast passphrase (must match your PayFast dashboard exactly) ---
define('PAYFAST_PASSPHRASE', '');

// --- Sandbox vs live ---
// Keep TRUE until a full test payment works on https://sandbox.payfast.co.za.
// Then set FALSE to take real payments.
define('PAYFAST_SANDBOX', true);

// --- Site address (no trailing slash) ---
define('SITE_URL', 'https://setwelbusiness.co.za');

// --- Where payment and referral notices are emailed ---
define('NOTIFY_EMAIL', 'sales@setwelbusiness.co.za');

// --- Licence signing key ---
// Signs the licences the app checks. It must match the public key built
// into the app (desktop/licence-public.pem). Keep it secret: anyone with
// it can make licences. If you lose it, a new app build is needed.
define('LICENCE_SIGNING_KEY', '');

// --- Password for the licence desk (api/admin.php). Empty = desk switched off. ---
define('ADMIN_PASSWORD', '');
