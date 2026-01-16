/**
 * Solana Wallet Adapter Integration
 * Provides a unified interface for connecting to Solana wallets on mobile and web
 */

// Supported mobile wallets with their deeplink schemes
const MOBILE_WALLETS = {
    phantom: {
        name: 'Phantom',
        icon: '/assets/wallets/phantom.svg',
        scheme: 'phantom://',
        appStoreUrl: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=app.phantom',
        deeplink: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`
    },
    solflare: {
        name: 'Solflare',
        icon: '/assets/wallets/solflare.svg',
        scheme: 'solflare://',
        appStoreUrl: 'https://apps.apple.com/app/solflare/id1580902717',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
        deeplink: (url) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`
    },
    backpack: {
        name: 'Backpack',
        icon: '/assets/wallets/backpack.svg',
        scheme: 'backpack://',
        appStoreUrl: 'https://apps.apple.com/app/backpack-crypto-wallet/id6444328103',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=app.backpack.mobile',
        deeplink: (url) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}`
    }
};

// Network configuration
const NETWORKS = {
    'mainnet-beta': {
        name: 'Mainnet Beta',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        cluster: 'mainnet-beta'
    },
    'devnet': {
        name: 'Devnet',
        rpcUrl: 'https://api.devnet.solana.com',
        cluster: 'devnet'
    },
    'testnet': {
        name: 'Testnet',
        rpcUrl: 'https://api.testnet.solana.com',
        cluster: 'testnet'
    }
};

class SolanaWalletAdapter {
    constructor(options = {}) {
        this.network = options.network || 'mainnet-beta';
        this.rpcUrl = NETWORKS[this.network].rpcUrl;
        
        this.publicKey = null;
        this.connected = false;
        this.provider = null;
        
        this.listeners = {
            connect: [],
            disconnect: [],
            accountChanged: []
        };
        
        this.init();
    }
    
    /**
     * Initialize the wallet adapter
     */
    init() {
        // Detect available providers
        this.detectProviders();
        
        // Listen for provider changes
        this.setupProviderListeners();
        
        // Check for existing connection
        this.checkExistingConnection();
    }
    
    /**
     * Detect available wallet providers
     */
    detectProviders() {
        // Check for injected providers (in-app browsers or extensions)
        this.providers = {
            phantom: window.phantom?.solana,
            solflare: window.solflare,
            backpack: window.backpack?.solana,
            generic: window.solana
        };
        
        // Determine if we're in a mobile wallet's in-app browser
        this.isInAppBrowser = this.detectInAppBrowser();
        
        // Determine if we're on mobile
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    /**
     * Detect if running inside a wallet's in-app browser
     */
    detectInAppBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('phantom')) return 'phantom';
        if (userAgent.includes('solflare')) return 'solflare';
        if (userAgent.includes('backpack')) return 'backpack';
        
        // Check for provider properties
        if (window.phantom?.solana?.isPhantom) return 'phantom';
        if (window.solflare?.isSolflare) return 'solflare';
        if (window.backpack?.isBackpack) return 'backpack';
        
        return null;
    }
    
    /**
     * Setup listeners for provider events
     */
    setupProviderListeners() {
        if (!this.provider) return;
        
        this.provider.on('connect', (publicKey) => {
            this.handleConnect(publicKey);
        });
        
        this.provider.on('disconnect', () => {
            this.handleDisconnect();
        });
        
        this.provider.on('accountChanged', (publicKey) => {
            this.handleAccountChanged(publicKey);
        });
    }
    
    /**
     * Check for existing connection
     */
    async checkExistingConnection() {
        const savedWallet = localStorage.getItem('solana_wallet_connected');
        
        if (savedWallet && this.providers[savedWallet]) {
            try {
                const provider = this.providers[savedWallet];
                if (provider.isConnected) {
                    this.provider = provider;
                    this.publicKey = provider.publicKey.toString();
                    this.connected = true;
                    this.emit('connect', { publicKey: this.publicKey });
                }
            } catch (error) {
                localStorage.removeItem('solana_wallet_connected');
            }
        }
    }
    
    /**
     * Connect to a wallet
     */
    async connect(walletName = null) {
        try {
            // If we're in an in-app browser, connect to that wallet directly
            if (this.isInAppBrowser) {
                return await this.connectInAppWallet();
            }
            
            // If a specific wallet is requested
            if (walletName && this.providers[walletName]) {
                return await this.connectToProvider(this.providers[walletName], walletName);
            }
            
            // If generic Solana provider exists (usually on desktop with extension)
            if (this.providers.generic) {
                return await this.connectToProvider(this.providers.generic, 'generic');
            }
            
            // On mobile without provider, offer deep linking options
            if (this.isMobile) {
                return this.showWalletOptions();
            }
            
            // No wallet found
            throw new Error('No Solana wallet found. Please install a wallet like Phantom or Solflare.');
        } catch (error) {
            throw error;
        }
    }
    
    /**
     * Connect to in-app wallet browser
     */
    async connectInAppWallet() {
        const walletName = this.isInAppBrowser;
        const provider = this.providers[walletName] || this.providers.generic;
        
        if (!provider) {
            throw new Error('Wallet provider not found');
        }
        
        return await this.connectToProvider(provider, walletName);
    }
    
    /**
     * Connect to a specific provider
     */
    async connectToProvider(provider, walletName) {
        try {
            const response = await provider.connect();
            
            this.provider = provider;
            this.publicKey = response.publicKey.toString();
            this.connected = true;
            
            // Save connection preference
            localStorage.setItem('solana_wallet_connected', walletName);
            
            // Setup listeners
            this.setupProviderListeners();
            
            // Emit connect event
            this.emit('connect', { publicKey: this.publicKey, wallet: walletName });
            
            return {
                publicKey: this.publicKey,
                wallet: walletName
            };
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('User rejected the connection request');
            }
            throw error;
        }
    }
    
    /**
     * Show wallet selection options (for mobile deep linking)
     */
    showWalletOptions() {
        return new Promise((resolve, reject) => {
            // Create modal for wallet selection
            const modal = document.createElement('div');
            modal.id = 'wallet-modal';
            modal.innerHTML = `
                <div class="wallet-modal-overlay">
                    <div class="wallet-modal-content">
                        <h3>Connect Wallet</h3>
                        <p>Select a wallet to connect</p>
                        <div class="wallet-options">
                            ${Object.entries(MOBILE_WALLETS).map(([key, wallet]) => `
                                <button class="wallet-option" data-wallet="${key}">
                                    <img src="${wallet.icon}" alt="${wallet.name}" onerror="this.style.display='none'">
                                    <span>${wallet.name}</span>
                                </button>
                            `).join('')}
                        </div>
                        <button class="wallet-modal-close">Cancel</button>
                    </div>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .wallet-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    z-index: 9999;
                    padding: 16px;
                }
                .wallet-modal-content {
                    background: #1A1A1A;
                    border-radius: 24px 24px 0 0;
                    padding: 24px;
                    width: 100%;
                    max-width: 400px;
                    animation: slideUp 0.3s ease;
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .wallet-modal-content h3 {
                    text-align: center;
                    margin-bottom: 8px;
                    color: #fff;
                }
                .wallet-modal-content p {
                    text-align: center;
                    color: #888;
                    margin-bottom: 24px;
                }
                .wallet-options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .wallet-option {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: #252525;
                    border: 1px solid #333;
                    border-radius: 12px;
                    color: #fff;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .wallet-option:active {
                    background: #333;
                }
                .wallet-option img {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                }
                .wallet-modal-close {
                    width: 100%;
                    padding: 16px;
                    background: transparent;
                    border: 1px solid #333;
                    border-radius: 12px;
                    color: #888;
                    font-size: 1rem;
                    cursor: pointer;
                }
            `;
            
            document.head.appendChild(style);
            document.body.appendChild(modal);
            
            // Handle wallet selection
            modal.querySelectorAll('.wallet-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    const walletKey = btn.dataset.wallet;
                    const wallet = MOBILE_WALLETS[walletKey];
                    const currentUrl = window.location.href;
                    
                    // Redirect to wallet's in-app browser
                    window.location.href = wallet.deeplink(currentUrl);
                    
                    // Clean up
                    modal.remove();
                    style.remove();
                    
                    reject(new Error('Redirecting to wallet app'));
                });
            });
            
            // Handle close
            modal.querySelector('.wallet-modal-close').addEventListener('click', () => {
                modal.remove();
                style.remove();
                reject(new Error('User cancelled wallet selection'));
            });
            
            modal.querySelector('.wallet-modal-overlay').addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    modal.remove();
                    style.remove();
                    reject(new Error('User cancelled wallet selection'));
                }
            });
        });
    }
    
    /**
     * Disconnect from wallet
     */
    async disconnect() {
        if (this.provider) {
            try {
                await this.provider.disconnect();
            } catch (error) {
                // Disconnect can sometimes throw, but we proceed anyway
            }
        }
        
        this.handleDisconnect();
    }
    
    /**
     * Handle connect event
     */
    handleConnect(publicKey) {
        this.publicKey = publicKey.toString();
        this.connected = true;
        this.emit('connect', { publicKey: this.publicKey });
    }
    
    /**
     * Handle disconnect event
     */
    handleDisconnect() {
        this.publicKey = null;
        this.connected = false;
        this.provider = null;
        localStorage.removeItem('solana_wallet_connected');
        this.emit('disconnect');
    }
    
    /**
     * Handle account change event
     */
    handleAccountChanged(publicKey) {
        if (publicKey) {
            this.publicKey = publicKey.toString();
            this.emit('accountChanged', { publicKey: this.publicKey });
        } else {
            this.handleDisconnect();
        }
    }
    
    /**
     * Get wallet balance
     */
    async getBalance() {
        if (!this.connected || !this.publicKey) {
            throw new Error('Wallet not connected');
        }
        
        try {
            const response = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [this.publicKey]
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            // Convert lamports to SOL
            return data.result.value / 1e9;
        } catch (error) {
            throw error;
        }
    }
    
    /**
     * Sign a message
     */
    async signMessage(message) {
        if (!this.connected || !this.provider) {
            throw new Error('Wallet not connected');
        }
        
        const encodedMessage = new TextEncoder().encode(message);
        const signature = await this.provider.signMessage(encodedMessage, 'utf8');
        
        return signature;
    }
    
    /**
     * Sign and send a transaction
     */
    async signAndSendTransaction(transaction) {
        if (!this.connected || !this.provider) {
            throw new Error('Wallet not connected');
        }
        
        const signature = await this.provider.signAndSendTransaction(transaction);
        
        return signature;
    }
    
    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }
    
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
    
    /**
     * Get connected wallet info
     */
    getWalletInfo() {
        if (!this.connected) {
            return null;
        }
        
        return {
            publicKey: this.publicKey,
            shortAddress: `${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`,
            network: this.network,
            provider: this.isInAppBrowser || 'unknown'
        };
    }
    
    /**
     * Change network
     */
    setNetwork(network) {
        if (NETWORKS[network]) {
            this.network = network;
            this.rpcUrl = NETWORKS[network].rpcUrl;
        }
    }
}

// Export for use in main app
export { SolanaWalletAdapter, MOBILE_WALLETS, NETWORKS };
export default SolanaWalletAdapter;
