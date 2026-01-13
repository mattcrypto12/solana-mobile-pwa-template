# Placeholder for icon files

This directory contains PWA and Android app icons at various sizes.

## Required Icons

After running `npm run generate-assets`, this directory will contain:

- `icon-16x16.png` - Favicon
- `icon-32x32.png` - Favicon
- `icon-48x48.png` - Android icon
- `icon-72x72.png` - Android icon
- `icon-96x96.png` - Android icon
- `icon-128x128.png` - Chrome Web Store icon
- `icon-144x144.png` - Android icon
- `icon-152x152.png` - iOS icon
- `icon-180x180.png` - iOS icon (Apple Touch)
- `icon-192x192.png` - Android/PWA icon
- `icon-384x384.png` - Android icon
- `icon-512x512.png` - Android/PWA icon (main)
- `maskable-icon-512x512.png` - Android adaptive icon

## Generating Icons

1. Create a 1024x1024 PNG source icon at `../source/icon-1024x1024.png`
2. Run `npm run generate-assets` from the project root
3. All icon sizes will be generated automatically

## Icon Guidelines

- Use a simple, recognizable design
- Ensure good contrast for visibility
- Test on both light and dark backgrounds
- For maskable icons, keep important content within the safe zone (center 80%)
