<?php $paid = $o['payment_status'] === 'paid'; ?>
<div class="topline">
  <h1>Order <?= e($o['ref']) ?> <?php partial('admin_status', ['o' => $o]); ?></h1>
  <div class="actions">
    <a class="btn" href="<?= url('admin/orders/' . $o['id'] . '/invoice') ?>" target="_blank">⬇ <?= $paid ? 'Receipt' : 'Invoice' ?> PDF</a>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="resend"><button class="btn">Re-send email to customer</button></form>
    <a class="btn" href="<?= url('admin/orders') ?>">← All orders</a>
  </div>
</div>
<div class="split">
  <div>
    <div class="card">
      <h2>Items</h2>
      <div class="table-wrap"><table class="t"><thead><tr><th>Product</th><th>SKU</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th></tr></thead><tbody>
        <?php foreach ($items as $it): ?><tr><td><?= $it['product_id'] ? '<a href="' . url('admin/products/' . $it['product_id']) . '">' . e($it['name']) . '</a>' : e($it['name']) ?></td><td><?= e($it['sku']) ?></td><td class="num"><?= money($it['price']) ?></td><td class="num"><?= (int)$it['qty'] ?></td><td class="num"><?= money($it['line_total']) ?></td></tr><?php endforeach; ?>
        <tr><td colspan="4" class="num">Subtotal</td><td class="num"><?= money($o['subtotal']) ?></td></tr>
        <tr><td colspan="4" class="num"><?= $o['delivery_method'] === 'collect' ? 'Collection' : 'Courier delivery' ?></td><td class="num"><?= money($o['delivery_fee']) ?></td></tr>
        <tr><td colspan="4" class="num"><strong>Total</strong></td><td class="num"><strong><?= money($o['total']) ?></strong></td></tr>
      </tbody></table></div>
    </div>
    <div class="card">
      <h2>Update status</h2>
      <form method="post" class="form"><?= csrf_field() ?><input type="hidden" name="action" value="status">
        <div class="grid-2">
          <label>New status<select name="status"><?php foreach (order_statuses() as $k => $l): ?><option value="<?= $k ?>" <?= $o['status'] === $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select></label>
          <label>Courier<input type="text" name="courier" value="<?= e($o['courier']) ?>" placeholder="e.g. The Courier Guy"></label>
          <label>Tracking number<input type="text" name="tracking_number" value="<?= e($o['tracking_number']) ?>"></label>
          <label>Message to customer (optional)<input type="text" name="note"></label>
        </div>
        <label class="check"><input type="checkbox" name="notify" value="1" checked> Email the customer about this update</label>
        <button class="btn btn-primary">Save status</button>
      </form>
    </div>
    <div class="card">
      <h2>History</h2>
      <ul class="timeline"><?php foreach ($history as $h): ?><li><strong><?= e(date('j M Y H:i', strtotime($h['created_at']))) ?></strong> — <?= e($h['note']) ?> <?= $h['notified'] ? '<span class="badge">emailed</span>' : '' ?></li><?php endforeach; ?></ul>
      <form method="post" class="actions" style="margin-top:10px"><?= csrf_field() ?><input type="hidden" name="action" value="note"><input type="text" name="note" placeholder="Add a private note" required style="width:auto;flex:1"><button class="btn">Add note</button></form>
    </div>
  </div>
  <div>
    <div class="card">
      <h2>Payment</h2>
      <p><?= $o['payment_method'] === 'payfast' ? 'PayFast' : 'Manual EFT' ?> · <?= $paid ? '<span class="badge ok">Paid ' . e($o['paid_at']) . '</span>' : '<span class="badge warn">Not paid</span>' ?></p>
      <?php if ($o['pf_payment_id']): ?><p class="hint">PayFast payment ID: <?= e($o['pf_payment_id']) ?></p><?php endif; ?>
      <?php if ($o['pop_path']): ?><p><a class="btn" href="<?= url('admin/orders/' . $o['id'] . '/pop') ?>" target="_blank">View proof of payment</a><br><small class="muted">Uploaded <?= e($o['pop_uploaded_at']) ?></small></p><?php endif; ?>
      <?php if (!$paid): ?>
        <form method="post" class="form"><?= csrf_field() ?><input type="hidden" name="action" value="mark_paid">
          <p class="hint">Only after the money is <strong>in your bank account</strong> (proof of payment alone is not enough).</p>
          <label class="check"><input type="checkbox" name="notify" value="1" checked> Email the receipt to the customer</label>
          <button class="btn btn-gold" data-confirm="Confirm the money has reflected in your account?">✔ Mark as paid</button>
        </form>
      <?php endif; ?>
    </div>
    <div class="card">
      <h2>Customer</h2>
      <p><strong><?= e($o['customer_name']) ?></strong><?= $o['company'] ? '<br>' . e($o['company']) : '' ?><?= $o['customer_vat'] ? '<br>VAT: ' . e($o['customer_vat']) : '' ?><br><a href="mailto:<?= e($o['email']) ?>"><?= e($o['email']) ?></a><br><a href="tel:<?= e($o['phone']) ?>"><?= e($o['phone']) ?></a> · <a href="https://wa.me/<?= e(wa_number($o['phone'])) ?>" target="_blank">WhatsApp</a></p>
      <h2>Delivery</h2>
      <?php if ($o['delivery_method'] === 'collect'): ?><p>Customer will <strong>collect</strong>.</p><?php else: ?><p><?= e($o['address1']) ?><br><?= $o['address2'] ? e($o['address2']) . '<br>' : '' ?><?= e($o['city']) ?>, <?= e($o['postal_code']) ?><br><?= e($o['province']) ?></p><?php endif; ?>
      <?php if ($o['notes']): ?><h2>Notes</h2><p><?= nl2br(e($o['notes'])) ?></p><?php endif; ?>
      <p class="hint">Customer's order page: <a href="<?= e(order_link($o)) ?>" target="_blank">open</a></p>
    </div>
  </div>
</div>
