<?php
/* =====================================================================
   MICHEALS DYNAMICS — PAYFAST SETTINGS  (private file)

   Put this file in your cPanel HOME folder: the top folder that contains
   public_html and michealsdynamics.co.za — NOT inside michealsdynamics.co.za.
   There, nobody can download it from the internet.

   Fill in the values between the quote marks. Keep every quote mark and comma.
   ===================================================================== */
return [
    // From PayFast: Settings > Developer Settings (or your PayFast welcome email)
    'merchant_id'    => '',
    'merchant_key'   => '',
    // The passphrase you set in PayFast: Settings > Developer Settings > Salt Passphrase.
    // Must be exactly the same in both places. Leave '' only if NO passphrase is set in PayFast.
    'passphrase'     => '',

    // false = real payments.  true = PayFast sandbox testing (needs sandbox merchant details).
    'sandbox'        => false,

    // Password for https://michealsdynamics.co.za/pay/link.php (where you create payment links).
    // At least 10 characters. Don't reuse your cPanel or email password.
    'admin_password' => '',

    // A long random secret that locks payment links (at least 32 characters).
    // Type random letters and numbers; you never need to remember it.
    // Changing it later makes old payment links stop working.
    'link_secret'    => '',

    // Where "PAID" notifications go
    'notify_email'   => 'michealsdynamicresults@gmail.com',
    // Sender address for emails (an address on your domain delivers best)
    'from_email'     => 'noreply@michealsdynamics.co.za',

    'site_url'       => 'https://michealsdynamics.co.za',
];
