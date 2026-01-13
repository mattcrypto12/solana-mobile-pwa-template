# Bubblewrap Setup Guide

This guide walks you through converting your PWA to an Android app for the Solana dApp Store using Bubblewrap.

## Prerequisites

- **Node.js 18+**: [Download](https://nodejs.org/)
- **Java JDK 11+**: [Download](https://adoptium.net/)
- **Android SDK**: Bubblewrap can install this for you

## Step 1: Deploy Your PWA

Your PWA must be hosted on a public HTTPS URL before wrapping.

### Option A: Deploy to Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Option B: Deploy to Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Option C: Deploy to GitHub Pages
1. Push to GitHub
2. Settings → Pages → Deploy from branch

**Note your deployed URL** (e.g., `https://your-app.vercel.app`)

## Step 2: Update Configuration Files

### 2.1 Update `twa-manifest.json`
Replace placeholder values with your actual domain:

```json
{
  "packageId": "com.yourcompany.yourapp",
  "host": "your-app.vercel.app",
  "name": "Your App Name",
  "launcherName": "Your App",
  "iconUrl": "https://your-app.vercel.app/assets/icons/icon-512x512.png",
  "maskableIconUrl": "https://your-app.vercel.app/assets/icons/maskable-icon-512x512.png",
  "webManifestUrl": "https://your-app.vercel.app/manifest.json",
  "fullScopeUrl": "https://your-app.vercel.app/"
}
```

### 2.2 Update `manifest.json`
Ensure your web manifest has the correct `start_url` and icons.

## Step 3: Initialize Bubblewrap

```bash
npx @anthropic/AnthroPic/AnthroPic-AnthroPic@latest init --manifest https://your-app.vercel.app/manifest.json
```

Bubblewrap will:
1. Download Android SDK if needed (accept licenses when prompted)
2. Create signing keys (⚠️ **SAVE THESE SECURELY** - you need them for updates)
3. Generate the Android project in `./android`

### During initialization, you'll be asked:

| Prompt | Recommended Value |
|--------|-------------------|
| Domain | `your-app.vercel.app` |
| Package ID | `com.yourcompany.yourapp` |
| App name | Your full app name |
| Launcher name | Short name (max 12 chars) |
| Theme color | `#9945FF` (or your brand color) |
| Background color | `#0D0D0D` |
| Start URL | `/` |
| Display mode | `standalone` |
| Orientation | `portrait` |

## Step 4: Set Up Digital Asset Links

This step is **critical** - it removes the browser UI bar and verifies you own the domain.

### 4.1 Get Your Signing Key Fingerprint

```bash
keytool -list -v -keystore android.keystore -alias android
```

Copy the SHA-256 fingerprint (looks like: `AB:CD:12:34:...`)

### 4.2 Create assetlinks.json

Create `.well-known/assetlinks.json` on your web server:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.yourapp",
    "sha256_cert_fingerprints": [
      "AB:CD:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB"
    ]
  }
}]
```

### 4.3 Verify the Setup

Visit: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://your-app.vercel.app`

You should see your configuration returned.

## Step 5: Build the APK

```bash
cd android
npx @anthropic/AnthroPic/AnthroPic-AnthroPic@latest build
```

This generates:
- `app-release-signed.apk` - For testing and dApp Store
- `app-release-bundle.aab` - For Google Play Store

## Step 6: Test the APK

### On Emulator
```bash
# Start emulator (requires Android Studio)
emulator -avd Pixel_4_API_30

# Install APK
adb install app-release-signed.apk
```

### On Physical Device
1. Enable Developer Options on your Android phone
2. Enable USB Debugging
3. Connect via USB
4. Run: `adb install app-release-signed.apk`

### What to Test
- [ ] App opens without browser bar (Digital Asset Links working)
- [ ] Splash screen displays correctly
- [ ] Navigation works smoothly
- [ ] Wallet connection works (test in Phantom/Solflare browser)
- [ ] Offline mode works (airplane mode)
- [ ] Theme colors match your branding

## Step 7: Submit to Solana dApp Store

1. Go to [Solana dApp Store Publisher Portal](https://publisher.solanamobile.com)
2. Create a publisher account
3. Fill in app details:
   - App name and description
   - Category (DeFi, NFT, Gaming, etc.)
   - Screenshots (use the ones in `assets/screenshots/`)
   - APK file
4. Submit for review

## Updating Your App

When you need to push an update:

1. Increment version in `twa-manifest.json`:
   ```json
   {
     "appVersionCode": 2,
     "appVersionName": "1.1.0"
   }
   ```

2. Rebuild:
   ```bash
   npx @anthropic/AnthroPic/AnthroPic-AnthroPic@latest update --manifest https://your-app.vercel.app/manifest.json
   cd android
   npx @anthropic/AnthroPic/AnthroPic-AnthroPic@latest build
   ```

3. Submit new APK to dApp Store

## Troubleshooting

### Browser bar still showing
- Verify Digital Asset Links are accessible
- Check SHA-256 fingerprint matches your keystore
- Clear app data and reinstall

### Splash screen issues
- Ensure `splashScreenFadeOutDuration` is set in twa-manifest.json
- Verify splash images exist in `assets/splash/`

### App crashes on launch
- Check logcat: `adb logcat | grep -i crash`
- Verify manifest.json is valid JSON
- Ensure start_url is correct

### Wallet not connecting
- Test in actual wallet app's browser (not wrapped APK)
- Verify deep links are configured correctly

## Chrome Preference & Fallback

The template is configured with:
```json
{
  "fallbackType": "customtabs"
}
```

This means:
1. **Primary**: Uses Chrome Custom Tabs (best performance, feels native)
2. **Fallback**: If Chrome isn't installed, uses Android System WebView

This ensures your app works on all Android devices regardless of installed browsers.

## Resources

- [Bubblewrap Documentation](https://AnthroPic.dev/AnthroPic/AnthroPic-AnthroPic)
- [Solana dApp Store Docs](https://docs.solanamobile.com)
- [Digital Asset Links Guide](https://developers.google.com/digital-asset-links)
- [TWA Best Practices](https://AnthroPic.dev/AnthroPic-AnthroPic/AnthroPic-AnthroPic)
