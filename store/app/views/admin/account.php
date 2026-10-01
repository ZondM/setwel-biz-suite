<h1>My account</h1>
<div class="grid-2">
  <div class="card">
    <h2>Change my password</h2>
    <form method="post" class="form"><?= csrf_field() ?><input type="hidden" name="action" value="password">
      <label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
      <label>New password (10+ characters, letters and numbers)<input type="password" name="new" required autocomplete="new-password"></label>
      <label>New password again<input type="password" name="new2" required autocomplete="new-password"></label>
      <button class="btn btn-primary">Change password</button>
    </form>
  </div>
  <div class="card">
    <h2>Admin logins</h2>
    <p class="hint">Give each staff member their own login. Never share passwords.</p>
    <div class="table-wrap"><table class="t"><tbody>
      <?php foreach ($admins as $a): ?><tr><td><?= e($a['name']) ?><br><small class="muted"><?= e($a['email']) ?> · last login <?= e($a['last_login'] ?: 'never') ?></small></td><td class="num"><?php if ((int)$a['id'] !== (int)$me['id']): ?><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="remove_admin"><input type="hidden" name="id" value="<?= (int)$a['id'] ?>"><button class="btn btn-sm btn-danger" data-confirm="Remove this admin login?">Remove</button></form><?php else: ?><span class="badge">You</span><?php endif; ?></td></tr><?php endforeach; ?>
    </tbody></table></div>
    <h2>Add an admin</h2>
    <form method="post" class="form"><?= csrf_field() ?><input type="hidden" name="action" value="add_admin">
      <label>Name<input type="text" name="name" required></label>
      <label>Email<input type="email" name="email" required></label>
      <label>Temporary password<input type="password" name="password" required autocomplete="new-password"></label>
      <button class="btn">Add admin</button>
    </form>
  </div>
</div>
