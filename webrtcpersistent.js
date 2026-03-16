// DOM Elements
const peerIdDisplay = document.getElementById('peerIdDisplay');
const remotePeerIdInput = document.getElementById('remotePeerId');
const connectBtn = document.getElementById('connectBtn');
const clearSessionBtn = document.getElementById('clearSessionBtn');
const copyIdBtn = document.getElementById('copyIdBtn');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDiv = document.getElementById('status');
const sessionStatus = document.getElementById('sessionStatus');
const sessionDetails = document.getElementById('sessionDetails');
const connectionStatusIndicator = document.querySelector('.connection-status');
const connectionStatusText = document.getElementById('connectionStatusText');
const chatHint = document.getElementById('chatHint');

// PeerJS instance
let peer = null;
let connection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

// LocalStorage keys
const STORAGE_KEYS = {
    MY_PEER_ID: 'webrtc_my_peer_id',
    REMOTE_PEER_ID: 'webrtc_remote_peer_id',
    CHAT_HISTORY: 'webrtc_chat_history',
    LAST_CONNECTED: 'webrtc_last_connected',
    SESSION_ACTIVE: 'webrtc_session_active'
};

// Session state
let chatHistory = [];
let sessionRestored = false;

// Update status message
function updateStatus(message) {
    statusDiv.textContent = `Status: ${message}`;
    console.log(message);
}

// Update connection status indicator
function updateConnectionStatus(status) {
    connectionStatusIndicator.className = 'connection-status';
    
    switch(status) {
        case 'connected':
            connectionStatusIndicator.classList.add('status-connected');
            connectionStatusText.textContent = 'Connected';
            break;
        case 'connecting':
            connectionStatusIndicator.classList.add('status-connecting');
            connectionStatusText.textContent = 'Connecting...';
            break;
        case 'disconnected':
        default:
            connectionStatusIndicator.classList.add('status-disconnected');
            connectionStatusText.textContent = 'Disconnected';
            break;
    }
}

// Save session to localStorage
function saveSession() {
    try {
        if (peer && peer.id) {
            localStorage.setItem(STORAGE_KEYS.MY_PEER_ID, peer.id);
        }
        
        const remotePeerId = remotePeerIdInput.value.trim();
        if (remotePeerId) {
            localStorage.setItem(STORAGE_KEYS.REMOTE_PEER_ID, remotePeerId);
        }
        
        if (chatHistory.length > 0) {
            localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chatHistory));
        }
        
        if (connection && connection.open) {
            localStorage.setItem(STORAGE_KEYS.LAST_CONNECTED, new Date().toISOString());
            localStorage.setItem(STORAGE_KEYS.SESSION_ACTIVE, 'true');
        }
        
        console.log('Session saved to localStorage');
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

// Load session from localStorage
function loadSession() {
    try {
        const savedPeerId = localStorage.getItem(STORAGE_KEYS.MY_PEER_ID);
        const savedRemotePeerId = localStorage.getItem(STORAGE_KEYS.REMOTE_PEER_ID);
        const savedChatHistory = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
        const lastConnected = localStorage.getItem(STORAGE_KEYS.LAST_CONNECTED);
        const sessionActive = localStorage.getItem(STORAGE_KEYS.SESSION_ACTIVE);
        
        if (savedChatHistory) {
            chatHistory = JSON.parse(savedChatHistory);
        }
        
        return {
            myPeerId: savedPeerId,
            remotePeerId: savedRemotePeerId,
            chatHistory: chatHistory,
            lastConnected: lastConnected,
            sessionActive: sessionActive === 'true'
        };
    } catch (error) {
        console.error('Error loading session:', error);
        return null;
    }
}

// Clear session from localStorage
function clearSession() {
    if (confirm('Are you sure you want to clear the session? This will delete all chat history and disconnect.')) {
        // Close existing connections
        if (connection) {
            connection.close();
            connection = null;
        }
        if (peer) {
            peer.destroy();
            peer = null;
        }
        
        // Clear localStorage
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Reset UI
        chatHistory = [];
        chatMessages.innerHTML = '';
        remotePeerIdInput.value = '';
        sessionStatus.style.display = 'none';
        chatContainer.classList.add('chat-disabled');
        updateConnectionStatus('disconnected');
        updateStatus('Session cleared. Reinitializing...');
        
        // Reinitialize
        setTimeout(() => {
            initializePeer();
        }, 500);
    }
}

// Display session info
function displaySessionInfo(session) {
    if (session && session.sessionActive) {
        sessionStatus.style.display = 'block';
        sessionStatus.classList.add('session-restored');
        
        const lastConnectedDate = session.lastConnected ? 
            new Date(session.lastConnected).toLocaleString() : 'Unknown';
        
        sessionDetails.innerHTML = `
            <p><strong>✅ Session Restored!</strong></p>
            <p><strong>Your Peer ID:</strong> ${session.myPeerId || 'N/A'}</p>
            <p><strong>Connected to:</strong> ${session.remotePeerId || 'N/A'}</p>
            <p><strong>Last Connected:</strong> ${lastConnectedDate}</p>
            <p><strong>Messages in History:</strong> ${session.chatHistory.length}</p>
            <p><em>Attempting to reconnect automatically...</em></p>
        `;
        
        sessionRestored = true;
        updateStatus('Session restored - reconnecting...');
    }
}

// Add message to chat UI
function addMessageToChat(text, isLocal = false, timestamp = null, isRestored = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isLocal ? 'local' : 'remote');
    
    if (isRestored) {
        messageElement.classList.add('restored');
    }
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const prefix = isLocal ? 'You' : 'Peer';
    
    messageElement.innerHTML = `${prefix}: ${text}<span class="message-timestamp">${time}</span>`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Save to history if not restored
    if (!isRestored) {
        const messageData = {
            text: text,
            isLocal: isLocal,
            timestamp: timestamp || new Date().toISOString()
        };
        chatHistory.push(messageData);
        saveSession();
    }
}

// Restore chat history from localStorage
function restoreChatHistory() {
    if (chatHistory.length > 0) {
        chatMessages.innerHTML = ''; // Clear existing
        chatHistory.forEach(msg => {
            addMessageToChat(msg.text, msg.isLocal, msg.timestamp, true);
        });
        updateStatus(`Restored ${chatHistory.length} messages from history`);
    }
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    if (connection && connection.open) {
        connection.send(message);
        addMessageToChat(message, true);
        messageInput.value = '';
    } else {
        updateStatus('Cannot send message - not connected');
    }
}

// Initialize PeerJS with free cloud server
function initializePeer(savedPeerId = null) {
    // Create peer with saved ID or generate new one
    const peerOptions = {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        }
    };
    
    if (savedPeerId) {
        peer = new Peer(savedPeerId, peerOptions);
        updateStatus(`Attempting to restore peer with ID: ${savedPeerId}`);
    } else {
        peer = new Peer(peerOptions);
        updateStatus('Creating new peer...');
    }
    
    peer.on('open', (id) => {
        console.log('My peer ID is:', id);
        peerIdDisplay.textContent = id;
        updateStatus(`Connected to signaling server. Your ID: ${id}`);
        saveSession();
        
        // Auto-connect to saved remote peer if session was restored
        const session = loadSession();
        if (session && session.remotePeerId && session.sessionActive) {
            remotePeerIdInput.value = session.remotePeerId;
            setTimeout(() => {
                autoReconnect(session.remotePeerId);
            }, 1000);
        }
    });
    
    peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        setupConnection(conn);
        remotePeerIdInput.value = conn.peer;
        saveSession();
        updateStatus(`Incoming connection from ${conn.peer}`);
    });
    
    peer.on('disconnected', () => {
        console.log('Disconnected from signaling server');
        updateStatus('Disconnected from signaling server - attempting reconnect...');
        updateConnectionStatus('connecting');
        peer.reconnect();
    });
    
    peer.on('close', () => {
        console.log('Peer connection closed');
        updateStatus('Peer closed');
        updateConnectionStatus('disconnected');
        chatContainer.classList.add('chat-disabled');
    });
    
    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        updateStatus(`Error: ${error.type}`);
        
        // If failed to restore saved peer ID, create new one
        if (error.type === 'unavailable-id' && savedPeerId) {
            updateStatus('Saved peer ID unavailable. Creating new peer...');
            localStorage.removeItem(STORAGE_KEYS.MY_PEER_ID);
            peer.destroy();
            setTimeout(() => initializePeer(), 1000);
        }
    });
}

// Setup connection handlers
function setupConnection(conn) {
    connection = conn;
    
    connection.on('open', () => {
        console.log('Data connection opened');
        updateStatus('Connected! You can now chat');
        updateConnectionStatus('connected');
        chatContainer.classList.remove('chat-disabled');
        chatHint.innerHTML = '<strong style="color: green;">✓ Connected and ready!</strong>';
        reconnectAttempts = 0;
        saveSession();
    });
    
    connection.on('data', (data) => {
        console.log('Received:', data);
        addMessageToChat(data, false);
    });
    
    connection.on('close', () => {
        console.log('Data connection closed');
        updateStatus('Connection closed - enter peer ID to reconnect');
        updateConnectionStatus('disconnected');
        chatContainer.classList.add('chat-disabled');
        chatHint.innerHTML = 'Connection closed. Click Connect to reconnect.';
        localStorage.setItem(STORAGE_KEYS.SESSION_ACTIVE, 'false');
        connection = null;
        
        // Attempt auto-reconnect if we have a remote peer ID
        const remotePeerId = remotePeerIdInput.value.trim();
        if (remotePeerId && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            updateStatus(`Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
            setTimeout(() => autoReconnect(remotePeerId), RECONNECT_DELAY);
        }
    });
    
    connection.on('error', (error) => {
        console.error('Connection error:', error);
        updateStatus('Connection error occurred');
        updateConnectionStatus('disconnected');
    });
}

// Auto-reconnect to remote peer
function autoReconnect(remotePeerId) {
    if (!remotePeerId || !peer) {
        return;
    }
    
    updateStatus(`Auto-reconnecting to ${remotePeerId}...`);
    updateConnectionStatus('connecting');
    
    // Create connection to remote peer
    const conn = peer.connect(remotePeerId, {
        reliable: true
    });
    
    setupConnection(conn);
}

// Connect to remote peer
function connectToPeer() {
    const remotePeerId = remotePeerIdInput.value.trim();
    
    if (!remotePeerId) {
        updateStatus('Please enter a peer ID');
        return;
    }
    
    if (!peer) {
        updateStatus('Peer not initialized');
        return;
    }
    
    updateStatus(`Connecting to ${remotePeerId}...`);
    updateConnectionStatus('connecting');
    reconnectAttempts = 0;
    
    // Create connection to remote peer
    const conn = peer.connect(remotePeerId, {
        reliable: true
    });
    
    setupConnection(conn);
}

// Copy peer ID to clipboard
function copyPeerId() {
    const peerId = peerIdDisplay.textContent;
    if (peerId && peerId !== 'Initializing...') {
        navigator.clipboard.writeText(peerId).then(() => {
            copyIdBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyIdBtn.textContent = 'Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            updateStatus('Failed to copy to clipboard');
        });
    }
}

// Event listeners
connectBtn.addEventListener('click', connectToPeer);
clearSessionBtn.addEventListener('click', clearSession);
copyIdBtn.addEventListener('click', copyPeerId);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Save session before page unload
window.addEventListener('beforeunload', () => {
    saveSession();
});

// Initialize on page load
window.addEventListener('load', () => {
    updateStatus('Initializing...');
    updateConnectionStatus('disconnected');
    
    // Try to load saved session
    const session = loadSession();
    
    if (session && session.myPeerId) {
        displaySessionInfo(session);
        restoreChatHistory();
        initializePeer(session.myPeerId);
    } else {
        updateStatus('No saved session. Starting fresh...');
        initializePeer();
    }
});
