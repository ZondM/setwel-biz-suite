<?php
/** @var array $l */
$wa = 'https://wa.me/' . wa_number(setting('whatsapp')) . '?text=' . rawurlencode('Hi ' . setting('business_name') . ', this is ' . $l['name'] . ' — about my request ' . $l['ref'] . '.');
?>
<div class="wrap" style="max-width:720px;margin:40px auto 56px;text-align:center">
  <div class="thanks-tick"><?= icon('check', 34) ?></div>
  <h1>Thank you, <?= e(trim(explode(' ', (string)$l['name'])[0]) ?: 'we have it') ?>!</h1>
  <p style="font-size:1.1rem"><?= nl2br(e(setting('business_hours_reply'))) ?></p>
  <p class="muted">Your reference: <strong><?= e($l['ref']) ?></strong><?= $l['email'] ? ' · A copy was emailed to ' . e($l['email']) : '' ?></p>
  <p><a class="btn btn-wa btn-lg" data-track="wa_click" data-label="thanks <?= e($l['ref']) ?>" href="<?= e($wa) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 20) ?> Continue on WhatsApp now</a></p>
  <p><a href="<?= url('weekly-specials') ?>">See this week's specials →</a></p>
</div>
