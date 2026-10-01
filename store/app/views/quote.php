<?php $err = fn($k) => isset($errors[$k]) ? '<span class="error-text">' . e($errors[$k]) . '</span>' : ''; ?>
<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [['Request a quote', null]]]); ?>
  <div class="contact-grid">
    <div>
      <h1>Request a quote</h1>
      <p>For businesses, schools, government departments and bulk orders. Tell us what you need — we will email a formal quote within one working day.</p>
      <?php if (!empty($errors['form'])): ?><div class="alert alert-error"><?= e($errors['form']) ?></div><?php endif; ?>
      <form method="post" class="form" novalidate>
        <?= csrf_field() ?><?= honeypot() ?>
        <div class="form-row">
          <label><span class="req">Your name</span><input type="text" name="name" value="<?= e(old('name')) ?>" required autocomplete="name"><?= $err('name') ?></label>
          <label>Company / school / department<input type="text" name="company" value="<?= e(old('company')) ?>" autocomplete="organization"></label>
        </div>
        <div class="form-row">
          <label><span class="req">Email</span><input type="email" name="email" value="<?= e(old('email')) ?>" required autocomplete="email"><?= $err('email') ?></label>
          <label>Phone<input type="tel" name="phone" value="<?= e(old('phone')) ?>" autocomplete="tel"></label>
        </div>
        <label>I am buying for
          <select name="customer_type">
            <?php foreach (['Business', 'School / college', 'Government / municipality', 'NGO', 'Personal'] as $t): ?><option <?= old('customer_type') === $t ? 'selected' : '' ?>><?= $t ?></option><?php endforeach; ?>
          </select>
        </label>
        <label><span class="req">Products and quantities</span><textarea name="items" rows="6" placeholder="e.g. 5 × Canon 725 black toner&#10;2 × Canon i-SENSYS MF3010" required><?= e(old('items', $prefill)) ?></textarea><?= $err('items') ?></label>
        <label>Anything else? (delivery address, deadline, order number)<textarea name="message" rows="3"><?= e(old('message')) ?></textarea></label>
        <label class="check"><input type="checkbox" name="consent" value="1" <?= old('consent') ? 'checked' : '' ?>> <span>I agree that <?= e(setting('business_name')) ?> may use my details to prepare and send this quote (see our <a href="<?= url('page/privacy') ?>">privacy policy</a>).</span></label><?= $err('consent') ?>
        <button class="btn btn-primary btn-lg" type="submit">Send quote request</button>
      </form>
    </div>
    <aside>
      <div class="p-box" style="margin-top:0">
        <h2 style="font-size:1.2rem">Faster on WhatsApp?</h2>
        <p class="muted" style="margin:0">Send a photo of your printer model or your list.</p>
        <a class="btn btn-wa" href="https://wa.me/<?= e(wa_number(setting('whatsapp'))) ?>?text=<?= rawurlencode('Hi, I would like a quote for: ') ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 18) ?> WhatsApp <?= e(setting('whatsapp')) ?></a>
      </div>
      <ul class="p-points">
        <li><?= icon('check', 18) ?> Formal quotes for procurement</li>
        <li><?= icon('check', 18) ?> Bulk and contract pricing</li>
        <li><?= icon('check', 18) ?> Nationwide delivery</li>
        <li><?= icon('check', 18) ?> <?= e(setting('reseller_statement')) ?></li>
      </ul>
    </aside>
  </div>
</div>
