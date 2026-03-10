// DOM Elements
const peerIdDisplay = document.getElementById('peerIdDisplay');
const remotePeerIdInput = document.getElementById('remotePeerId');
const connectBtn = document.getElementById('connectBtn');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDiv = document.getElementById('status');

// PeerJS instance
let peer = null;
let connection = null;

// Update status message
function updateStatus(message) {
    statusDiv.textContent = `Status: ${message}`;
    console.log(message);
}

// Add message to chat UI
function addMessageToChat(text, isLocal = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isLocal ? 'local' : 'remote');
    messageElement.textContent = isLocal ? `You: ${text}` : `Peer: ${text}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
function initializePeer() {
    // Create peer with random ID using PeerJS cloud server
    peer = new Peer({
        config: {
            iceServers: [
                
            ]
        }
    });
    
    peer.on('open', (id) => {
        console.log('My peer ID is:', id);
        peerIdDisplay.textContent = id;
        updateStatus(`Connected to signaling server. Your ID: ${id}`);
    });
    
    peer.on('connection', (conn) => {
        console.log('Incoming connection from:', conn.peer);
        setupConnection(conn);
        updateStatus(`Incoming connection from ${conn.peer}`);
    });
    
    peer.on('disconnected', () => {
        console.log('Disconnected from signaling server');
        updateStatus('Disconnected from signaling server - attempting reconnect...');
        peer.reconnect();
    });
    
    peer.on('close', () => {
        console.log('Peer connection closed');
        updateStatus('Connection closed');
        chatContainer.classList.add('chat-disabled');
    });
    
    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        updateStatus(`Error: ${error.type}`);
    });
}

// Setup connection handlers
function setupConnection(conn) {
    connection = conn;
    
    connection.on('open', () => {
        console.log('Data connection opened');
        updateStatus('Connected! You can now chat');
        chatContainer.classList.remove('chat-disabled');
    });
    
    connection.on('data', (data) => {
        console.log('Received:', data);
        addMessageToChat(data, false);
    });
    
    connection.on('close', () => {
        console.log('Data connection closed');
        updateStatus('Connection closed - enter peer ID to reconnect');
        chatContainer.classList.add('chat-disabled');
        connection = null;
    });
    
    connection.on('error', (error) => {
        console.error('Connection error:', error);
        updateStatus('Connection error occurred');
    });
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
    
    // Create connection to remote peer
    const conn = peer.connect(remotePeerId, {
        reliable: true
    });
    
    setupConnection(conn);
}

// Event listeners
connectBtn.addEventListener('click', connectToPeer);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initialize on page load
window.addEventListener('load', () => {
    updateStatus('Initializing...');
    initializePeer();
});

// Check if PeerJS is loaded
if (typeof Peer === 'undefined') {
    updateStatus('ERROR: PeerJS library not loaded');
    console.error('PeerJS not found');
}