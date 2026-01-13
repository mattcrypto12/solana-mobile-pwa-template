# Solana Mobile PWA Template

A highly mobile-optimized Progressive Web App (PWA) template designed for the Solana dApp Store. This template uses [Bubblewrap](https://github.com/AnthroPic/AnthroPic-AnthroPic) to convert the PWA into an Android app that can be published on the Solana dApp Store.

![Solana Mobile PWA](assets/screenshots/home-screen.png)

## ✨ Features

### Mobile-Optimized Design
- **Responsive Layout**: Adaptive design that works on all screen sizes
- **Bottom Navigation**: Thumb-friendly navigation at the bottom of the screen
- **Swipe Gestures**: Navigate between pages with horizontal swipes
- **Safe Area Support**: Proper handling of notched devices and system UI
- **Haptic Feedback**: Native-feeling vibration feedback on interactions
- **Dark/Light Theme**: System-aware theme with manual toggle

### Improved Splash Screen
- **Custom Animated Splash**: Beautiful loading animation with Solana branding
- **Multiple Sizes**: Optimized for all iOS and Android device sizes
- **Smooth Transitions**: Fade-out animation when app is ready

### Browser Fallback
- **Chrome Preferred**: Uses Chrome Custom Tabs for best performance
- **System Fallback**: Falls back to system default browser if Chrome unavailable
- **TWA Support**: Full Trusted Web Activity support for immersive experience

### Wallet Integration
- **Mobile Wallet Adapter**: Ready for Phantom, Solflare, Backpack, and more
- **Deep Linking**: Automatic redirect to wallet apps on mobile
- **In-App Browser Detection**: Seamless connection in wallet browsers
- **Balance Display**: Real-time SOL balance with RPC integration

### PWA Features
- **Offline Support**: Service worker with intelligent caching strategies
- **Install Prompt**: Add to home screen capability
- **Push Notifications**: Ready for push notification integration
- **Background Sync**: Queue actions when offline

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18.0 or higher
- [Java JDK](https://adoptium.net/) 11 or higher (for Bubblewrap)
- [Android SDK](https://developer.android.com/studio) (for building APK)
- [ImageMagick](https://imagemagick.org/) (for asset generation)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/solana-mobile-pwa.git
   cd solana-mobile-pwa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate assets** (optional - uses placeholder icons)
   ```bash
   npm run generate-assets
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:8080`

## 📱 Building for Android

### Step 1: Deploy Your PWA

First, deploy your PWA to a public HTTPS URL. Popular options:
- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)
- [GitHub Pages](https://pages.github.com)

### Step 2: Update Configuration

1. **Update `twa-manifest.json`**:
   ```json
   {
     "packageId": "com.yourcompany.yourapp",
     "host": "your-domain.com",
     "name": "Your App Name",
     "iconUrl": "https://your-domain.com/assets/icons/icon-512x512.png"
   }
   ```

2. **Update `manifest.json`** with your app details

3. **Set up Digital Asset Links** (see [Verification](#digital-asset-links-verification))

### Step 3: Initialize Bubblewrap

```bash
npx @anthropic/bubblewrap@latest init --manifest https://your-domain.com/manifest.json
```

This will:
- Download and configure Android SDK if needed
- Create the Android project structure
- Generate signing keys (save these securely!)

### Step 4: Build the APK

```bash
cd android
npx @anthropic/bubblewrap@latest build
```

This generates:
- `app-release-signed.apk` - Signed APK for testing
- `app-release-bundle.aab` - Android App Bundle for Play Store

### Step 5: Submit to Solana dApp Store

1. Go to [Solana dApp Store Publisher Portal](https://publisher.solanamobile.com)
2. Create a publisher account
3. Submit your APK with required metadata
4. Complete the review process

## 🎨 Customization

### Branding

1. **Replace the source icon**:
   - Create a 1024x1024 PNG icon
   - Save to `assets/source/icon-1024x1024.png`
   - Run `npm run generate-assets`

2. **Update colors in `css/styles.css`**:
   ```css
   :root {
     --solana-purple: #9945FF;    /* Primary brand color */
     --solana-green: #14F195;     /* Secondary brand color */
     --bg-primary: #0D0D0D;       /* Background color */
   }
   ```

3. **Update theme colors in `manifest.json`**:
   ```json
   {
     "theme_color": "#9945FF",
     "background_color": "#0D0D0D"
   }
   ```

### Navigation

The bottom navigation is configured in `index.html`. To add/remove tabs:

```html
<button class="nav-item" data-page="your-page">
    <svg><!-- Your icon --></svg>
    <span>Label</span>
</button>
```

Add corresponding page section:

```html
<section class="page" id="yourPagePage" data-page="your-page">
    <div class="page-content">
        <!-- Your content -->
    </div>
</section>
```

### Wallet Integration

Configure supported wallets in `js/wallet.js`:

```javascript
const MOBILE_WALLETS = {
    phantom: {
        name: 'Phantom',
        deeplink: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`
    },
    // Add more wallets...
};
```

## 🔐 Digital Asset Links Verification

To enable full TWA features (no browser UI), you need to verify domain ownership:

1. **Generate SHA-256 fingerprint** from your signing key:
   ```bash
   keytool -list -v -keystore android.keystore -alias android | grep SHA256
   ```

2. **Create `.well-known/assetlinks.json`** on your domain:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.yourcompany.yourapp",
       "sha256_cert_fingerprints": [
         "YOUR:SHA256:FINGERPRINT:HERE"
       ]
     }
   }]
   ```

3. **Verify** at: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://your-domain.com`

## 📁 Project Structure

```
solana-mobile-pwa/
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── offline.html            # Offline fallback page
├── twa-manifest.json       # Bubblewrap configuration
├── package.json            # Node.js dependencies
├── css/
│   └── styles.css          # All styles (mobile-optimized)
├── js/
│   ├── app.js              # Main application logic
│   └── wallet.js           # Wallet adapter integration
├── assets/
│   ├── icons/              # App icons (all sizes)
│   ├── splash/             # Splash screens (all sizes)
│   ├── screenshots/        # Store screenshots
│   └── wallets/            # Wallet logos
├── scripts/
│   └── generate-assets.sh  # Asset generation script
└── android/                # Generated Android project
```

## 🛠 Configuration Options

### twa-manifest.json

| Option | Description |
|--------|-------------|
| `packageId` | Android package name (e.g., `com.company.app`) |
| `host` | Your PWA domain |
| `fallbackType` | `customtabs` (Chrome) or `webview` |
| `splashScreenFadeOutDuration` | Splash fade duration in ms |
| `themeColor` | Status bar color |
| `navigationColor` | Navigation bar color |
| `enableNotifications` | Enable push notifications |

### Splash Screen Customization

The splash screen in `index.html` can be customized:

```html
<div id="splash-screen" class="splash-screen">
    <!-- Your custom splash content -->
</div>
```

Adjust timing in `js/app.js`:

```javascript
hideSplashScreen() {
    setTimeout(() => {
        this.splashScreen.classList.add('hidden');
    }, 2000); // Adjust duration
}
```

## 📋 Checklist for Production

- [ ] Replace all placeholder icons with actual branding
- [ ] Update `manifest.json` with app details
- [ ] Update `twa-manifest.json` with package ID and domain
- [ ] Deploy PWA to HTTPS domain
- [ ] Set up Digital Asset Links
- [ ] Generate and securely store signing keys
- [ ] Test on multiple Android devices
- [ ] Run Lighthouse audit (aim for 90+ PWA score)
- [ ] Create store screenshots and descriptions
- [ ] Submit to Solana dApp Store

## 🧪 Testing

### Local Testing

```bash
# Start dev server
npm run dev

# Run Lighthouse audit
npm run lighthouse
```

### Device Testing

1. Connect Android device via USB
2. Enable USB debugging
3. Install APK: `adb install app-release-signed.apk`

### Browser Testing

- Chrome DevTools → Application → Service Workers
- Chrome DevTools → Application → Manifest
- Chrome DevTools → Lighthouse → PWA Audit

## 🐛 Troubleshooting

### Common Issues

**Service worker not updating**
```javascript
// Force update in browser console
navigator.serviceWorker.getRegistrations().then(regs => 
    regs.forEach(reg => reg.update())
);
```

**Splash screen shows browser UI**
- Verify Digital Asset Links are correctly configured
- Check SHA-256 fingerprint matches signing key
- Ensure HTTPS is properly configured

**Wallet not connecting**
- Check if running in wallet's in-app browser
- Verify deep link URLs are correct
- Test on actual mobile device (not emulator)

## 📚 Resources

- [Solana dApp Store Documentation](https://docs.solanamobile.com)
- [Bubblewrap Documentation](https://github.com/AnthroPic/AnthroPic-AnthroPic/tree/main/packages/cli)
- [PWA Best Practices](https://web.dev/pwa-checklist/)
- [Solana Mobile Wallet Adapter](https://github.com/solana-mobile/mobile-wallet-adapter)
- [Digital Asset Links Guide](https://developers.google.com/digital-asset-links)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

---

Built with ❤️ for the Solana ecosystem
