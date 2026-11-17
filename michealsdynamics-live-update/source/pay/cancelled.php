<?php
define('MD_PAY', 1);
require __DIR__ . '/_lib.php';
md_page('Payment cancelled', '<div class="card"><h1>Payment cancelled</h1>'
    . '<p>No money was taken. You can use the same payment link again to try once more.</p>'
    . '<p>Need help? WhatsApp <a href="https://wa.me/27747423962">074 742 3962</a> or email <a href="mailto:michealsdynamicresults@gmail.com">michealsdynamicresults@gmail.com</a>.</p>'
    . '<a class="btn" href="/">Back to the shop</a></div>');
