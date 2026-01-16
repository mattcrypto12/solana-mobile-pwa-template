/**
 * Solana Mobile PWA - Main Application
 * 
 * A mobile-optimized Progressive Web App template for Solana dApp Store.
 * This template demonstrates best practices for building PWAs that work
 * seamlessly with Solana mobile wallets via Mobile Wallet Adapter (MWA).
 * 
 * Features:
 * - Mobile Wallet Adapter (MWA) integration for native wallet connections
 * - Injected provider support for in-app wallet browsers
 * - Swipe gestures for navigation
 * - Haptic feedback for touch interactions
 * - Dark/light theme support
 * - Offline-capable via service worker
 * 
 * @see https://docs.solanamobile.com for MWA documentation
 */

// ==========================================================================
// App Initialization
// ==========================================================================

/**
 * Main application class handling all UI interactions and wallet connections.
 */
class SolanaMobilePWA {
    constructor() {
        // Navigation state
        this.currentPage = 'home';
        
        // Wallet connection state
        this.isWalletConnected = false;
        this.walletAddress = null;  // Base58-encoded public key
        this.balance = null;        // Balance in SOL (not lamports)
        
        // Touch handling for swipe gestures
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        // Haptic feedback support (vibration API)
        this.hapticEnabled = true;
        
        this.init();
    }
    
    /**
     * Initializes the app, waiting for DOM if necessary.
     */
    async init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    /**
     * Main setup function called after DOM is ready.
     * Caches DOM elements, binds events, and initializes features.
     */
    setup() {
        this.cacheElements();
        this.bindEvents();
        this.initializeSettings();
        this.registerServiceWorker();
        this.checkForWalletProvider();
        this.hideSplashScreen();
    }
    
    /**
     * Checks if we're running inside a wallet's in-app browser (e.g., Phantom app).
     * If so, shows a prompt to connect since the wallet is already available.
     */
    async checkForWalletProvider() {
        // Wait for wallet providers to inject their APIs
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (typeof getInjectedProvider === 'function') {
            const injected = getInjectedProvider();
            if (injected) {
                // We're in a wallet browser! Show a connect prompt
                this.showToast(`${injected.name} detected! Tap Connect Wallet to continue.`, 'info');
            }
        }
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
        // Show wallet options modal with deep links to wallet apps
        this.showWalletSelectionModal();
    }
    
    showWalletSelectionModal() {
        // Remove existing modal if present
        const existing = document.getElementById('wallet-selection-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'wallet-selection-modal';
        modal.innerHTML = `
            <div class="wallet-modal-overlay">
                <div class="wallet-modal-content">
                    <div class="wallet-modal-header">
                        <h3>Connect Wallet</h3>
                        <button class="wallet-modal-close-btn" aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <p class="wallet-modal-description">Select a wallet to connect to this dApp</p>
                    
                    <div class="wallet-options-list">
                        <button class="wallet-option-btn" data-wallet="phantom">
                            <img src="assets/wallets/phantom.svg" alt="Phantom" class="wallet-option-icon" onerror="this.style.display='none'" />
                            <div class="wallet-option-info">
                                <span class="wallet-option-name">Phantom</span>
                                <span class="wallet-option-desc">Popular Solana wallet</span>
                            </div>
                            <svg class="wallet-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </button>
                        
                        <button class="wallet-option-btn" data-wallet="solflare">
                            <img src="assets/wallets/solflare.svg" alt="Solflare" class="wallet-option-icon" onerror="this.style.display='none'" />
                            <div class="wallet-option-info">
                                <span class="wallet-option-name">Solflare</span>
                                <span class="wallet-option-desc">Full-featured wallet</span>
                            </div>
                            <svg class="wallet-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </button>
                        
                        <button class="wallet-option-btn" data-wallet="backpack">
                            <img src="assets/wallets/backpack.svg" alt="Backpack" class="wallet-option-icon" onerror="this.style.display='none'" />
                            <div class="wallet-option-info">
                                <span class="wallet-option-name">Backpack</span>
                                <span class="wallet-option-desc">xNFT wallet</span>
                            </div>
                            <svg class="wallet-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </button>
                        
                        <button class="wallet-option-btn mwa-option" data-wallet="mwa">
                            <div class="wallet-option-icon mwa-icon">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="url(#mwaGrad)" stroke-width="2"/>
                                    <path d="M8 12h8M12 8v8" stroke="url(#mwaGrad)" stroke-width="2" stroke-linecap="round"/>
                                    <defs>
                                        <linearGradient id="mwaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style="stop-color:#9945FF"/>
                                            <stop offset="100%" style="stop-color:#14F195"/>
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <div class="wallet-option-info">
                                <span class="wallet-option-name">Mobile Wallet</span>
                                <span class="wallet-option-desc">For Seeker & Android wallets</span>
                            </div>
                            <svg class="wallet-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="wallet-modal-footer">
                        <p class="wallet-footer-text">New to Solana? <a href="https://phantom.app/download" target="_blank" rel="noopener">Get a wallet</a></p>
                        <button class="wallet-demo-btn">Try Demo Mode</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal styles
        const style = document.createElement('style');
        style.id = 'wallet-modal-styles';
        style.textContent = `
            .wallet-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .wallet-modal-content {
                background: linear-gradient(180deg, #1E1E2E 0%, #13131D 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px 24px 0 0;
                padding: 24px;
                width: 100%;
                max-width: 420px;
                max-height: 85vh;
                overflow-y: auto;
                animation: slideUp 0.3s ease;
            }
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            .wallet-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .wallet-modal-header h3 {
                margin: 0;
                color: #fff;
                font-size: 20px;
                font-weight: 600;
            }
            .wallet-modal-close-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 12px;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                cursor: pointer;
                transition: background 0.2s;
            }
            .wallet-modal-close-btn:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            .wallet-modal-description {
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 24px;
                font-size: 14px;
            }
            .wallet-options-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 20px;
            }
            .wallet-option-btn {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                width: 100%;
                text-align: left;
            }
            .wallet-option-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(153, 69, 255, 0.5);
                transform: translateY(-2px);
            }
            .wallet-option-btn:active {
                transform: translateY(0);
            }
            .wallet-option-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                object-fit: cover;
            }
            .wallet-option-icon.mwa-icon {
                background: linear-gradient(135deg, rgba(153, 69, 255, 0.2), rgba(20, 241, 149, 0.2));
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .wallet-option-icon.mwa-icon svg {
                width: 32px;
                height: 32px;
            }
            .wallet-option-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .wallet-option-name {
                color: #fff;
                font-weight: 600;
                font-size: 16px;
            }
            .wallet-option-desc {
                color: rgba(255, 255, 255, 0.5);
                font-size: 13px;
            }
            .wallet-option-arrow {
                color: rgba(255, 255, 255, 0.4);
            }
            .wallet-modal-footer {
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding-top: 16px;
            }
            .wallet-footer-text {
                text-align: center;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 12px;
            }
            .wallet-footer-text a {
                color: #9945FF;
                text-decoration: none;
            }
            .wallet-footer-text a:hover {
                text-decoration: underline;
            }
            .wallet-demo-btn {
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #9945FF, #14F195);
                border: none;
                border-radius: 12px;
                color: #fff;
                font-weight: 600;
                font-size: 16px;
                cursor: pointer;
                transition: opacity 0.2s, transform 0.2s;
            }
            .wallet-demo-btn:hover {
                opacity: 0.9;
            }
            .wallet-demo-btn:active {
                transform: scale(0.98);
            }
            @media (min-width: 480px) {
                .wallet-modal-overlay {
                    align-items: center;
                }
                .wallet-modal-content {
                    border-radius: 24px;
                }
            }
        `;
        
        if (!document.getElementById('wallet-modal-styles')) {
            document.head.appendChild(style);
        }
        
        document.body.appendChild(modal);
        
        // Event listeners
        modal.querySelector('.wallet-modal-close-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('.wallet-modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) modal.remove();
        });
        
        // Wallet option clicks - in production these would deep link
        modal.querySelectorAll('.wallet-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const wallet = btn.dataset.wallet;
                this.handleWalletDeepLink(wallet);
                modal.remove();
            });
        });
        
        // Demo mode button
        modal.querySelector('.wallet-demo-btn').addEventListener('click', () => {
            modal.remove();
            this.simulateDemoConnection();
        });
    }
    
    handleWalletDeepLink(walletName) {
        // Handle Mobile Wallet Adapter for Seeker phones
        if (walletName === 'mwa') {
            this.connectWithMWA();
            return;
        }
        
        // Deep link configurations for mobile wallets
        const currentUrl = encodeURIComponent(window.location.href);
        const deepLinks = {
            phantom: `https://phantom.app/ul/browse/${currentUrl}`,
            solflare: `https://solflare.com/ul/v1/browse/${currentUrl}`,
            backpack: `https://backpack.app/ul/v1/browse/${currentUrl}`
        };
        
        const link = deepLinks[walletName];
        if (link) {
            this.showToast(`Opening ${walletName}...`, 'info');
            // In production, this would redirect to the wallet app
            window.location.href = link;
        }
    }
    
    /**
     * Connects to a wallet using the Mobile Wallet Adapter (MWA) protocol.
     * 
     * This is the primary connection method for Android/Seeker devices. It:
     * 1. First checks for injected providers (in-app browser scenario)
     * 2. Falls back to MWA protocol which launches the system wallet chooser
     * 3. Handles the encrypted authorization flow via WebSocket
     * 4. Converts the base64 address response to base58 format
     * 
     * MWA is preferred over deep links because it:
     * - Works with any installed wallet (Phantom, Solflare, Seed Vault, etc.)
     * - Provides a native wallet chooser experience
     * - Uses encrypted communication for security
     */
    async connectWithMWA() {
        // First check if we're already in a wallet's in-app browser
        // This happens when user opens our PWA from within a wallet app
        if (typeof getInjectedProvider === 'function') {
            const injected = getInjectedProvider();
            if (injected) {
                this.showToast(`Found ${injected.name}! Connecting...`, 'info');
                try {
                    const resp = await injected.provider.connect();
                    this.walletAddress = resp.publicKey.toString();
                    this.isWalletConnected = true;
                    this.updateWalletUI();
                    this.fetchBalance();
                    this.showToast(`✓ Connected via ${injected.name}!`, 'success');
                    return;
                } catch (e) {
                    if (e.code === 4001) {
                        this.showToast('Connection rejected by user', 'warning');
                        return;
                    }
                }
            }
        }
        
        // If no injected provider, use the full MWA protocol
        // This launches the Android wallet chooser (Seed Vault, Phantom, Solflare, etc.)
        this.showToast('Opening wallet selector...', 'info');
        
        try {
            if (typeof transact === 'function') {
                // transact() handles the complete MWA flow:
                // 1. Generates association keypair for app identity
                // 2. Opens solana-wallet:// URL to launch wallet chooser
                // 3. Establishes encrypted WebSocket session
                // 4. Calls our callback with the wallet API
                const result = await transact(async (wallet) => {
                    // Request authorization from the wallet
                    // The wallet will show a consent screen to the user
                    const auth = await wallet.authorize({
                        identity: {
                            name: 'Solana Mobile PWA',
                            uri: window.location.origin,
                            icon: '/assets/icons/icon-192x192.png'
                        },
                        chain: 'solana:mainnet'  // Using mainnet for real balances
                    });
                    
                    return auth;
                });
                
                // Process the authorization result
                if (result && result.accounts && result.accounts.length > 0) {
                    const account = result.accounts[0];
                    
                    // MWA returns addresses as base64-encoded bytes
                    // We need to convert to base58 for display
                    let address;
                    if (account.display_address) {
                        // Some wallets provide pre-formatted address
                        address = account.display_address;
                    } else if (account.address) {
                        // Convert base64-encoded public key to base58
                        address = this.base64ToBase58(account.address);
                    }
                    
                    if (address) {
                        this.walletAddress = address;
                        this.isWalletConnected = true;
                        this.updateWalletUI();
                        this.fetchBalance();
                        this.showToast('✓ Wallet connected via MWA!', 'success');
                    } else {
                        this.showToast('Failed to get wallet address', 'error');
                    }
                } else {
                    this.showToast('No accounts returned from wallet', 'warning');
                }
            } else {
                this.showToast('MWA not available. Try a specific wallet.', 'error');
            }
            
        } catch (error) {
            // Handle specific MWA errors with user-friendly messages
            if (error.message?.includes('WALLET_NOT_FOUND')) {
                this.showToast('No MWA-compatible wallet found.', 'error');
            } else if (error.message?.includes('SESSION_TIMEOUT')) {
                this.showToast('Wallet connection timed out.', 'warning');
            } else {
                this.showToast('Could not connect. Try a specific wallet.', 'error');
            }
        }
    }
    
    simulateDemoConnection() {
        // Demo mode - clearly labeled as demo/template
        this.showToast('Connecting demo wallet...', 'info');
        
        setTimeout(() => {
            // Use a realistic-looking demo address
            this.walletAddress = 'DemoWa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
            this.isWalletConnected = true;
            this.balance = 2.5;
            this.updateWalletUI();
            this.showToast('✓ Demo wallet connected (Template Mode)', 'success');
        }, 800);
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
    
    /**
     * Updates the balance display in the UI.
     * Formats the balance with exactly 4 decimal places.
     */
    updateBalanceDisplay() {
        if (this.balance !== null) {
            // Format balance with 4 decimal places, ensuring leading zero is preserved
            const formattedBalance = this.balance.toLocaleString('en-US', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
                useGrouping: false
            });
            this.balanceValue.textContent = `${formattedBalance} SOL`;
        } else {
            this.balanceValue.textContent = '-- SOL';
        }
    }
    
    /**
     * Fetches the SOL balance for the connected wallet from Solana RPC.
     * 
     * Uses the Solana JSON-RPC API to query the account balance.
     * The RPC returns balance in lamports (1 SOL = 1,000,000,000 lamports).
     * 
     * Note: Currently uses devnet. For production, change to mainnet-beta:
     * https://api.mainnet-beta.solana.com
     */
    async fetchBalance() {
        if (!this.walletAddress) {
            this.balance = null;
            this.updateBalanceDisplay();
            return;
        }
        
        // Try multiple RPC endpoints in case one fails
        const rpcEndpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-mainnet.g.alchemy.com/v2/demo',
            'https://rpc.ankr.com/solana'
        ];
        
        for (const rpcUrl of rpcEndpoints) {
            try {
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getBalance',
                        params: [this.walletAddress]
                    })
                });
                
                if (!response.ok) continue;
                
                const data = await response.json();
                
                if (data.result && typeof data.result.value === 'number') {
                    // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
                    this.balance = data.result.value / 1e9;
                    this.updateBalanceDisplay();
                    return; // Success, exit
                }
            } catch (error) {
                // Try next endpoint
                continue;
            }
        }
        
        // All endpoints failed
        this.balance = 0;
        this.updateBalanceDisplay();
    }
    
    /**
     * Truncates a wallet address for display (e.g., "ABCD...WXYZ")
     * @param {string} address - Full wallet address
     * @returns {string} Truncated address showing first and last 4 characters
     */
    truncateAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    
    /**
     * Converts a base64-encoded wallet address to base58 format.
     * 
     * MWA returns wallet addresses as base64-encoded 32-byte public keys.
     * Solana uses base58 encoding (like Bitcoin) for display.
     * 
     * Algorithm:
     * 1. Decode base64 to raw bytes (32 bytes for Ed25519 public key)
     * 2. Treat bytes as a big integer
     * 3. Repeatedly divide by 58, collecting remainders
     * 4. Map remainders to base58 alphabet
     * 5. Handle leading zero bytes (they become '1' in base58)
     * 
     * @param {string} base64 - Base64-encoded address from MWA
     * @returns {string} Base58-encoded Solana address
     */
    base64ToBase58(base64) {
        try {
            // Step 1: Decode base64 to raw bytes
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Base58 alphabet - note: no 0, O, I, l to avoid confusion
            const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            
            // Step 2-4: Convert bytes to base58 using repeated division
            // We process byte-by-byte, treating the running result as a big integer
            const digits = [0];
            for (let i = 0; i < bytes.length; i++) {
                let carry = bytes[i];
                // Multiply existing result by 256 and add new byte
                for (let j = 0; j < digits.length; j++) {
                    carry += digits[j] << 8; // digits[j] * 256
                    digits[j] = carry % 58;
                    carry = (carry / 58) | 0;
                }
                // Handle overflow into new digits
                while (carry > 0) {
                    digits.push(carry % 58);
                    carry = (carry / 58) | 0;
                }
            }
            
            // Step 5: Handle leading zeros (each 0x00 byte = '1' in base58)
            let result = '';
            for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
                result += ALPHABET[0]; // '1'
            }
            
            // Convert digit indices to characters (reverse order, as we built LSB first)
            for (let i = digits.length - 1; i >= 0; i--) {
                result += ALPHABET[digits[i]];
            }
            
            return result;
        } catch (e) {
            // If conversion fails, return original (may already be base58)
            return base64;
        }
    }

    showWalletOptions() {
        // Show wallet details modal
        const existing = document.getElementById('wallet-details-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'wallet-details-modal';
        modal.innerHTML = `
            <div class="wallet-modal-overlay">
                <div class="wallet-modal-content">
                    <div class="wallet-modal-header">
                        <h3>Wallet Connected</h3>
                        <button class="wallet-modal-close-btn" aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="wallet-details-content">
                        <div class="wallet-address-display">
                            <span class="wallet-label">Address</span>
                            <span class="wallet-address-full">${this.walletAddress}</span>
                        </div>
                        
                        <div class="wallet-balance-display">
                            <span class="wallet-label">Balance</span>
                            <span class="wallet-balance-value">${this.balance !== null ? this.balance.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false }) + ' SOL' : 'Loading...'}</span>
                        </div>
                        
                        <div class="wallet-actions">
                            <button class="wallet-action-btn copy-address-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                </svg>
                                Copy Address
                            </button>
                            <button class="wallet-action-btn refresh-balance-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 4v6h-6M1 20v-6h6"/>
                                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                                </svg>
                                Refresh Balance
                            </button>
                            <button class="wallet-action-btn disconnect-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                                    <polyline points="16 17 21 12 16 7"/>
                                    <line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
                                Disconnect
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add wallet details styles if not already present
        if (!document.getElementById('wallet-details-styles')) {
            const style = document.createElement('style');
            style.id = 'wallet-details-styles';
            style.textContent = `
                .wallet-details-content {
                    padding: 16px 0;
                }
                .wallet-address-display,
                .wallet-balance-display {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 12px;
                }
                .wallet-label {
                    display: block;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                .wallet-address-full {
                    display: block;
                    color: #fff;
                    font-size: 14px;
                    word-break: break-all;
                    font-family: monospace;
                    line-height: 1.5;
                }
                .wallet-balance-value {
                    display: block;
                    color: #14F195;
                    font-size: 24px;
                    font-weight: 700;
                }
                .wallet-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-top: 20px;
                }
                .wallet-action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 14px 20px;
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    color: #fff;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .wallet-action-btn:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                .wallet-action-btn:active {
                    transform: scale(0.98);
                }
                .wallet-action-btn.disconnect-btn {
                    background: rgba(255, 100, 100, 0.15);
                    border-color: rgba(255, 100, 100, 0.3);
                    color: #ff6b6b;
                }
                .wallet-action-btn.disconnect-btn:hover {
                    background: rgba(255, 100, 100, 0.25);
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add event listeners
        const closeBtn = modal.querySelector('.wallet-modal-close-btn');
        const overlay = modal.querySelector('.wallet-modal-overlay');
        const copyBtn = modal.querySelector('.copy-address-btn');
        const refreshBtn = modal.querySelector('.refresh-balance-btn');
        const disconnectBtn = modal.querySelector('.disconnect-btn');
        
        const closeModal = () => modal.remove();
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(this.walletAddress);
                this.showToast('Address copied!', 'success');
            } catch (e) {
                this.showToast('Failed to copy', 'error');
            }
        });
        
        refreshBtn.addEventListener('click', async () => {
            this.showToast('Refreshing balance...', 'info');
            await this.fetchBalance();
            const balanceEl = modal.querySelector('.wallet-balance-value');
            if (balanceEl) {
                balanceEl.textContent = this.balance !== null ? this.balance.toFixed(4) + ' SOL' : 'Error';
            }
            this.showToast('Balance updated!', 'success');
        });
        
        disconnectBtn.addEventListener('click', () => {
            this.disconnectWallet();
            closeModal();
        });
    }
    
    disconnectWallet() {
        this.isWalletConnected = false;
        this.walletAddress = null;
        this.balance = null;
        this.updateWalletUI();
        this.updateBalanceDisplay();
        this.showToast('Wallet disconnected', 'info');
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
                // Service worker registration failed silently
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
