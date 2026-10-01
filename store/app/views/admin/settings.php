<div class="topline"><h1>Settings</h1><div class="actions"><?php foreach (array_keys($groups) as $g): ?><a class="btn btn-sm" href="#<?= e(preg_replace('/\W+/', '', $g)) ?>"><?= e($g) ?></a><?php endforeach; ?></div></div>
<form method="post"><?= csrf_field() ?>
<?php foreach ($groups as $group => $fields): ?>
  <div class="card" id="<?= e(preg_replace('/\W+/', '', $group)) ?>">
    <h2><?= e($group) ?></h2>
    <div class="grid-2">
    <?php foreach ($fields as $key => $def): [$label, $type] = $def; $help = $def[2] ?? ''; $val = setting($key); ?>
      <?php if ($type === 'bool'): ?>
        <div><label class="check"><input type="checkbox" name="<?= e($key) ?>" value="1" <?= $val === '1' ? 'checked' : '' ?>> <?= e($label) ?></label><?php if ($help): ?><div class="hint"><?= e($help) ?></div><?php endif; ?></div>
      <?php else: ?>
        <label class="field"><?= e($label) ?>
          <?php if ($type === 'textarea'): ?><textarea name="<?= e($key) ?>" rows="3"><?= e($val) ?></textarea>
          <?php elseif ($type === 'select'): ?><select name="<?= e($key) ?>"><?php foreach ($def[3] as $ov => $ol): ?><option value="<?= e($ov) ?>" <?= (string)$val === (string)$ov ? 'selected' : '' ?>><?= e($ol) ?></option><?php endforeach; ?></select>
          <?php elseif ($type === 'password'): ?><input type="password" name="<?= e($key) ?>" placeholder="<?= $val !== '' ? '•••••••• (saved — type to change)' : 'not set' ?>" autocomplete="new-password"><?php if ($val !== ''): ?><span class="check hint"><input type="checkbox" name="clear_<?= e($key) ?>" value="1"> clear it</span><?php endif; ?>
          <?php else: ?><input type="<?= $type === 'number' ? 'text' : 'text' ?>" <?= $type === 'number' ? 'inputmode="decimal"' : '' ?> name="<?= e($key) ?>" value="<?= e($val) ?>">
          <?php endif; ?>
          <?php if ($help): ?><span class="hint"><?= e($help) ?></span><?php endif; ?>
        </label>
      <?php endif; ?>
    <?php endforeach; ?>
    </div>
    <?php if ($group === 'Payments'): ?><p class="hint">PayFast "notify URL" (filled in automatically): <code><?= e(abs_url('payfast/notify')) ?></code></p><?php endif; ?>
    <p style="margin-top:14px"><button class="btn btn-primary">Save settings</button></p>
  </div>
<?php endforeach; ?>
</form>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="test_email"><h2>Test email</h2><p class="hint">Save your email settings first, then send a test to <?= e(setting('orders_email') ?: setting('email')) ?>.</p><button class="btn">Send test email</button></form>
