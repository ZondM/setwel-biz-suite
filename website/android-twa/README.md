# Android app (Trusted Web Activity) — build notes

Status: blocked on network access, not on code. See "Blocker" below before
re-running anything.

## What's already done

- `website/manifest.json` and `website/sw.js` — PWA manifest + service worker (prior commit).
- `website/.well-known/assetlinks.json` — Digital Asset Links file, already carrying the
  real SHA-256 fingerprint of the release signing keystore (see below). This needs to be
  live at `https://setwelbusiness.co.za/.well-known/assetlinks.json` for the TWA to launch
  without a Chrome URL bar.

## App identity (use these exact values when running `bubblewrap init`)

- Application ID: `za.co.setwelbusiness.twa`
- App name: `Setwel Biz Suite`
- Manifest URL: `https://setwelbusiness.co.za/manifest.json`
- Host: `setwelbusiness.co.za`
- Start URL: `/mobile.html`

## Signing keystore

A release keystore (`setwel-release.keystore`, alias `setwel-twa`, RSA 2048, PKCS12,
valid ~30 years) was generated offline with `keytool` and is **not** in this repo or
commit. It was handed to the owner separately (see chat/report) — store it in a password
manager, not git. Losing it means losing the ability to ship updates to this app on
Google Play under the same package.

SHA-256 certificate fingerprint (already baked into `assetlinks.json` above):
`B8:2A:BC:50:EF:6B:5B:81:84:0B:45:4F:BE:9A:02:8E:BB:BA:1A:9F:24:A5:3A:63:95:BF:AA:11:E3:35:8E:2D`

## Blocker: this environment cannot build the APK

Bubblewrap needs, at minimum:
1. A JDK 17 (installed here via `apt-get install openjdk-17-jdk-headless` — fine, no
   external network needed beyond the standard Ubuntu archive).
2. The Android SDK (platform, build-tools, `aapt2`) — Bubblewrap downloads these from
   `dl.google.com`.
3. The Android Gradle Plugin's `aapt2` artifact during the Gradle build — this is
   published **only** on Google's Maven repo (`maven.google.com`, which itself
   redirects to `dl.google.com`), not on Maven Central.

In this session's network policy, `dl.google.com`, `play.google.com`,
`googlechromelabs.github.io`, `github.com` (blocks Bubblewrap's JDK-installer fallback,
which pulls from `github.com/adoptium/...`), and generic mirrors (`jitpack.io`,
`maven.aliyun.com`) all return `403` from the egress proxy. `registry.npmjs.org`,
`repo1.maven.org`/`repo.maven.apache.org`, and `services.gradle.org` (Gradle itself, and
most of Maven Central) are reachable. So `npm install -g @bubblewrap/cli` and the AGP
jar itself can be fetched, but `aapt2` and the Android SDK components cannot — there's no
way to compile a real APK here.

## Exact commands to re-run once network access to Google's Android infra is available

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifestUrl=https://setwelbusiness.co.za/manifest.json
# When prompted:
#   JDK: point at an existing JDK 17 (or let Bubblewrap install one)
#   Android SDK: let Bubblewrap install it
#   Application ID: za.co.setwelbusiness.twa
#   Signing key: import the existing setwel-release.keystore (alias setwel-twa)
#     rather than generating a new one, so the fingerprint keeps matching
#     the assetlinks.json already committed above.
bubblewrap build
```

That produces `app-release-signed.apk` (or `.aab` for Play Store upload). Typical TWA
APK size is a few MB (it's a thin native shell around Chrome, not a bundled browser
runtime) — confirm the actual number once a build succeeds.

## Still needed regardless of the above

- Deploy `website/manifest.json`, `website/sw.js`, and
  `website/.well-known/assetlinks.json` to the live site (check they're actually live —
  they weren't reachable as of this session).
- A real source logo file: `setwel-logo.png` referenced by `manifest.json` is not
  present anywhere in this git repo, so its resolution/quality couldn't be checked here.
  If it's low-res, it'll look poor as a launcher icon — get a proper 512x512+ source
  image before shipping.
- A Google Play Developer account (owner's own Google account, $25 fee, identity
  verification) — out of scope for any Claude session.
