/**
 * Solana Mobile PWA - Main Application
 * A mobile-optimized Progressive Web App template for Solana dApp Store
 */

// ==========================================================================
// App Initialization
// ==========================================================================

class SolanaMobilePWA {
    constructor() {
        this.currentPage = 'home';
        this.isWalletConnected = false;
        this.walletAddress = null;
        this.balance = null;
        
        // Touch handling for swipe gestures
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        // Haptic feedback support
        this.hapticEnabled = true;
        
        this.init();
    }
    
    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        this.cacheElements();
        this.bindEvents();
        this.initializeSettings();
        this.registerServiceWorker();
        this.hideSplashScreen();
    }
    
    cacheElements() {
        // Splash screen
        this.splashScreen = document.getElementById('splash-screen');
        this.appContainer = document.getElementById('app');
        
        // Navigation
        this.bottomNav = document.getElementById('bottomNav');
        this.pageContainer = document.getElementById('pageContainer');
        this.pages = document.querySelectorAll('.page');
        this.navItems = document.querySelectorAll('.nav-item');
        
        // Header
        this.menuBtn = document.getElementById('menuBtn');
        this.walletBtn = document.getElementById('walletBtn');
        
        // Drawer
        this.sideDrawer = document.getElementById('sideDrawer');
        this.drawerOverlay = document.getElementById('drawerOverlay');
        this.closeDrawer = document.getElementById('closeDrawer');
        
        // Wallet
        this.connectWalletBtn = document.getElementById('connectWalletBtn');
        this.walletStatus = document.getElementById('walletStatus');
        this.balanceValue = document.getElementById('balanceValue');
        
        // Settings
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.hapticToggle = document.getElementById('hapticToggle');
        this.notificationsToggle = document.getElementById('notificationsToggle');
        
        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
    }
    
    bindEvents() {
        // Bottom navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });
        
        // Menu drawer
        this.menuBtn.addEventListener('click', () => this.openDrawer());
        this.closeDrawer.addEventListener('click', () => this.closeDrawerMenu());
        this.drawerOverlay.addEventListener('click', () => this.closeDrawerMenu());
        
        // Wallet
        this.walletBtn.addEventListener('click', () => this.handleWalletClick());
        this.connectWalletBtn.addEventListener('click', () => this.connectWallet());
        
        // Quick actions
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => this.handleQuickAction(e));
        });
        
        // Category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleCategoryChange(e));
        });
        
        // Settings toggles
        this.darkModeToggle.addEventListener('change', (e) => this.toggleDarkMode(e));
        this.hapticToggle.addEventListener('change', (e) => this.toggleHaptic(e));
        this.notificationsToggle.addEventListener('change', (e) => this.toggleNotifications(e));
        
        // View source
        document.getElementById('viewSourceBtn').addEventListener('click', () => {
            window.open('https://github.com/solana-mobile/pwa-template', '_blank');
        });
        
        // Swipe gestures for page navigation
        this.pageContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.pageContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        
        // Handle back button for drawer
        window.addEventListener('popstate', () => {
            if (this.sideDrawer.classList.contains('active')) {
                this.closeDrawerMenu();
            }
        });
        
        // Handle keyboard for accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDrawerMenu();
            }
        });
    }
    
    // ==========================================================================
    // Navigation
    // ==========================================================================
    
    handleNavigation(e) {
        const targetPage = e.currentTarget.dataset.page;
        
        if (targetPage === this.currentPage) return;
        
        this.triggerHaptic('light');
        this.navigateToPage(targetPage);
    }
    
    navigateToPage(pageName) {
        // Update nav items
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });
        
        // Animate page transition
        const currentPageEl = document.querySelector('.page.active');
        const targetPageEl = document.getElementById(`${pageName}Page`);
        
        if (currentPageEl) {
            currentPageEl.classList.remove('active');
        }
        
        if (targetPageEl) {
            targetPageEl.classList.add('active');
            // Scroll to top of new page
            targetPageEl.scrollTop = 0;
        }
        
        this.currentPage = pageName;
    }
    
    // ==========================================================================
    // Swipe Gestures
    // ==========================================================================
    
    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
    }
    
    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipeGesture();
    }
    
    handleSwipeGesture() {
        const threshold = 100;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) < threshold) return;
        
        const pages = ['home', 'explore', 'nft', 'settings'];
        const currentIndex = pages.indexOf(this.currentPage);
        
        if (diff > 0 && currentIndex < pages.length - 1) {
            // Swipe left - next page
            this.triggerHaptic('light');
            this.navigateToPage(pages[currentIndex + 1]);
        } else if (diff < 0 && currentIndex > 0) {
            // Swipe right - previous page
            this.triggerHaptic('light');
            this.navigateToPage(pages[currentIndex - 1]);
        }
    }
    
    // ==========================================================================
    // Drawer
    // ==========================================================================
    
    openDrawer() {
        this.triggerHaptic('medium');
        this.sideDrawer.classList.add('active');
        this.drawerOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Add history state for back button handling
        history.pushState({ drawer: true }, '');
    }
    
    closeDrawerMenu() {
        this.sideDrawer.classList.remove('active');
        this.drawerOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // ==========================================================================
    // Wallet Connection
    // ==========================================================================
    
    handleWalletClick() {
        if (this.isWalletConnected) {
            this.showWalletOptions();
        } else {
            this.connectWallet();
        }
    }
    
    async connectWallet() {
        this.triggerHaptic('medium');
        
        try {
            // Check if we're in a mobile wallet browser
            if (this.isMobileWalletBrowser()) {
                await this.connectWithMobileWallet();
            } else if (window.solana) {
                await this.connectWithBrowserWallet();
            } else {
                // Show mobile wallet options
                this.showMobileWalletPrompt();
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            this.showToast('Failed to connect wallet', 'error');
        }
    }
    
    isMobileWalletBrowser() {
        // Check if running inside a mobile wallet's in-app browser
        const userAgent = navigator.userAgent.toLowerCase();
        return userAgent.includes('phantom') || 
               userAgent.includes('solflare') ||
               userAgent.includes('backpack') ||
               window.phantom?.solana?.isPhantom ||
               window.solflare?.isSolflare;
    }
    
    async connectWithMobileWallet() {
        // Mobile Wallet Adapter connection
        try {
            const provider = window.phantom?.solana || window.solflare || window.solana;
            
            if (provider) {
                const response = await provider.connect();
                this.walletAddress = response.publicKey.toString();
                this.isWalletConnected = true;
                this.updateWalletUI();
                this.showToast('Wallet connected!', 'success');
                
                // Fetch balance
                this.fetchBalance();
            }
        } catch (error) {
            throw error;
        }
    }
    
    async connectWithBrowserWallet() {
        const provider = window.solana;
        
        if (!provider?.isPhantom) {
            throw new Error('No compatible wallet found');
        }
        
        const response = await provider.connect();
        this.walletAddress = response.publicKey.toString();
        this.isWalletConnected = true;
        this.updateWalletUI();
        this.showToast('Wallet connected!', 'success');
        
        // Fetch balance
        this.fetchBalance();
    }
    
    showMobileWalletPrompt() {
        // For mobile users without a wallet, suggest mobile wallet apps
        const message = 'Please install a Solana wallet like Phantom or Solflare to connect.';
        this.showToast(message, 'info');
        
        // You could also show a modal with wallet app links
        // For now, we'll simulate a connection for demo purposes
        this.simulateConnection();
    }
    
    simulateConnection() {
        // Demo mode - simulate wallet connection
        setTimeout(() => {
            this.walletAddress = 'Demo...Address';
            this.isWalletConnected = true;
            this.balance = 2.5;
            this.updateWalletUI();
            this.showToast('Demo wallet connected!', 'success');
        }, 1000);
    }
    
    updateWalletUI() {
        const statusIndicator = this.walletStatus.querySelector('.status-indicator');
        const statusText = this.walletStatus.querySelector('span');
        
        if (this.isWalletConnected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('disconnected');
            statusText.textContent = this.truncateAddress(this.walletAddress);
            this.connectWalletBtn.querySelector('span').textContent = 'View Wallet';
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Wallet Not Connected';
            this.connectWalletBtn.querySelector('span').textContent = 'Connect Wallet';
        }
        
        this.updateBalanceDisplay();
    }
    
    updateBalanceDisplay() {
        if (this.balance !== null) {
            this.balanceValue.textContent = `${this.balance.toFixed(4)} SOL`;
        } else {
            this.balanceValue.textContent = '-- SOL';
        }
    }
    
    async fetchBalance() {
        // In a real app, fetch balance from RPC
        // For demo, use simulated balance
        this.balance = 2.5;
        this.updateBalanceDisplay();
    }
    
    truncateAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    
    showWalletOptions() {
        // Could show a bottom sheet with wallet options
        this.showToast(`Wallet: ${this.truncateAddress(this.walletAddress)}`, 'info');
    }
    
    // ==========================================================================
    // Quick Actions
    // ==========================================================================
    
    handleQuickAction(e) {
        const action = e.currentTarget.dataset.action;
        this.triggerHaptic('light');
        
        if (!this.isWalletConnected) {
            this.showToast('Please connect wallet first', 'info');
            return;
        }
        
        switch (action) {
            case 'send':
                this.showToast('Send feature coming soon', 'info');
                break;
            case 'receive':
                this.showToast('Receive feature coming soon', 'info');
                break;
            case 'swap':
                this.showToast('Swap feature coming soon', 'info');
                break;
            case 'stake':
                this.showToast('Stake feature coming soon', 'info');
                break;
        }
    }
    
    // ==========================================================================
    // Category Tabs
    // ==========================================================================
    
    handleCategoryChange(e) {
        const category = e.currentTarget.dataset.category;
        this.triggerHaptic('light');
        
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        // Filter dApps based on category
        // In a real app, this would filter the dapp list
    }
    
    // ==========================================================================
    // Settings
    // ==========================================================================
    
    initializeSettings() {
        // Load saved settings
        const savedTheme = localStorage.getItem('theme') || 'dark';
        const savedHaptic = localStorage.getItem('hapticEnabled') !== 'false';
        
        // Apply theme
        if (savedTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            this.darkModeToggle.checked = false;
        } else {
            this.darkModeToggle.checked = true;
        }
        
        // Apply haptic setting
        this.hapticEnabled = savedHaptic;
        this.hapticToggle.checked = savedHaptic;
    }
    
    toggleDarkMode(e) {
        const isDark = e.target.checked;
        this.triggerHaptic('light');
        
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }
    
    toggleHaptic(e) {
        this.hapticEnabled = e.target.checked;
        localStorage.setItem('hapticEnabled', this.hapticEnabled);
        
        if (this.hapticEnabled) {
            this.triggerHaptic('medium');
        }
    }
    
    toggleNotifications(e) {
        const enabled = e.target.checked;
        this.triggerHaptic('light');
        
        if (enabled && 'Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission !== 'granted') {
                    e.target.checked = false;
                    this.showToast('Notification permission denied', 'error');
                }
            });
        }
    }
    
    // ==========================================================================
    // Haptic Feedback
    // ==========================================================================
    
    triggerHaptic(intensity = 'light') {
        if (!this.hapticEnabled) return;
        
        // Use Vibration API if available
        if ('vibrate' in navigator) {
            switch (intensity) {
                case 'light':
                    navigator.vibrate(10);
                    break;
                case 'medium':
                    navigator.vibrate(25);
                    break;
                case 'heavy':
                    navigator.vibrate(50);
                    break;
            }
        }
    }
    
    // ==========================================================================
    // Toast Notifications
    // ==========================================================================
    
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));
        
        this.toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => this.removeToast(toast), duration);
    }
    
    removeToast(toast) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }
    
    // ==========================================================================
    // Splash Screen
    // ==========================================================================
    
    hideSplashScreen() {
        // Wait for splash animation to complete
        setTimeout(() => {
            this.splashScreen.classList.add('hidden');
            this.appContainer.classList.add('visible');
        }, 2000);
    }
    
    // ==========================================================================
    // Service Worker
    // ==========================================================================
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration.scope);
                
                // Handle updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('New version available! Refresh to update.', 'info');
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
}

// ==========================================================================
// Initialize App
// ==========================================================================

const app = new SolanaMobilePWA();

// Export for use in other modules
export default app;
