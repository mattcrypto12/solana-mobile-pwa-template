# Placeholder for splash screen files

This directory contains splash screen images for iOS and Android.

## Required Splash Screens

After running `npm run generate-assets`, this directory will contain:

### iOS Splash Screens
- `splash-640x1136.png` - iPhone 5/SE
- `splash-750x1334.png` - iPhone 8/SE 2nd gen
- `splash-828x1792.png` - iPhone XR/11
- `splash-1125x2436.png` - iPhone X/XS/11 Pro
- `splash-1242x2208.png` - iPhone 8 Plus
- `splash-1242x2688.png` - iPhone XS Max/11 Pro Max
- `splash-1536x2048.png` - iPad (portrait)
- `splash-1668x2388.png` - iPad Pro 11"
- `splash-2048x2732.png` - iPad Pro 12.9"

### Android Splash Screen
- `splash-512x512.png` - Center logo for Bubblewrap

## Customization

The splash screens are generated with:
- Dark background (#0D0D0D)
- Centered app logo (20% of screen width)
- Solana gradient branding

To customize:
1. Edit the colors in `scripts/generate-assets.sh`
2. Replace the source icon
3. Re-run `npm run generate-assets`
