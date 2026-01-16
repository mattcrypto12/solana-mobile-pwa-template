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
const SEQUENCE_NUMBER_BYTES = 4;
const INITIALIZATION_VECTOR_BYTES = 12;
const ENCODED_PUBLIC_KEY_LENGTH_BYTES = 65;

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

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function base64ToUrlSafe(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getRandomPort() {
    // Per MWA spec: random port between 49152 and 65535
    return 49152 + Math.floor(Math.random() * (65535 - 49152 + 1));
}

// ==========================================================================
// Encryption Utilities (from official MWA spec)
// ==========================================================================

function createSequenceNumberVector(sequenceNumber) {
    if (sequenceNumber >= 4294967296) {
        throw new Error('Outbound sequence number overflow');
    }
    const byteArray = new ArrayBuffer(SEQUENCE_NUMBER_BYTES);
    const view = new DataView(byteArray);
    view.setUint32(0, sequenceNumber, false); // big-endian
    return new Uint8Array(byteArray);
}

async function parseHelloRsp(payloadBuffer, associationPublicKey, ecdhPrivateKey) {
    // Import wallet's ECDH public key from response
    const walletPublicKey = await crypto.subtle.importKey(
        'raw',
        payloadBuffer.slice(0, ENCODED_PUBLIC_KEY_LENGTH_BYTES),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );
    
    // Derive shared secret using ECDH
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: walletPublicKey },
        ecdhPrivateKey,
        256
    );
    
    // Import shared secret for HKDF
    const ecdhSecretKey = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        'HKDF',
        false,
        ['deriveKey']
    );
    
    // Derive AES-GCM key using HKDF
    const associationPublicKeyBuffer = await crypto.subtle.exportKey('raw', associationPublicKey);
    const aesKey = await crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(associationPublicKeyBuffer),
            info: new Uint8Array(),
        },
        ecdhSecretKey,
        { name: 'AES-GCM', length: 128 },
        false,
        ['encrypt', 'decrypt']
    );
    
    return aesKey;
}

async function encryptMessage(plaintext, sequenceNumber, sharedSecret) {
    const sequenceNumberVector = createSequenceNumberVector(sequenceNumber);
    const initializationVector = new Uint8Array(INITIALIZATION_VECTOR_BYTES);
    crypto.getRandomValues(initializationVector);
    
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: initializationVector,
            additionalData: sequenceNumberVector,
            tagLength: 128,
        },
        sharedSecret,
        new TextEncoder().encode(plaintext)
    );
    
    const response = new Uint8Array(
        sequenceNumberVector.byteLength + initializationVector.byteLength + ciphertext.byteLength
    );
    response.set(sequenceNumberVector, 0);
    response.set(initializationVector, sequenceNumberVector.byteLength);
    response.set(new Uint8Array(ciphertext), sequenceNumberVector.byteLength + initializationVector.byteLength);
    return response;
}

async function decryptMessage(message, sharedSecret) {
    const sequenceNumberVector = message.slice(0, SEQUENCE_NUMBER_BYTES);
    const initializationVector = message.slice(SEQUENCE_NUMBER_BYTES, SEQUENCE_NUMBER_BYTES + INITIALIZATION_VECTOR_BYTES);
    const ciphertext = message.slice(SEQUENCE_NUMBER_BYTES + INITIALIZATION_VECTOR_BYTES);
    
    const plaintextBuffer = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: initializationVector,
            additionalData: sequenceNumberVector,
            tagLength: 128,
        },
        sharedSecret,
        ciphertext
    );
    
    return new TextDecoder('utf-8').decode(plaintextBuffer);
}

async function encryptJsonRpcMessage(jsonRpcMessage, sharedSecret) {
    const plaintext = JSON.stringify(jsonRpcMessage);
    const sequenceNumber = jsonRpcMessage.id;
    return encryptMessage(plaintext, sequenceNumber, sharedSecret);
}

async function decryptJsonRpcMessage(message, sharedSecret) {
    const plaintext = await decryptMessage(message, sharedSecret);
    const jsonRpcMessage = JSON.parse(plaintext);
    if (jsonRpcMessage.error) {
        throw new Error(`MWA Error ${jsonRpcMessage.error.code}: ${jsonRpcMessage.error.message}`);
    }
    return jsonRpcMessage;
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
        let sharedSecret = null;
        let nextMessageId = 1;
        const pendingRequests = new Map();
        
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
        
        const sendRequest = async (method, params) => {
            const id = nextMessageId++;
            const request = {
                id,
                jsonrpc: '2.0',
                method,
                params
            };
            
            console.log('[MWA] Sending request:', method);
            
            const encryptedMsg = await encryptJsonRpcMessage(request, sharedSecret);
            socket.send(encryptedMsg);
            
            return new Promise((resolveReq, rejectReq) => {
                pendingRequests.set(id, { resolve: resolveReq, reject: rejectReq });
            });
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
            state = { 
                type: 'hello_sent', 
                ecdhKeypair,
                associationPublicKey: associationKeypair.publicKey
            };
        };
        
        const handleClose = (evt) => {
            console.log('[MWA] WebSocket closed:', evt.code, evt.reason);
            cleanup();
            if (!evt.wasClean && state.type !== 'done') {
                reject(new Error(`Session closed unexpectedly: ${evt.code} ${evt.reason}`));
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
            console.log('[MWA] Received message, state:', state.type);
            
            try {
                // Handle binary messages
                let dataBuffer;
                if (evt.data instanceof Blob) {
                    dataBuffer = await evt.data.arrayBuffer();
                } else if (evt.data instanceof ArrayBuffer) {
                    dataBuffer = evt.data;
                } else {
                    console.error('[MWA] Unexpected message type');
                    return;
                }
                
                if (state.type === 'hello_sent') {
                    // Parse HELLO_RSP and derive shared secret
                    console.log('[MWA] Parsing HELLO_RSP...');
                    sharedSecret = await parseHelloRsp(
                        dataBuffer,
                        state.associationPublicKey,
                        state.ecdhKeypair.privateKey
                    );
                    
                    console.log('[MWA] Session encrypted! Shared secret derived.');
                    state = { type: 'session_ready' };
                    
                    // Create the wallet API with real encrypted messaging
                    const wallet = {
                        authorize: async (params) => {
                            console.log('[MWA] authorize called');
                            const result = await sendRequest('authorize', params);
                            return result.result;
                        },
                        reauthorize: async (params) => {
                            console.log('[MWA] reauthorize called');
                            const result = await sendRequest('reauthorize', params);
                            return result.result;
                        },
                        deauthorize: async (params) => {
                            console.log('[MWA] deauthorize called');
                            const result = await sendRequest('deauthorize', params);
                            return result.result;
                        },
                        signTransactions: async (params) => {
                            console.log('[MWA] signTransactions called');
                            const result = await sendRequest('sign_transactions', params);
                            return result.result;
                        },
                        signMessages: async (params) => {
                            console.log('[MWA] signMessages called');
                            const result = await sendRequest('sign_messages', params);
                            return result.result;
                        },
                        signAndSendTransactions: async (params) => {
                            console.log('[MWA] signAndSendTransactions called');
                            const result = await sendRequest('sign_and_send_transactions', params);
                            return result.result;
                        }
                    };
                    
                    // Execute the callback with the wallet API
                    try {
                        const result = await callback(wallet);
                        state = { type: 'done' };
                        cleanup();
                        socket.close(1000, 'Normal closure');
                        resolve(result);
                    } catch (e) {
                        state = { type: 'done' };
                        cleanup();
                        socket.close(1000, 'Error in callback');
                        reject(e);
                    }
                    
                } else if (state.type === 'session_ready' || state.type === 'waiting_response') {
                    // Decrypt and handle JSON-RPC response
                    const response = await decryptJsonRpcMessage(dataBuffer, sharedSecret);
                    console.log('[MWA] Received response for id:', response.id);
                    
                    const pending = pendingRequests.get(response.id);
                    if (pending) {
                        pendingRequests.delete(response.id);
                        pending.resolve(response);
                    }
                }
            } catch (e) {
                console.error('[MWA] Error handling message:', e);
                // Check if this was a pending request error
                if (e.message && e.message.startsWith('MWA Error')) {
                    // Protocol error from wallet
                    cleanup();
                    socket.close();
                    reject(e);
                }
            }
        };
        
        const attemptConnection = () => {
            console.log('[MWA] Attempting WebSocket connection...');
            socket = new WebSocket(websocketURL, [WEBSOCKET_PROTOCOL]);
            socket.binaryType = 'arraybuffer';
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
