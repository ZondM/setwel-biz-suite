// Text for the information and legal pages. Business details come from Admin > Settings.
// Placeholders in [SQUARE BRACKETS] appear when a setting is still empty.
const { html, money } = require('../util');

const R = (v) => money(Number(v || 0) * 100).replace('.00', '');
const fill = (v, ph) => (v && String(v).trim() ? v : `[${ph}]`);

const pages = {
  about: (s) => ({
    title: 'About Us — Medical Supplier in Khayelitsha, Cape Town',
    description: `SAHPRA-licensed supplier of medical consumables in Khayelitsha, Cape Town. Serving clinics, GPs, dentists, pharmacies, care homes and home-care nurses.`,
    h1: 'About Micheals Dynamics',
    body: html`
      <p>${s.business_name} is a Cape Town supplier of medical consumables, based in Khayelitsha. We supply gloves, wound-care products, syringes and needles, swabs, IV giving sets and personal protective equipment (PPE).</p>
      <p>We serve clinics, GP and dental practices, pharmacies, old-age and care homes, schools, home-care nurses, government facilities and members of the public.</p>
      <h2>Why buy from us</h2>
      <ul>
        <li><b>Licensed:</b> SAHPRA medical device licence no. ${s.sahpra_no}.</li>
        <li><b>Fast delivery:</b> next-day delivery in Cape Town and courier delivery nationwide.</li>
        <li><b>Free delivery</b> on orders of ${R(s.free_threshold)} or more.</li>
        <li><b>Bulk pricing</b> and written quotes for practices and institutions.</li>
        <li><b>Easy ordering</b> online, by WhatsApp or by email.</li>
      </ul>
      <p>Company registration no. ${s.reg_no}. We are not VAT registered, so no VAT is added to our prices.</p>`,
  }),

  'delivery-returns': (s) => ({
    title: 'Delivery & Returns',
    description: `Next-day delivery in Cape Town, courier nationwide, free over ${R(s.free_threshold)}. Sterile and opened items are non-returnable unless faulty.`,
    h1: 'Delivery & Returns',
    body: html`
      <h2>Delivery</h2>
      <ul>
        <li><b>Cape Town:</b> next working-day delivery on orders paid before ${fill(s.cutoff_time, 'CUT-OFF TIME')}.</li>
        <li><b>Rest of South Africa:</b> by courier, usually 2–4 working days to main centres. Outlying areas may take longer.</li>
        <li><b>Free delivery</b> on orders of ${R(s.free_threshold)} or more (after bulk discounts).</li>
        <li>Check the delivery cost for your postal code in the cart before you pay.</li>
        ${s.allow_collection === '1' ? html`<li><b>Collection:</b> you can collect from our Khayelitsha premises at no charge. We'll let you know when your order is ready.</li>` : ''}
        <li>We email you a tracking number when your order is dispatched.</li>
        <li>Please check your parcel on delivery and report damage or missing items within 2 working days.</li>
      </ul>
      <h2>Returns</h2>
      <p class="notice"><b>Sterile products and any opened packs cannot be returned or exchanged</b>, for hygiene and patient-safety reasons — unless they are faulty.</p>
      <ul>
        <li><b>Unopened, non-sterile items:</b> may be returned within 7 days of delivery in their original sealed packaging.</li>
        <li><b>Faulty or incorrect items:</b> tell us within 6 months of delivery. We will repair, replace or refund, as required by the Consumer Protection Act, and we pay the return delivery cost.</li>
        <li>To start a return, email <a href="mailto:${s.email}">${s.email}</a> or WhatsApp ${s.phone_1} with your order number and photos.</li>
        <li>Refunds are paid to your original payment method within 10 working days after we receive and check the item.</li>
      </ul>
      <p>Full details: <a href="/returns-policy">Returns Policy</a>.</p>`,
  }),

  faq: (s) => ({
    title: 'FAQ — Ordering, Delivery & Returns',
    description: 'Answers about payment, delivery times, free delivery, bulk discounts, returns and business accounts.',
    h1: 'Frequently asked questions',
    faq: [
      ['Do I need an account to order?', html`No. You can check out as a guest. Practices and institutions can <a href="/account/register">apply for a business account</a> for EFT payment, order history, one-click re-ordering and downloadable invoices.`],
      ['Do your prices include VAT?', html`We are not VAT registered, so no VAT is charged. The price you see is the price you pay, plus delivery where it applies.`],
      ['How can I pay?', html`Card or instant EFT through our secure payment provider. Approved business accounts can also pay by bank EFT; those orders are dispatched once payment reflects.`],
      ['How much is delivery and how long does it take?', html`Next working-day delivery in Cape Town and courier delivery nationwide. Delivery is free on orders of ${R(s.free_threshold)} or more. Enter your postal code in the cart to see the cost. See <a href="/delivery-returns">Delivery &amp; Returns</a>.`],
      ['Do you offer bulk discounts?', html`Yes. Bulk prices are shown on each product page and are applied automatically in the cart. For large or recurring orders, <a href="/quote">request a quote</a>.`],
      ['Why do some products say "Price on request"?', html`We're still loading prices for some items. Send us a <a href="/quote">quote request</a> or WhatsApp us and we'll reply with a price.`],
      ['Can I return a product?', html`Sterile items and opened packs cannot be returned unless faulty. Unopened non-sterile items can be returned within 7 days. See our <a href="/returns-policy">Returns Policy</a>.`],
      ['Can you advise which product to use for a patient?', html`No. We supply products only and cannot give medical advice. Please consult a qualified healthcare professional and follow the manufacturer's instructions.`],
      ['Do you supply government facilities and accept purchase orders?', html`Yes. Send your order list or tender reference through <a href="/quote">Request a Quote</a> and we'll send a formal quote.`],
      ['Are you licensed?', html`Yes. SAHPRA medical device licence no. ${s.sahpra_no}. Company registration no. ${s.reg_no}.`],
    ],
  }),

  'privacy-policy': (s) => ({
    title: 'Privacy Policy (POPIA)',
    description: 'How Micheals Dynamics collects, uses and protects personal information under POPIA.',
    h1: 'Privacy Policy',
    body: html`
      <p>${s.business_name} ("we") respects your privacy. This policy explains how we process personal information under the Protection of Personal Information Act 4 of 2013 (POPIA).</p>
      <h2>1. Responsible party and Information Officer</h2>
      <p>${s.business_name}, reg. no. ${s.reg_no}, ${s.address}. Information Officer: ${fill(s.info_officer, 'INFORMATION OFFICER NAME')}, <a href="mailto:${s.email}">${s.email}</a>, ${s.phone_1}.</p>
      <h2>2. What we collect</h2>
      <ul>
        <li>Contact details: name, email, phone, delivery and billing address.</li>
        <li>Business account details: organisation name and type, practice or registration number.</li>
        <li>Order details: products bought, order history, delivery details.</li>
        <li>Payment information is processed by our payment provider (PayFast or Yoco). We never see or store your full card details.</li>
        <li>Files you upload with a quote request (for example an order list).</li>
        <li>Basic technical data: IP address and browser type, kept in server logs for security.</li>
      </ul>
      <p>We do not ask for patient information. Please do not send us patient names or health information.</p>
      <h2>3. Why we use it</h2>
      <ul>
        <li>To process, deliver and support your orders and quotes (to perform our contract with you).</li>
        <li>To run business accounts and keep accounting and tax records (legal obligation).</li>
        <li>To prevent fraud and keep the website secure (legitimate interest).</li>
        <li>We do not send marketing unless you have asked us to. You can stop it at any time.</li>
      </ul>
      <h2>4. Who we share it with</h2>
      <p>Only with service providers who help us run the business and must keep it confidential: our website host, payment provider, courier companies, email provider and accountant — and authorities where the law requires it. We do not sell personal information.</p>
      <h2>5. Transfers outside South Africa</h2>
      <p>Some service providers (for example email or hosting) may store data outside South Africa. We only use providers bound by laws or agreements that give protection substantially similar to POPIA (section 72).</p>
      <h2>6. How long we keep it</h2>
      <p>Order and invoice records are kept for at least 5 years, as tax and company law require. Other information is kept only as long as needed.</p>
      <h2>7. Security</h2>
      <p>We use encrypted (HTTPS) connections, hashed passwords and access-controlled systems.</p>
      <h2>8. Your rights</h2>
      <p>You may ask to access, correct or delete your personal information, or object to its processing. Contact our Information Officer. You may also complain to the Information Regulator: <a href="https://inforegulator.org.za" target="_blank" rel="noopener">inforegulator.org.za</a>.</p>
      <h2>9. Cookies</h2>
      <p>See our <a href="/cookies">Cookie notice</a>.</p>
      <h2>10. Changes</h2>
      <p>We may update this policy. The latest version is always on this page.</p>`,
  }),

  terms: (s) => ({
    title: 'Terms & Conditions',
    description: 'Terms and conditions for buying from Micheals Dynamics online, under the CPA and ECTA.',
    h1: 'Terms and Conditions',
    body: html`
      <p>These terms apply to all purchases on this website. They are subject to the Consumer Protection Act 68 of 2008 (CPA) and the Electronic Communications and Transactions Act 25 of 2002 (ECTA). Nothing in these terms limits your rights under those Acts.</p>
      <h2>1. Supplier information (ECTA section 43)</h2>
      <ul>
        <li>Name and legal status: ${s.business_name}, a private company registered in South Africa.</li>
        <li>Registration number: ${s.reg_no}.</li>
        <li>Directors: ${fill(s.directors, 'DIRECTOR NAME(S)')}.</li>
        <li>Physical address (also for service of legal documents): ${s.address}.</li>
        <li>Phone: ${s.phone_1}${s.phone_2 ? ` / ${s.phone_2}` : ''}. Email: ${s.email}.</li>
        <li>SAHPRA medical device licence no.: ${s.sahpra_no}.</li>
        <li>VAT: not VAT registered. No VAT is charged.</li>
        <li>Self-regulatory body or code of conduct: none.</li>
      </ul>
      <h2>2. Products and information</h2>
      <p>Product descriptions, photos and specifications are for identification only and are not medical advice. Use products according to the manufacturer's instructions and the guidance of a qualified healthcare professional. Packaging may differ slightly from photos.</p>
      <h2>3. Prices</h2>
      <p>Prices are in South African Rand. We are not VAT registered, so no VAT is added. Bulk discounts and delivery costs are shown before you pay. If an obvious pricing error occurs, we will contact you and you may cancel for a full refund.</p>
      <h2>4. Orders</h2>
      <p>An order is accepted when we confirm it by email. We may decline or cancel an order (for example, if stock is unavailable), in which case any payment is refunded in full.</p>
      <h2>5. Payment and security</h2>
      <p>Payment is by card or instant EFT through PayFast or Yoco, or by bank EFT for approved business accounts. Card payments are processed by the payment provider over encrypted connections; we do not see or store card details. EFT orders are processed once funds reflect.</p>
      <h2>6. Delivery</h2>
      <p>Orders are normally dispatched within 1–2 working days of payment; Cape Town orders paid before ${fill(s.cutoff_time, 'CUT-OFF TIME')} are delivered the next working day. Other areas are delivered by courier, usually within 2–4 working days. Risk passes to you on delivery. Please inspect goods on delivery and report damage or shortages within 2 working days.</p>
      <h2>7. Cooling-off period (ECTA section 44)</h2>
      <p>If you are an individual buying online, you may cancel within 7 days after receiving the goods, without reason or penalty; you pay only the direct cost of returning the goods. This does not apply to goods that by their nature cannot be returned (ECTA section 42(2)), which includes sterile products and opened packs.</p>
      <h2>8. Returns, defects and warranty</h2>
      <p>Our <a href="/returns-policy">Returns Policy</a> forms part of these terms. Under CPA section 56, you may return defective goods within 6 months of delivery for repair, replacement or refund.</p>
      <h2>9. Business accounts</h2>
      <p>Business accounts are approved at our discretion. Keep your login details confidential and tell us about any unauthorised use.</p>
      <h2>10. Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential loss. Nothing here excludes liability that cannot be excluded under the CPA.</p>
      <h2>11. Records</h2>
      <p>Order confirmations and invoices are emailed to you. Business account holders can view past orders and download invoices in their account.</p>
      <h2>12. Complaints and law</h2>
      <p>Please contact us first so we can resolve any complaint. You may also approach the National Consumer Commission or the Consumer Goods and Services Ombud. South African law applies.</p>`,
  }),

  'returns-policy': (s) => ({
    title: 'Returns Policy',
    description: 'Returns policy: sterile and opened items are non-returnable unless faulty; unopened non-sterile items within 7 days.',
    h1: 'Returns Policy',
    body: html`
      <h2>Items that cannot be returned</h2>
      <p class="notice"><b>Sterile products and any opened packs cannot be returned or exchanged</b>, because their safety cannot be guaranteed once they have left our control. This does not affect your rights if an item is faulty.</p>
      <h2>Unopened, non-sterile items</h2>
      <p>You may return unopened, non-sterile items in their original sealed packaging within 7 days of delivery. You pay the return delivery cost. We refund the product price after we receive and check the items.</p>
      <h2>Faulty, damaged or incorrect items</h2>
      <ul>
        <li>Report damaged or incorrect deliveries within 2 working days of delivery, with photos.</li>
        <li>Faulty items may be returned within 6 months of delivery (CPA section 56) for repair, replacement or refund.</li>
        <li>We pay the return delivery cost for faulty or incorrect items.</li>
      </ul>
      <h2>How to return</h2>
      <ol>
        <li>Email ${s.email} or WhatsApp ${s.phone_1} with your order number, the item(s) and photos.</li>
        <li>We confirm and send return instructions. Please don't send items back before we confirm.</li>
        <li>Refunds go to your original payment method within 10 working days after we receive and check the item.</li>
      </ol>`,
  }),

  cookies: () => ({
    title: 'Cookie Notice',
    description: 'This website uses only essential cookies for the cart, checkout and login.',
    h1: 'Cookie notice',
    body: html`
      <p>This website uses <b>only essential cookies</b>:</p>
      <ul>
        <li><b>sid</b> — keeps your cart, checkout and login working. Expires after 30 days.</li>
      </ul>
      <p>We do not use advertising or tracking cookies. The "OK" you click on the cookie banner is remembered in your browser so the banner doesn't show again.</p>
      <p>Our payment providers (PayFast or Yoco) may set their own cookies on their payment pages. See their privacy policies.</p>
      <p>If we add analytics in future, we will ask for your consent first and update this notice.</p>`,
  }),
};

module.exports = { pages };
