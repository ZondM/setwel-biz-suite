// PDF invoice. Not VAT registered, so this is an "Invoice", not a "Tax Invoice", and shows no VAT.
const PDFDocument = require('pdfkit');
const { getSettings } = require('./db');
const { money } = require('./util');

function invoicePdf(order) {
  return new Promise((resolve, reject) => {
    const s = getSettings();
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const teal = '#0B6E78';
    doc.fillColor(teal).fontSize(20).font('Helvetica-Bold').text(s.trading_name);
    doc.fillColor('#10202A').fontSize(9).font('Helvetica')
      .text(s.business_name)
      .text(`Reg. no. ${s.reg_no}  ·  SAHPRA licence no. ${s.sahpra_no}`)
      .text(s.address)
      .text(`${s.phone_1}${s.phone_2 ? ' / ' + s.phone_2 : ''}  ·  ${s.email}`)
      .text(s.vat_line);

    doc.moveUp(6).fontSize(18).font('Helvetica-Bold').text('INVOICE', 0, 48, { align: 'right', width: doc.page.width - 48 });
    doc.fontSize(9).font('Helvetica')
      .text(`Invoice no: ${order.number}`, { align: 'right', width: doc.page.width - 48 })
      .text(`Date: ${String(order.created_at).slice(0, 10)}`, { align: 'right', width: doc.page.width - 48 })
      .text(`Payment: ${order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}`, { align: 'right', width: doc.page.width - 48 });

    doc.moveDown(4).font('Helvetica-Bold').fontSize(10).text('Bill / deliver to', 48);
    doc.font('Helvetica').fontSize(9);
    [order.org_name, order.name, order.address1, order.address2, order.suburb, [order.city, order.postal_code].filter(Boolean).join(' '), order.province, order.phone, order.email]
      .filter(Boolean).forEach((l) => doc.text(l));

    // Items table
    doc.moveDown(1.2);
    const cols = [48, 300, 360, 440, 500];
    let y = doc.y;
    doc.rect(48, y - 4, doc.page.width - 96, 18).fill('#E8F3F4');
    doc.fillColor('#10202A').font('Helvetica-Bold').fontSize(9);
    ['Item', 'Qty', 'Unit price', '', 'Total'].forEach((h, i) => doc.text(h, cols[i], y, { width: i === 0 ? 245 : 60, align: i === 0 ? 'left' : 'right' }));
    y += 20;
    doc.font('Helvetica');
    for (const it of order.items) {
      const name = it.name + (it.variant_label && it.variant_label !== 'Standard' ? ` — ${it.variant_label}` : '') + (it.sku ? ` (${it.sku})` : '');
      const h = doc.heightOfString(name, { width: 245 });
      if (y + h > doc.page.height - 140) { doc.addPage(); y = 48; }
      doc.text(name, cols[0], y, { width: 245 });
      doc.text(String(it.qty), cols[1], y, { width: 60, align: 'right' });
      doc.text(money(it.unit_price_cents), cols[2], y, { width: 60, align: 'right' });
      doc.text(money(it.line_total_cents), cols[4], y, { width: 60, align: 'right' });
      y += Math.max(h, 12) + 6;
    }
    doc.moveTo(48, y).lineTo(doc.page.width - 48, y).strokeColor('#C9D3D6').stroke();
    y += 8;
    const row = (label, value, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 330, y, { width: 160, align: 'right' }).text(value, cols[4], y, { width: 60, align: 'right' });
      y += 14;
    };
    row('Subtotal (before bulk discount)', money(order.subtotal_cents));
    if (order.discount_cents) row('Bulk discount', '-' + money(order.discount_cents));
    row(`Delivery: ${order.delivery_label}`, order.delivery_cents ? money(order.delivery_cents) : 'Free');
    row('TOTAL (ZAR)', money(order.total_cents), true);
    doc.font('Helvetica').fontSize(8).text('No VAT charged — supplier is not registered for VAT.', 48, y + 4);

    y = doc.y + 16;
    if (order.payment_method === 'eft' && order.payment_status !== 'paid' && s.bank_account_no) {
      doc.font('Helvetica-Bold').fontSize(10).text('Banking details for EFT', 48, y);
      doc.font('Helvetica').fontSize(9)
        .text(`Bank: ${s.bank_name}   Account name: ${s.bank_account_name}`)
        .text(`Account no: ${s.bank_account_no}   Branch code: ${s.bank_branch_code}   Type: ${s.bank_account_type}`)
        .text(`Reference: ${order.number}`);
      y = doc.y + 12;
    }
    doc.fontSize(8).fillColor('#4A5559')
      .text('Sterile items and opened packs cannot be returned unless faulty. See our Returns Policy. Product information is not medical advice.', 48, y, { width: doc.page.width - 96 });
    doc.end();
  });
}

module.exports = { invoicePdf };
