#!/bin/bash
# Rebuilds website-preview/ (a static snapshot of the shop that opens without PHP).
# Run from the repo root on Linux/Mac:  bash tools/build-preview.sh
set -e
ROOT=$(pwd); TMP=$(mktemp -d)
tar --exclude=store/app/config.php --exclude='store/storage/db/*' --exclude='store/uploads/products/*.webp' -cf - store | tar -xf - -C "$TMP"
php -S 127.0.0.1:8099 -t "$TMP/store" "$TMP/store/index.php" >/dev/null 2>&1 &
echo $! > "$TMP/pid"
sleep 1; B=http://127.0.0.1:8099; J="$TMP/cj"
T=$(curl -s -b $J -c $J $B/ | grep -o 'name="_token" value="[^"]*"' | sed 's/.*value="//;s/"//')
curl -s -b $J -c $J -o /dev/null -X POST $B/ --data-urlencode "_token=$T" -d db_driver=sqlite -d site_url=https://setwelafrica.com \
  -d admin_name=Preview -d admin_email=preview@example.com -d admin_password=Preview12345 -d admin_password2=Preview12345 -d sample=1 -d catalogue=1
mkdir "$TMP/out" && cd "$TMP/out"
wget -q -e robots=off --recursive --level=40 --page-requisites --convert-links --adjust-extension --restrict-file-names=windows --no-host-directories \
  --reject-regex '/(admin|api|payfast|order|feeds|cart/|checkout|newsletter|search)|sitemap\.xml|robots\.txt|quote\?|sort=|brand%5B|brand\[|min=|max=|stock=|sale=|category=' $B/ || true
kill "$(cat "$TMP/pid")" 2>/dev/null || true
python3 "$ROOT/tools/preview-postprocess.py" .
rm -rf "$ROOT/website-preview" && cp -r "$TMP/out" "$ROOT/website-preview"
rm -rf "$TMP"
echo "Built website-preview/ — open website-preview/index.html"
