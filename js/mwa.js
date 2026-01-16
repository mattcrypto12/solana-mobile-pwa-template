/**
 * Solana Mobile Wallet Adapter (MWA) Implementation
 * 
 * Based on the official @solana-mobile/mobile-wallet-adapter-protocol
 * @see https://github.com/solana-mobile/mobile-wallet-adapter
 */

// ==========================================================================
// Constants
// ==========================================================================

const WEBSOCKET_CONNECTION_CONFIG = {
    retryDelayScheduleMs: [150, 150, 200, 500, 500, 750, 750, 1000],
    timeoutMs: 30000,
};

const WEBSOCKET_PROTOCOL = 'com.solana.mobilewalletadapter.v1';

// ==========================================================================
// Crypto Utilities
// ==========================================================================

async function generateAssociationKeypair() {
    return await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
    );
}

async function generateECDHKeypair() {
    return await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey', 'deriveBits']
    );
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToUrlSafe(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getRandomPort() {
    // Per MWA spec: random port between 49152 and 65535
    return 49152 + Math.floor(Math.random() * (65535 - 49152 + 1));
}

// ==========================================================================
// Association URL
// ==========================================================================

async function getAssociateAndroidIntentURL(associationPublicKey, port) {
    const exportedKey = await crypto.subtle.exportKey('raw', associationPublicKey);
    const encodedKey = base64ToUrlSafe(arrayBufferToBase64(exportedKey));
    
    // Build the URL per MWA spec
    const url = new URL('solana-wallet:/v1/associate/local');
    url.searchParams.set('association', encodedKey);
    url.searchParams.set('port', port.toString());
    url.searchParams.set('v', 'v1');
    
    return url;
}

// ==========================================================================
// Session Launcher
// ==========================================================================

function getDetectionPromise() {
    // Wait to see if browser loses focus (wallet opened)
    return new Promise((resolve, reject) => {
        function cleanup() {
            clearTimeout(timeoutId);
            window.removeEventListener('blur', handleBlur);
        }
        function handleBlur() {
            cleanup();
            resolve();
        }
        window.addEventListener('blur', handleBlur);
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('WALLET_NOT_FOUND'));
        }, 3000);
    });
}

async function launchAssociation(associationUrl) {
    console.log('[MWA] Launching association URL:', associationUrl.toString());
    
    try {
        const detectionPromise = getDetectionPromise();
        
        // Launch the wallet intent
        window.location.assign(associationUrl.toString());
        
        // Wait for wallet to open (blur event) or timeout
        await detectionPromise;
        
        console.log('[MWA] Wallet opened (blur detected)');
    } catch (e) {
        console.error('[MWA] Launch failed:', e);
        throw new Error('ERROR_WALLET_NOT_FOUND: Found no installed wallet that supports the mobile wallet protocol.');
    }
}

async function startSession(associationPublicKey) {
    const port = getRandomPort();
    const associationUrl = await getAssociateAndroidIntentURL(associationPublicKey, port);
    await launchAssociation(associationUrl);
    return port;
}

// ==========================================================================
// Hello Request Creation
// ==========================================================================

async function createHelloReq(ecdhPublicKey, associationPrivateKey) {
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', ecdhPublicKey);
    const signatureBuffer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        associationPrivateKey,
        publicKeyBuffer
    );
    
    const response = new Uint8Array(publicKeyBuffer.byteLength + signatureBuffer.byteLength);
    response.set(new Uint8Array(publicKeyBuffer), 0);
    response.set(new Uint8Array(signatureBuffer), publicKeyBuffer.byteLength);
    return response;
}

// ==========================================================================
// Main Transact Function
// ==========================================================================

/**
 * Execute a transaction with a mobile wallet via MWA protocol.
 * This triggers the Android wallet chooser (Seed Vault, Phantom, etc.)
 * 
 * @param {Function} callback - Called with the wallet API once connected
 * @param {Object} config - Optional configuration
 * @returns {Promise} - Result from the callback
 */
async function transact(callback, config = {}) {
    // Ensure we're in a secure context
    if (typeof window === 'undefined' || !window.isSecureContext) {
        throw new Error('ERROR_SECURE_CONTEXT_REQUIRED: MWA protocol requires HTTPS.');
    }
    
    console.log('[MWA] Starting transact...');
    
    // Generate association keypair
    const associationKeypair = await generateAssociationKeypair();
    
    // Start session (launches wallet intent and returns port)
    const sessionPort = await startSession(associationKeypair.publicKey);
    
    const websocketURL = `ws://localhost:${sessionPort}/solana-wallet`;
    console.log('[MWA] Connecting to WebSocket:', websocketURL);
    
    let connectionStartTime = Date.now();
    const retrySchedule = [...WEBSOCKET_CONNECTION_CONFIG.retryDelayScheduleMs];
    const getNextRetryDelayMs = () => retrySchedule.length > 1 ? retrySchedule.shift() : retrySchedule[0];
    
    return new Promise((resolve, reject) => {
        let socket;
        let retryTimeoutId;
        let state = { type: 'connecting' };
        
        const cleanup = () => {
            if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
            }
            if (socket) {
                socket.removeEventListener('open', handleOpen);
                socket.removeEventListener('close', handleClose);
                socket.removeEventListener('error', handleError);
                socket.removeEventListener('message', handleMessage);
            }
        };
        
        const handleOpen = async () => {
            console.log('[MWA] WebSocket connected!');
            state = { type: 'connected' };
            
            // Generate ECDH keypair for session encryption
            const ecdhKeypair = await generateECDHKeypair();
            
            // Send HELLO_REQ
            const helloReq = await createHelloReq(ecdhKeypair.publicKey, associationKeypair.privateKey);
            socket.send(helloReq);
            
            console.log('[MWA] Sent HELLO_REQ');
            state = { type: 'hello_sent', ecdhKeypair };
        };
        
        const handleClose = (evt) => {
            console.log('[MWA] WebSocket closed:', evt.code, evt.reason);
            if (state.type === 'connected' || state.type === 'session_ready') {
                cleanup();
                if (evt.wasClean) {
                    // Normal close
                } else {
                    reject(new Error(`Session closed unexpectedly: ${evt.code} ${evt.reason}`));
                }
            }
        };
        
        const handleError = async (evt) => {
            console.log('[MWA] WebSocket error, will retry...');
            cleanup();
            
            const elapsed = Date.now() - connectionStartTime;
            if (elapsed >= WEBSOCKET_CONNECTION_CONFIG.timeoutMs) {
                reject(new Error('ERROR_SESSION_TIMEOUT: Failed to connect to wallet WebSocket.'));
            } else {
                const delay = getNextRetryDelayMs();
                retryTimeoutId = setTimeout(() => {
                    attemptConnection();
                }, delay);
            }
        };
        
        const handleMessage = async (evt) => {
            console.log('[MWA] Received message');
            const data = evt.data;
            
            if (state.type === 'hello_sent') {
                // This should be HELLO_RSP with wallet's ECDH public key
                console.log('[MWA] Received HELLO_RSP, session established!');
                state = { type: 'session_ready' };
                
                // Create a simple wallet interface for the callback
                // Note: Full implementation would include encryption/decryption
                const wallet = {
                    authorize: async (params) => {
                        console.log('[MWA] authorize called with:', params);
                        // In real implementation, send encrypted JSON-RPC
                        return {
                            accounts: [],
                            auth_token: null
                        };
                    },
                    signTransactions: async (txs) => {
                        console.log('[MWA] signTransactions called');
                        return txs;
                    },
                    signMessages: async (msgs) => {
                        console.log('[MWA] signMessages called');
                        return msgs;
                    }
                };
                
                try {
                    const result = await callback(wallet);
                    cleanup();
                    socket.close();
                    resolve(result);
                } catch (e) {
                    cleanup();
                    socket.close();
                    reject(e);
                }
            }
        };
        
        const attemptConnection = () => {
            console.log('[MWA] Attempting WebSocket connection...');
            socket = new WebSocket(websocketURL, [WEBSOCKET_PROTOCOL]);
            socket.addEventListener('open', handleOpen);
            socket.addEventListener('close', handleClose);
            socket.addEventListener('error', handleError);
            socket.addEventListener('message', handleMessage);
        };
        
        // Start connecting
        attemptConnection();
    });
}

// ==========================================================================
// Helper Functions
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
// Exports
// ==========================================================================

window.transact = transact;
window.isAndroid = isAndroid;
window.isSeeker = isSeeker;
window.getInjectedProvider = getInjectedProvider;

console.log('[MWA] Loaded. Android:', isAndroid(), 'Seeker:', isSeeker());
