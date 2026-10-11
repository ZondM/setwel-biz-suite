# Product fields to create (do this BEFORE importing products)

Shopify admin > **Settings > Metafields and metaobjects > Products > Add definition**.
Use exactly these namespace/keys (type the full `custom.xxx` in the "Namespace and key" box).

| Name | Namespace and key | Type | Example | Filterable? |
|---|---|---|---|---|
| Pack quantity | `custom.pack_quantity` | Integer | 100 | Yes ("Pack size") |
| Unit label | `custom.unit_label` | Single line text | glove | No |
| Sterile | `custom.sterile` | True or false | true | Yes |
| Material | `custom.material` | Single line text | Nitrile | Yes |
| Bulk tiers | `custom.bulk_tiers` | Single line text | `10:5, 50:10` | No |
| Specifications | `custom.specs` | Multi-line text | one spec per line | No |
| Data sheet | `custom.datasheet` | File | PDF | No |

**Bulk tiers format**: `quantity:percent-off`, comma-separated. `10:5, 50:10` means 10+ packs = 5% off, 50+ packs = 10% off.
The product page only *displays* this. The actual discount must also exist under **Discounts** (see README step 7).
The import file uses `10:5, 50:10` as a placeholder on every product — change it to your real tiers.

## Filters (Shop page)
Install the free **Shopify Search & Discovery** app > Filters > Add:
Availability, Price, Product type (category), Vendor (= brand), Size / Volume / Gauge (variant options), Material, Sterile, Pack quantity.
Sorting (price, best-selling, A–Z, newest) is built into the Dawn theme.
