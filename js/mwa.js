/**
 * Solana Mobile Wallet Adapter (MWA) Implementation
 * 
 * This module implements the Mobile Wallet Adapter protocol, which allows
 * web applications to communicate with Solana wallets on mobile devices.
 * 
 * Protocol Overview:
 * 1. App generates an association keypair (ECDSA P-256) for identity
 * 2. App opens a wallet via solana-wallet:// URL with public key + port
 * 3. Wallet connects back via WebSocket on localhost
 * 4. Both sides perform ECDH key exchange for encrypted communication
 * 5. All subsequent messages are encrypted with AES-GCM-128
 * 
 * Security Model:
 * - Association keypair proves app identity across sessions
 * - ECDH provides forward secrecy for each session.
 * - AES-GCM ensures message confidentiality and integrity.
 * 
 * Based on the official @solana-mobile/mobile-wallet-adapter-protocol
 * @see https://github.com/solana-mobile/mobile-wallet-adapter
 * @see https://docs.solanamobile.com/reference/typescript/mobile-wallet-adapter
 */

// ==========================================================================
// Constants
// ==========================================================================

/**
 * WebSocket connection configuration.
 * The wallet may take time to respond, so we use a retry strategy with
 * increasing delays to avoid overwhelming the connection.
 */
const WEBSOCKET_CONNECTION_CONFIG = {
    retryDelayScheduleMs: [150, 150, 200, 500, 500, 750, 750, 1000], // Delays between retry attempts
    timeoutMs: 30000, // Total timeout before giving up (30 seconds)
};

/** MWA WebSocket subprotocol identifier */
const WEBSOCKET_PROTOCOL = 'com.solana.mobilewalletadapter.v1';

/** Number of bytes for the message sequence number (uint32) */
const SEQUENCE_NUMBER_BYTES = 4;

/** Number of bytes for AES-GCM initialization vector */
const INITIALIZATION_VECTOR_BYTES = 12;

/** Length of uncompressed EC P-256 public key (1 byte prefix + 32 bytes X + 32 bytes Y) */
const ENCODED_PUBLIC_KEY_LENGTH_BYTES = 65;

// ==========================================================================
// Crypto Utilities
// ==========================================================================

/**
 * Generates an ECDSA P-256 keypair for association.
 * The public key is sent to the wallet to identify this app.
 * The private key is used to sign the ECDH public key in HELLO_REQ.
 * @returns {Promise<CryptoKeyPair>} ECDSA keypair
 */
async function generateAssociationKeypair() {
    return await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
    );
}

/**
 * Generates an ECDH P-256 keypair for session encryption.
 * This keypair is used for Diffie-Hellman key exchange with the wallet
 * to derive a shared secret for AES-GCM encryption.
 * @returns {Promise<CryptoKeyPair>} ECDH keypair
 */
async function generateECDHKeypair() {
    return await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey', 'deriveBits']
    );
}

/** Converts an ArrayBuffer to a standard base64 string */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Converts a base64 string to an ArrayBuffer */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/** Converts standard base64 to URL-safe base64 (used in association URL) */
function base64ToUrlSafe(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a random port for WebSocket server.
 * Per MWA spec, ports must be in the ephemeral range (49152-65535).
 */
function getRandomPort() {
    return 49152 + Math.floor(Math.random() * (65535 - 49152 + 1));
}

// ==========================================================================
// Encryption Utilities
// 
// MWA uses AES-GCM-128 for message encryption after the ECDH handshake.
// Message format: [4-byte sequence number][12-byte IV][encrypted payload + auth tag]
// The sequence number is used as additional authenticated data (AAD).
// ==========================================================================

/**
 * Creates a 4-byte big-endian sequence number for message ordering.
 * Used as Additional Authenticated Data (AAD) in AES-GCM to prevent replay attacks.
 */
function createSequenceNumberVector(sequenceNumber) {
    if (sequenceNumber >= 4294967296) {
        throw new Error('Outbound sequence number overflow');
    }
    const byteArray = new ArrayBuffer(SEQUENCE_NUMBER_BYTES);
    const view = new DataView(byteArray);
    view.setUint32(0, sequenceNumber, false); // big-endian
    return new Uint8Array(byteArray);
}

/**
 * Parses the HELLO_RSP message from the wallet and derives the session encryption key.
 * 
 * HELLO_RSP Format:
 * - Bytes 0-64: Wallet's ECDH public key (uncompressed P-256, 65 bytes)
 * - Bytes 65+: Wallet's signature of our association public key (optional verification)
 * 
 * Key Derivation Process:
 * 1. Extract wallet's ECDH public key
 * 2. Perform ECDH to get shared secret (32 bytes)
 * 3. Use HKDF with association public key as salt to derive AES-GCM-128 key
 * 
 * @param {ArrayBuffer} payloadBuffer - Raw HELLO_RSP message bytes
 * @param {CryptoKey} associationPublicKey - Our association public key (used as HKDF salt)
 * @param {CryptoKey} ecdhPrivateKey - Our ECDH private key for Diffie-Hellman
 * @returns {Promise<CryptoKey>} AES-GCM-128 key for session encryption
 */
async function parseHelloRsp(payloadBuffer, associationPublicKey, ecdhPrivateKey) {
    // Validate minimum message length
    if (payloadBuffer.byteLength < ENCODED_PUBLIC_KEY_LENGTH_BYTES) {
        throw new Error(`HELLO_RSP too short: ${payloadBuffer.byteLength} < ${ENCODED_PUBLIC_KEY_LENGTH_BYTES}`);
    }
    
    // Step 1: Extract and import wallet's ECDH public key
    const walletPublicKeyBytes = payloadBuffer.slice(0, ENCODED_PUBLIC_KEY_LENGTH_BYTES);
    
    const walletPublicKey = await crypto.subtle.importKey(
        'raw',
        walletPublicKeyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );
    
    // Step 2: Perform ECDH to derive shared secret (256 bits = 32 bytes)
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: walletPublicKey },
        ecdhPrivateKey,
        256
    );
    
    // Step 3: Import shared secret as HKDF key material
    const ecdhSecretKey = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        'HKDF',
        false,
        ['deriveKey']
    );
    
    // Step 4: Derive AES-GCM key using HKDF
    // Salt = our association public key (binds encryption to our identity)
    // Info = empty (per MWA spec)
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

/**
 * Encrypts a plaintext message using AES-GCM-128.
 * 
 * Output Format: [sequence_number (4)][iv (12)][ciphertext + auth_tag]
 * 
 * @param {string} plaintext - The message to encrypt
 * @param {number} sequenceNumber - Message sequence number (also used as request ID)
 * @param {CryptoKey} sharedSecret - AES-GCM key from parseHelloRsp
 * @returns {Promise<Uint8Array>} Encrypted message ready for WebSocket transmission
 */
async function encryptMessage(plaintext, sequenceNumber, sharedSecret) {
    const sequenceNumberVector = createSequenceNumberVector(sequenceNumber);
    const initializationVector = new Uint8Array(INITIALIZATION_VECTOR_BYTES);
    crypto.getRandomValues(initializationVector); // Random IV for each message
    
    // AES-GCM encryption with sequence number as additional authenticated data
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: initializationVector,
            additionalData: sequenceNumberVector, // Binds sequence number to ciphertext
            tagLength: 128,
        },
        sharedSecret,
        new TextEncoder().encode(plaintext)
    );
    
    // Combine: [seq_num][iv][ciphertext]
    const response = new Uint8Array(
        sequenceNumberVector.byteLength + initializationVector.byteLength + ciphertext.byteLength
    );
    response.set(sequenceNumberVector, 0);
    response.set(initializationVector, sequenceNumberVector.byteLength);
    response.set(new Uint8Array(ciphertext), sequenceNumberVector.byteLength + initializationVector.byteLength);
    return response;
}

/**
 * Decrypts an AES-GCM encrypted message from the wallet.
 * 
 * @param {Uint8Array} message - Encrypted message [seq_num][iv][ciphertext]
 * @param {CryptoKey} sharedSecret - AES-GCM key from parseHelloRsp
 * @returns {Promise<string>} Decrypted plaintext (JSON-RPC message)
 */
async function decryptMessage(message, sharedSecret) {
    // Parse message components
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

/** Encrypts a JSON-RPC request object. Uses request ID as sequence number. */
async function encryptJsonRpcMessage(jsonRpcMessage, sharedSecret) {
    const plaintext = JSON.stringify(jsonRpcMessage);
    const sequenceNumber = jsonRpcMessage.id;
    return encryptMessage(plaintext, sequenceNumber, sharedSecret);
}

/** Decrypts a JSON-RPC response. Throws if response contains an error. */
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

/**
 * Builds the solana-wallet:// URL that launches the wallet app.
 * 
 * URL Format: solana-wallet:/v1/associate/local?association=<pubkey>&port=<port>&v=v1
 * 
 * @param {CryptoKey} associationPublicKey - Our ECDSA public key
 * @param {number} port - WebSocket port the wallet should connect to
 * @returns {Promise<URL>} The association URL to open
 */
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

/**
 * Creates a promise that resolves when the browser loses focus (wallet opened)
 * or rejects after 3 seconds (no wallet found).
 * 
 * This detection method works because launching the wallet app causes our
 * browser/PWA to lose focus. If no wallet handles the intent, focus stays.
 */
function getDetectionPromise() {
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

/** Opens the wallet via solana-wallet:// URL and waits for it to launch */
async function launchAssociation(associationUrl) {
    try {
        const detectionPromise = getDetectionPromise();
        window.location.assign(associationUrl.toString());
        await detectionPromise;
    } catch (e) {
        throw new Error('ERROR_WALLET_NOT_FOUND: Found no installed wallet that supports the mobile wallet protocol.');
    }
}

/** Initiates a session by generating a port, building the URL, and launching the wallet */
async function startSession(associationPublicKey) {
    const port = getRandomPort();
    const associationUrl = await getAssociateAndroidIntentURL(associationPublicKey, port);
    await launchAssociation(associationUrl);
    return port;
}

// ==========================================================================
// Hello Request Creation
// ==========================================================================

/**
 * Creates the HELLO_REQ message to send to the wallet.
 * 
 * Format: [ECDH public key (65 bytes)][ECDSA signature of ECDH public key]
 * 
 * The signature proves we control the association keypair, preventing
 * man-in-the-middle attacks during the handshake.
 */
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
 * Execute a wallet operation via the Mobile Wallet Adapter protocol.
 * 
 * This function handles the complete MWA session lifecycle:
 * 1. Generates association keypair (ECDSA P-256) for app identity
 * 2. Opens wallet via solana-wallet:// URL (shows Android wallet chooser)
 * 3. Wallet connects back via WebSocket on localhost
 * 4. Performs ECDH handshake for encrypted session
 * 5. Executes your callback with the encrypted wallet API
 * 6. Cleans up WebSocket connection
 * 
 * @example
 * const result = await transact(async (wallet) => {
 *     const auth = await wallet.authorize({
 *         identity: { name: 'My App', uri: origin, icon: '/icon.png' },
 *         chain: 'solana:devnet'
 *     });
 *     return auth;
 * });
 * 
 * @param {Function} callback - Async function receiving the wallet API object
 * @param {Object} config - Optional configuration (reserved for future use)
 * @returns {Promise<any>} - Result from your callback function
 * @throws {Error} WALLET_NOT_FOUND - No compatible wallet installed
 * @throws {Error} SESSION_TIMEOUT - WebSocket connection timed out
 * @throws {Error} MWA Error - Wallet returned an error response
 */
async function transact(callback, config = {}) {
    // MWA requires HTTPS because it uses crypto.subtle APIs
    if (typeof window === 'undefined' || !window.isSecureContext) {
        throw new Error('ERROR_SECURE_CONTEXT_REQUIRED: MWA protocol requires HTTPS.');
    }
    
    // Step 1: Generate association keypair for app identity
    const associationKeypair = await generateAssociationKeypair();
    
    // Step 2: Launch wallet and get WebSocket port
    const sessionPort = await startSession(associationKeypair.publicKey);
    
    // Step 3: Connect to wallet's local WebSocket server
    const websocketURL = `ws://localhost:${sessionPort}/solana-wallet`;
    
    // Retry configuration for WebSocket connection
    let connectionStartTime = Date.now();
    const retrySchedule = [...WEBSOCKET_CONNECTION_CONFIG.retryDelayScheduleMs];
    const getNextRetryDelayMs = () => retrySchedule.length > 1 ? retrySchedule.shift() : retrySchedule[0];
    
    return new Promise((resolve, reject) => {
        let socket;
        let retryTimeoutId;
        let state = { type: 'connecting' }; // State machine: connecting -> hello_sent -> session_ready -> done
        let sharedSecret = null; // AES-GCM key derived from ECDH
        let nextMessageId = 1; // JSON-RPC request ID counter
        const pendingRequests = new Map(); // Maps request ID to {resolve, reject}
        
        // Cleanup function to remove all event listeners
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
            
            const encryptedMsg = await encryptJsonRpcMessage(request, sharedSecret);
            socket.send(encryptedMsg);
            
            return new Promise((resolveReq, rejectReq) => {
                pendingRequests.set(id, { resolve: resolveReq, reject: rejectReq });
            });
        };
        
        const handleOpen = async () => {
            state = { type: 'connected' };
            
            // Generate ECDH keypair for session encryption
            const ecdhKeypair = await generateECDHKeypair();
            
            // Send HELLO_REQ
            const helloReq = await createHelloReq(ecdhKeypair.publicKey, associationKeypair.privateKey);
            socket.send(helloReq);
            
            state = { 
                type: 'hello_sent', 
                ecdhKeypair,
                associationPublicKey: associationKeypair.publicKey
            };
        };
        
        const handleClose = (evt) => {
            cleanup();
            if (!evt.wasClean && state.type !== 'done') {
                reject(new Error(`Session closed unexpectedly: ${evt.code} ${evt.reason}`));
            }
        };
        
        const handleError = async (evt) => {
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
            try {
                // Handle binary messages
                let dataBuffer;
                if (evt.data instanceof Blob) {
                    dataBuffer = await evt.data.arrayBuffer();
                } else if (evt.data instanceof ArrayBuffer) {
                    dataBuffer = evt.data;
                } else {
                    return;
                }
                
                if (state.type === 'hello_sent') {
                    // Parse HELLO_RSP and derive shared secret
                    sharedSecret = await parseHelloRsp(
                        dataBuffer,
                        state.associationPublicKey,
                        state.ecdhKeypair.privateKey
                    );
                    
                    state = { type: 'session_ready' };
                    
                    // Create the wallet API with real encrypted messaging
                    const wallet = {
                        authorize: async (params) => {
                            const result = await sendRequest('authorize', params);
                            return result.result;
                        },
                        reauthorize: async (params) => {
                            const result = await sendRequest('reauthorize', params);
                            return result.result;
                        },
                        deauthorize: async (params) => {
                            const result = await sendRequest('deauthorize', params);
                            return result.result;
                        },
                        signTransactions: async (params) => {
                            const result = await sendRequest('sign_transactions', params);
                            return result.result;
                        },
                        signMessages: async (params) => {
                            const result = await sendRequest('sign_messages', params);
                            return result.result;
                        },
                        signAndSendTransactions: async (params) => {
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
                    
                    const pending = pendingRequests.get(response.id);
                    if (pending) {
                        pendingRequests.delete(response.id);
                        pending.resolve(response);
                    }
                }
            } catch (e) {
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
