<?php /** @var array $l @var array $items @var ?array $chat */ $src = lead_sources(); ?>
<div class="topline"><h1>Lead <?= e($l['ref']) ?> <small class="muted"><?= e($src[$l['source']] ?? $l['source']) ?></small></h1><a class="btn" href="<?= url('admin/leads') ?>">← All leads</a></div>
<div class="split">
  <div>
    <div class="card">
      <h2>Reply now</h2>
      <p class="actions">
        <?php if ($l['phone']): ?><a class="btn btn-primary" href="<?= e(lead_wa_link($l)) ?>" target="_blank" rel="noopener" onclick="document.getElementById('mark-contacted').submit()">Reply on WhatsApp</a>
          <a class="btn" href="tel:<?= e(preg_replace('/\s+/', '', $l['phone'])) ?>">Call <?= e($l['phone']) ?></a><?php endif; ?>
        <?php if ($l['email']): ?><a class="btn" href="mailto:<?= e($l['email']) ?>?subject=<?= rawurlencode('Your enquiry ' . $l['ref'] . ' — ' . setting('business_name')) ?>">Email</a><?php endif; ?>
        <?php if ($l['source'] === 'instant_quote'): ?><a class="btn" href="<?= e(quote_url($l)) ?>" target="_blank">Customer's quote page</a><a class="btn" href="<?= e(quote_url($l, '/pdf')) ?>" target="_blank">PDF</a><?php endif; ?>
      </p>
      <form method="post" id="mark-contacted"><?= csrf_field() ?><input type="hidden" name="action" value="contacted"></form>
      <?php if ($l['message']): ?><h2>Message</h2><p style="white-space:pre-line"><?= e($l['message']) ?></p><?php endif; ?>
      <?php if ($l['preferred_time']): ?><p><strong>Call-back:</strong> <?= e($l['preferred_time']) ?></p><?php endif; ?>
    </div>
    <?php if ($items || $l['source'] === 'instant_quote'): ?>
    <div class="card">
      <h2>Quote items <small class="muted">— change a price or quantity and click "Update &amp; send"</small></h2>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="requote">
        <div class="table-wrap"><table class="t">
          <thead><tr><th>Product</th><th>Price (R)</th><th>Qty</th><th>Total</th></tr></thead>
          <tbody>
          <?php foreach ($items as $i => $it): ?>
            <tr><td><?= e($it['name']) ?><br><small class="muted"><?= e($it['sku']) ?></small></td>
              <td><input type="text" name="price[<?= $i ?>]" value="<?= e(number_format((float)$it['price'], 2, '.', '')) ?>" style="width:100px"></td>
              <td><input type="number" name="qty[<?= $i ?>]" value="<?= (int)$it['qty'] ?>" min="0" style="width:70px"></td>
              <td><?= money($it['line_total']) ?></td></tr>
          <?php endforeach; ?>
          </tbody>
        </table></div>
        <p>Subtotal <?= money($l['subtotal'] ?? 0) ?> · Total incl. delivery <strong><?= money($l['total'] ?? 0) ?></strong> · valid until <?= e($l['valid_until'] ?? '—') ?></p>
        <?php if ($items): ?><button class="btn btn-primary">Update &amp; send to customer</button><?php endif; ?>
      </form>
    </div>
    <?php endif; ?>
    <?php if ($chat): ?>
    <div class="card"><h2>AI assistant conversation</h2>
      <?php foreach (json_decode((string)$chat['messages'], true) ?: [] as $m): if (!is_string($m['content'] ?? null) && ($m['role'] ?? '') !== 'assistant') continue;
        $text = is_string($m['content']) ? $m['content'] : implode("\n", array_map(fn($b) => $b['text'] ?? '', array_filter($m['content'], fn($b) => ($b['type'] ?? '') === 'text'))); if (trim($text) === '') continue; ?>
        <p><strong><?= $m['role'] === 'user' ? 'Customer' : 'Assistant' ?>:</strong> <?= nl2br(e($text)) ?></p>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </div>
  <div class="card">
    <h2>Customer</h2>
    <p><strong><?= e($l['name'] ?: '—') ?></strong><?= $l['company'] ? '<br>' . e($l['company']) : '' ?><br><?= e($l['phone']) ?><br><?= e($l['email']) ?><br>
      <small class="muted">Received <?= e($l['created_at']) ?><?= $l['first_response_at'] ? '<br>First reply ' . e($l['first_response_at']) : '' ?><?= $l['followups'] ? '<br>Follow-up emails sent: ' . (int)$l['followups'] : '' ?><?= $l['order_id'] ? '<br><a href="' . url('admin/orders/' . $l['order_id']) . '">Became order →</a>' : '' ?></small></p>
    <form method="post" class="form"><?= csrf_field() ?><input type="hidden" name="action" value="save">
      <label>Status<select name="status"><?php foreach (lead_statuses() as $k => $v): ?><option value="<?= $k ?>" <?= $l['status'] === $k ? 'selected' : '' ?>><?= e($v) ?></option><?php endforeach; ?></select></label>
      <label>Private notes<textarea name="admin_notes" rows="5"><?= e($l['admin_notes']) ?></textarea></label>
      <button class="btn btn-primary">Save</button>
    </form>
  </div>
</div>
