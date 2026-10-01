<?php
$err = fn($k) => isset($errors[$k]) ? '<span class="error-text">' . e($errors[$k]) . '</span>' : '';
$dm = old('delivery_method', 'courier');
$pm = old('payment_method', array_key_first($methods));
$sub = $totals['subtotal'];
?>
<div class="wrap">
  <div class="steps"><span>1. Cart</span> › <span class="on">2. Details &amp; payment</span> › <span>3. Done</span></div>
  <?php if ($errors): ?><div class="alert alert-error" role="alert">Please check the highlighted fields below.</div><?php endif; ?>
  <form id="checkout-form" method="post" class="cart-layout" style="padding-top:0" novalidate data-subtotal="<?= e($sub) ?>" data-fee="<?= e((float)setting('delivery_fee')) ?>" data-threshold="<?= e((float)setting('free_delivery_threshold')) ?>">
    <div>
      <h1>Checkout</h1>
      <?= csrf_field() ?>
      <fieldset class="fieldset">
        <legend>Your details</legend>
        <div class="form">
          <div class="form-row">
            <label><span class="req">Full name</span><input type="text" name="customer_name" value="<?= e(old('customer_name')) ?>" required autocomplete="name"><?= $err('customer_name') ?></label>
            <label><span class="req">Phone</span><input type="tel" name="phone" value="<?= e(old('phone')) ?>" required autocomplete="tel"><?= $err('phone') ?></label>
          </div>
          <label><span class="req">Email</span><input type="email" name="email" value="<?= e(old('email')) ?>" required autocomplete="email"><span class="hint">Your order confirmation and invoice are sent here.</span><?= $err('email') ?></label>
          <div class="form-row">
            <label>Company / school (optional)<input type="text" name="company" value="<?= e(old('company')) ?>" autocomplete="organization"></label>
            <label>Your VAT number (optional)<input type="text" name="customer_vat" value="<?= e(old('customer_vat')) ?>"></label>
          </div>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend>Delivery</legend>
        <div class="form">
          <label class="choice"><input type="radio" name="delivery_method" value="courier" <?= $dm !== 'collect' ? 'checked' : '' ?>><span><strong>Courier delivery (nationwide)</strong><br><span class="muted"><?= money(setting('delivery_fee'), false) ?> · free on orders over <?= money(setting('free_delivery_threshold'), false) ?> · <?= e(setting('delivery_note')) ?></span></span></label>
          <?php if (setting('allow_collection') === '1'): ?>
            <label class="choice"><input type="radio" name="delivery_method" value="collect" <?= $dm === 'collect' ? 'checked' : '' ?>><span><strong>Collect (free)</strong><br><span class="muted"><?= e(setting('collection_address')) ?> · <?= e(setting('hours')) ?>. We email you when it is ready.</span></span></label>
          <?php endif; ?>
          <div id="address-fields" class="form">
            <label><span class="req">Street address</span><input type="text" name="address1" value="<?= e(old('address1')) ?>" data-required autocomplete="address-line1"><?= $err('address1') ?></label>
            <label>Complex, building, suburb<input type="text" name="address2" value="<?= e(old('address2')) ?>" autocomplete="address-line2"></label>
            <div class="form-row">
              <label><span class="req">Town / city</span><input type="text" name="city" value="<?= e(old('city')) ?>" data-required autocomplete="address-level2"><?= $err('city') ?></label>
              <label><span class="req">Postal code</span><input type="text" name="postal_code" value="<?= e(old('postal_code')) ?>" data-required inputmode="numeric" autocomplete="postal-code"><?= $err('postal_code') ?></label>
            </div>
            <label><span class="req">Province</span>
              <select name="province" data-required autocomplete="address-level1">
                <option value="">Choose…</option>
                <?php foreach (provinces() as $pr): ?><option <?= old('province') === $pr ? 'selected' : '' ?>><?= e($pr) ?></option><?php endforeach; ?>
              </select><?= $err('province') ?>
            </label>
          </div>
          <label>Order notes (optional)<textarea name="notes" rows="2" placeholder="e.g. delivery instructions, PO number"><?= e(old('notes')) ?></textarea></label>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend>Payment</legend>
        <div class="form">
          <?php if (!$methods): ?><div class="alert alert-error">Online payment is being set up. Please <a href="<?= url('quote', ['cart' => 1]) ?>">request a quote</a> instead.</div><?php endif; ?>
          <?php foreach ($methods as $key => [$label, $note]): ?>
            <label class="choice"><input type="radio" name="payment_method" value="<?= e($key) ?>" <?= $pm === $key ? 'checked' : '' ?>><span><strong><?= e($label) ?></strong><br><span class="muted"><?= e($note) ?></span></span></label>
          <?php endforeach; ?>
          <?= $err('payment_method') ?>
        </div>
      </fieldset>
      <label class="check"><input type="checkbox" name="terms" value="1" <?= old('terms') ? 'checked' : '' ?>> <span>I accept the <a href="<?= url('page/terms') ?>" target="_blank">terms &amp; conditions</a>, <a href="<?= url('page/delivery-returns') ?>" target="_blank">delivery &amp; returns policy</a> and <a href="<?= url('page/privacy') ?>" target="_blank">privacy policy</a>.</span></label><?= $err('terms') ?>
    </div>
    <aside class="summary">
      <h2 style="font-size:1.2rem">Your order</h2>
      <?php foreach ($lines as $l): ?>
        <div class="summary-row"><span><?= e($l['product']['name']) ?> <span class="muted">× <?= (int)$l['qty'] ?></span></span><span><?= money($l['total']) ?></span></div>
      <?php endforeach; ?>
      <div class="summary-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px"><span>Subtotal</span><strong><?= money($sub) ?></strong></div>
      <div class="summary-row"><span>Delivery</span><span id="sum-delivery"><?= $totals['delivery'] > 0 ? money($totals['delivery']) : 'Free' ?></span></div>
      <div class="summary-row summary-total"><span>Total</span><span id="sum-total"><?= money($totals['total']) ?></span></div>
      <p class="hint"><?= setting('vat_registered') === '1' ? 'Prices include VAT.' : 'No VAT added — we are not VAT registered.' ?></p>
      <button class="btn btn-gold btn-lg btn-block" type="submit" <?= $methods ? '' : 'disabled' ?>><?= icon('lock', 18) ?> Place order</button>
      <p class="hint center" style="margin-top:10px">Secure checkout. Card details are entered on PayFast, never on our site.</p>
    </aside>
  </form>
</div>
