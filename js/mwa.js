/**
 * Solana Mobile Wallet Adapter Integration
 * 
 * This module provides MWA integration for PWAs.
 * Uses deep links to wallet apps which provide in-app browser with injected providers.
 * 
 * @see https://github.com/solana-mobile/mobile-wallet-adapter
 */

// ==========================================================================
// Detection Functions
// ==========================================================================

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

function isSeeker() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('seeker') || ua.includes('saga') || ua.includes('solanamobile');
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ==========================================================================
// Provider Detection
// ==========================================================================

function getInjectedProvider() {
    // Phantom
    if (window.phantom?.solana?.isPhantom) {
        console.log('MWA: Found Phantom provider');
        return { name: 'Phantom', provider: window.phantom.solana };
    }
    if (window.solana?.isPhantom) {
        console.log('MWA: Found Phantom via window.solana');
        return { name: 'Phantom', provider: window.solana };
    }
    
    // Solflare
    if (window.solflare?.isSolflare) {
        console.log('MWA: Found Solflare provider');
        return { name: 'Solflare', provider: window.solflare };
    }
    
    // Backpack
    if (window.backpack?.isBackpack) {
        console.log('MWA: Found Backpack provider');
        return { name: 'Backpack', provider: window.backpack };
    }
    
    // Generic Solana provider
    if (window.solana) {
        console.log('MWA: Found generic Solana provider');
        return { name: 'Wallet', provider: window.solana };
    }
    
    return null;
}

// ==========================================================================
// Wallet Deep Links
// ==========================================================================

const WALLET_DEEP_LINKS = {
    phantom: {
        name: 'Phantom',
        browse: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`,
        connect: () => 'https://phantom.app/ul/v1/connect',
        installed: () => !!window.phantom?.solana
    },
    solflare: {
        name: 'Solflare', 
        browse: (url) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`,
        connect: () => 'https://solflare.com/ul/v1/connect',
        installed: () => !!window.solflare
    },
    backpack: {
        name: 'Backpack',
        browse: (url) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}`,
        connect: () => 'https://backpack.app/ul/v1/connect',
        installed: () => !!window.backpack
    }
};

// ==========================================================================
// MobileWalletAdapter Class
// ==========================================================================

class MobileWalletAdapter {
    constructor(options = {}) {
        this.cluster = options.cluster || 'devnet';
        this.appIdentity = options.appIdentity || {
            name: 'Solana Mobile PWA',
            uri: window.location.origin,
            icon: `${window.location.origin}/assets/icons/icon-192x192.png`
        };
        
        this.publicKey = null;
        this.connected = false;
        this.providerName = null;
        this._provider = null;
    }
    
    /**
     * Check if MWA/wallet connection is available
     */
    isAvailable() {
        // Available if we have an injected provider or we're on Android
        return !!getInjectedProvider() || isAndroid();
    }
    
    /**
     * Check if running on Seeker phone
     */
    isSeeker() {
        return isSeeker();
    }
    
    /**
     * Connect to a wallet
     * @param {string} preferredWallet - Optional: 'phantom', 'solflare', 'backpack'
     */
    async connect(preferredWallet = null) {
        console.log('MWA: Starting connection...', { preferredWallet, isAndroid: isAndroid(), isSeeker: isSeeker() });
        
        // First, check for injected provider (we're in a wallet's in-app browser)
        const injected = getInjectedProvider();
        if (injected) {
            console.log('MWA: Using injected provider:', injected.name);
            return await this._connectWithProvider(injected.provider, injected.name);
        }
        
        // No injected provider - we need to open a wallet app
        if (preferredWallet && WALLET_DEEP_LINKS[preferredWallet]) {
            console.log('MWA: Opening specific wallet:', preferredWallet);
            return this._openWalletApp(preferredWallet);
        }
        
        // On Seeker, default to Phantom (pre-installed)
        if (isSeeker()) {
            console.log('MWA: Seeker detected, opening Phantom');
            return this._openWalletApp('phantom');
        }
        
        // On other Android, try Phantom first
        if (isAndroid()) {
            console.log('MWA: Android detected, trying Phantom');
            return this._openWalletApp('phantom');
        }
        
        throw new Error('NO_WALLET_AVAILABLE');
    }
    
    /**
     * Connect with an injected provider
     */
    async _connectWithProvider(provider, name) {
        try {
            console.log('MWA: Connecting with provider:', name);
            
            // Connect to the wallet
            const response = await provider.connect();
            
            this.publicKey = response.publicKey.toString();
            this.connected = true;
            this.providerName = name;
            this._provider = provider;
            
            console.log('MWA: Connected!', this.publicKey);
            
            // Set up disconnect listener
            if (provider.on) {
                provider.on('disconnect', () => {
                    console.log('MWA: Wallet disconnected');
                    this.publicKey = null;
                    this.connected = false;
                });
            }
            
            return {
                publicKey: this.publicKey,
                connected: true,
                providerName: name
            };
            
        } catch (error) {
            console.error('MWA: Provider connect error:', error);
            
            if (error.code === 4001) {
                throw new Error('USER_REJECTED');
            }
            throw error;
        }
    }
    
    /**
     * Open a wallet app's in-app browser
     */
    _openWalletApp(walletKey) {
        const wallet = WALLET_DEEP_LINKS[walletKey];
        if (!wallet) {
            throw new Error('UNKNOWN_WALLET');
        }
        
        const currentUrl = window.location.href;
        const browseUrl = wallet.browse(currentUrl);
        
        console.log('MWA: Opening wallet browser:', browseUrl);
        
        // Navigate to the wallet's in-app browser
        window.location.href = browseUrl;
        
        // This will navigate away, so we return a pending promise
        return new Promise((resolve) => {
            // This promise won't resolve - the page will navigate
            // When the user returns (in the wallet's browser), 
            // the injected provider will be available
        });
    }
    
    /**
     * Disconnect from wallet
     */
    async disconnect() {
        if (this._provider?.disconnect) {
            try {
                await this._provider.disconnect();
            } catch (e) {
                console.log('MWA: Disconnect error (ignored):', e);
            }
        }
        
        this.publicKey = null;
        this.connected = false;
        this.providerName = null;
        this._provider = null;
    }
    
    /**
     * Sign a message
     */
    async signMessage(message) {
        if (!this.connected || !this._provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        const encodedMessage = typeof message === 'string'
            ? new TextEncoder().encode(message)
            : message;
        
        const { signature } = await this._provider.signMessage(encodedMessage, 'utf8');
        return signature;
    }
    
    /**
     * Sign a transaction
     */
    async signTransaction(transaction) {
        if (!this.connected || !this._provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        return await this._provider.signTransaction(transaction);
    }
    
    /**
     * Sign and send a transaction
     */
    async signAndSendTransaction(transaction, options = {}) {
        if (!this.connected || !this._provider) {
            throw new Error('WALLET_NOT_CONNECTED');
        }
        
        return await this._provider.signAndSendTransaction(transaction, options);
    }
}

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Open a specific wallet's in-app browser
 */
function openWalletBrowser(walletName, url = window.location.href) {
    const wallet = WALLET_DEEP_LINKS[walletName.toLowerCase()];
    if (!wallet) {
        console.error('Unknown wallet:', walletName);
        return false;
    }
    
    const browseUrl = wallet.browse(url);
    console.log('Opening wallet browser:', browseUrl);
    window.location.href = browseUrl;
    return true;
}

/**
 * Try to connect with any available wallet
 */
async function autoConnect() {
    const injected = getInjectedProvider();
    if (injected) {
        try {
            const response = await injected.provider.connect({ onlyIfTrusted: true });
            return {
                publicKey: response.publicKey.toString(),
                providerName: injected.name
            };
        } catch (e) {
            // Auto-connect not available or not trusted
            return null;
        }
    }
    return null;
}

// ==========================================================================
// Initialize and Export
// ==========================================================================

// Make classes and functions available globally
window.MobileWalletAdapter = MobileWalletAdapter;
window.openWalletBrowser = openWalletBrowser;
window.getInjectedProvider = getInjectedProvider;
window.isAndroid = isAndroid;
window.isSeeker = isSeeker;
window.isMobileDevice = isMobileDevice;
window.autoConnect = autoConnect;
window.WALLET_DEEP_LINKS = WALLET_DEEP_LINKS;

// Log initialization
console.log('[MWA] Module loaded', {
    isAndroid: isAndroid(),
    isSeeker: isSeeker(),
    hasInjectedProvider: !!getInjectedProvider(),
    injectedProvider: getInjectedProvider()?.name || 'none'
});

// If we have an injected provider, we're in a wallet browser!
const provider = getInjectedProvider();
if (provider) {
    console.log(`[MWA] Running inside ${provider.name} wallet browser!`);
}
