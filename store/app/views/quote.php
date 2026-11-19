<?php
/** @var array $errors @var string $prefill @var array $start */
$err = fn($k) => isset($errors[$k]) ? '<span class="error-text">' . e($errors[$k]) . '</span>' : '';
$wa = 'https://wa.me/' . e(wa_number(setting('whatsapp')));
?>
<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [['Instant quote', null]]]); ?>
  <div class="contact-grid">
    <div>
      <h1>Instant quote</h1>
      <p>Add the products you need — prices appear immediately. You get your quote with a PDF straight away, and can accept and pay online, or send it to us on WhatsApp.</p>
      <?php if (!empty($errors['form'])): ?><div class="alert alert-error"><?= e($errors['form']) ?></div><?php endif; ?>
      <form method="post" class="form" novalidate data-quote-builder data-fee="<?= e(setting('delivery_fee', 150)) ?>" data-free="<?= e(setting('free_delivery_threshold', 2500)) ?>">
        <?= csrf_field() ?><?= honeypot() ?><input type="hidden" name="mode" value="instant">
        <div class="qb-search" data-suggest-picker>
          <label for="qb-q"><span>1. Find a product (model, cartridge code or printer)</span></label>
          <input id="qb-q" type="search" placeholder="e.g. 3607XXL, 730, HP 145A, Riso master…" autocomplete="off">
          <div class="qb-results" hidden></div>
        </div>
        <table class="qb-table" aria-label="Products in your quote">
          <thead><tr><th>Product</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th><th></th></tr></thead>
          <tbody>
            <?php foreach ($start as $s): $p = $s['p']; $price = effective_price($p); ?>
              <tr data-id="<?= (int)$p['id'] ?>" data-price="<?= e($price) ?>">
                <td><strong><?= e($p['name']) ?></strong><br><small class="muted"><?= e($p['sku']) ?> · <?= e(stock_label($p)) ?></small></td>
                <td class="num"><?= $price > 0 ? money($price, false) : 'We will price' ?></td>
                <td class="num"><input type="number" name="qty[<?= (int)$p['id'] ?>]" value="<?= (int)$s['qty'] ?>" min="1" max="999" aria-label="Quantity"></td>
                <td class="num" data-line></td>
                <td><button type="button" class="btn btn-ghost btn-sm" data-remove aria-label="Remove">✕</button></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
          <tfoot>
            <tr class="qb-empty"<?= $start ? ' hidden' : '' ?>><td colspan="5" class="muted">No products yet — search above.</td></tr>
            <tr><td colspan="3">Subtotal</td><td class="num" data-sub>R0</td><td></td></tr>
            <tr><td colspan="3">Courier delivery <small class="muted">(free from <?= money(setting('free_delivery_threshold'), false) ?>, or collect in Cape Town)</small></td><td class="num" data-del>—</td><td></td></tr>
            <tr class="qb-total"><td colspan="3">Total</td><td class="num" data-tot>R0</td><td></td></tr>
          </tfoot>
        </table>
        <?= $err('items') ?>
        <label>Anything not on our website? (optional)<textarea name="items" rows="2" placeholder="e.g. 10 × A4 paper boxes, a printer for a school office"><?= e(old('items', $prefill && !$start ? $prefill : '')) ?></textarea></label>
        <p style="margin:18px 0 6px"><strong>2. Where should we send your quote?</strong></p>
        <div class="form-row">
          <label><span class="req">Your name</span><input type="text" name="name" value="<?= e(old('name')) ?>" required autocomplete="name"><?= $err('name') ?></label>
          <label>WhatsApp / phone<input type="tel" name="phone" value="<?= e(old('phone')) ?>" autocomplete="tel" placeholder="e.g. 082 123 4567"></label>
        </div>
        <div class="form-row">
          <label>Email<input type="email" name="email" value="<?= e(old('email')) ?>" autocomplete="email"><?= $err('email') ?></label>
          <label>Company / school / department<input type="text" name="company" value="<?= e(old('company')) ?>" autocomplete="organization"></label>
        </div>
        <label>Notes (delivery town, deadline, order number)<textarea name="message" rows="2"><?= e(old('message')) ?></textarea></label>
        <label class="check"><input type="checkbox" name="consent" value="1" <?= old('consent') ? 'checked' : '' ?>> <span>I agree that <?= e(setting('business_name')) ?> may use my details to send this quote and follow up (see our <a href="<?= url('page/privacy') ?>">privacy policy</a>).</span></label><?= $err('consent') ?>
        <button class="btn btn-gold btn-lg" type="submit">Get my instant quote</button>
      </form>
    </div>
    <aside>
      <div class="p-box" style="margin-top:0">
        <h2 style="font-size:1.2rem">Faster on WhatsApp?</h2>
        <p class="muted" style="margin:0 0 10px">Send your list or a photo of your printer label.</p>
        <a class="btn btn-wa btn-block" data-track="wa_click" data-label="quote page" href="<?= $wa ?>?text=<?= rawurlencode('Hi, I would like a quote for: ') ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 18) ?> WhatsApp <?= e(setting('whatsapp')) ?></a>
      </div>
      <div class="p-box">
        <h2 style="font-size:1.2rem">Rather talk to someone?</h2>
        <form method="post" action="<?= url('callback') ?>" class="form">
          <?= csrf_field() ?><?= honeypot() ?>
          <label>Name<input type="text" name="name" required autocomplete="name"></label>
          <label>Phone<input type="tel" name="phone" required autocomplete="tel"></label>
          <label>Best time to call<select name="preferred_time"><option>As soon as possible</option><option>Today, morning</option><option>Today, afternoon</option><option>Tomorrow, morning</option><option>Tomorrow, afternoon</option></select></label>
          <button class="btn btn-outline btn-block" type="submit"><?= icon('phone', 16) ?> Call me back</button>
        </form>
      </div>
      <ul class="p-points">
        <li><?= icon('check', 18) ?> Instant prices from our live price list</li>
        <li><?= icon('check', 18) ?> Formal PDF quote for procurement</li>
        <li><?= icon('check', 18) ?> Accept &amp; pay online — card, Instant EFT or EFT</li>
        <li><?= icon('check', 18) ?> <?= e(setting('reseller_statement')) ?></li>
      </ul>
    </aside>
  </div>
</div>
