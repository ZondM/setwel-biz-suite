<?php $err = fn($k) => isset($errors[$k]) ? '<span class="error-text">' . e($errors[$k]) . '</span>' : ''; $wa = wa_number(setting('whatsapp')); ?>
<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [['Contact', null]]]); ?>
  <div class="contact-grid">
    <div>
      <h1>Contact us</h1>
      <div class="contact-cards">
        <a class="contact-card" href="https://wa.me/<?= e($wa) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 24) ?><span><strong>WhatsApp</strong><?= e(setting('whatsapp')) ?> — quickest reply</span></a>
        <a class="contact-card" href="tel:<?= e(preg_replace('/\s+/', '', setting('phone'))) ?>"><?= icon('phone', 24) ?><span><strong>Phone</strong><?= e(setting('phone')) ?><?= setting('phone2') ? ' · ' . e(setting('phone2')) : '' ?></span></a>
        <a class="contact-card" href="mailto:<?= e(setting('email')) ?>"><?= icon('mail', 24) ?><span><strong>Email</strong><?= e(setting('email')) ?></span></a>
        <div class="contact-card"><?= icon('map', 24) ?><span><strong>Address</strong><?= nl2br(e(setting('address'))) ?></span></div>
        <div class="contact-card"><?= icon('clock', 24) ?><span><strong>Hours</strong><?= e(setting('hours')) ?></span></div>
      </div>
      <h2 style="margin-top:28px">Find us</h2>
      <?php if (setting('map_query')): ?>
        <iframe class="map" title="Map to <?= e(setting('business_name')) ?>" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=<?= rawurlencode(setting('map_query')) ?>&amp;output=embed"></iframe>
      <?php endif; ?>
    </div>
    <div>
      <h2>Send a message</h2>
      <?php if (!empty($errors['form'])): ?><div class="alert alert-error"><?= e($errors['form']) ?></div><?php endif; ?>
      <form method="post" class="form" novalidate>
        <?= csrf_field() ?><?= honeypot() ?>
        <label><span class="req">Name</span><input type="text" name="name" value="<?= e(old('name')) ?>" required autocomplete="name"><?= $err('name') ?></label>
        <div class="form-row">
          <label><span class="req">Email</span><input type="email" name="email" value="<?= e(old('email')) ?>" required autocomplete="email"><?= $err('email') ?></label>
          <label>Phone<input type="tel" name="phone" value="<?= e(old('phone')) ?>" autocomplete="tel"></label>
        </div>
        <label>Subject<input type="text" name="subject" value="<?= e(old('subject')) ?>"></label>
        <label><span class="req">Message</span><textarea name="message" rows="6" required><?= e(old('message')) ?></textarea><?= $err('message') ?></label>
        <label class="check"><input type="checkbox" name="consent" value="1"> <span>I agree that my details may be used to reply to me (see our <a href="<?= url('page/privacy') ?>">privacy policy</a>).</span></label><?= $err('consent') ?>
        <button class="btn btn-primary btn-lg" type="submit">Send message</button>
      </form>
    </div>
  </div>
</div>
