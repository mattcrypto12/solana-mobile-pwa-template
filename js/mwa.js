/**
 * Solana Mobile Wallet Adapter Integration
 * 
 * This module provides integration with Solana's Mobile Wallet Adapter (MWA) standard,
 * enabling seamless wallet connections on Android devices.
 * 
 * @see https://github.com/solana-mobile/mobile-wallet-adapter
 */

// MWA Constants
const MWA_PROTOCOL_VERSION = '1.0.0';
const MWA_APP_IDENTITY = {
    name: 'Solana Mobile PWA',
    uri: window.location.origin,
    icon: `${window.location.origin}/assets/icons/icon-192x192.png`
};

// Cluster configuration
const CLUSTERS = {
    'mainnet-beta': 'https://api.mainnet-beta.solana.com',
    'devnet': 'https://api.devnet.solana.com',
    'testnet': 'https://api.testnet.solana.com'
};

/**
 * Mobile Wallet Adapter class
 * Provides a unified interface for connecting to Solana wallets on mobile
 */
class MobileWalletAdapter {
    constructor(options = {}) {
        this.cluster = options.cluster || 'devnet';
        this.appIdentity = options.appIdentity || MWA_APP_IDENTITY;
        
        this.publicKey = null;
        this.authToken = null;
        this.connected = false;
        
        // Event listeners
        this._listeners = new Map();
        
        // Check if MWA is available
        this.mwaAvailable = this._checkMWAAvailability();
    }
    
    /**
     * Check if Mobile Wallet Adapter is available
     */
    _checkMWAAvailability() {
        // MWA is available on Android devices with compatible wallets
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        // Check for wallet-standard compatible wallets
        const hasWalletStandard = typeof window !== 'undefined' && 
            (window.phantom?.solana || window.solflare || window.backpack?.solana || window.solana);
        
        return isAndroid || hasWalletStandard;
    }
    
    /**
     * Connect to a mobile wallet using MWA
     */
    async connect() {
        try {
            // Try injected provider first (in-app browser)
            const provider = this._getInjectedProvider();
            
            if (provider) {
                return await this._connectInjected(provider);
            }
            
            // Check for wallet-standard wallets
            if (window.solana?.isPhantom || window.phantom?.solana) {
                const phantomProvider = window.phantom?.solana || window.solana;
                return await this._connectInjected(phantomProvider);
            }
            
            if (window.solflare?.isSolflare) {
                return await this._connectInjected(window.solflare);
            }
            
            if (window.backpack?.isBackpack) {
                return await this._connectInjected(window.backpack.solana);
            }
            
            // No provider found - show wallet selection
            throw new Error('NO_WALLET_FOUND');
            
        } catch (error) {
            console.error('MWA Connect Error:', error);
            throw error;
        }
    }
    
    /**
     * Get injected wallet provider
     */
    _getInjectedProvider() {
        // Check user agent for in-app browser
        const ua = navigator.userAgent.toLowerCase();
        
        if (ua.includes('phantom') && window.phantom?.solana) {
            return window.phantom.solana;
        }
        
        if (ua.includes('solflare') && window.solflare) {
            return window.solflare;
        }
        
        if (ua.includes('backpack') && window.backpack?.solana) {
            return window.backpack.solana;
        }
        
        // Check for generic Solana provider
        if (window.solana?.isPhantom) {
            return window.solana;
        }
        
        return null;
    }
    
    /**
     * Connect using injected provider
     */
    async _connectInjected(provider) {
        try {
            const response = await provider.connect();
            
            this.publicKey = response.publicKey.toString();
            this.connected = true;
            this.provider = provider;
            
            // Setup disconnect listener
            provider.on?.('disconnect', () => {
                this._handleDisconnect();
            });
            
            // Setup account change listener
            provider.on?.('accountChanged', (publicKey) => {
                if (publicKey) {
                    this.publicKey = publicKey.toString();
                    this._emit('accountChanged', { publicKey: this.publicKey });
                } else {
                    this._handleDisconnect();
                }
            });
            
            this._emit('connect', { publicKey: this.publicKey });
            
            return {
                publicKey: this.publicKey,
                connected: true
            };
            
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('USER_REJECTED');
            }
            throw error;
        }
    }
    
    /**
     * Disconnect from wallet
     */
    async disconnect() {
        try {
            if (this.provider?.disconnect) {
                await this.provider.disconnect();
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        } finally {
            this._handleDisconnect();
        }
    }
    
    /**
     * Handle disconnect
     */
    _handleDisconnect() {
        this.publicKey = null;
        this.authToken = null;
        this.connected = false;
        this.provider = null;
        
        this._emit('disconnect', {});
    }
    
    /**
     * Sign a message
     */
    async signMessage(message) {
        if (!this.connected || !this.provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        const encodedMessage = typeof message === 'string' 
            ? new TextEncoder().encode(message)
            : message;
        
        const signature = await this.provider.signMessage(encodedMessage, 'utf8');
        
        return signature;
    }
    
    /**
     * Sign a transaction
     */
    async signTransaction(transaction) {
        if (!this.connected || !this.provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        const signedTransaction = await this.provider.signTransaction(transaction);
        
        return signedTransaction;
    }
    
    /**
     * Sign and send a transaction
     */
    async signAndSendTransaction(transaction, options = {}) {
        if (!this.connected || !this.provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        const signature = await this.provider.signAndSendTransaction(transaction, options);
        
        return signature;
    }
    
    /**
     * Sign multiple transactions
     */
    async signAllTransactions(transactions) {
        if (!this.connected || !this.provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        if (this.provider.signAllTransactions) {
            return await this.provider.signAllTransactions(transactions);
        }
        
        // Fallback: sign one by one
        return await Promise.all(transactions.map(tx => this.signTransaction(tx)));
    }
    
    /**
     * Get wallet balance
     */
    async getBalance() {
        if (!this.publicKey) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        const rpcUrl = CLUSTERS[this.cluster];
        
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        // Return balance in SOL
        return data.result.value / 1e9;
    }
    
    /**
     * Request airdrop (devnet only)
     */
    async requestAirdrop(amount = 1) {
        if (this.cluster !== 'devnet') {
            throw new Error('AIRDROP_DEVNET_ONLY');
        }
        
        if (!this.publicKey) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        const rpcUrl = CLUSTERS[this.cluster];
        
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'requestAirdrop',
                params: [this.publicKey, amount * 1e9]
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        return data.result;
    }
    
    /**
     * Event emitter - on
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
    }
    
    /**
     * Event emitter - off
     */
    off(event, callback) {
        if (!this._listeners.has(event)) return;
        
        const callbacks = this._listeners.get(event);
        const index = callbacks.indexOf(callback);
        
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }
    
    /**
     * Event emitter - emit
     */
    _emit(event, data) {
        if (!this._listeners.has(event)) return;
        
        this._listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }
    
    /**
     * Get short address
     */
    getShortAddress() {
        if (!this.publicKey) return null;
        return `${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`;
    }
    
    /**
     * Check if wallet is connected
     */
    isConnected() {
        return this.connected && this.publicKey !== null;
    }
}

/**
 * Wallet selection modal for mobile deep linking
 */
class WalletSelector {
    constructor() {
        this.wallets = [
            {
                name: 'Phantom',
                icon: '/assets/wallets/phantom.svg',
                adapter: 'phantom',
                deeplink: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`,
                appStore: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
                playStore: 'https://play.google.com/store/apps/details?id=app.phantom'
            },
            {
                name: 'Solflare',
                icon: '/assets/wallets/solflare.svg',
                adapter: 'solflare',
                deeplink: (url) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`,
                appStore: 'https://apps.apple.com/app/solflare/id1580902717',
                playStore: 'https://play.google.com/store/apps/details?id=com.solflare.mobile'
            },
            {
                name: 'Backpack',
                icon: '/assets/wallets/backpack.svg',
                adapter: 'backpack',
                deeplink: (url) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}`,
                appStore: 'https://apps.apple.com/app/backpack-crypto-wallet/id6444328103',
                playStore: 'https://play.google.com/store/apps/details?id=app.backpack.mobile'
            }
        ];
    }
    
    /**
     * Show wallet selection modal
     */
    show() {
        return new Promise((resolve, reject) => {
            // Remove existing modal
            const existing = document.getElementById('mwa-wallet-modal');
            if (existing) existing.remove();
            
            const modal = document.createElement('div');
            modal.id = 'mwa-wallet-modal';
            modal.innerHTML = this._getModalHTML();
            
            // Add styles
            this._injectStyles();
            
            document.body.appendChild(modal);
            
            // Animate in
            requestAnimationFrame(() => {
                modal.classList.add('visible');
            });
            
            // Event listeners
            modal.querySelector('.mwa-modal-close').addEventListener('click', () => {
                this._close(modal);
                reject(new Error('USER_CANCELLED'));
            });
            
            modal.querySelector('.mwa-modal-overlay').addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    this._close(modal);
                    reject(new Error('USER_CANCELLED'));
                }
            });
            
            // Wallet buttons
            modal.querySelectorAll('.mwa-wallet-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const walletName = btn.dataset.wallet;
                    const wallet = this.wallets.find(w => w.adapter === walletName);
                    
                    if (wallet) {
                        this._close(modal);
                        resolve(wallet);
                    }
                });
            });
        });
    }
    
    /**
     * Generate modal HTML
     */
    _getModalHTML() {
        return `
            <div class="mwa-modal-overlay">
                <div class="mwa-modal-content">
                    <div class="mwa-modal-header">
                        <h3>Connect Wallet</h3>
                        <button class="mwa-modal-close" aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    <p class="mwa-modal-desc">Select a wallet to connect to this dApp</p>
                    
                    <div class="mwa-wallet-list">
                        ${this.wallets.map(wallet => `
                            <button class="mwa-wallet-btn" data-wallet="${wallet.adapter}">
                                <img src="${wallet.icon}" alt="${wallet.name}" class="mwa-wallet-icon" />
                                <span class="mwa-wallet-name">${wallet.name}</span>
                                <svg class="mwa-wallet-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 18l6-6-6-6"/>
                                </svg>
                            </button>
                        `).join('')}
                    </div>
                    
                    <div class="mwa-modal-footer">
                        <p>New to Solana? <a href="https://phantom.app/download" target="_blank" rel="noopener">Get a wallet</a></p>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Inject modal styles
     */
    _injectStyles() {
        if (document.getElementById('mwa-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'mwa-modal-styles';
        style.textContent = `
            #mwa-wallet-modal {
                position: fixed;
                inset: 0;
                z-index: 99999;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            
            #mwa-wallet-modal.visible {
                opacity: 1;
            }
            
            .mwa-modal-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 16px;
            }
            
            .mwa-modal-content {
                background: linear-gradient(180deg, #1E1E2E 0%, #13131D 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px 24px 0 0;
                width: 100%;
                max-width: 400px;
                padding: 24px;
                transform: translateY(100%);
                animation: mwaSlideUp 0.3s ease forwards;
            }
            
            @keyframes mwaSlideUp {
                to { transform: translateY(0); }
            }
            
            .mwa-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .mwa-modal-header h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #fff;
            }
            
            .mwa-modal-close {
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
            
            .mwa-modal-close:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            
            .mwa-modal-desc {
                color: rgba(255, 255, 255, 0.6);
                font-size: 14px;
                margin-bottom: 24px;
            }
            
            .mwa-wallet-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .mwa-wallet-btn {
                display: flex;
                align-items: center;
                gap: 16px;
                width: 100%;
                padding: 16px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .mwa-wallet-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(153, 69, 255, 0.5);
                transform: translateY(-2px);
            }
            
            .mwa-wallet-btn:active {
                transform: translateY(0);
            }
            
            .mwa-wallet-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
            }
            
            .mwa-wallet-name {
                flex: 1;
                text-align: left;
                font-size: 16px;
                font-weight: 500;
                color: #fff;
            }
            
            .mwa-wallet-arrow {
                color: rgba(255, 255, 255, 0.4);
            }
            
            .mwa-modal-footer {
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                text-align: center;
            }
            
            .mwa-modal-footer p {
                margin: 0;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .mwa-modal-footer a {
                color: #9945FF;
                text-decoration: none;
            }
            
            .mwa-modal-footer a:hover {
                text-decoration: underline;
            }
            
            @media (min-width: 480px) {
                .mwa-modal-overlay {
                    align-items: center;
                }
                
                .mwa-modal-content {
                    border-radius: 24px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Close modal
     */
    _close(modal) {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 200);
    }
    
    /**
     * Open wallet via deep link
     */
    openWallet(wallet) {
        const currentUrl = window.location.href;
        const deeplink = wallet.deeplink(currentUrl);
        
        window.location.href = deeplink;
    }
}

// Export
export { MobileWalletAdapter, WalletSelector, CLUSTERS };
export default MobileWalletAdapter;
