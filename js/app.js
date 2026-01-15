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
    
    async connectWithMWA() {
        // Connect using Mobile Wallet Adapter (for Seeker phones and Android wallets)
        const isSeeker = /seeker|saga|solanamobile/i.test(navigator.userAgent);
        
        if (isSeeker) {
            this.showToast('Connecting to Seeker wallet...', 'info');
        } else {
            this.showToast('Looking for mobile wallets...', 'info');
        }
        
        try {
            // Check if MobileWalletAdapter class is available (from mwa.js)
            if (typeof MobileWalletAdapter !== 'undefined') {
                const mwa = new MobileWalletAdapter({ cluster: 'devnet' });
                
                // Show connecting state
                if (isSeeker) {
                    this.showToast('Opening wallet selector...', 'info');
                }
                
                const result = await mwa.connect();
                
                if (result && result.publicKey) {
                    this.walletAddress = result.publicKey;
                    this.isWalletConnected = true;
                    this.updateWalletUI();
                    this.fetchBalance();
                    this.showToast('✓ Wallet connected via MWA!', 'success');
                    return;
                }
            }
            
            // Fallback: Try to use injected provider directly
            const provider = window.phantom?.solana || window.solflare || window.solana;
            if (provider) {
                const resp = await provider.connect();
                this.walletAddress = resp.publicKey.toString();
                this.isWalletConnected = true;
                this.updateWalletUI();
                this.fetchBalance();
                this.showToast('✓ Wallet connected!', 'success');
                return;
            }
            
            // On Seeker, try deep linking to Phantom which is pre-installed
            if (isSeeker) {
                this.showToast('Opening Phantom...', 'info');
                const currentUrl = encodeURIComponent(window.location.href);
                window.location.href = `phantom://browse/${currentUrl}`;
                return;
            }
            
            // No wallet found - show helpful message
            this.showToast('No mobile wallet detected. Try selecting a specific wallet.', 'warning');
        } catch (error) {
            console.error('MWA connection error:', error);
            
            // On Seeker, provide a more helpful fallback
            if (isSeeker) {
                this.showToast('Try selecting Phantom or Solflare directly.', 'warning');
            } else {
                this.showToast('Connection failed. Try a specific wallet.', 'error');
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
    
    updateBalanceDisplay() {
        if (this.balance !== null) {
            this.balanceValue.textContent = `${this.balance.toFixed(4)} SOL`;
        } else {
            this.balanceValue.textContent = '-- SOL';
        }
    }
    
    async fetchBalance() {
        // Template: In production, fetch real balance from Solana RPC
        // Example implementation:
        // const connection = new Connection('https://api.mainnet-beta.solana.com');
        // const balance = await connection.getBalance(new PublicKey(this.walletAddress));
        // this.balance = balance / 1e9; // Convert lamports to SOL
        
        // For demo purposes, use simulated balance
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
