#!/usr/bin/env bash
# Builds the Setwel app from app-src/ into app/ (used by the desktop installers),
# then rebuilds the website so the phone version (website/app/) matches.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd app-src && npm ci --no-audit --no-fund && npm run build)
rm -rf app
cp -r app-src/dist app
python3 tools/build_site.py
echo "App built into app/ and website/app/"
