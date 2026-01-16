/**
 * Solana Mobile Wallet Adapter (MWA) Implementation
 * 
 * For TWA/PWA web apps, we can't directly trigger Android intents.
 * Instead, we use wallet universal links to open the dApp inside
 * the wallet's in-app browser, where the wallet injects its provider.
 * 
 * @see https://github.com/solana-mobile/mobile-wallet-adapter
 */

// ==========================================================================
// Wallet Universal Links
// ==========================================================================

const WALLET_CONFIGS = {
    seedvault: {
        name: 'Seed Vault',
        // Seed Vault uses the Solana Mobile dApp Store flow
        // Apps opened from dApp Store have Seed Vault available via injected provider
        checkProvider: () => window.SeedVault || window.solana?.isSeedVault
    },
    phantom: {
        name: 'Phantom',
        universalLink: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`,
        checkProvider: () => window.phantom?.solana?.isPhantom || window.solana?.isPhantom
    },
    solflare: {
        name: 'Solflare', 
        universalLink: (url) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`,
        checkProvider: () => window.solflare?.isSolflare
    },
    backpack: {
        name: 'Backpack',
        universalLink: (url) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}`,
        checkProvider: () => window.backpack?.isBackpack
    }
};

// ==========================================================================
// Provider Detection
// ==========================================================================

function getInjectedProvider() {
    // Check for Seed Vault first (on Seeker/Saga devices)
    if (window.SeedVault) {
        return { name: 'Seed Vault', provider: window.SeedVault };
    }
    
    // Check for standard wallet providers
    if (window.phantom?.solana?.isPhantom) {
        return { name: 'Phantom', provider: window.phantom.solana };
    }
    if (window.solana?.isPhantom) {
        return { name: 'Phantom', provider: window.solana };
    }
    if (window.solflare?.isSolflare) {
        return { name: 'Solflare', provider: window.solflare };
    }
    if (window.backpack?.isBackpack) {
        return { name: 'Backpack', provider: window.backpack };
    }
    if (window.solana) {
        return { name: 'Wallet', provider: window.solana };
    }
    return null;
}

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

function isSeeker() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('seeker') || ua.includes('saga') || ua.includes('solanamobile');
}

// ==========================================================================
// MWA Wallet Selector Modal
// ==========================================================================

function showMWAWalletSelector() {
    // Remove any existing modal
    const existingModal = document.getElementById('mwa-wallet-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const currentUrl = window.location.href;
    
    const modal = document.createElement('div');
    modal.id = 'mwa-wallet-modal';
    modal.innerHTML = `
        <div class="mwa-modal-backdrop"></div>
        <div class="mwa-modal-content">
            <div class="mwa-modal-header">
                <h3>Select Wallet</h3>
                <button class="mwa-modal-close">&times;</button>
            </div>
            <div class="mwa-modal-body">
                <p class="mwa-modal-desc">Choose a wallet to connect with:</p>
                <div class="mwa-wallet-list">
                    <button class="mwa-wallet-btn" data-wallet="phantom">
                        <img src="assets/wallets/phantom.svg" alt="Phantom" onerror="this.style.display='none'">
                        <span>Phantom</span>
                    </button>
                    <button class="mwa-wallet-btn" data-wallet="solflare">
                        <img src="assets/wallets/solflare.svg" alt="Solflare" onerror="this.style.display='none'">
                        <span>Solflare</span>
                    </button>
                    <button class="mwa-wallet-btn" data-wallet="backpack">
                        <img src="assets/wallets/backpack.svg" alt="Backpack" onerror="this.style.display='none'">
                        <span>Backpack</span>
                    </button>
                </div>
                <p class="mwa-modal-note">This will open the wallet app with this dApp inside it.</p>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #mwa-wallet-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .mwa-modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
        }
        .mwa-modal-content {
            position: relative;
            background: #1a1a2e;
            border-radius: 16px;
            width: 90%;
            max-width: 360px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .mwa-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .mwa-modal-header h3 {
            margin: 0;
            color: #fff;
            font-size: 18px;
        }
        .mwa-modal-close {
            background: none;
            border: none;
            color: #888;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }
        .mwa-modal-body {
            padding: 20px;
        }
        .mwa-modal-desc {
            color: #aaa;
            margin: 0 0 16px;
            font-size: 14px;
        }
        .mwa-wallet-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .mwa-wallet-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .mwa-wallet-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }
        .mwa-wallet-btn img {
            width: 32px;
            height: 32px;
            border-radius: 8px;
        }
        .mwa-modal-note {
            color: #666;
            font-size: 12px;
            margin: 16px 0 0;
            text-align: center;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Event handlers
    modal.querySelector('.mwa-modal-close').addEventListener('click', () => {
        modal.remove();
        style.remove();
    });
    
    modal.querySelector('.mwa-modal-backdrop').addEventListener('click', () => {
        modal.remove();
        style.remove();
    });
    
    modal.querySelectorAll('.mwa-wallet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const wallet = btn.dataset.wallet;
            const config = WALLET_CONFIGS[wallet];
            
            if (config && config.universalLink) {
                // Open the wallet's in-app browser with our dApp
                const link = config.universalLink(currentUrl);
                console.log(`[MWA] Opening ${config.name}:`, link);
                
                // Use window.open with _self to replace current page
                window.location.href = link;
            }
            
            modal.remove();
            style.remove();
        });
    });
}

// ==========================================================================
// Main MWA Functions
// ==========================================================================

/**
 * Connect using Mobile Wallet Adapter
 * On Android, this shows a wallet selector that opens the dApp in wallet's browser
 */
async function mwaConnect() {
    console.log('[MWA] mwaConnect called');
    
    // First check if we already have an injected provider
    const injected = getInjectedProvider();
    if (injected) {
        console.log(`[MWA] Found injected provider: ${injected.name}`);
        return injected;
    }
    
    // Check if we're on Android
    if (!isAndroid()) {
        throw new Error('MWA is only available on Android devices');
    }
    
    // Show wallet selector modal
    showMWAWalletSelector();
}

/**
 * Transact function - for compatibility with app.js
 */
async function transact(callback, config = {}) {
    console.log('[MWA] transact called');
    
    // Check for injected provider first
    const injected = getInjectedProvider();
    if (injected) {
        console.log(`[MWA] Using injected provider: ${injected.name}`);
        
        // Create a wallet-like interface for the callback
        const wallet = {
            authorize: async (authConfig) => {
                try {
                    const resp = await injected.provider.connect();
                    return {
                        accounts: [{
                            address: resp.publicKey.toString(),
                            publicKey: resp.publicKey
                        }],
                        auth_token: null
                    };
                } catch (e) {
                    throw e;
                }
            },
            signTransactions: async (txs) => {
                return await injected.provider.signAllTransactions(txs);
            },
            signMessages: async (msgs) => {
                const results = [];
                for (const msg of msgs) {
                    const sig = await injected.provider.signMessage(msg);
                    results.push(sig);
                }
                return results;
            }
        };
        
        return await callback(wallet);
    }
    
    // No injected provider - show wallet selector
    if (isAndroid()) {
        showMWAWalletSelector();
        // Return a promise that never resolves (user will be redirected)
        return new Promise(() => {});
    }
    
    throw new Error('No wallet provider available');
}

// ==========================================================================
// Wallet Deep Links (for direct wallet connection)
// ==========================================================================

function openWalletBrowser(wallet, url = window.location.href) {
    const config = WALLET_CONFIGS[wallet.toLowerCase()];
    if (config && config.universalLink) {
        window.location.href = config.universalLink(url);
        return true;
    }
    return false;
}

// ==========================================================================
// Exports
// ==========================================================================

window.transact = transact;
window.mwaConnect = mwaConnect;
window.isAndroid = isAndroid;
window.isSeeker = isSeeker;
window.getInjectedProvider = getInjectedProvider;
window.openWalletBrowser = openWalletBrowser;
window.showMWAWalletSelector = showMWAWalletSelector;
window.WALLET_CONFIGS = WALLET_CONFIGS;

console.log('[MWA] Loaded. Android:', isAndroid(), 'Seeker:', isSeeker(), 'Injected:', getInjectedProvider()?.name || 'none');
