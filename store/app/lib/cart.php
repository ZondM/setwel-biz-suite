<?php
/** Shopping cart, kept in the visitor's session: [product_id => qty]. */

function cart_raw(): array
{
    return $_SESSION['cart'] ?? [];
}

function cart_count(): int
{
    return array_sum(cart_raw());
}

function cart_set(int $productId, int $qty): void
{
    if ($qty <= 0) {
        unset($_SESSION['cart'][$productId]);
    } else {
        $_SESSION['cart'][$productId] = min($qty, 999);
    }
}

function cart_add(int $productId, int $qty): void
{
    cart_set($productId, (cart_raw()[$productId] ?? 0) + max(1, $qty));
}

function cart_clear(): void
{
    unset($_SESSION['cart']);
}

/** Cart lines with current prices from the database (prices are never trusted from the browser). */
function cart_lines(): array
{
    $raw = cart_raw();
    if (!$raw) {
        return [];
    }
    $ids = array_map('intval', array_keys($raw));
    $rows = q_all(PRODUCT_SELECT . ' WHERE p.id IN (' . implode(',', $ids) . ') AND p.visible = 1');
    $lines = [];
    foreach ($rows as $p) {
        if (!can_buy($p)) {
            unset($_SESSION['cart'][$p['id']]);
            continue;
        }
        $qty = (int)$raw[$p['id']];
        $price = effective_price($p);
        $lines[] = ['product' => $p, 'qty' => $qty, 'price' => $price, 'total' => round($price * $qty, 2)];
    }
    foreach ($ids as $id) {
        if (!in_array($id, array_map(fn($l) => (int)$l['product']['id'], $lines), true)) {
            unset($_SESSION['cart'][$id]);
        }
    }
    return $lines;
}

function cart_totals(array $lines, string $deliveryMethod = 'courier'): array
{
    $subtotal = round(array_sum(array_column($lines, 'total')), 2);
    $fee = delivery_fee($subtotal, $deliveryMethod);
    return ['subtotal' => $subtotal, 'delivery' => $fee, 'total' => round($subtotal + $fee, 2)];
}

function delivery_fee(float $subtotal, string $method): float
{
    if ($method === 'collect' || $subtotal <= 0) {
        return 0.0;
    }
    $threshold = (float)setting('free_delivery_threshold', 2500);
    if ($threshold > 0 && $subtotal >= $threshold) {
        return 0.0;
    }
    return (float)setting('delivery_fee', 150);
}
