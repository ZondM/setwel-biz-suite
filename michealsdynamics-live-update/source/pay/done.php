<?php
/* PayFast sends the customer here after paying. The order is only treated as paid once PayFast's confirmation arrives (notify.php). */
define('MD_PAY', 1);
require __DIR__ . '/_lib.php';
$ref = md_ref($_GET['ref'] ?? '') ?: '';
md_page('Thank you', '<div class="card"><h1>Thank you!</h1>'
    . '<p class="ok">Your payment' . ($ref ? ' for order <b>' . md_h($ref) . '</b>' : '') . ' was submitted.</p>'
    . '<p>PayFast emails you a receipt, and we confirm by email once the payment reaches us. We\'ll let you know when your order is on its way.</p>'
    . '<a class="btn" href="/">Back to the shop</a></div>');
