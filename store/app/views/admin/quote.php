<div class="topline"><h1>Quote request <?= e($qt['ref']) ?></h1><a class="btn" href="<?= url('admin/quotes') ?>">← All quotes</a></div>
<div class="split">
  <div class="card">
    <h2>Products requested</h2>
    <p><?= nl2br(e($qt['items'])) ?></p>
    <?php if ($qt['message']): ?><h2>Message</h2><p><?= nl2br(e($qt['message'])) ?></p><?php endif; ?>
    <p class="actions">
      <a class="btn btn-primary" href="mailto:<?= e($qt['email']) ?>?subject=<?= rawurlencode('Your quote ' . $qt['ref'] . ' from ' . setting('business_name')) ?>&body=<?= rawurlencode("Hi " . $qt['name'] . ",\n\nThank you for your request. Please find our quote below / attached.\n\n") ?>">Reply by email</a>
      <?php if ($qt['phone']): ?><a class="btn" href="https://wa.me/<?= e(wa_number($qt['phone'])) ?>" target="_blank">WhatsApp customer</a><?php endif; ?>
    </p>
  </div>
  <div class="card">
    <h2>Customer</h2>
    <p><strong><?= e($qt['name']) ?></strong><br><?= e($qt['company']) ?><br><?= e($qt['customer_type']) ?><br><a href="mailto:<?= e($qt['email']) ?>"><?= e($qt['email']) ?></a><br><?= e($qt['phone']) ?><br><small class="muted"><?= e($qt['created_at']) ?></small></p>
    <form method="post" class="form"><?= csrf_field() ?>
      <label>Status<select name="status"><?php foreach (['new' => 'New', 'sent' => 'Quote sent', 'won' => 'Won (became an order)', 'lost' => 'Lost'] as $k => $l): ?><option value="<?= $k ?>" <?= $qt['status'] === $k ? 'selected' : '' ?>><?= $l ?></option><?php endforeach; ?></select></label>
      <label>Private notes<textarea name="admin_notes" rows="4"><?= e($qt['admin_notes']) ?></textarea></label>
      <button class="btn btn-primary">Save</button>
    </form>
  </div>
</div>
