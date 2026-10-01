<div class="topline"><h1>Newsletter subscribers (<?= count($subs) ?>)</h1><a class="btn btn-primary" href="<?= url('admin/subscribers', ['export' => 1]) ?>">⬇ Download list (CSV)</a></div>
<div class="help">Download the list and import it into a free email tool such as Mailchimp or Brevo to send your monthly specials. Only email people on this list, and always include an unsubscribe link (POPIA).</div>
<div class="table-wrap"><table class="t"><thead><tr><th>Email</th><th>Signed up</th><th></th></tr></thead><tbody>
<?php foreach ($subs as $s): ?><tr><td><?= e($s['email']) ?></td><td><?= e($s['created_at']) ?></td><td class="num"><form method="post"><?= csrf_field() ?><button class="btn btn-sm btn-danger" name="remove" value="<?= (int)$s['id'] ?>" data-confirm="Remove (unsubscribe) this email?">Remove</button></form></td></tr><?php endforeach; ?>
</tbody></table></div>
