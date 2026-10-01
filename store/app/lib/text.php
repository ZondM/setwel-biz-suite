<?php
/**
 * Simple text formatting for pages you edit in the admin (no HTML knowledge needed):
 *   ## Heading          → heading
 *   ### Smaller heading → sub-heading
 *   - item              → bullet list
 *   **bold**            → bold
 *   [link text](https://...) → link
 *   blank line         → new paragraph
 */
function format_text(?string $text): string
{
    $text = str_replace("\r\n", "\n", (string)$text);
    $blocks = preg_split("/\n{2,}/", trim($text));
    $html = '';
    foreach ($blocks as $block) {
        $lines = explode("\n", $block);
        if (preg_match('/^(#{2,3})\s+(.+)$/', $lines[0], $m) && count($lines) === 1) {
            $tag = strlen($m[1]) === 2 ? 'h2' : 'h3';
            $html .= "<$tag>" . inline_format($m[2]) . "</$tag>\n";
            continue;
        }
        if (preg_match('/^(#{2,3})\s+(.+)$/', $lines[0], $m)) {
            $tag = strlen($m[1]) === 2 ? 'h2' : 'h3';
            $html .= "<$tag>" . inline_format($m[2]) . "</$tag>\n";
            array_shift($lines);
        }
        if ($lines && count(array_filter($lines, fn($l) => preg_match('/^\s*[-*]\s+/', $l))) === count($lines)) {
            $html .= '<ul>' . implode('', array_map(fn($l) => '<li>' . inline_format(preg_replace('/^\s*[-*]\s+/', '', $l)) . '</li>', $lines)) . "</ul>\n";
        } elseif ($lines) {
            $html .= '<p>' . implode('<br>', array_map('inline_format', $lines)) . "</p>\n";
        }
    }
    return $html;
}

function inline_format(string $s): string
{
    $s = e($s);
    $s = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $s);
    $s = preg_replace_callback('/\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:|tel:)[^)\s]+)\)/', fn($m) => '<a href="' . (str_starts_with($m[2], '/') ? url($m[2]) : $m[2]) . '">' . $m[1] . '</a>', $s);
    return $s;
}

/** Replace {placeholders} in page text with values from Settings. */
function fill_placeholders(string $text): string
{
    $map = [];
    foreach (['business_name', 'legal_name', 'registration_number', 'email', 'phone', 'whatsapp', 'collection_address', 'information_officer', 'hours', 'delivery_fee', 'free_delivery_threshold'] as $k) {
        $v = setting($k);
        if (in_array($k, ['delivery_fee', 'free_delivery_threshold'], true)) {
            $v = money($v, false);
        }
        $map['{' . $k . '}'] = $v !== '' ? $v : '[' . str_replace('_', ' ', $k) . ' — add in Admin → Settings]';
    }
    $map['{address}'] = str_replace("\n", ', ', setting('address'));
    $map['{site_url}'] = setting('site_url') ?: abs_url();
    return strtr($text, $map);
}

function excerpt(?string $text, int $len = 160): string
{
    $t = trim(preg_replace('/\s+/', ' ', strip_tags((string)$text)));
    return mb_strlen($t) > $len ? rtrim(mb_substr($t, 0, $len - 1)) . '…' : $t;
}
