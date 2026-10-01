<div class="wrap section center" style="max-width:560px">
  <h1>Taking you to PayFast…</h1>
  <p class="muted">Order <?= e($o['ref']) ?> · <?= money($o['total']) ?>. If nothing happens, click the button.</p>
  <form id="pf" action="<?= e($action) ?>" method="post">
    <?php foreach ($fields as $k => $v): ?><input type="hidden" name="<?= e($k) ?>" value="<?= e($v) ?>"><?php endforeach; ?>
    <button class="btn btn-gold btn-lg" type="submit"><?= icon('lock', 18) ?> Pay <?= money($o['total']) ?> with PayFast</button>
  </form>
  <p style="margin-top:16px"><a href="<?= url('order/' . $o['ref'], ['t' => $o['token']]) ?>">Back to your order</a></p>
  <script>setTimeout(function(){document.getElementById('pf').submit();}, 600);</script>
</div>
