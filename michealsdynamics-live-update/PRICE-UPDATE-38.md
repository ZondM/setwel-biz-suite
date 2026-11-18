# 38% markup on all product prices

Upload exactly as before:
1. cPanel → File Manager → open **michealsdynamics.co.za**.
2. **Upload** `michealsdynamics-site-update.zip` → right-click → **Extract** into the same folder, replacing the existing files.
3. Delete the zip afterwards.

Don't delete the `product` or `images` folders. Product pages pick up the new prices automatically.

After uploading, check one product: its price should be the old price × 1.38 (e.g. R37.84 → R52.22).
If you still see an old price, refresh once (Cmd+Shift+R).

Note: if the products are re-imported from Transpharm later, the markup must be applied again (`source/markup.py`).
