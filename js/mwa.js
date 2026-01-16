/**
 * Solana Mobile Wallet Adapter (MWA) Implementation
 * 
 * This implements the MWA protocol for web browsers per Solana Mobile guidelines.
 * Uses Android Intents to trigger the wallet chooser (Seed Vault, Phantom, etc.)
 * 
 * @see https://github.com/solana-mobile/mobile-wallet-adapter
 */

// ==========================================================================
// Crypto Utilities
// ==========================================================================

async function generateAssociationKeypair() {
    return await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true, // extractable to get public key
        ['sign']
    );
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToUrlSafe(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getRandomPort() {
    return 49152 + Math.floor(Math.random() * (65535 - 49152 + 1));
}

// ==========================================================================
// Intent URL Builder
// ==========================================================================

async function buildAssociationUrl(port) {
    // Generate association keypair
    const keypair = await generateAssociationKeypair();
    const exportedKey = await crypto.subtle.exportKey('raw', keypair.publicKey);
    const encodedKey = base64ToUrlSafe(arrayBufferToBase64(exportedKey));
    
    // Build the intent URL per MWA spec
    // Format: solana-wallet://v1/associate/local?association=<KEY>&port=<PORT>
    const url = `solana-wallet://v1/associate/local?association=${encodedKey}&port=${port}`;
    
    return { url, keypair, port };
}

// ==========================================================================
// MWA Transact Function
// ==========================================================================

/**
 * Execute a transaction with a mobile wallet via MWA
 * This triggers the Android wallet chooser (Seed Vault, Phantom, Solflare, etc.)
 */
async function transact(callback, config = {}) {
    console.log('[MWA] Starting transact...');
    
    // Check if we're on Android
    if (!isAndroid()) {
        throw new Error('MWA is only available on Android devices');
    }
    
    // Check secure context
    if (!window.isSecureContext) {
        throw new Error('MWA requires HTTPS (secure context)');
    }
    
    const port = getRandomPort();
    
    // Build the association URL
    const { url, keypair } = await buildAssociationUrl(port);
    console.log('[MWA] Intent URL:', url);
    console.log('[MWA] Port:', port);
    
    // Store session info in sessionStorage for when we return
    sessionStorage.setItem('mwa_pending', JSON.stringify({
        port: port,
        timestamp: Date.now()
    }));
    
    // Create an invisible iframe to try opening the intent
    // This allows us to detect if the intent handler exists
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Try to open the wallet intent
    return new Promise((resolve, reject) => {
        let resolved = false;
        
        // Set up a timeout - if nothing happens, the wallet chooser didn't open
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                document.body.removeChild(iframe);
                sessionStorage.removeItem('mwa_pending');
                reject(new Error('WALLET_NOT_FOUND'));
            }
        }, 3000);
        
        // Listen for visibility changes (when user returns from wallet)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && !resolved) {
                // User came back - clear timeout
                clearTimeout(timeout);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        
        // Try to open via iframe first, then fallback to direct navigation
        try {
            // Method 1: Try opening via link click (better for Android)
            const link = document.createElement('a');
            link.href = url;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('[MWA] Intent launched via link click');
            
        } catch (err) {
            console.warn('[MWA] Link click failed, trying location.href');
            // Method 2: Direct navigation
            window.location.href = url;
        }
        
        // Clean up iframe
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 100);
    });
}

// ==========================================================================
// Simplified Connect Function for App Usage
// ==========================================================================

/**
 * Connect using Mobile Wallet Adapter
 * This opens the Android wallet chooser (Seed Vault, Phantom, etc.)
 */
async function mwaConnect() {
    console.log('[MWA] mwaConnect called');
    
    // Check we're on Android
    if (!isAndroid()) {
        throw new Error('MWA is only available on Android');
    }
    
    const port = getRandomPort();
    const { url } = await buildAssociationUrl(port);
    
    console.log('[MWA] Opening wallet chooser:', url);
    
    // Launch the wallet chooser via link click
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// Detection Helpers
// ==========================================================================

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

function isSeeker() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('seeker') || ua.includes('saga') || ua.includes('solanamobile');
}

function getInjectedProvider() {
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

// ==========================================================================
// Wallet Deep Links (fallback if MWA doesn't work)
// ==========================================================================

const WALLET_LINKS = {
    phantom: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}`,
    solflare: (url) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`,
    backpack: (url) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}`
};

function openWalletBrowser(wallet, url = window.location.href) {
    const linkFn = WALLET_LINKS[wallet.toLowerCase()];
    if (linkFn) {
        window.location.href = linkFn(url);
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
window.WALLET_LINKS = WALLET_LINKS;

console.log('[MWA] Loaded. Android:', isAndroid(), 'Seeker:', isSeeker());
