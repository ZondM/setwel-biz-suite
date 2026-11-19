<?php
/**
 * AI shopping assistant for the website (Claude API, called over HTTPS with cURL —
 * the store runs on plain cPanel hosting without Composer, so the PHP SDK is not used).
 *
 * The assistant only knows what its tools return from YOUR database: products, prices, stock.
 * When it is unsure (price missing, special request) it asks for the customer's name and number
 * and alerts the owner on WhatsApp at once. Switched off until an API key is saved in Settings.
 */

const ASSISTANT_API_URL = 'https://api.anthropic.com/v1/messages';
const ASSISTANT_API_VERSION = '2026-10-21';
const ASSISTANT_MAX_TURNS = 20;
const ASSISTANT_MAX_TOOL_ROUNDS = 6;

function assistant_enabled(): bool
{
    return setting('ai_enabled') === '1' && trim((string)setting('ai_api_key')) !== '' && function_exists('curl_init');
}

/** Stable instructions (kept identical between requests so they are cached by the API). */
function assistant_system_prompt(): string
{
    $biz = setting('business_name');
    $fee = money(setting('delivery_fee', 150), false);
    $free = (float)setting('free_delivery_threshold', 2500);
    $lines = [
        "You are the online sales assistant of {$biz}, a South African reseller of genuine printers, ink and toner cartridges (HP, Brother, Canon, Riso, Kyocera and more), storage, cleaning products and office technology. " . setting('reseller_statement') . '.',
        'Your goal: answer quickly and correctly, help the customer choose the right product, give prices and availability, and help them buy or get a quote within minutes.',
        '',
        'Rules:',
        '- Only state prices, stock and product facts that come from the search_products tool in this conversation. Never guess a price, a page yield or compatibility. If the tool does not show it, say you will check with the team and use request_owner_help.',
        '- Prices are in South African rand and are final: ' . (setting('vat_registered') === '1' ? 'they include VAT.' : "{$biz} is not VAT registered, so no VAT is added."),
        "- Delivery: nationwide by courier, {$fee} per order" . ($free > 0 ? ', free on orders of ' . money($free, false) . ' or more' : '') . '. ' . (setting('allow_collection') === '1' ? 'Free collection at ' . setting('collection_address') . '. ' : '') . setting('delivery_note'),
        '- Payment: card or Instant EFT through PayFast, or bank EFT. Customers pay online at checkout or through the "Accept & pay" link on a quote.',
        '- To buy: give the product link from search_products, or make a quote with create_quote (needs the customer\'s name and a phone number or email) — the quote link lets them accept and pay immediately.',
        '- When the customer wants a price you do not have, a bulk/contract price, a product not on the website, a delivery date guarantee, or a person: collect their name and phone number, then call request_owner_help. Tell them the team has been alerted and will contact them shortly, and offer WhatsApp ' . setting('whatsapp') . '.',
        '- If the customer mentions a competitor\'s lower price, be honest: use the price from search_products, mention any recorded market comparison it returns, and if they want a price match, use request_owner_help so the owner can decide. Never promise a discount yourself.',
        '- Whenever you give a quote link, add: "Please double-check with a person on ' . setting('whatsapp') . ' via WhatsApp before sending payment."',
        '- Weekly specials (marked weekly_special) are limited stock: mention the saving and the quantity left.',
        '- Write short, friendly answers in plain South African English (2–5 sentences or a short list). No markdown headings or tables. Put each product link on its own line.',
        '- Do not ask for ID numbers, card details or passwords. Do not discuss topics unrelated to the shop; steer back politely.',
        '',
        'Store details: phone ' . setting('phone') . ', WhatsApp ' . setting('whatsapp') . ', email ' . setting('email') . ', hours ' . setting('hours') . '. Address: ' . str_replace("\n", ', ', (string)setting('address')) . '. Quotes are valid for ' . (int)setting('quote_valid_days', 7) . ' days.',
    ];
    $extra = trim((string)setting('ai_extra_info'));
    if ($extra !== '') {
        $lines[] = "Extra facts from the owner:\n" . $extra;
    }
    return implode("\n", $lines);
}

function assistant_tools(): array
{
    return [
        [
            'name' => 'search_products',
            'description' => 'Search the shop\'s live product list by product name, cartridge or model code (e.g. "TN3607", "HP 730 cyan", "Riso master A4"), or by printer model to find compatible supplies. Returns current price, sale saving, stock, compatible printers and the product link. Always use this before quoting any price or availability.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'query' => ['type' => 'string', 'description' => 'Words or codes to search for.'],
                ],
                'required' => ['query'],
                'additionalProperties' => false,
            ],
            'strict' => true,
        ],
        [
            'name' => 'create_quote',
            'description' => 'Create an instant priced quote (with PDF and an "Accept & pay" link) for products found with search_products. Use when the customer asks for a quote or wants to buy several items. Requires the customer\'s name and a phone number or email.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'items' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['product_id' => ['type' => 'integer'], 'qty' => ['type' => 'integer']], 'required' => ['product_id', 'qty'], 'additionalProperties' => false]],
                    'name' => ['type' => 'string'],
                    'phone' => ['type' => 'string', 'description' => 'Phone / WhatsApp number, or empty string.'],
                    'email' => ['type' => 'string', 'description' => 'Email address, or empty string.'],
                    'company' => ['type' => 'string', 'description' => 'Company, school or department, or empty string.'],
                    'notes' => ['type' => 'string', 'description' => 'Anything else the customer asked for (delivery town, deadline), or empty string.'],
                ],
                'required' => ['items', 'name', 'phone', 'email', 'company', 'notes'],
                'additionalProperties' => false,
            ],
            'strict' => true,
        ],
        [
            'name' => 'request_owner_help',
            'description' => 'Alert the owner immediately on WhatsApp so a person contacts the customer: for prices or stock you could not confirm, bulk or price-match requests, call-backs, appointments or complaints. Requires the customer\'s name and phone number.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'name' => ['type' => 'string'],
                    'phone' => ['type' => 'string'],
                    'email' => ['type' => 'string', 'description' => 'Email, or empty string.'],
                    'question' => ['type' => 'string', 'description' => 'What the customer needs, in one or two sentences, including products and quantities.'],
                    'preferred_time' => ['type' => 'string', 'description' => 'When the customer would like to be contacted, or empty string.'],
                ],
                'required' => ['name', 'phone', 'email', 'question', 'preferred_time'],
                'additionalProperties' => false,
            ],
            'strict' => true,
        ],
    ];
}

/** Run one tool call. Returns [result text, lead row or null]. */
function assistant_run_tool(string $name, array $in, array $chat): array
{
    if ($name === 'search_products') {
        $q = mb_substr(trim((string)($in['query'] ?? '')), 0, 120);
        $res = product_search(['q' => $q], 8);
        if (!$res['items']) {
            return ['No products found for "' . $q . '". Try a shorter code, or offer request_owner_help.', null];
        }
        $out = [];
        foreach ($res['items'] as $p) {
            $price = effective_price($p);
            $row = [
                'product_id' => (int)$p['id'], 'name' => $p['name'], 'sku' => $p['sku'], 'brand' => $p['brand_name'],
                'price' => $price > 0 ? money($price, false) : 'no price — ask the owner',
                'stock' => stock_label($p), 'can_buy_online' => can_buy($p), 'link' => abs_url('product/' . $p['slug']),
            ];
            if (sale_active($p)) {
                $row['normal_price'] = money($p['price'], false);
                $row['saving'] = money((float)$p['price'] - (float)$p['sale_price'], false);
            }
            if (!empty($p['is_weekly'])) {
                $row['weekly_special'] = true;
            }
            if ($p['short_description']) {
                $row['about'] = mb_substr($p['short_description'], 0, 200);
            }
            if ($p['compatible']) {
                $row['compatible'] = mb_substr(str_replace("\n", ', ', $p['compatible']), 0, 300);
            }
            if (!empty($p['competitor_price']) && (float)$p['competitor_price'] > 0) {
                $row['market_comparison'] = 'Recorded price elsewhere' . ($p['competitor_name'] ? ' (' . $p['competitor_name'] . ')' : '') . ': ' . money($p['competitor_price'], false);
            }
            $out[] = $row;
        }
        return [json_encode(['results' => $out, 'total_matches' => $res['total']], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), null];
    }
    if ($name === 'create_quote') {
        $wanted = [];
        foreach ((array)($in['items'] ?? []) as $it) {
            if ((int)($it['product_id'] ?? 0) > 0 && (int)($it['qty'] ?? 0) > 0) {
                $wanted[(int)$it['product_id']] = min(999, (int)$it['qty']);
            }
        }
        $contact = ['name' => (string)($in['name'] ?? ''), 'phone' => (string)($in['phone'] ?? ''), 'email' => (string)($in['email'] ?? ''), 'company' => (string)($in['company'] ?? ''),
            'message' => trim('Quote made by the AI assistant. ' . ($in['notes'] ?? ''))];
        if (trim($contact['name']) === '' || (trim($contact['phone']) === '' && !valid_email(trim($contact['email'])))) {
            return ['Not created: ask the customer for their name and a phone number or email first.', null];
        }
        if (trim($contact['email']) !== '' && !valid_email(trim($contact['email']))) {
            $contact['email'] = '';
        }
        $lead = $wanted ? instant_quote_create($wanted, $contact, 'instant_quote', (int)$chat['id']) : null;
        if (!$lead) {
            return ['Not created: none of those product_ids could be found. Search again.', null];
        }
        lead_send_customer_reply($lead);
        $items = lead_items($lead);
        return [json_encode([
            'quote_ref' => $lead['ref'], 'total_including_delivery' => money($lead['total'] ?? 0, false), 'valid_until' => $lead['valid_until'],
            'items' => array_map(fn($i) => $i['qty'] . ' × ' . $i['name'] . ' @ ' . money($i['price'], false), $items),
            'needs_owner_price' => (bool)$lead['needs_price'],
            'quote_link_with_accept_and_pay' => quote_url($lead),
            'emailed_to_customer' => (bool)$lead['email'],
            'note' => $lead['needs_price'] ? 'Some items need a price from the owner; the owner has been alerted.' : 'The owner has been alerted.',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $lead];
    }
    if ($name === 'request_owner_help') {
        $phone = trim((string)($in['phone'] ?? ''));
        if (trim((string)($in['name'] ?? '')) === '' || strlen(preg_replace('/\D/', '', $phone)) < 9) {
            return ['Not sent: ask the customer for their name and a valid phone number first.', null];
        }
        $lead = lead_create(['source' => !empty($in['preferred_time']) ? 'callback' : 'chat', 'name' => $in['name'], 'phone' => $phone,
            'email' => valid_email(trim((string)($in['email'] ?? ''))) ? trim((string)$in['email']) : '', 'needs_price' => 1,
            'message' => 'From the AI assistant: ' . ($in['question'] ?? ''), 'preferred_time' => (string)($in['preferred_time'] ?? ''), 'chat_id' => (int)$chat['id']]);
        lead_send_customer_reply($lead);
        return ['Owner alerted on WhatsApp. Reference ' . $lead['ref'] . '. Tell the customer the team will contact them shortly (business hours: ' . setting('hours') . ') and that they can also WhatsApp ' . setting('whatsapp') . '.', $lead];
    }
    return ['Unknown tool.', null];
}

/** One HTTPS call to the Messages API. Returns the decoded response or ['error' => message]. */
function assistant_call_api(array $messages): array
{
    $model = (string)setting('ai_model', 'claude-haiku-5-5');
    $body = [
        'model' => $model,
        'max_tokens' => 8000,
        'system' => assistant_system_prompt(),
        'tools' => assistant_tools(),
        'messages' => $messages,
        'cache_control' => ['type' => 'ephemeral'],
        'output_config' => ['effort' => 'low'],
    ];
    $headers = [
        'content-type: application/json',
        'x-api-key: ' . trim((string)setting('ai_api_key')),
        'anthropic-version: ' . ASSISTANT_API_VERSION,
    ];
    // If the model declines for safety reasons, let the API retry on its recommended fallback model.
    if (in_array($model, ['claude-opus-5-5', 'claude-sonnet-5-5'], true)) {
        $body['fallbacks'] = 'default';
        $headers[] = 'anthropic-beta: server-side-fallback-2026-07-01';
    }
    $ch = curl_init((string)config('ai_api_url', ASSISTANT_API_URL)); // config override is only for testing
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT => 90, CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);
    if ($raw === false) {
        log_message('assistant', 'Connection error: ' . $cerr);
        return ['error' => 'connection'];
    }
    $res = json_decode((string)$raw, true);
    if ($code !== 200 || !is_array($res)) {
        log_message('assistant', "API error $code: " . mb_substr((string)$raw, 0, 400));
        return ['error' => $code === 401 ? 'key' : ($code === 429 || $code >= 500 ? 'busy' : 'api')];
    }
    return $res;
}

/**
 * Handle one customer message. Returns ['reply' => text, 'quote_url' => ?string].
 * The full conversation (including the model's own content blocks, unchanged) is stored in `chats`.
 */
function assistant_reply(array $chat, string $userText): array
{
    $wa = 'WhatsApp ' . setting('whatsapp');
    $messages = json_decode((string)$chat['messages'], true) ?: [];
    $messages[] = ['role' => 'user', 'content' => $userText];
    $quoteUrl = null;
    $leadId = $chat['lead_id'];
    $tin = 0;
    $tout = 0;
    $reply = '';
    for ($round = 0; $round < ASSISTANT_MAX_TOOL_ROUNDS; $round++) {
        $res = assistant_call_api($messages);
        if (isset($res['error'])) {
            $reply = $res['error'] === 'key'
                ? 'Sorry, the assistant is not set up correctly right now. Please ' . $wa . ' and we will help you straight away.'
                : 'Sorry, I could not answer just now. Please try again in a moment, or ' . $wa . ' for a quick reply.';
            break;
        }
        $tin += (int)($res['usage']['input_tokens'] ?? 0) + (int)($res['usage']['cache_read_input_tokens'] ?? 0) + (int)($res['usage']['cache_creation_input_tokens'] ?? 0);
        $tout += (int)($res['usage']['output_tokens'] ?? 0);
        $content = $res['content'] ?? [];
        $stop = $res['stop_reason'] ?? '';
        if ($stop === 'refusal') {
            $reply = 'Sorry, I can\'t help with that here. For anything about our products, ' . $wa . '.';
            break;
        }
        $messages[] = ['role' => 'assistant', 'content' => $content];
        if ($stop !== 'tool_use') {
            $reply = trim(implode("\n", array_map(fn($b) => $b['text'] ?? '', array_filter($content, fn($b) => ($b['type'] ?? '') === 'text'))));
            break;
        }
        $results = [];
        foreach ($content as $b) {
            if (($b['type'] ?? '') !== 'tool_use') {
                continue;
            }
            [$text, $lead] = assistant_run_tool((string)$b['name'], is_array($b['input'] ?? null) ? $b['input'] : [], $chat);
            if ($lead) {
                $leadId = (int)$lead['id'];
                if ($lead['source'] === 'instant_quote') {
                    $quoteUrl = quote_url($lead);
                }
            }
            $results[] = ['type' => 'tool_result', 'tool_use_id' => $b['id'], 'content' => $text];
        }
        $messages[] = ['role' => 'user', 'content' => $results];
    }
    if ($reply === '') {
        $reply = 'Let me get a person to help with this. Please ' . $wa . ', or leave your name and number here and we will call you.';
    }
    db_update('chats', ['messages' => json_encode($messages, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'turns' => (int)$chat['turns'] + 1,
        'tokens_in' => (int)$chat['tokens_in'] + $tin, 'tokens_out' => (int)$chat['tokens_out'] + $tout, 'lead_id' => $leadId, 'updated_at' => now()], 'id = ?', [$chat['id']]);
    return ['reply' => $reply, 'quote_url' => $quoteUrl];
}
