#!/bin/bash

# ============================================================================
# Solana Mobile PWA - Icon & Splash Screen Generator
# ============================================================================
# This script generates all required icon and splash screen sizes from source
# images. Requires ImageMagick to be installed.
#
# Usage: ./scripts/generate-assets.sh
# ============================================================================

set -e

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is required but not installed."
    echo "   Install with: brew install imagemagick"
    exit 1
fi

echo "🎨 Generating PWA assets..."

# Create directories
mkdir -p assets/icons
mkdir -p assets/splash
mkdir -p assets/screenshots
mkdir -p assets/wallets

# Source icon path (create a 1024x1024 source icon)
SOURCE_ICON="assets/source/icon-1024x1024.png"
SOURCE_SPLASH="assets/source/splash-center.png"

# Check if source icon exists, if not create a placeholder
if [ ! -f "$SOURCE_ICON" ]; then
    mkdir -p assets/source
    echo "📝 Creating placeholder source icon..."
    
    # Create a gradient icon with Solana colors
    convert -size 1024x1024 \
        -define gradient:angle=135 \
        gradient:'#9945FF-#14F195' \
        -gravity center \
        -font Helvetica-Bold -pointsize 400 \
        -fill white -annotate +0+50 'S' \
        "$SOURCE_ICON"
fi

# Icon sizes for PWA and Android
ICON_SIZES=(16 32 48 72 96 128 144 152 180 192 384 512)

echo "📱 Generating icon sizes..."
for size in "${ICON_SIZES[@]}"; do
    convert "$SOURCE_ICON" \
        -resize "${size}x${size}" \
        -quality 100 \
        "assets/icons/icon-${size}x${size}.png"
    echo "   ✓ icon-${size}x${size}.png"
done

# Generate maskable icon (with safe zone padding)
echo "🎭 Generating maskable icons..."
convert "$SOURCE_ICON" \
    -resize 410x410 \
    -gravity center \
    -background '#9945FF' \
    -extent 512x512 \
    "assets/icons/maskable-icon-512x512.png"
echo "   ✓ maskable-icon-512x512.png"

# Generate shortcut icons
echo "🔗 Generating shortcut icons..."
for action in send receive; do
    convert "$SOURCE_ICON" \
        -resize 96x96 \
        "assets/icons/shortcut-${action}.png"
    echo "   ✓ shortcut-${action}.png"
done

# Generate badge icon for notifications
convert "$SOURCE_ICON" \
    -resize 72x72 \
    "assets/icons/badge-72x72.png"
echo "   ✓ badge-72x72.png"

# Splash screen sizes for iOS
echo "💦 Generating splash screens..."

SPLASH_SIZES=(
    "640x1136"
    "750x1334"
    "828x1792"
    "1125x2436"
    "1242x2208"
    "1242x2688"
    "1536x2048"
    "1668x2388"
    "2048x2732"
)

# Background color for splash screens
SPLASH_BG="#0D0D0D"

for size in "${SPLASH_SIZES[@]}"; do
    width=$(echo $size | cut -d'x' -f1)
    height=$(echo $size | cut -d'x' -f2)
    
    # Calculate logo size (20% of smaller dimension)
    if [ $width -lt $height ]; then
        logo_size=$((width / 5))
    else
        logo_size=$((height / 5))
    fi
    
    convert -size "${width}x${height}" xc:"$SPLASH_BG" \
        \( "$SOURCE_ICON" -resize "${logo_size}x${logo_size}" \) \
        -gravity center -composite \
        "assets/splash/splash-${size}.png"
    echo "   ✓ splash-${size}.png"
done

# Create Android splash (512x512 center logo)
convert "$SOURCE_ICON" \
    -resize 512x512 \
    "assets/splash/splash-512x512.png"
echo "   ✓ splash-512x512.png (Android)"

# Generate placeholder screenshots
echo "📸 Generating placeholder screenshots..."

# Home screen screenshot
convert -size 1080x1920 xc:"$SPLASH_BG" \
    -fill '#1A1A1A' -draw "roundrectangle 40,150 1040,500 20,20" \
    -fill '#252525' -draw "roundrectangle 40,550 255,750 15,15" \
    -fill '#252525' -draw "roundrectangle 290,550 505,750 15,15" \
    -fill '#252525' -draw "roundrectangle 540,550 755,750 15,15" \
    -fill '#252525' -draw "roundrectangle 790,550 1005,750 15,15" \
    -fill '#1E1E1E' -draw "roundrectangle 40,800 1040,1700 15,15" \
    -fill '#1A1A1A' -draw "rectangle 0,1800 1080,1920" \
    "assets/screenshots/home-screen.png"
echo "   ✓ home-screen.png"

# Explore screen screenshot
convert -size 1080x1920 xc:"$SPLASH_BG" \
    -fill '#1E1E1E' -draw "roundrectangle 40,150 1040,230 15,15" \
    -fill '#252525' -draw "roundrectangle 40,280 160,330 20,20" \
    -fill '#9945FF' -draw "roundrectangle 180,280 260,330 20,20" \
    -fill '#252525' -draw "roundrectangle 280,280 360,330 20,20" \
    -fill '#252525' -draw "roundrectangle 380,280 460,330 20,20" \
    -fill '#1E1E1E' -draw "roundrectangle 40,380 1040,500 15,15" \
    -fill '#1E1E1E' -draw "roundrectangle 40,520 1040,640 15,15" \
    -fill '#1E1E1E' -draw "roundrectangle 40,660 1040,780 15,15" \
    -fill '#1E1E1E' -draw "roundrectangle 40,800 1040,920 15,15" \
    -fill '#1A1A1A' -draw "rectangle 0,1800 1080,1920" \
    "assets/screenshots/explore-screen.png"
echo "   ✓ explore-screen.png"

# Create wallet icons (placeholders)
echo "💰 Creating wallet icon placeholders..."
for wallet in phantom solflare backpack; do
    convert -size 80x80 xc:'#252525' \
        -fill white -gravity center \
        -font Helvetica-Bold -pointsize 32 \
        -annotate +0+0 "$(echo ${wallet:0:1} | tr '[:lower:]' '[:upper:]')" \
        -draw "roundrectangle 0,0 80,80 16,16" \
        "assets/wallets/${wallet}.png"
    echo "   ✓ ${wallet}.png"
done

echo ""
echo "✅ Asset generation complete!"
echo ""
echo "📋 Generated assets:"
echo "   - ${#ICON_SIZES[@]} icon sizes"
echo "   - ${#SPLASH_SIZES[@]} splash screen sizes"
echo "   - 2 screenshot placeholders"
echo "   - 3 wallet icons"
echo ""
echo "🎯 Next steps:"
echo "   1. Replace placeholder icons with your actual branding"
echo "   2. Update screenshots with real app screenshots"
echo "   3. Replace wallet icons with official wallet logos"
