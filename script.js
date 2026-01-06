// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAIOBY18re2JDYY8br9OgGEnjBAyQAFsiU",
    authDomain: "my-walkie-talkie-app.firebaseapp.com",
    databaseURL: "https://my-walkie-talkie-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "my-walkie-talkie-app",
    storageBucket: "my-walkie-talkie-app.firebasestorage.app",
    messagingSenderId: "852251263438",
    appId: "1:852251263438:web:0393c53479f4cba535ab9f"
};

// Turnix.io Configuration (আপনার credentials)
const TURNIX_CREDENTIALS = {
    iceServers: [
        { urls: ["stun:stun.turnix.io:3478"] },
        {
            username: "e1f3be5f-aa41-4923-a821-5486876ae50a",
            credential: "b95df4075bd05f6bf732b1aedc8175d9",
            urls: [
                "turn:eu-central.turnix.io:3478?transport=udp",
                "turn:eu-central.turnix.io:3478?transport=tcp",
                "turns:eu-central.turnix.io:443?transport=udp",
                "turns:eu-central.turnix.io:443?transport=tcp"
            ]
        }
    ],
    expiresAt: "2026-01-06T15:14:22.277Z"
};

// Complete ICE Servers List with Turnix.io
const ICE_SERVERS = [
    // STUN Servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // ✅ Turnix.io TURN Servers (বাংলাদেশের নেটওয়ার্কের জন্য জরুরি)
    {
        urls: "turn:eu-central.turnix.io:3478?transport=udp",
        username: "e1f3be5f-aa41-4923-a821-5486876ae50a",
        credential: "b95df4075bd05f6bf732b1aedc8175d9"
    },
    {
        urls: "turn:eu-central.turnix.io:3478?transport=tcp",
        username: "e1f3be5f-aa41-4923-a821-5486876ae50a",
        credential: "b95df4075bd05f6bf732b1aedc8175d9"
    },
    {
        urls: "turns:eu-central.turnix.io:443?transport=tcp",
        username: "e1f3be5f-aa41-4923-a821-5486876ae50a",
        credential: "b95df4075bd05f6bf732b1aedc8175d9"
    }
];

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// DOM Elements
const authOverlay = document.getElementById('authOverlay');
const mainContainer = document.getElementById('mainContainer');
const loginModal = document.getElementById('loginModal');

// Authentication state
let currentUser = null;
let myId = null;
let authCheckCompleted = false;

// ==================== WEBRTC IMPROVEMENTS ====================

// Connection state variables
let peerConnection = null;
let localStream = null;
let dataChannel = null;
let currentFriendId = null;
let isConnected = false;
let isInitiator = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isTalking = false;
let isListening = false;
let audioLevelInterval = null;
let keepAliveInterval = null;
let connectionMonitorInterval = null;
let lastActivityTime = Date.now();
let isPageHidden = false;

// ✅ ICE Candidate Queue System (আপনার ভাইয়ের সমাধান)
let pendingIceCandidates = [];
let isRemoteDescriptionSet = false;
let iceConnectionStateLog = [];
let callTimeoutId = null;
const CALL_TIMEOUT = 30000; // 30 seconds

// Double tap mic lock variables
let isMicLocked = false;
let tapCount = 0;
let lastTapTime = 0;
const DOUBLE_TAP_INTERVAL = 500;
let tapTimeout = null;

// Background control variable
let isMicLockedForBg = false;

// ==================== GLOBAL STATUS FUNCTIONS ====================

// Update main status display (GLOBAL)
function updateStatus(type = "info", icon = "fas fa-signal", title = "Ready", details = "Waiting...") {
    try {
        const statusElement = document.getElementById('status');
        if (!statusElement) {
            console.warn("⚠️ Status element not found");
            return;
        }
        
        // Update status class
        statusElement.className = `status-message ${type}`;
        
        // Update icon
        const statusIcon = statusElement.querySelector('.status-icon i');
        if (statusIcon) {
            statusIcon.className = icon;
        }
        
        // Update title and details
        const statusTitle = document.getElementById('statusTitle');
        const statusDetails = document.getElementById('statusDetails');
        if (statusTitle) statusTitle.textContent = title;
        if (statusDetails) statusDetails.textContent = details;
        
        console.log(`✅ Status updated: ${title}`);
        
        // Update last activity time
        lastActivityTime = Date.now();
    } catch (error) {
        console.error("❌ Error updating status:", error);
    }
}

// Update audio status text (GLOBAL)
function updateAudioStatus(text = "Mic: Ready") {
    try {
        const audioStatus = document.getElementById('audioStatus');
        if (audioStatus) {
            audioStatus.textContent = text;
        }
    } catch (error) {
        console.error("❌ Error updating audio status:", error);
    }
}

// ==================== ICE CANDIDATE QUEUE SYSTEM ====================

// ✅ ICE Candidate Queue System (আপনার ভাইয়ের সমাধান)
async function addIceCandidate(candidate) {
    if (!peerConnection) return;
    
    if (isRemoteDescriptionSet) {
        // Remote description is set, add candidate immediately
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("✅ ICE candidate added immediately");
        } catch (error) {
            console.error("❌ Error adding ICE candidate:", error);
        }
    } else {
        // Queue the candidate
        pendingIceCandidates.push(candidate);
        console.log("📥 ICE candidate queued (remote description not set)");
    }
}

async function setRemoteDescription(description) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.setRemoteDescription(description);
        isRemoteDescriptionSet = true;
        console.log("✅ Remote description set");
        
        // Add all queued ICE candidates
        for (const candidate of pendingIceCandidates) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("✅ Queued ICE candidate added");
            } catch (error) {
                console.error("❌ Error adding queued ICE candidate:", error);
            }
        }
        pendingIceCandidates = [];
        
    } catch (error) {
        console.error("❌ Error setting remote description:", error);
    }
}

// ✅ Create PeerConnection with Turnix.io
function createPeerConnection(configOverrides = {}) {
    console.log("🔧 Creating PeerConnection with Turnix.io servers");
    
    const config = {
        iceServers: ICE_SERVERS,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 10,
        sdpSemantics: 'unified-plan',
        ...configOverrides
    };
    
    peerConnection = new RTCPeerConnection(config);
    
    // Reset ICE queue
    pendingIceCandidates = [];
    isRemoteDescriptionSet = false;
    iceConnectionStateLog = [];
    
    // Setup event listeners
    setupPeerConnectionListeners();
    
    return peerConnection;
}

// ✅ Setup PeerConnection Listeners
function setupPeerConnectionListeners() {
    if (!peerConnection) return;
    
    // ICE Connection State Change
    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log(`❄️ ICE State: ${state}`);
        iceConnectionStateLog.push({ time: Date.now(), state });
        
        switch(state) {
            case 'checking':
                updateStatus("info", "fas fa-sync-alt", "Connecting", "Establishing connection...");
                break;
                
            case 'connected':
                console.log("✅ ICE Connected!");
                updateStatus("success", "fas fa-check-circle", "Connected", "ICE connection established");
                break;
                
            case 'completed':
                console.log("🏁 ICE Completed");
                break;
                
            case 'failed':
                console.error("❌ ICE Failed");
                handleIceFailure();
                break;
                
            case 'disconnected':
                console.warn("⚠️ ICE Disconnected");
                setTimeout(() => {
                    if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
                        console.log("🔄 Attempting ICE restart...");
                        restartIce();
                    }
                }, 2000);
                break;
        }
    };
    
    // ICE Candidate Event
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("📤 ICE Candidate generated:", event.candidate.type, event.candidate.protocol);
            
            // Log TURN usage
            if (event.candidate.type === 'relay') {
                console.log("✅ Using TURN server (relay)");
            }
            
            // Send ICE candidate via Firebase
            if (currentFriendId) {
                database.ref(`candidates/${myId}_${currentFriendId}`).push({
                    candidate: event.candidate.toJSON(),
                    from: myId,
                    to: currentFriendId,
                    timestamp: Date.now()
                });
            }
        } else {
            console.log("✅ All ICE candidates sent");
        }
    };
    
    // Connection State Change
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔗 Connection State: ${state}`);
        
        if (state === 'connected') {
            console.log("🎉 Connection established successfully!");
            isConnected = true;
            reconnectAttempts = 0;
            
            // Clear call timeout
            if (callTimeoutId) {
                clearTimeout(callTimeoutId);
                callTimeoutId = null;
            }
            
            updateStatus("success", "fas fa-check-circle", "Connected!", "Hold to talk");
            
            // 🔔 কানেক্টেড সাউন্ড প্লে করুন
            if (window.AudioSystem && window.AudioSystem.playConnectedSound) {
                window.AudioSystem.playConnectedSound();
            }
        }
        
        if (state === 'failed') {
            console.error("💥 Connection failed");
            handleConnectionFailure();
        }
        
        if (state === 'disconnected') {
            console.warn("⚠️ Connection disconnected");
            setTimeout(() => {
                if (peerConnection && peerConnection.connectionState === 'disconnected') {
                    attemptReconnection();
                }
            }, 3000);
        }
    };
    
    // Track Event (remote audio)
    peerConnection.ontrack = (event) => {
        console.log("🎧 Remote track received");
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio && event.streams[0]) {
            remoteAudio.srcObject = event.streams[0];
            
            // Play audio with user interaction
            const playAudio = () => {
                remoteAudio.play().then(() => {
                    console.log("✅ Audio playback started");
                }).catch(e => {
                    console.log("Audio play requires interaction");
                    document.addEventListener('click', playAudio, { once: true });
                });
            };
            playAudio();
        }
    };
    
    // Data Channel
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };
}

// ✅ Handle ICE Failure
function handleIceFailure() {
    console.log("🔄 Handling ICE failure...");
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error("❌ Max reconnect attempts reached");
        updateStatus("error", "fas fa-times-circle", "Connection Failed", 
                   "Cannot establish connection. Please try again.");
        fullCleanup();
        return;
    }
    
    reconnectAttempts++;
    console.log(`🔄 Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    
    updateStatus("warning", "fas fa-sync-alt", "Reconnecting", 
               `Attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS}`);
    
    // Restart ICE
    setTimeout(() => {
        if (peerConnection) {
            restartIce();
        }
    }, 2000);
}

// ✅ Restart ICE
function restartIce() {
    if (!peerConnection) return;
    
    console.log("🔄 Restarting ICE...");
    
    if (peerConnection.signalingState === 'stable') {
        peerConnection.createOffer({ iceRestart: true })
            .then(offer => {
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log("✅ ICE restart offer created");
                // Send new offer to peer
                if (currentFriendId && peerConnection.localDescription) {
                    database.ref('offers').push({
                        sdp: peerConnection.localDescription.sdp,
                        type: peerConnection.localDescription.type,
                        from: myId,
                        to: currentFriendId,
                        timestamp: Date.now(),
                        iceRestart: true
                    });
                }
            })
            .catch(error => {
                console.error("❌ ICE restart failed:", error);
            });
    }
}

// ==================== PAGE VISIBILITY MANAGEMENT ====================

// Handle page visibility changes
function handleVisibilityChange() {
    isPageHidden = document.hidden;
    
    if (document.hidden) {
        console.log("🔍 Page hidden (minimized/switched tab)");
        
        // Don't disconnect, just adjust resources
        if (localStream && isConnected) {
            console.log("📱 Page hidden - Reducing audio quality to save resources");
            
            if (localStream.getAudioTracks().length > 0) {
                const track = localStream.getAudioTracks()[0];
                
                track.applyConstraints({
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 1,
                    sampleRate: 16000,
                    sampleSize: 16
                }).then(() => {
                    console.log("✅ Audio constraints applied for background");
                }).catch(e => {
                    console.log("⚠️ Couldn't apply background constraints:", e);
                });
            }
        }
        
        if (isConnected) {
            if (isMicLocked) {
                updateStatus("info", "fas fa-moon", "Background Mode Active", 
                           "Mic locked ON. App continues in background.");
            } else {
                updateStatus("info", "fas fa-moon", "Background Mode", 
                           "App is running in background. Connection active.");
            }
        }
        
    } else {
        console.log("🔍 Page visible again");
        
        if (localStream && isConnected) {
            console.log("📱 Page visible - Restoring audio quality");
            
            if (localStream.getAudioTracks().length > 0) {
                const track = localStream.getAudioTracks()[0];
                
                track.applyConstraints({
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 2,
                    sampleRate: 44100,
                    sampleSize: 16
                }).then(() => {
                    console.log("✅ Audio constraints restored");
                }).catch(e => {
                    console.log("⚠️ Couldn't restore audio constraints:", e);
                });
            }
            
            if (isMicLocked) {
                updateStatus("success", "fas fa-check-circle", "Connected!", "Mic LOCKED ON");
            } else {
                updateStatus("success", "fas fa-check-circle", "Connected!", "Hold to talk");
            }
        }
        
        if (peerConnection && isConnected) {
            checkConnectionHealth();
        }
    }
}

// Start keep-alive mechanism
function startKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    
    keepAliveInterval = setInterval(() => {
        if (isConnected && peerConnection && dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify({
                    type: 'keep-alive',
                    timestamp: Date.now(),
                    sender: myId
                }));
                console.log("💓 Keep-alive sent");
            } catch (e) {
                console.log("⚠️ Couldn't send keep-alive:", e);
            }
        }
        
        if (isConnected && Date.now() - lastActivityTime > 30000) {
            console.log("🕒 Connection appears stale, refreshing...");
            sendActivityPing();
        }
    }, 10000);
}

// Send activity ping
function sendActivityPing() {
    if (peerConnection && peerConnection.connectionState === 'connected') {
        lastActivityTime = Date.now();
        
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'activity-ping',
                timestamp: Date.now()
            }));
        }
    }
}

// Check connection health
function checkConnectionHealth() {
    if (!peerConnection) return;
    
    const state = peerConnection.connectionState;
    const iceState = peerConnection.iceConnectionState;
    
    console.log(`🔍 Connection check: ${state}, ICE: ${iceState}`);
    
    if (state === 'connected' && iceState === 'connected') {
        return true;
    } else if (state === 'disconnected' || iceState === 'disconnected') {
        console.log("⚠️ Connection appears disconnected, attempting recovery...");
        attemptReconnection();
        return false;
    }
    
    return true;
}

// Attempt reconnection
function attemptReconnection() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log("❌ Max reconnection attempts reached");
        updateStatus("error", "fas fa-times-circle", "Connection Lost", 
                   "Failed to reconnect after multiple attempts");
        return;
    }
    
    reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    
    updateStatus("warning", "fas fa-sync-alt", "Reconnecting", 
               `Attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS}`);
    
    if (currentFriendId && localStream) {
        setTimeout(() => {
            if (!isConnected && currentFriendId) {
                console.log("Trying to restore connection...");
                restoreConnection();
            }
        }, 2000);
    }
}

// Restore connection
function restoreConnection() {
    if (!currentFriendId) return;
    
    console.log("🔄 Restoring connection to:", currentFriendId);
    
    if (peerConnection) {
        try {
            peerConnection.restartIce();
            console.log("✅ ICE restart initiated");
        } catch (e) {
            console.log("❌ Couldn't restart ICE:", e);
            reestablishConnection();
        }
    } else {
        reestablishConnection();
    }
}

// Re-establish connection
function reestablishConnection() {
    if (!currentFriendId) return;
    
    console.log("🔁 Re-establishing connection");
    
    safeCleanup();
    
    if (isInitiator) {
        makeCall(currentFriendId);
    } else {
        updateStatus("info", "fas fa-clock", "Waiting for Reconnect", 
                   "Waiting for friend to call back...");
    }
}

// Safe cleanup
function safeCleanup() {
    console.log("🧹 Safe cleanup (preserving resources)");
    
    if (peerConnection) {
        try {
            peerConnection.onconnectionstatechange = null;
            peerConnection.oniceconnectionstatechange = null;
            peerConnection.onicecandidate = null;
            peerConnection.ontrack = null;
            peerConnection.ondatachannel = null;
        } catch (e) {
            console.log("⚠️ Error cleaning peer connection:", e);
        }
        peerConnection = null;
    }
    
    if (dataChannel) {
        try {
            dataChannel.onopen = null;
            dataChannel.onclose = null;
            dataChannel.onmessage = null;
            dataChannel.onerror = null;
            if (dataChannel.readyState !== 'closed') {
                dataChannel.close();
            }
        } catch (e) {
            console.log("⚠️ Error cleaning data channel:", e);
        }
        dataChannel = null;
    }
    
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
    }
    
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
    
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }
    
    if (callTimeoutId) {
        clearTimeout(callTimeoutId);
        callTimeoutId = null;
    }
    
    isConnected = false;
    isTalking = false;
    isListening = false;
    
    const disconnectButton = document.getElementById('disconnectButton');
    if (disconnectButton) disconnectButton.style.display = 'none';
    
    const waveContainer = document.getElementById('waveContainer');
    if (waveContainer) waveContainer.style.display = 'none';
    
    resetTalkButton();
}

// Setup data channel
function setupDataChannel() {
    if (!dataChannel) return;
    
    dataChannel.onopen = () => {
        console.log("📡 Data channel opened");
        startKeepAlive();
    };
    
    dataChannel.onclose = () => {
        console.log("📡 Data channel closed");
    };
    
    dataChannel.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            if (message.type && message.type.startsWith('bg-')) {
                if (window.bgAppControl && window.bgAppControl.handleBackgroundDataMessage) {
                    window.bgAppControl.handleBackgroundDataMessage(event.data);
                    return;
                }
            }
            
            if (message.type === 'keep-alive') {
                lastActivityTime = Date.now();
                console.log("💓 Keep-alive received from:", message.sender);
                
                if (dataChannel.readyState === 'open') {
                    dataChannel.send(JSON.stringify({
                        type: 'keep-alive-ack',
                        timestamp: Date.now(),
                        sender: myId
                    }));
                }
            } else if (message.type === 'keep-alive-ack') {
                lastActivityTime = Date.now();
                console.log("💓 Keep-alive acknowledged");
            } else if (message.type === 'activity-ping') {
                lastActivityTime = Date.now();
            }
        } catch (e) {
            console.log("⚠️ Error parsing data channel message:", e);
        }
    };
    
    dataChannel.onerror = (error) => {
        console.log("📡 Data channel error:", error);
    };
}

// Handle connection failure
function handleConnectionFailure() {
    console.log("🔄 Handling connection failure...");
    attemptReconnection();
}

// ==================== AUTHENTICATION SYSTEM ====================

// Check authentication state
function checkAuth() {
    console.log("🔐 Checking authentication...");
    
    if (authOverlay) {
        authOverlay.style.display = 'flex';
    }
    
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
    if (loginModal) {
        loginModal.style.display = 'none';
    }
    
    const authTimeout = setTimeout(() => {
        if (!authCheckCompleted) {
            console.warn("⚠️ Auth check timeout - showing login modal");
            showLoginModal();
            authCheckCompleted = true;
        }
    }, 3000);
    
    auth.onAuthStateChanged(async (user) => {
        clearTimeout(authTimeout);
        authCheckCompleted = true;
        
        if (authOverlay) {
            authOverlay.style.display = 'none';
        }
        
        if (user) {
            console.log("✅ User authenticated:", user.email);
            currentUser = user;
            await initializeUser(user);
            showMainApp();
        } else {
            console.log("❌ No user signed in");
            showLoginModal();
        }
    });
}

// Initialize user data
async function initializeUser(user) {
    console.log("✅ User authenticated:", user.uid);
    
    try {
        await user.reload();
        console.log("🔄 User reloaded from Firebase Auth");
    } catch (reloadError) {
        console.log("⚠️ User reload failed:", reloadError);
    }
    
    myId = generateFixedUserId(user.uid);
    console.log("🎯 Your Fixed Walkie ID:", myId);
    console.log("📝 Display Name from Firebase:", user.displayName);
    
    if (!user.displayName || user.displayName === user.email.split('@')[0]) {
        await checkDisplayNameFromDatabase(user);
    }
    
    updateUserUI(user);
    await saveUserToDatabase(user);
}

async function checkDisplayNameFromDatabase(user) {
    try {
        const userRef = database.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.displayName && userData.displayName !== user.email.split('@')[0]) {
                await user.updateProfile({
                    displayName: userData.displayName
                });
                
                await user.reload();
                console.log("✅ Display name loaded from database:", userData.displayName);
            }
        }
    } catch (dbError) {
        console.log("⚠️ Database check failed:", dbError);
    }
}

function generateFixedUserId(uid) {
    const shortUid = uid.substring(0, 8);
    const hash = simpleHash(uid);
    return `user_${shortUid}_${hash}`;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 4);
}

function updateUserUI(user) {
    const userNameElement = document.getElementById('userName');
    const userEmailElement = document.getElementById('userEmail');
    const userIdSmallElement = document.getElementById('userIdSmall');
    const idTextElement = document.getElementById('idText');
    
    if (userNameElement) {
        if (user.displayName && user.displayName !== user.email.split('@')[0]) {
            userNameElement.textContent = user.displayName;
            console.log("✅ UI Updated with displayName:", user.displayName);
        } else {
            const tempName = user.email.split('@')[0];
            userNameElement.textContent = tempName;
            console.log("⚠️ Using temporary name:", tempName);
        }
    }
    
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }
    
    if (userIdSmallElement) {
        userIdSmallElement.textContent = `ID: ${myId}`;
    }
    
    if (idTextElement) {
        idTextElement.textContent = myId;
    }
    
    const myIdElement = document.getElementById('myId');
    if (myIdElement) {
        const idText = myIdElement.querySelector('.id-text');
        if (idText) {
            idText.textContent = myId;
        }
    }
}

async function saveUserToDatabase(user) {
    try {
        const displayName = user.displayName || user.email.split('@')[0];
        
        await database.ref('users/' + user.uid).set({
            email: user.email,
            displayName: displayName,
            walkieId: myId,
            lastSeen: Date.now(),
            online: true,
            status: 'available'
        });
        console.log("✅ User saved to database with displayName:", displayName);
    } catch (error) {
        console.error("❌ Error saving user:", error);
    }
}

function showMainApp() {
    console.log("📱 Showing main application");
    
    if (mainContainer) {
        mainContainer.style.display = 'block';
    }
    if (loginModal) {
        loginModal.style.display = 'none';
    }
    if (authOverlay) {
        authOverlay.style.display = 'none';
    }
    
    initializeWalkieTalkie();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startConnectionMonitoring();
}

function startConnectionMonitoring() {
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
    }
    
    connectionMonitorInterval = setInterval(() => {
        if (isConnected) {
            checkConnectionHealth();
        }
    }, 15000);
}

function showLoginModal() {
    console.log("🔓 Showing login modal");
    
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
    if (loginModal) {
        loginModal.style.display = 'flex';
    }
    if (authOverlay) {
        authOverlay.style.display = 'none';
    }
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (forgotPasswordForm) forgotPasswordForm.style.display = 'none';
}

// ==================== AUTHENTICATION EVENT LISTENERS ====================

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginButton = document.getElementById('loginButton');
const toggleLoginPassword = document.getElementById('toggleLoginPassword');

const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const confirmPassword = document.getElementById('confirmPassword');
const registerButton = document.getElementById('registerButton');
const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');

const showRegisterLink = document.getElementById('showRegisterLink');
const showLoginLink = document.getElementById('showLoginLink');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const backToLoginLink = document.getElementById('backToLoginLink');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');

const authLoading = document.getElementById('authLoading');
const authStatus = document.getElementById('authStatus');

if (toggleLoginPassword) {
    toggleLoginPassword.addEventListener('click', function() {
        const passwordInput = loginPassword;
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}

if (toggleRegisterPassword) {
    toggleRegisterPassword.addEventListener('click', function() {
        const passwordInput = registerPassword;
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}

if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        forgotPasswordForm.style.display = 'none';
        clearAuthStatus();
    });
}

if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        forgotPasswordForm.style.display = 'none';
        clearAuthStatus();
    });
}

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        forgotPasswordForm.style.display = 'block';
        clearAuthStatus();
    });
}

if (backToLoginLink) {
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordForm.style.display = 'none';
        loginForm.style.display = 'block';
        clearAuthStatus();
    });
}

function showAuthLoading(show) {
    if (authLoading) {
        authLoading.style.display = show ? 'block' : 'none';
    }
}

function showAuthStatus(message, type = 'error') {
    if (authStatus) {
        authStatus.textContent = message;
        authStatus.className = `auth-status ${type}`;
        authStatus.style.display = 'block';
        
        setTimeout(() => {
            authStatus.style.display = 'none';
        }, 5000);
    }
}

function clearAuthStatus() {
    if (authStatus) {
        authStatus.style.display = 'none';
    }
}

if (loginButton) {
    loginButton.addEventListener('click', async () => {
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        const rememberMe = document.getElementById('rememberMe')?.checked || false;
        
        if (!email || !password) {
            showAuthStatus('Please enter both email and password', 'error');
            return;
        }
        
        showAuthLoading(true);
        
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log("✅ Login successful");
            
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('userEmail', email);
            } else {
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('userEmail');
            }
            
            loginEmail.value = '';
            loginPassword.value = '';
            
        } catch (error) {
            console.error("❌ Login error:", error);
            
            let errorMessage = "Login failed. Please try again.";
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = "No account found with this email.";
                    break;
                case 'auth/wrong-password':
                    errorMessage = "Incorrect password.";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Invalid email address.";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "This account has been disabled.";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "Too many failed attempts. Please try again later.";
                    break;
            }
            
            showAuthStatus(errorMessage, 'error');
        } finally {
            showAuthLoading(false);
        }
    });
}

if (registerButton) {
    registerButton.addEventListener('click', async () => {
        const name = registerName.value.trim();
        const email = registerEmail.value.trim();
        const password = registerPassword.value.trim();
        const confirm = confirmPassword.value.trim();
        
        if (!name || !email || !password || !confirm) {
            showAuthStatus('Please fill all fields', 'error');
            return;
        }
        
        if (password.length < 6) {
            showAuthStatus('Password must be at least 6 characters', 'error');
            return;
        }
        
        if (password !== confirm) {
            showAuthStatus('Passwords do not match', 'error');
            return;
        }
        
        showAuthLoading(true);
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await user.updateProfile({
                displayName: name
            });
            
            await user.reload();
            
            console.log("✅ Registration successful. Display name set:", name);
            showAuthStatus('Account created successfully!', 'success');
            
            registerName.value = '';
            registerEmail.value = '';
            registerPassword.value = '';
            confirmPassword.value = '';
            
        } catch (error) {
            console.error("❌ Registration error:", error);
            
            let errorMessage = "Registration failed. Please try again.";
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = "Email already registered. Please login.";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Invalid email address.";
                    break;
                case 'auth/weak-password':
                    errorMessage = "Password is too weak. Use at least 6 characters.";
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = "Registration is temporarily disabled.";
                    break;
            }
            
            showAuthStatus(errorMessage, 'error');
        } finally {
            showAuthLoading(false);
        }
    });
}

const resetPasswordButton = document.getElementById('resetPasswordButton');
if (resetPasswordButton) {
    resetPasswordButton.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value.trim();
        
        if (!email) {
            showAuthStatus('Please enter your email address', 'error');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showAuthStatus('Please enter a valid email address', 'error');
            return;
        }
        
        showAuthLoading(true);
        
        try {
            if (window.PasswordAuth && window.PasswordAuth.sendResetEmail) {
                await window.PasswordAuth.sendResetEmail(email);
                showAuthStatus('Password reset email sent! Check your inbox (and spam folder).', 'success');
                
                document.getElementById('resetEmail').value = '';
                
                setTimeout(() => {
                    if (window.AudioSystem && window.AudioSystem.playNotification) {
                        window.AudioSystem.playNotification('message');
                    }
                    backToLoginLink.click();
                }, 5000);
            } else {
                await auth.sendPasswordResetEmail(email);
                showAuthStatus('Reset link sent to your email. Check your inbox.', 'success');
            }
            
        } catch (error) {
            console.error("❌ Password reset error:", error);
            
            let errorMessage = "Error sending reset email. ";
            switch(error.code) {
                case 'auth/invalid-email':
                    errorMessage += "Invalid email address.";
                    break;
                case 'auth/user-not-found':
                    errorMessage += "No account found with this email.";
                    break;
                case 'auth/too-many-requests':
                    errorMessage += "Too many attempts. Try again later.";
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage += "Password reset is not enabled.";
                    break;
                default:
                    errorMessage += error.message;
            }
            
            showAuthStatus(errorMessage, 'error');
        } finally {
            showAuthLoading(false);
        }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            if (typeof fullCleanup === 'function') {
                fullCleanup();
            }
            
            await auth.signOut();
            
            currentUser = null;
            myId = null;
            
            showLoginModal();
            
            console.log("✅ Logout successful");
        } catch (error) {
            console.error("❌ Logout error:", error);
        }
    });
}

const userMenuBtn = document.getElementById('userMenuBtn');
if (userMenuBtn) {
    userMenuBtn.addEventListener('click', () => {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    });
    
    document.addEventListener('click', (event) => {
        const dropdown = document.getElementById('userDropdown');
        const menuBtn = document.getElementById('userMenuBtn');
        
        if (dropdown && menuBtn && 
            !dropdown.contains(event.target) && 
            !menuBtn.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// ==================== WALKIE TALKIE FUNCTIONALITY ====================

function initializeWalkieTalkie() {
    if (!currentUser || !myId) {
        console.error("❌ Cannot initialize walkie talkie: User not authenticated");
        return;
    }
    
    console.log("🚀 Initializing Walkie Talkie for user:", myId);
    
    updateStatus("info", "fas fa-signal", "Ready to Connect", 
                `You are logged in as ${currentUser.displayName || currentUser.email}`);
    
    initWalkieElements();
    startDatabaseMonitoring();
    
    setTimeout(() => {
        if (typeof initializeContactSystem === 'function') {
            initializeContactSystem();
        } else if (typeof window.ContactSystem !== 'undefined') {
            window.ContactSystem.initialize();
        }
    }, 2000);
}

function initWalkieElements() {
    const myIdElement = document.getElementById('myId');
    const friendIdInput = document.getElementById('friendId');
    const syncButton = document.getElementById('syncButton');
    const talkButton = document.getElementById('talkButton');
    const remoteAudio = document.getElementById('remoteAudio');
    const disconnectButton = document.getElementById('disconnectButton');
    const waveContainer = document.getElementById('waveContainer');
    
    const muteButton = document.getElementById('muteButton');
    const volumeUpButton = document.getElementById('volumeUp');
    const volumeDownButton = document.getElementById('volumeDown');
    
    window.resetTalkButton = function() {
        if (talkButton) {
            if (isMicLocked) {
                const talkText = talkButton.querySelector('.talk-text');
                if (talkText) {
                    talkText.textContent = 'Mic ON (Tap 2x to off)';
                }
                updateAudioStatus("Mic: LOCKED ON");
                return;
            }
            
            talkButton.classList.remove('talking');
            talkButton.classList.remove('listening');
            talkButton.classList.remove('locked');
            
            const talkText = talkButton.querySelector('.talk-text');
            if (talkText) {
                talkText.textContent = 'Hold to Talk';
            }
            
            updateAudioStatus("Mic: Ready");
            isTalking = false;
            isListening = false;
            
            if (waveContainer) {
                waveContainer.style.display = 'none';
            }
            
            hideMicLockIndicator();
        }
    };
    
    if (muteButton) {
        muteButton.addEventListener('click', () => {
            if (!remoteAudio) return;
            
            remoteAudio.muted = !remoteAudio.muted;
            const icon = muteButton.querySelector('.control-icon i');
            const textSpan = muteButton.querySelector('.button-text');
            
            if (remoteAudio.muted) {
                icon.className = 'fas fa-volume-mute';
                if (textSpan) textSpan.textContent = 'Unmute';
                console.log("🔇 Remote audio muted");
                updateStatus("info", "fas fa-volume-mute", "Audio Muted", 
                           "You won't hear your friend. Click again to unmute.");
            } else {
                icon.className = 'fas fa-volume-up';
                if (textSpan) textSpan.textContent = 'Mute';
                console.log("🔊 Remote audio unmuted");
                updateStatus("success", "fas fa-volume-up", "Audio Unmuted", 
                           "You can hear your friend now.");
            }
        });
    }
    
    if (volumeUpButton) {
        volumeUpButton.addEventListener('click', () => {
            if (remoteAudio) {
                remoteAudio.volume = Math.min(1.0, remoteAudio.volume + 0.1);
                updateAudioStatus(`Volume: ${Math.round(remoteAudio.volume * 100)}%`);
            }
        });
    }
    
    if (volumeDownButton) {
        volumeDownButton.addEventListener('click', () => {
            if (remoteAudio) {
                remoteAudio.volume = Math.max(0.0, remoteAudio.volume - 0.1);
                updateAudioStatus(`Volume: ${Math.round(remoteAudio.volume * 100)}%`);
            }
        });
    }
    
    // Listen for incoming calls
    database.ref('offers').on('child_added', async (snapshot) => {
        const offerData = snapshot.val();
        
        if (offerData.to === myId && offerData.from !== myId && !peerConnection) {
            console.log("📞 Incoming call from:", offerData.from);
            
            if (isConnected) {
                console.log("Already connected, ignoring new call");
                snapshot.ref.remove();
                return;
            }
            
            if (window.AudioSystem && window.AudioSystem.playRingtone) {
                window.AudioSystem.playRingtone();
            }
            
            let callerName = offerData.from;
            if (window.AudioSystem && window.AudioSystem.getCallerName) {
                try {
                    callerName = await window.AudioSystem.getCallerName(offerData.from);
                    console.log("📇 Caller name resolved:", callerName);
                } catch (error) {
                    console.error("Error getting caller name:", error);
                }
            }
            
            if (window.AudioSystem && window.AudioSystem.showIncomingCallUI) {
                window.AudioSystem.showIncomingCallUI(
                    offerData.from,
                    callerName,
                    () => acceptIncomingCall(snapshot.key),
                    () => rejectIncomingCall(snapshot.key)
                );
            } else {
                if (confirm(`${callerName} is calling. Answer?`)) {
                    await acceptIncomingCall(snapshot.key);
                } else {
                    rejectIncomingCall(snapshot.key);
                }
            }
        }
    });
    
    // Listen for answers
    database.ref('answers').on('child_added', async (snapshot) => {
        const answerData = snapshot.val();
        if (answerData.to === myId && answerData.from === currentFriendId && peerConnection) {
            try {
                await setRemoteDescription(new RTCSessionDescription({
                    sdp: answerData.sdp,
                    type: answerData.type
                }));
                console.log("✅ Answer received and set");
                snapshot.ref.remove();
            } catch (error) {
                console.error("Answer error:", error);
            }
        }
    });
    
    // Listen for ICE candidates
    database.ref('candidates').on('child_added', async (snapshot) => {
        const candidateData = snapshot.val();
        const candidateId = snapshot.key;
        
        if (candidateData.to === myId && candidateData.from === currentFriendId) {
            console.log("📥 ICE candidate received");
            
            await addIceCandidate(candidateData.candidate);
            
            snapshot.ref.remove();
        }
    });
    
    // Answer incoming call
    async function answerCall(offerData) {
        try {
            updateStatus("info", "fas fa-phone-alt", "Answering Call", "Setting up connection...");
            
            safeCleanup();
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 2,
                    sampleRate: 44100,
                    sampleSize: 16,
                    latency: 0.01
                }
            };
            
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log("🎤 Microphone acquired");
            updateAudioStatus("Mic: Active");
            
            setupAudioLevelMonitoring();
            
            // ✅ Create peer connection with Turnix.io
            peerConnection = createPeerConnection();
            
            // Add local tracks
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
                track.enabled = false;
            });
            
            // Create data channel
            dataChannel = peerConnection.createDataChannel('walkie-talkie', {
                ordered: true,
                maxPacketLifeTime: 3000
            });
            
            setupDataChannel();
            
            // Set remote offer using queue system
            await setRemoteDescription(new RTCSessionDescription({
                sdp: offerData.sdp,
                type: offerData.type
            }));
            
            console.log("✅ Remote description set");
            
            // Create and send answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            await database.ref('answers').push({
                sdp: answer.sdp,
                type: answer.type,
                from: myId,
                to: offerData.from,
                timestamp: Date.now()
            });
            
            console.log("📤 Answer sent");
            updateStatus("info", "fas fa-sync-alt", "Connecting", "Establishing secure connection...");
            
        } catch (error) {
            console.error("❌ Error answering call:", error);
            updateStatus("error", "fas fa-times-circle", "Error", error.message);
            safeCleanup();
        }
    }
    
    async function acceptIncomingCall(offerKey) {
        console.log("✅ Accepting call...");
        
        const offerRef = database.ref('offers/' + offerKey);
        const snapshot = await offerRef.once('value');
        const offerData = snapshot.val();
        
        if (!offerData) return;
        
        if (window.BackgroundCallSystem && window.BackgroundCallSystem.hideModal) {
            window.BackgroundCallSystem.hideModal();
        }
        
        if (window.AudioSystem && window.AudioSystem.stopRingtone) {
            window.AudioSystem.stopRingtone();
        }
        
        if (window.AudioSystem && window.AudioSystem.hideIncomingCallUI) {
            window.AudioSystem.hideIncomingCallUI();
        }
        
        offerRef.remove();
        
        currentFriendId = offerData.from;
        isInitiator = false;
        
        updateStatus("info", "fas fa-phone-alt", "Answering Call", "Connecting...");
        await answerCall(offerData);
    }
    
    function rejectIncomingCall(offerKey) {
        console.log("❌ Rejecting call...");
        
        if (window.BackgroundCallSystem && window.BackgroundCallSystem.hideModal) {
            window.BackgroundCallSystem.hideModal();
        }

        if (window.AudioSystem && window.AudioSystem.stopRingtone) {
            window.AudioSystem.stopRingtone();
        }
        
        if (window.AudioSystem && window.AudioSystem.hideIncomingCallUI) {
            window.AudioSystem.hideIncomingCallUI();
        }
        
        if (window.AudioSystem && window.AudioSystem.playCallEndedSound) {
            window.AudioSystem.playCallEndedSound();
        }
        
        database.ref('offers/' + offerKey).remove();
        
        updateStatus("info", "fas fa-phone-slash", "Call Declined", "You rejected the call");
    }
    
    if (syncButton) {
        syncButton.addEventListener('click', async () => {
            const friendId = friendIdInput.value.trim();
            if (!friendId) {
                alert("Please enter your friend's ID");
                return;
            }
            
            if (friendId === myId) {
                alert("You cannot call yourself!");
                return;
            }
            
            if (friendId.length < 6) {
                alert("Please enter a valid friend ID");
                return;
            }
            
            currentFriendId = friendId;
            isInitiator = true;
            
            updateStatus("info", "fas fa-phone-alt", "Calling", "Initiating call...");
            await makeCall(friendId);
        });
    }
    
    async function makeCall(friendId) {
        try {
            if (window.bgAppControl && window.bgAppControl.onCallStart) {
                window.bgAppControl.onCallStart();
            }
            
            safeCleanup();
            
            console.log("📞 Calling:", friendId);
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 2,
                    sampleRate: 44100,
                    sampleSize: 16,
                    latency: 0.01
                }
            };
            
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log("🎤 Microphone ready");
            updateAudioStatus("Mic: Active");
            
            setupAudioLevelMonitoring();
            
            // ✅ Create peer connection with Turnix.io
            peerConnection = createPeerConnection();
            
            // Add local tracks
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
                track.enabled = false;
            });
            
            // Create data channel
            dataChannel = peerConnection.createDataChannel('walkie-talkie', {
                ordered: true,
                maxPacketLifeTime: 3000
            });
            
            setupDataChannel();
            
            // Create and send offer
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                iceRestart: false
            });
            
            await peerConnection.setLocalDescription(offer);
            
            await database.ref('offers').push({
                sdp: offer.sdp,
                type: offer.type,
                from: myId,
                to: friendId,
                timestamp: Date.now()
            });
            
            console.log("📤 Offer sent");
            updateStatus("info", "fas fa-clock", "Calling", "Waiting for answer...");
            
            // Set call timeout
            callTimeoutId = setTimeout(() => {
                if (!isConnected) {
                    console.log("⏰ Call timeout - no answer");
                    updateStatus("error", "fas fa-times-circle", "No Answer", 
                               "Friend didn't answer the call");
                    safeCleanup();
                }
            }, CALL_TIMEOUT);
            
        } catch (error) {
            console.error("❌ Error making call:", error);
            updateStatus("error", "fas fa-times-circle", "Error", error.message);
            safeCleanup();
        }
    }
    
    function setupAudioLevelMonitoring() {
        if (!localStream) return;
        
        if (audioLevelInterval) {
            clearInterval(audioLevelInterval);
        }
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(localStream);
            
            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;
            
            microphone.connect(analyser);
            
            audioLevelInterval = setInterval(() => {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                
                let values = 0;
                const length = array.length;
                for (let i = 0; i < length; i++) {
                    values += array[i];
                }
                
                const average = values / length;
                const level = Math.min(100, Math.max(0, average * 0.5));
                
                const audioLevelFill = document.getElementById('audioLevel');
                if (audioLevelFill) {
                    audioLevelFill.style.width = `${level}%`;
                    
                    if (level > 70) {
                        audioLevelFill.style.background = 'linear-gradient(90deg, #ff0033, #ff9900)';
                    } else if (level > 30) {
                        audioLevelFill.style.background = 'linear-gradient(90deg, #ff9900, #00cc66)';
                    } else {
                        audioLevelFill.style.background = 'linear-gradient(90deg, #00cc66, #0066ff)';
                    }
                }
            }, 100);
        } catch (e) {
            console.error("Audio level monitoring error:", e);
        }
    }
    
    if (talkButton) {
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        const TAP_MOVE_THRESHOLD = 10;
        
        function handleTouchStart(event) {
            event.preventDefault();
            event.stopPropagation();
            
            touchStartTime = Date.now();
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            
            if (!isMicLocked && localStream && isConnected) {
                talkButton.dispatchEvent(new MouseEvent('mousedown'));
            }
            
            return false;
        }
        
        function handleTouchEnd(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const touchEndTime = Date.now();
            const touchEndX = event.changedTouches[0].clientX;
            const touchEndY = event.changedTouches[0].clientY;
            
            const deltaX = Math.abs(touchEndX - touchStartX);
            const deltaY = Math.abs(touchEndY - touchStartY);
            const touchDuration = touchEndTime - touchStartTime;
            
            if (!isMicLocked && localStream && isConnected) {
                talkButton.dispatchEvent(new MouseEvent('mouseup'));
            }
            
            if (touchDuration < 300 && deltaX < TAP_MOVE_THRESHOLD && deltaY < TAP_MOVE_THRESHOLD) {
                const currentTime = Date.now();
                const timeDiff = currentTime - lastTapTime;
                
                if (tapTimeout) {
                    clearTimeout(tapTimeout);
                    tapTimeout = null;
                }
                
                if (timeDiff < DOUBLE_TAP_INTERVAL && timeDiff > 0) {
                    console.log("👆 DOUBLE TAP detected on mobile!");
                    tapCount = 0;
                    
                    toggleMicLock();
                    
                } else {
                    tapCount = 1;
                    lastTapTime = currentTime;
                    
                    tapTimeout = setTimeout(() => {
                        tapCount = 0;
                        lastTapTime = 0;
                    }, DOUBLE_TAP_INTERVAL);
                }
            }
            
            return false;
        }
        
        function handleClick(event) {
            if (!('ontouchstart' in window) || window.innerWidth > 768) {
                event.preventDefault();
                event.stopPropagation();
                
                const currentTime = Date.now();
                const timeDiff = currentTime - lastTapTime;
                
                if (tapTimeout) {
                    clearTimeout(tapTimeout);
                    tapTimeout = null;
                }
                
                if (timeDiff < DOUBLE_TAP_INTERVAL && timeDiff > 0) {
                    console.log("👆 DOUBLE TAP detected on desktop!");
                    tapCount = 0;
                    
                    toggleMicLock();
                    
                } else {
                    tapCount = 1;
                    lastTapTime = currentTime;
                    
                    tapTimeout = setTimeout(() => {
                        tapCount = 0;
                        lastTapTime = 0;
                    }, DOUBLE_TAP_INTERVAL);
                }
            }
        }
        
        talkButton.addEventListener('touchstart', handleTouchStart, { passive: false });
        talkButton.addEventListener('touchend', handleTouchEnd, { passive: false });
        talkButton.addEventListener('click', handleClick);
        
        talkButton.addEventListener('mousedown', () => {
            if (isMicLocked) return;
            
            if (localStream && isConnected) {
                console.log("🎤 START talking (Hold mode)");
                isTalking = true;
                isListening = false;
                
                localStream.getAudioTracks().forEach(track => {
                    track.enabled = true;
                });
                
                talkButton.classList.add('talking');
                talkButton.classList.remove('listening');
                
                const talkText = talkButton.querySelector('.talk-text');
                if (talkText) {
                    talkText.textContent = 'Talking...';
                }
                
                if (waveContainer) {
                    waveContainer.style.display = 'flex';
                }
                
                updateAudioStatus("Mic: Talking (Hold Mode)");
                lastActivityTime = Date.now();
            }
        });
        
        talkButton.addEventListener('mouseup', () => {
            if (isMicLocked) return;
            
            if (localStream && isConnected) {
                console.log("🔇 STOP talking, now Listening");
                isTalking = false;
                isListening = true;
                
                localStream.getAudioTracks().forEach(track => {
                    track.enabled = false;
                });
                
                talkButton.classList.remove('talking');
                talkButton.classList.add('listening');
                
                const talkText = talkButton.querySelector('.talk-text');
                if (talkText) {
                    talkText.textContent = 'Listening...';
                }
                
                if (waveContainer) {
                    waveContainer.style.display = 'none';
                }
                
                updateAudioStatus("Mic: Listening");
                lastActivityTime = Date.now();
                
                setTimeout(() => {
                    if (!isTalking && isListening && !isMicLocked) {
                        resetTalkButton();
                    }
                }, 3000);
            }
        });
    }

    function toggleMicLock() {
        if (!localStream || !isConnected) {
            console.log("❌ Cannot toggle mic: No connection");
            return;
        }
        
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) return;
        
        const track = audioTracks[0];
        
        if (!isMicLocked) {
            isMicLocked = true;
            isMicLockedForBg = true;
            track.enabled = true;
            isTalking = true;
            isListening = false;
            
            if (window.bgAppControl && window.bgAppControl.onMicLockToggle) {
                window.bgAppControl.onMicLockToggle(true);
            }
            
            talkButton.classList.add('talking');
            talkButton.classList.remove('listening');
            talkButton.classList.add('locked');
            
            const talkText = talkButton.querySelector('.talk-text');
            if (talkText) {
                talkText.textContent = 'Mic ON (Tap 2x to off)';
            }
            
            const waveContainer = document.getElementById('waveContainer');
            if (waveContainer) {
                waveContainer.style.display = 'flex';
            }
            
            updateAudioStatus("Mic: LOCKED ON");
            updateStatus("success", "fas fa-microphone-alt", "Mic Locked ON", 
                       "Microphone is locked in talking mode. App will work in background.");
            
            console.log("🔒 MIC LOCKED ON (Background mode enabled)");
            
            showMicLockIndicator();
            
        } else {
            isMicLocked = false;
            isMicLockedForBg = false;
            track.enabled = false;
            isTalking = false;
            isListening = true;
            
            if (window.bgAppControl && window.bgAppControl.onMicLockToggle) {
                window.bgAppControl.onMicLockToggle(false);
            }
            
            talkButton.classList.remove('talking');
            talkButton.classList.remove('locked');
            talkButton.classList.add('listening');
            
            const talkText = talkButton.querySelector('.talk-text');
            if (talkText) {
                talkText.textContent = 'Listening...';
            }
            
            const waveContainer = document.getElementById('waveContainer');
            if (waveContainer) {
                waveContainer.style.display = 'none';
            }
            
            updateAudioStatus("Mic: OFF (Tap 2x to lock)");
            updateStatus("info", "fas fa-microphone-alt-slash", "Mic Unlocked", 
                       "Microphone is off. Double tap to lock ON.");
            
            console.log("🔓 MIC UNLOCKED (Background mode disabled)");
            
            hideMicLockIndicator();
            
            setTimeout(() => {
                if (!isMicLocked && !isTalking) {
                    resetTalkButton();
                }
            }, 3000);
        }
    }

    function showMicLockIndicator() {
        const talkContent = document.querySelector('.talk-content');
        if (talkContent && !document.querySelector('.lock-indicator')) {
            const lockIcon = document.createElement('div');
            lockIcon.className = 'lock-indicator';
            lockIcon.innerHTML = '<i class="fas fa-lock"></i>';
            lockIcon.style.position = 'absolute';
            lockIcon.style.top = '15px';
            lockIcon.style.right = '15px';
            lockIcon.style.color = 'var(--amoled-green)';
            lockIcon.style.fontSize = '1.2em';
            lockIcon.style.textShadow = '0 0 10px var(--amoled-green)';
            lockIcon.style.zIndex = '3';
            talkContent.appendChild(lockIcon);
        }
    }

    function hideMicLockIndicator() {
        const lockIndicator = document.querySelector('.lock-indicator');
        if (lockIndicator) {
            lockIndicator.remove();
        }
    }
    
    window.fullCleanup = function() {
        console.log("🧹 Full cleanup (disconnecting)");
        
        if (window.bgAppControl && window.bgAppControl.onCallEnd) {
            window.bgAppControl.onCallEnd();
        }
        
        if (window.AudioSystem && window.AudioSystem.stopRingtone) {
            window.AudioSystem.stopRingtone();
        }
        
        if (window.AudioSystem && window.AudioSystem.hideIncomingCallUI) {
            window.AudioSystem.hideIncomingCallUI();
        }
        
        if (window.AudioSystem && window.AudioSystem.playCallEndedSound) {
            window.AudioSystem.playCallEndedSound();
        }
        
        isMicLocked = false;
        isMicLockedForBg = false;
        tapCount = 0;
        lastTapTime = 0;
        
        if (peerConnection) {
            try {
                peerConnection.close();
            } catch (e) {
                console.log("Peer connection close error:", e);
            }
            peerConnection = null;
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (dataChannel) {
            try {
                if (dataChannel.readyState !== 'closed') {
                    dataChannel.close();
                }
            } catch (e) {
                console.log("Data channel close error:", e);
            }
            dataChannel = null;
        }
        
        if (audioLevelInterval) {
            clearInterval(audioLevelInterval);
            audioLevelInterval = null;
        }
        
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
        
        if (connectionMonitorInterval) {
            clearInterval(connectionMonitorInterval);
            connectionMonitorInterval = null;
        }
        
        if (callTimeoutId) {
            clearTimeout(callTimeoutId);
            callTimeoutId = null;
        }
        
        if (currentFriendId) {
            database.ref(`candidates/${myId}_${currentFriendId}`).remove();
            database.ref(`candidates/${currentFriendId}_${myId}`).remove();
            database.ref('offers').orderByChild('from').equalTo(myId).once('value', snap => {
                snap.forEach(child => child.ref.remove());
            });
            database.ref('answers').orderByChild('from').equalTo(myId).once('value', snap => {
                snap.forEach(child => child.ref.remove());
            });
        }
        
        isConnected = false;
        isTalking = false;
        isListening = false;
        currentFriendId = null;
        reconnectAttempts = 0;
        
        if (disconnectButton) {
            disconnectButton.style.display = 'none';
        }
        
        if (waveContainer) {
            waveContainer.style.display = 'none';
        }
        
        resetTalkButton();
        
        const audioLevelFill = document.getElementById('audioLevel');
        if (audioLevelFill) {
            audioLevelFill.style.width = '0%';
        }
        
        updateAudioStatus("Mic: Ready");
        updateStatus("info", "fas fa-signal", "Disconnected", "Ready for new call");
    };
    
    if (myIdElement) {
        myIdElement.addEventListener('click', () => {
            navigator.clipboard.writeText(myId).then(() => {
                const copyIcon = myIdElement.querySelector('.copy-icon i');
                if (copyIcon) {
                    const originalClass = copyIcon.className;
                    copyIcon.className = 'fas fa-check';
                    
                    setTimeout(() => {
                        copyIcon.className = originalClass;
                    }, 2000);
                }
            });
        });
    }
    
    window.addEventListener('beforeunload', () => {
        fullCleanup();
        
        if (currentUser) {
            database.ref('users/' + currentUser.uid).update({
                online: false,
                lastSeen: Date.now()
            });
        }
    });
}

function startDatabaseMonitoring() {
    database.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            console.log("✅ Firebase connected");
            
            if (currentUser && myId) {
                database.ref('users/' + currentUser.uid).update({
                    online: true,
                    lastSeen: Date.now(),
                    walkieId: myId
                }).catch(e => console.log("User update error:", e));
            }
        }
    });
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Walkie Talkie v3.0 with Turnix.io - Starting...");
    
    if (authOverlay) authOverlay.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'none';
    if (loginModal) loginModal.style.display = 'none';
    
    setTimeout(() => {
        try {
            checkAuth();
        } catch (error) {
            console.error("🔥 Critical auth error:", error);
            if (authOverlay) authOverlay.style.display = 'none';
            if (loginModal) loginModal.style.display = 'flex';
        }
    }, 100);
    
    setTimeout(() => {
        if (window.BackgroundCallSystem && window.BackgroundCallSystem.init) {
            window.BackgroundCallSystem.init();
            console.log("✅ Background call system ready");
        }
    }, 3000);
});

setTimeout(() => {
    const authOverlay = document.getElementById('authOverlay');
    if (authOverlay && authOverlay.style.display === 'flex') {
        console.log("🚨 EMERGENCY: Auth overlay stuck, forcing login");
        authOverlay.style.display = 'none';
        
        const loginModal = document.getElementById('loginModal');
        const mainContainer = document.getElementById('mainContainer');
        
        if (loginModal) loginModal.style.display = 'flex';
        if (mainContainer) mainContainer.style.display = 'none';
    }
}, 7000);

document.addEventListener('DOMContentLoaded', function() {
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    const authOverlay = document.getElementById('authOverlay');
    const loginModal = document.getElementById('loginModal');
    const container = document.querySelector('.container');
    
    if (!isLoggedIn) {
        if (authOverlay) {
            authOverlay.style.display = 'flex';
            authOverlay.classList.add('show');
        }
        if (loginModal) {
            loginModal.style.display = 'flex';
            loginModal.classList.add('show');
        }
        if (container) {
            container.style.display = 'none';
        }
        
        document.body.classList.remove('logged-in');
    } else {
        if (authOverlay) {
            authOverlay.style.display = 'none';
            authOverlay.classList.remove('show');
        }
        if (loginModal) {
            loginModal.style.display = 'none';
            loginModal.classList.remove('show');
        }
        if (container) {
            container.style.display = 'block';
        }
        
        document.body.classList.add('logged-in');
    }
});

function loginUser() {
    localStorage.setItem('userLoggedIn', 'true');
    document.body.classList.add('logged-in');
    
    const authOverlay = document.getElementById('authOverlay');
    const loginModal = document.getElementById('loginModal');
    const container = document.querySelector('.container');
    
    if (authOverlay) {
        authOverlay.style.display = 'none';
        authOverlay.classList.remove('show');
    }
    if (loginModal) {
        loginModal.style.display = 'none';
        loginModal.classList.remove('show');
    }
    if (container) {
        container.style.display = 'block';
    }
}

function logoutUser() {
    localStorage.setItem('userLoggedIn', 'false');
    document.body.classList.remove('logged-in');
    
    const authOverlay = document.getElementById('authOverlay');
    const loginModal = document.getElementById('loginModal');
    const container = document.querySelector('.container');
    
    if (authOverlay) {
        authOverlay.style.display = 'flex';
        authOverlay.classList.add('show');
    }
    if (loginModal) {
        loginModal.style.display = 'flex';
        loginModal.classList.add('show');
    }
    if (container) {
        container.style.display = 'none';
    }
}

// Test Turnix.io connection
function testTurnixConnection() {
    console.log("🧪 Testing Turnix.io connection...");
    
    const testPC = new RTCPeerConnection({
        iceServers: ICE_SERVERS
    });
    
    testPC.onicecandidate = (event) => {
        if (event.candidate) {
            console.log(`🔍 ICE Candidate Type: ${event.candidate.type}`);
            console.log(`🔍 Protocol: ${event.candidate.protocol}`);
            console.log(`🔍 Address: ${event.candidate.address}`);
            
            if (event.candidate.type === 'relay') {
                console.log("✅ TURN server is working!");
            }
        }
    };
    
    testPC.createDataChannel('test');
    testPC.createOffer()
        .then(offer => testPC.setLocalDescription(offer))
        .then(() => {
            setTimeout(() => {
                testPC.close();
                console.log("🧪 Turnix.io test completed");
            }, 5000);
        })
        .catch(error => {
            console.error("❌ Turnix.io test failed:", error);
        });
}

// Test on startup
setTimeout(() => {
    testTurnixConnection();
}, 5000);

console.log("🎯 WebRTC with Turnix.io initialized successfully!");