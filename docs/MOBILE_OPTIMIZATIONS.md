# Mobile Optimization Guide

This document details all the mobile optimizations included in this PWA template.

## 1. Improved Splash Screen Styling

### Web Splash Screen (in-app)
Located in `index.html`:
- Animated Solana logo with gradient colors
- Smooth fade-in animation
- Loading progress bar
- Automatic fade-out when app is ready

```html
<div id="splash-screen" class="splash-screen">
    <div class="splash-content">
        <div class="splash-logo"><!-- Animated SVG --></div>
        <div class="splash-text">
            <h1>Solana Mobile</h1>
            <p>PWA Template</p>
        </div>
        <div class="splash-loader">
            <div class="loader-bar"></div>
        </div>
    </div>
</div>
```

### iOS Splash Screens
Meta tags in `index.html` for all iOS device sizes:
- iPhone SE to iPhone Pro Max
- iPad to iPad Pro 12.9"

### Android Splash Screen (TWA)
Configured in `twa-manifest.json`:
```json
{
  "splashScreenFadeOutDuration": 300,
  "backgroundColor": "#0D0D0D"
}
```

Generated splash images in `assets/splash/` for all sizes.

## 2. Chrome Browser Default with Fallback

Configured in `twa-manifest.json`:

```json
{
  "fallbackType": "customtabs"
}
```

### How it works:
1. **Chrome Custom Tabs** (primary): Uses Chrome's rendering engine with native Android integration. Provides best performance and modern web features.

2. **System WebView** (fallback): If Chrome isn't available, automatically uses Android System WebView. Ensures compatibility on all devices.

### Benefits:
- Faster page loads than WebView
- Shared cookies/sessions with Chrome
- Better JavaScript performance
- Automatic security updates via Chrome

## 3. Mobile-Intuitive Navigation

### Bottom Tab Navigation
Located at bottom of screen for thumb accessibility:

```css
.bottom-nav {
    position: fixed;
    bottom: 0;
    height: 72px; /* Comfortable touch target */
    padding-bottom: env(safe-area-inset-bottom);
}
```

Features:
- Active state indicator with gradient
- Icon + label for clarity
- Scale animation on tap
- 4 main sections: Home, Explore, NFTs, Settings

### Swipe Gesture Navigation
Horizontal swipe to navigate between pages:

```javascript
handleSwipeGesture() {
    const threshold = 100; // pixels
    const diff = this.touchStartX - this.touchEndX;
    
    if (diff > threshold) {
        // Swipe left - next page
        this.navigateToPage(pages[currentIndex + 1]);
    } else if (diff < -threshold) {
        // Swipe right - previous page
        this.navigateToPage(pages[currentIndex - 1]);
    }
}
```

### Side Drawer Menu
Slide-out menu for secondary navigation:
- Overlay background dims content
- Touch outside to close
- Back button support
- Smooth slide animation

## 4. Mobile-Intuitive Layouts

### Touch Target Sizes
All interactive elements meet 48dp minimum:

```css
.action-card {
    padding: 16px;
    min-height: 48px;
}

.nav-item {
    min-width: 48px;
    min-height: 48px;
}
```

### Safe Area Insets
Support for notched devices (iPhone X+, etc.):

```css
:root {
    --safe-area-top: env(safe-area-inset-top, 0px);
    --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

.app-header {
    padding-top: var(--safe-area-top);
}

.bottom-nav {
    padding-bottom: var(--safe-area-bottom);
}
```

### Viewport Configuration
Prevents unwanted zoom and handles notches:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

### Pull-to-Refresh Prevention
Prevents accidental navigation on Android:

```css
body {
    overscroll-behavior-y: contain;
}
```

### Responsive Grid Layouts
Adaptive layouts based on screen size:

```css
.action-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 360px) {
    .action-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

## 5. Additional Mobile Optimizations

### Haptic Feedback
Native-feeling vibration on interactions:

```javascript
triggerHaptic(intensity = 'light') {
    if ('vibrate' in navigator) {
        switch (intensity) {
            case 'light': navigator.vibrate(10); break;
            case 'medium': navigator.vibrate(25); break;
            case 'heavy': navigator.vibrate(50); break;
        }
    }
}
```

### Touch Feedback
Visual feedback on all interactive elements:

```css
.action-card:active {
    transform: scale(0.95);
    background: var(--bg-tertiary);
}

button:active {
    opacity: 0.9;
}
```

### Hidden Scrollbars
Cleaner look while maintaining scroll functionality:

```css
.page {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.page::-webkit-scrollbar {
    display: none;
}
```

### Smooth Scrolling
Native-like scroll behavior:

```css
.page {
    -webkit-overflow-scrolling: touch;
}

html {
    scroll-behavior: smooth;
}
```

### Input Zoom Prevention
Prevents iOS zoom on input focus:

```css
input, textarea {
    font-size: 16px; /* >= 16px prevents zoom */
}
```

### Tap Highlight Removal
Removes default blue highlight on Android:

```css
button, a {
    -webkit-tap-highlight-color: transparent;
}
```

### Dark Mode Support
System-aware theming with manual toggle:

```css
:root {
    /* Dark theme (default) */
    --bg-primary: #0D0D0D;
    --text-primary: #FFFFFF;
}

[data-theme="light"] {
    --bg-primary: #FFFFFF;
    --text-primary: #1A1A1A;
}
```

### Reduced Motion Support
Respects user accessibility preferences:

```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

### Landscape Mode Handling
Adaptive layout for landscape orientation:

```css
@media (orientation: landscape) and (max-height: 500px) {
    .bottom-nav {
        --bottom-nav-height: 56px;
    }
    .nav-item span {
        display: none; /* Icons only in landscape */
    }
}
```

## Performance Optimizations

### Service Worker Caching
Multiple caching strategies for optimal performance:
- **Cache-first**: Static assets (images, CSS, JS)
- **Network-first**: HTML pages
- **Stale-while-revalidate**: Dynamic content

### Lazy Loading
Images and non-critical resources load on demand.

### Minimal Dependencies
No external frameworks - pure vanilla JS/CSS for smallest bundle size.

## Testing Mobile Optimizations

### Chrome DevTools
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M)
3. Select mobile device preset
4. Test touch events with mouse

### Real Device Testing
Access via local network IP:
```
http://192.168.x.x:8080
```

### Lighthouse Audit
Run PWA audit to verify optimizations:
```bash
npm run lighthouse
```
