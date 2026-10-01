<?php $paid = $o['payment_status'] === 'paid'; $link = fn($p = '', $q = []) => url('order/' . $o['ref'] . $p, array_merge(['t' => $o['token']], $q)); ?>
<div class="wrap">
  <div class="cart-layout">
    <div>
      <?php if (!empty($_GET['new'])): ?><div class="alert alert-success">Thank you! Your order has been placed. A confirmation email is on its way to <?= e($o['email']) ?>.</div><?php endif; ?>
      <h1>Order <?= e($o['ref']) ?></h1>
      <p><span class="order-status"><?= e(order_status_label($o['status'])) ?></span> <span class="muted">· placed <?= e(date('j M Y, H:i', strtotime($o['created_at']))) ?></span></p>

      <?php if (!$paid && $o['status'] !== 'cancelled'): ?>
        <?php if ($o['payment_method'] === 'eft'): ?>
          <section class="bank" style="margin:18px 0">
            <h2 style="font-size:1.15rem">Pay by EFT</h2>
            <?php if (setting('bank_account_number')): ?>
              <dl>
                <dt>Bank</dt><dd><?= e(setting('bank_name')) ?></dd>
                <dt>Account name</dt><dd><?= e(setting('bank_account_name')) ?></dd>
                <dt>Account number</dt><dd><?= e(setting('bank_account_number')) ?></dd>
                <dt>Branch code</dt><dd><?= e(setting('bank_branch_code')) ?></dd>
                <dt>Account type</dt><dd><?= e(setting('bank_account_type')) ?></dd>
                <dt>Reference</dt><dd><?= e($o['ref']) ?></dd>
                <dt>Amount</dt><dd><?= money($o['total']) ?></dd>
              </dl>
            <?php else: ?><p>We will email our banking details to you shortly.</p><?php endif; ?>
            <form method="post" action="<?= $link('/pop') ?>" enctype="multipart/form-data" class="form" style="margin-top:16px">
              <?= csrf_field() ?><input type="hidden" name="t" value="<?= e($o['token']) ?>">
              <label>Upload proof of payment (PDF or photo, max 8 MB)<input type="file" name="pop" accept=".pdf,image/*" required></label>
              <button class="btn btn-primary" type="submit"><?= icon('upload', 18) ?> Upload proof of payment</button>
              <?php if ($o['pop_path']): ?><p class="hint">✔ Proof of payment received <?= e(date('j M Y H:i', strtotime($o['pop_uploaded_at']))) ?>. You can upload again to replace it.</p><?php endif; ?>
            </form>
          </section>
          <?php if (array_key_exists('payfast', payment_methods())): ?><p>Prefer to pay now by card or Instant EFT? <a class="btn btn-sm btn-gold" href="<?= $link('/pay') ?>">Pay with PayFast</a></p><?php endif; ?>
        <?php else: ?>
          <div class="alert alert-info">Awaiting payment confirmation from PayFast. If you did not finish paying, <a href="<?= $link('/pay') ?>">pay now</a> — or pay by EFT using reference <?= e($o['ref']) ?>.</div>
        <?php endif; ?>
      <?php endif; ?>

      <?php if ($o['status'] === 'shipped' && $o['tracking_number']): ?>
        <div class="alert alert-info">Shipped with <strong><?= e($o['courier']) ?></strong> · tracking number <strong><?= e($o['tracking_number']) ?></strong></div>
      <?php endif; ?>

      <h2 style="font-size:1.15rem;margin-top:24px">Items</h2>
      <table class="cart-table">
        <tbody>
        <?php foreach ($items as $it): ?>
          <tr><td><?= e($it['name']) ?> <span class="muted">× <?= (int)$it['qty'] ?></span></td><td style="text-align:right"><?= money($it['line_total']) ?></td></tr>
        <?php endforeach; ?>
        </tbody>
      </table>
      <h2 style="font-size:1.15rem;margin-top:24px">Delivery</h2>
      <p><?php if ($o['delivery_method'] === 'collect'): ?>Collection from <?= e(setting('collection_address')) ?><?php else: ?><?= e($o['customer_name']) ?><br><?= e($o['address1']) ?><?= $o['address2'] ? '<br>' . e($o['address2']) : '' ?><br><?= e($o['city']) ?>, <?= e($o['province']) ?> <?= e($o['postal_code']) ?><?php endif; ?></p>
      <?php if ($history): ?>
        <h2 style="font-size:1.15rem">History</h2>
        <ul class="muted"><?php foreach ($history as $h): ?><li><?= e(date('j M Y H:i', strtotime($h['created_at']))) ?> — <?= e($h['note'] ?: order_status_label($h['status'])) ?></li><?php endforeach; ?></ul>
      <?php endif; ?>
    </div>
    <aside class="summary">
      <h2 style="font-size:1.2rem">Summary</h2>
      <div class="summary-row"><span>Subtotal</span><span><?= money($o['subtotal']) ?></span></div>
      <div class="summary-row"><span><?= $o['delivery_method'] === 'collect' ? 'Collection' : 'Delivery' ?></span><span><?= (float)$o['delivery_fee'] > 0 ? money($o['delivery_fee']) : 'Free' ?></span></div>
      <div class="summary-row summary-total"><span>Total</span><span><?= money($o['total']) ?></span></div>
      <p><strong>Payment:</strong> <?= $paid ? '✔ Paid' : 'Not yet paid' ?></p>
      <a class="btn btn-outline btn-block" href="<?= $link('/invoice') ?>" target="_blank"><?= icon('download', 18) ?> <?= $paid ? 'Download receipt (PDF)' : 'Download invoice (PDF)' ?></a>
      <p class="hint" style="margin-top:12px">Questions? WhatsApp <?= e(setting('whatsapp')) ?> or email <?= e(setting('email')) ?> with your order number.</p>
    </aside>
  </div>
</div>
