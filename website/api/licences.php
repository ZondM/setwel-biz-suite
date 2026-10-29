<?php
/**
 * Licence keys: creating, storing, extending and signing them.
 *
 * A key (SETW-XXXX-XXXX-XXXX) is what the customer sees. The app sends it
 * to licence.php and gets back a signed token it can check offline.
 * Records are flat JSON files in data/licences/ (no database needed).
 */

const LIC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0 or 1 to avoid typing mistakes

function lic_dir(): string
{
    $dir = pf_data_dir() . '/licences';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    return $dir;
}

function lic_random(int $n): string
{
    $out = '';
    for ($i = 0; $i < $n; $i++) {
        $out .= LIC_ALPHABET[random_int(0, strlen(LIC_ALPHABET) - 1)];
    }
    return $out;
}

function lic_normalise(string $key): string
{
    $k = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $key));
    if (strpos($k, 'SETW') === 0) $k = substr($k, 4);
    return 'SETW-' . implode('-', str_split($k, 4));
}

function lic_valid_format(string $key): bool
{
    return (bool)preg_match('/^SETW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $key);
}

function lic_file(string $key): string
{
    return lic_dir() . '/' . $key . '.json';
}

function lic_get(string $key): ?array
{
    $key = lic_normalise($key);
    if (!lic_valid_format($key)) return null;
    $f = lic_file($key);
    if (!file_exists($f)) return null;
    $data = json_decode(file_get_contents($f), true);
    return is_array($data) ? $data : null;
}

function lic_save(array $lic): void
{
    file_put_contents(lic_file($lic['key']), json_encode($lic, JSON_PRETTY_PRINT), LOCK_EX);
}

/** Small index so we can find a licence by PayFast payment ID or referral code. */
function lic_index_update(callable $fn): array
{
    $file = pf_data_dir() . '/licence-index.json';
    $fh = fopen($file, 'c+');
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $idx = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($idx)) $idx = [];
    $idx += ['payment' => [], 'ref' => []];
    $idx = $fn($idx);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($idx, JSON_PRETTY_PRINT));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $idx;
}

function lic_index(): array
{
    return lic_index_update(fn($i) => $i);
}

function lic_find_by_payment(string $paymentId): ?array
{
    $key = lic_index()['payment'][$paymentId] ?? null;
    return $key ? lic_get($key) : null;
}

function lic_find_by_ref(string $ref): ?array
{
    $ref = strtoupper(trim($ref));
    $key = lic_index()['ref'][$ref] ?? null;
    return $key ? lic_get($key) : null;
}

function lic_period(string $billing): string
{
    return in_array(strtolower($billing), ['yearly', 'annual'], true) ? '+1 year' : '+1 month';
}

/** Push paid_until forward from today or from the current end date, whichever is later. */
function lic_extend(array $lic, string $period): array
{
    $from = max(time(), strtotime($lic['paid_until'] ?? 'now'));
    $lic['paid_until'] = date('c', strtotime($period, $from));
    return $lic;
}

function lic_create(array $details): array
{
    do {
        $key = 'SETW-' . lic_random(4) . '-' . lic_random(4) . '-' . lic_random(4);
    } while (file_exists(lic_file($key)));
    $ref = 'REF-' . lic_random(6);

    $lic = [
        'key' => $key,
        'ref_code' => $ref,
        'plan' => $details['plan'] ?? 'grinder',
        'billing' => $details['billing'] ?? 'monthly',
        'name' => $details['name'] ?? '',
        'email' => $details['email'] ?? '',
        'phone' => $details['phone'] ?? '',
        'biz' => $details['biz'] ?? '',
        'payment_id' => $details['payment_id'] ?? '',
        'payfast_token' => $details['payfast_token'] ?? '',
        'referred_by' => $details['referred_by'] ?? '',
        'status' => 'active',
        'created_at' => date('c'),
        'paid_until' => date('c'),
        'referral_credits' => 0,
    ];
    $lic = lic_extend($lic, $details['period'] ?? lic_period($lic['billing']));
    lic_save($lic);

    lic_index_update(function ($idx) use ($lic) {
        if ($lic['payment_id'] !== '') $idx['payment'][$lic['payment_id']] = $lic['key'];
        $idx['ref'][$lic['ref_code']] = $lic['key'];
        return $idx;
    });
    return $lic;
}

function lic_b64url(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

/** Signed token the app checks offline. Only plan and dates go in it, no personal details. */
function lic_token(array $lic): string
{
    $payload = json_encode([
        'key' => $lic['key'],
        'plan' => $lic['plan'],
        'paid_until' => $lic['paid_until'],
        'issued' => date('c'),
    ]);
    $body = lic_b64url($payload);
    $secret = base64_decode(LICENCE_SIGNING_KEY);
    return $body . '.' . lic_b64url(sodium_crypto_sign_detached($body, $secret));
}

/**
 * Token for a staff laptop: the owner's plan and paid-up date, but not the owner's key,
 * so the key never sits on a staff laptop. Refreshed on every sync.
 */
function lic_team_token(array $lic, string $teamId): string
{
    $payload = json_encode([
        'key' => 'TEAM',
        'team' => $teamId,
        'plan' => $lic['plan'],
        'paid_until' => $lic['paid_until'],
        'issued' => date('c'),
    ]);
    $body = lic_b64url($payload);
    $secret = base64_decode(LICENCE_SIGNING_KEY);
    return $body . '.' . lic_b64url(sodium_crypto_sign_detached($body, $secret));
}

function lic_plan_name(string $plan): string
{
    $names = [
        'hustler' => 'Hustler', 'grinder' => 'Grinder', 'builder' => 'Builder',
        'enterprise' => 'Enterprise', 'accountant_partner' => 'Accountant Partner',
    ];
    return $names[$plan] ?? ucfirst($plan);
}

function lic_email_new(array $lic): void
{
    if (!filter_var($lic['email'], FILTER_VALIDATE_EMAIL)) return;
    $site = SITE_URL;
    $first = explode(' ', trim($lic['name']))[0] ?: 'there';
    $subject = 'Your Setwel licence key: ' . $lic['key'];
    $body = "Hi {$first},\n\n"
        . "Thank you for choosing Setwel Biz Suite (" . lic_plan_name($lic['plan']) . ").\n\n"
        . "YOUR LICENCE KEY:  {$lic['key']}\n\n"
        . "To unlock Setwel:\n"
        . "  1. Open Setwel on your computer.\n"
        . "  2. If it asks for a key, paste the key above and click Activate.\n"
        . "     (Or use the menu: Licence > Enter licence key.)\n\n"
        . "Haven't installed it yet? Download it here: {$site}/download.html\n"
        . "On a phone: {$site}/app/ (enter the key when asked).\n\n"
        . "TRAINING MANUAL (for subscribers): {$site}/manual.html\n"
        . "Sign in with your licence key. Please keep it for your own business.\n\n"
        . "YOUR REFERRAL CODE:  {$lic['ref_code']}\n"
        . "Share it with other business owners. Every business that pays with your code gets you a free month.\n"
        . "Share link: {$site}/?ref={$lic['ref_code']}\n\n"
        . "Questions? WhatsApp us on 082 082 9050.\n\n"
        . "The Setwel team";
    @mail($lic['email'], $subject, $body, 'From: no-reply@setwelbusiness.co.za');
}

/**
 * Referral reward: one free month for the referrer. The licence is extended
 * straight away. If they pay by PayFast subscription, we also ask PayFast to
 * skip one charge; if that fails, the team is emailed to do it by hand.
 */
function lic_credit_referrer(array $referrer, array $newCustomer): void
{
    $referrer = lic_extend($referrer, '+1 month');
    $referrer['referral_credits'] = ($referrer['referral_credits'] ?? 0) + 1;
    lic_save($referrer);

    $paused = false;
    if (!empty($referrer['payfast_token'])) {
        $paused = pf_pause_subscription($referrer['payfast_token'], 1);
    }

    if (filter_var($referrer['email'], FILTER_VALIDATE_EMAIL)) {
        $first = explode(' ', trim($referrer['name']))[0] ?: 'there';
        @mail($referrer['email'], 'You earned a free month of Setwel',
            "Hi {$first},\n\nA business you referred has just joined Setwel. Your next month is free, and your licence now runs to "
            . date('j F Y', strtotime($referrer['paid_until'])) . ".\n\nThank you for spreading the word.\n\nThe Setwel team",
            'From: no-reply@setwelbusiness.co.za');
    }
    if (defined('NOTIFY_EMAIL') && NOTIFY_EMAIL !== '') {
        $action = $paused
            ? "PayFast was asked to skip their next charge automatically. Nothing to do."
            : "ACTION NEEDED: skip one charge for this customer in the PayFast dashboard (Subscriptions > find their email > Pause 1 cycle)."
              . (empty($referrer['payfast_token']) ? " They have no PayFast subscription on record, so check how they pay." : "");
        @mail(NOTIFY_EMAIL, 'Referral reward: ' . $referrer['email'],
            "Referrer: {$referrer['name']} <{$referrer['email']}> ({$referrer['key']})\n"
            . "New customer: {$newCustomer['name']} <{$newCustomer['email']}>\n"
            . "Referrer licence now paid to: {$referrer['paid_until']}\n\n{$action}\n",
            'From: no-reply@setwelbusiness.co.za');
    }
    pf_log('Referral credited', ['referrer' => $referrer['key'], 'new' => $newCustomer['key'], 'payfast_paused' => $paused]);
}
