<h1>Messages from the contact form</h1>
<?php if (!$messages): ?><p class="muted">No messages yet.</p><?php endif; ?>
<?php foreach ($messages as $m): ?>
  <div class="card" style="<?= $m['handled'] ? 'opacity:.6' : '' ?>">
    <strong><?= e($m['subject'] ?: 'Message') ?></strong> — <?= e($m['name']) ?> · <a href="mailto:<?= e($m['email']) ?>?subject=<?= rawurlencode('Re: ' . ($m['subject'] ?: 'your message')) ?>"><?= e($m['email']) ?></a> <?= $m['phone'] ? '· ' . e($m['phone']) : '' ?> <small class="muted">· <?= e($m['created_at']) ?></small>
    <p><?= nl2br(e($m['message'])) ?></p>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$m['id'] ?>"><input type="hidden" name="handled" value="<?= $m['handled'] ? 0 : 1 ?>"><button class="btn btn-sm"><?= $m['handled'] ? 'Mark as not done' : '✔ Mark as handled' ?></button></form>
  </div>
<?php endforeach; ?>
