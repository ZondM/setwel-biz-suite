<?php
/** Store settings (editable in Admin → Settings). Defaults below are used until changed. */

function setting_defaults(): array
{
    return [
        // Business
        'business_name' => 'Setwel Africa',
        'legal_name' => 'Setwel Africa (Pty) Ltd',
        'registration_number' => '',
        'tagline' => 'Printers, ink, toner & office technology — delivered nationwide',
        'site_url' => '',
        'email' => 'sa@setwelafrica.com',
        'orders_email' => 'sa@setwelafrica.com',
        'phone' => '082 082 9050',
        'phone2' => '073 019 7093',
        'whatsapp' => '073 019 7093',
        'address' => "124 Adderley Street\nCape Town CBD\n8001",
        'collection_address' => "124 Adderley Street, Cape Town CBD, 8001",
        'hours' => 'Mon–Fri 08:00–17:00',
        'map_query' => '124 Adderley Street, Cape Town',
        'information_officer' => '',
        // Trust
        'reseller_statement' => 'Authorised Reseller — Canon · HP · Epson · Riso · Brother',
        'reseller_details' => 'Setwel Africa is an authorised reseller of genuine Canon, HP, Epson, Riso and Brother products. Every product we sell is new, genuine and covered by the manufacturer’s warranty.',
        'bbbee_statement' => '100% Black-owned South African business',
        'show_brand_logos' => '0',
        // Money
        'vat_registered' => '0',
        'markup_percent' => '45',
        'price_rounding' => '1',
        'delivery_fee' => '150',
        'free_delivery_threshold' => '2500',
        'allow_collection' => '1',
        'delivery_note' => 'Nationwide courier delivery, usually 2–5 working days after payment.',
        // Payments
        'payfast_enabled' => '1',
        'payfast_mode' => 'sandbox',
        'payfast_merchant_id' => '10000100',
        'payfast_merchant_key' => '46f0cd694581a',
        'payfast_passphrase' => '',
        'payfast_check_ip' => '1',
        'eft_enabled' => '1',
        'bank_name' => '',
        'bank_account_name' => 'Setwel Africa (Pty) Ltd',
        'bank_account_number' => '',
        'bank_branch_code' => '',
        'bank_account_type' => 'Business cheque',
        // Email
        'mail_from_name' => 'Setwel Africa',
        'mail_from' => 'sa@setwelafrica.com',
        'smtp_host' => '',
        'smtp_port' => '465',
        'smtp_secure' => 'ssl',
        'smtp_user' => '',
        'smtp_pass' => '',
        // Marketing
        'ga4_id' => '',
        'meta_pixel_id' => '',
        'announcement' => 'Free nationwide delivery on orders over R2 500 · Collection available in Cape Town',
        'home_title' => 'Setwel Africa | Printers, Ink, Toner & Office Technology in South Africa',
        'home_description' => 'Buy genuine Canon, HP, Epson, Riso and Brother printers, ink and toner cartridges, laptop bags, USB and SSD storage online. Nationwide delivery, business quotes and collection in Cape Town.',
        'social_facebook' => '',
        'social_linkedin' => '',
        'social_instagram' => '',
    ];
}

function settings_all(): array
{
    static $cache = null;
    if ($cache === null || isset($GLOBALS['settings_dirty'])) {
        unset($GLOBALS['settings_dirty']);
        $cache = setting_defaults();
        try {
            foreach (q_all('SELECT skey, svalue FROM settings') as $r) {
                $cache[$r['skey']] = $r['svalue'];
            }
        } catch (Throwable $e) {
            // Database not ready yet (during install) — use defaults.
        }
    }
    return $cache;
}

function setting(string $key, $default = '')
{
    $all = settings_all();
    return $all[$key] ?? $default;
}

function setting_save(string $key, $value): void
{
    $value = (string)$value;
    if (q_val('SELECT COUNT(*) FROM settings WHERE skey = ?', [$key])) {
        q('UPDATE settings SET svalue = ? WHERE skey = ?', [$value, $key]);
    } else {
        q('INSERT INTO settings (skey, svalue) VALUES (?, ?)', [$key, $value]);
    }
    $GLOBALS['settings_dirty'] = true;
}

/** Pricing rules (Admin → Pricing rules). Returns all rules, cached for the request. */
function price_rules(): array
{
    static $rules = null;
    if ($rules === null || isset($GLOBALS['rules_dirty'])) {
        unset($GLOBALS['rules_dirty']);
        try {
            $rules = q_all('SELECT r.*, b.name AS brand_name, c.name AS category_name FROM price_rules r
                LEFT JOIN brands b ON b.id = r.brand_id LEFT JOIN categories c ON c.id = r.category_id ORDER BY r.id');
        } catch (Throwable $e) {
            $rules = [];
        }
    }
    return $rules;
}

/**
 * Markup % for a product. The most specific rule wins:
 *   brand + category  →  category only  →  brand only  →  default markup (Settings).
 */
function markup_for(?int $brandId, ?int $categoryId): float
{
    $best = null;
    $bestScore = -1;
    foreach (price_rules() as $r) {
        $b = $r['brand_id'] !== null ? (int)$r['brand_id'] : null;
        $c = $r['category_id'] !== null ? (int)$r['category_id'] : null;
        if (($b !== null && $b !== $brandId) || ($c !== null && $c !== $categoryId)) {
            continue;
        }
        $score = ($b !== null && $c !== null) ? 3 : ($c !== null ? 2 : ($b !== null ? 1 : 0));
        if ($score > $bestScore) {
            $best = (float)$r['markup'];
            $bestScore = $score;
        }
    }
    return $best ?? (float)setting('markup_percent', 45);
}

/**
 * Selling price from supplier cost: cost × (1 + markup%), rounded UP to the rounding step (R1 = no cents).
 * Example with 45% markup: R299.00 → R433.55 → R434. With 0% markup: R1 557.38 → R1 558.
 */
function price_from_cost(float $cost, ?int $brandId = null, ?int $categoryId = null): float
{
    $markup = markup_for($brandId, $categoryId);
    $price = $cost * (1 + $markup / 100);
    $step = (float)setting('price_rounding', 1);
    if ($step > 0) {
        $price = ceil(round($price / $step, 6)) * $step;
    }
    return round($price, 2);
}
