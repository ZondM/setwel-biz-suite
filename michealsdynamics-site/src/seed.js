// First-run starter catalogue. NO prices and NO photos: products show "Price on request"
// until the owner enters prices in Admin > Prices & stock. Edit or delete anything in Admin.
const { db, tx } = require('./db');
const { slugify } = require('./util');

const CATEGORIES = [
  ['Gloves', 'Nitrile, latex and vinyl examination gloves, and sterile surgical gloves.', 'Buy Nitrile Gloves South Africa | Latex & Vinyl Gloves', 'Nitrile, latex and vinyl examination gloves in boxes of 100, plus sterile surgical gloves. Bulk pricing. Next-day delivery in Cape Town.'],
  ['Wound Care', 'Dressings, bandages and wound-care consumables.', 'Wound Dressings & Bandages | Cape Town', 'Sterile island dressings, crepe bandages and wound-care consumables for clinics and home-care nurses. Delivery across South Africa.'],
  ['Syringes & Needles', 'Sterile single-use syringes and hypodermic needles.', 'Buy Syringes & Needles Online South Africa', 'Sterile single-use syringes and hypodermic needles in boxes of 100. Bulk prices for practices. Next-day delivery in Cape Town.'],
  ['Swabs', 'Gauze swabs and alcohol prep swabs.', 'Gauze & Alcohol Swabs | Medical Supplies Cape Town', 'Sterile and non-sterile gauze swabs and alcohol prep swabs. Bulk packs for clinics and pharmacies.'],
  ['IV Giving Sets', 'IV administration sets and tubing.', 'IV Giving Sets & Tubing | Buy Online', 'Sterile IV administration (giving) sets for clinics and facilities. Courier delivery across South Africa.'],
  ['PPE', 'Masks, gowns, aprons and face shields.', 'Medical PPE South Africa | Masks, Gowns, Face Shields', 'Surgical masks, respirators, isolation gowns, aprons and face shields. Bulk pricing for clinics and schools.'],
];

// [category, name, material, sterile(1/0/null), pack, unit, options[], specs, description, bestseller]
const PRODUCTS = [
  ['Gloves', 'Nitrile Examination Gloves, Powder-Free (Box of 100)', 'Nitrile', 0, 100, 'glove', ['XS', 'S', 'M', 'L', 'XL'], 'Powder-free\nLatex-free\nAmbidextrous, beaded cuff', 'Powder-free, latex-free nitrile examination gloves. Box of 100.', 1],
  ['Gloves', 'Latex Examination Gloves, Powder-Free (Box of 100)', 'Latex', 0, 100, 'glove', ['S', 'M', 'L'], 'Powder-free\nAmbidextrous\nContains natural rubber latex', 'Powder-free latex examination gloves. Box of 100. Contains natural rubber latex.', 0],
  ['Gloves', 'Vinyl Examination Gloves (Box of 100)', 'Vinyl', 0, 100, 'glove', ['S', 'M', 'L', 'XL'], 'Latex-free\nAmbidextrous', 'Latex-free vinyl examination gloves. Box of 100.', 0],
  ['Gloves', 'Sterile Latex Surgical Gloves (Box of 50 Pairs)', 'Latex', 1, 50, 'pair', ['6.5', '7', '7.5', '8'], 'Individually packed pairs\nContains natural rubber latex', 'Sterile latex surgical gloves, individually packed pairs. Box of 50 pairs.', 0],
  ['Wound Care', 'Adhesive Island Dressing, Sterile (Box of 50)', 'Non-woven', 1, 50, 'dressing', ['10 x 10 cm', '10 x 20 cm'], 'Individually wrapped\nNon-woven adhesive border', 'Sterile adhesive island dressings, individually wrapped. Box of 50.', 1],
  ['Wound Care', 'Crepe Bandage (Pack of 12)', 'Cotton blend', 0, 12, 'bandage', ['5 cm', '7.5 cm', '10 cm', '15 cm'], '', 'Crepe bandages. Pack of 12.', 0],
  ['Swabs', 'Gauze Swabs 10 x 10 cm, 8-Ply, Non-Sterile (Pack of 100)', 'Cotton gauze', 0, 100, 'swab', ['Standard'], 'Size: 10 x 10 cm\nPly: 8', 'Non-sterile 8-ply gauze swabs, 10 x 10 cm. Pack of 100.', 1],
  ['Swabs', 'Sterile Gauze Swabs 7.5 x 7.5 cm (Pouch of 5)', 'Cotton gauze', 1, 5, 'swab', ['Standard'], 'Size: 7.5 x 7.5 cm', 'Sterile gauze swabs, 7.5 x 7.5 cm. Pouch of 5.', 0],
  ['Swabs', 'Alcohol Prep Swabs, 70% Isopropyl (Box of 100)', 'Non-woven', null, 100, 'swab', ['Standard'], 'Alcohol: 70% isopropyl\nIndividually sealed', 'Individually sealed 70% isopropyl alcohol prep swabs. Box of 100.', 1],
  ['Syringes & Needles', 'Disposable Syringes, Luer Slip, Sterile (Box of 100)', 'Polypropylene', 1, 100, 'syringe', ['2 ml', '5 ml', '10 ml', '20 ml'], 'Single-use\nLuer slip tip\nNeedle not included', 'Sterile single-use Luer slip syringes, needle not included. Box of 100.', 1],
  ['Syringes & Needles', 'Hypodermic Needles, Sterile (Box of 100)', 'Stainless steel', 1, 100, 'needle', ['21G', '23G', '25G'], 'Single-use\nColour-coded hub', 'Sterile single-use hypodermic needles. Box of 100.', 0],
  ['IV Giving Sets', 'IV Administration (Giving) Set, 20 Drops/ml, Sterile', 'PVC', 1, 1, 'set', ['Standard'], 'Drip rate: 20 drops/ml\nSingle-use', 'Sterile single-use IV administration set, 20 drops/ml.', 0],
  ['PPE', 'Surgical Face Masks, 3-Ply (Box of 50)', 'Non-woven polypropylene', null, 50, 'mask', ['Standard'], 'Layers: 3-ply\nEar loops', '3-ply disposable face masks with ear loops. Box of 50.', 1],
  ['PPE', 'Disposable Isolation Gowns (Pack of 10)', 'Non-woven polypropylene', 0, 10, 'gown', ['Universal', 'XL'], 'Long sleeves, elastic cuffs\nBack ties', 'Disposable isolation gowns with elastic cuffs. Pack of 10.', 0],
  ['PPE', 'Disposable Plastic Aprons (Pack of 100)', 'Polyethylene', null, 100, 'apron', ['White', 'Blue'], 'Single-use\nNeck loop and waist ties', 'Single-use polyethylene aprons. Pack of 100.', 0],
  ['PPE', 'Full Face Shields (Pack of 10)', 'PET', null, 10, 'shield', ['Standard'], 'Foam forehead pad\nElastic strap', 'Full face shields with elastic strap. Pack of 10.', 0],
];

function seedIfEmpty() {
  if (db.prepare('SELECT 1 FROM categories').get()) return false;
  tx(() => {
    CATEGORIES.forEach(([name, desc, st, sd], i) =>
      db.prepare('INSERT INTO categories (slug, name, description, seo_title, seo_description, sort) VALUES (?,?,?,?,?,?)').run(slugify(name), name, desc, st, sd, i));
    for (const [cat, name, material, sterile, pack, unit, opts, specs, desc, best] of PRODUCTS) {
      const catId = db.prepare('SELECT id FROM categories WHERE name = ?').get(cat).id;
      const pid = Number(db.prepare(`INSERT INTO products (slug, name, category_id, material, sterile, pack_qty, unit_label, specs, description, bestseller)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(slugify(name), name, catId, material, sterile, pack, unit, specs, desc, best).lastInsertRowid);
      opts.forEach((label, i) => db.prepare('INSERT INTO variants (product_id, label, price_cents, stock, sort) VALUES (?,?,NULL,0,?)').run(pid, label, i));
    }
  });
  return true;
}

module.exports = { seedIfEmpty };
