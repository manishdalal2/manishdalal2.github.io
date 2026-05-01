// Configuration
let configuration = { 
    iceServers: [] 
};

// DOM Elements
const createOfferBtn = document.getElementById('createOffer');
const createAnswerBtn = document.getElementById('createAnswer');
const setRemoteAnswerBtn = document.getElementById('setRemoteAnswer');
const localSdp1 = document.getElementById('localSdp1');
const remoteSdp1 = document.getElementById('remoteSdp1');
const localSdp2 = document.getElementById('localSdp2');
const remoteSdp2 = document.getElementById('remoteSdp2');
const statusDiv = document.getElementById('status');
const stunServerInput = document.getElementById('stunServer');
const updateStunBtn = document.getElementById('updateStun');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Peer connections and data channels
let localConnection = null;
let remoteConnection = null;
let sendChannel = null;
let receiveChannel = null;

// Stats logging with IndexedDB
const DB_NAME = 'webrtc_stats_db';
const DB_VERSION = 1;
const STORE_NAME = 'stats';
let statsInterval = null;
let statsCounter = 0;
let dbPromise = null;

// Track last logged state to avoid duplicate entries
const lastStatsState = new Map(); // key: connectionName, value: {connectionState, iceConnectionState, signalingState}

// Initialize IndexedDB
function initStatsDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('connectionName', 'connectionName', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });

    return dbPromise;
}

// Get next counter value from DB
async function getNextCounter() {
    const db = await initStatsDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();
        request.onsuccess = () => resolve(request.result + 1);
        request.onerror = () => resolve(statsCounter + 1);
    });
}

// Store stats entry
async function storeStatsEntry(entry) {
    try {
        const db = await initStatsDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
            const req = store.add(entry);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Failed to store stats:', e);
    }
}

// Start periodic stats logging - only logs when state changes
function startStatsLogging() {
    stopStatsLogging();
    lastStatsState.clear(); // Reset state tracking on new connection

    statsInterval = setInterval(async () => {
        const connections = [
            { name: 'localConnection', pc: localConnection },
            { name: 'remoteConnection', pc: remoteConnection }
        ];

        for (const { name, pc } of connections) {
            if (!pc || pc.signalingState === 'closed') continue;

            // Get current state
            const currentState = {
                connectionState: pc.connectionState,
                iceConnectionState: pc.iceConnectionState,
                signalingState: pc.signalingState
            };

            // Check if state changed from last logged state
            const lastState = lastStatsState.get(name);
            const stateChanged = !lastState ||
                lastState.connectionState !== currentState.connectionState ||
                lastState.iceConnectionState !== currentState.iceConnectionState ||
                lastState.signalingState !== currentState.signalingState;

            if (!stateChanged) {
                // Skip logging - no state change
                continue;
            }

            try {
                const stats = await pc.getStats();
                const timestamp = new Date().toISOString();
                statsCounter = await getNextCounter();

                const statsData = [];
                stats.forEach(report => {
                    statsData.push(report);
                    console.log(`[${name}] [${statsCounter}] state=${currentState.connectionState}, ice=${currentState.iceConnectionState}`, report);
                });

                const statsEntry = {
                    counter: statsCounter,
                    timestamp: timestamp,
                    connectionName: name,
                    ...currentState,
                    reports: statsData
                };

                // Async store - non-blocking
                await storeStatsEntry(statsEntry);

                // Update last logged state
                lastStatsState.set(name, currentState);
            } catch (e) {
                console.error(`Error getting stats for ${name}:`, e);
            }
        }
    }, 2000);
}

function stopStatsLogging() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

// Query stats by time range (useful for post-debug analysis)
async function queryStats(connectionName, sinceTimestamp) {
    const db = await initStatsDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('connectionName');
        const results = [];

        const request = index.openCursor(IDBKeyRange.only(connectionName));
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (!sinceTimestamp || new Date(cursor.value.timestamp) >= new Date(sinceTimestamp)) {
                    results.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Export all stats to a JSON file (call this when app is foregrounded to inspect)
async function exportStatsToFile(filename = 'webrtc_stats.json') {
    try {
        const db = await initStatsDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const allStats = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const blob = new Blob([JSON.stringify(allStats, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`Exported ${allStats.length} stats entries to ${filename}`);
        return allStats.length;
    } catch (e) {
        console.error('Failed to export stats:', e);
        return 0;
    }
}

// Clear all stored stats
async function clearAllStats() {
    try {
        const db = await initStatsDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        statsCounter = 0;
        lastStatsState.clear(); // Reset state tracking
        console.log('All WebRTC stats cleared from IndexedDB');
    } catch (e) {
        console.error('Failed to clear stats:', e);
    }
}

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

// Send message through data channel
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Try sendChannel first (Peer 1), then receiveChannel (Peer 2)
    const channel = sendChannel || receiveChannel;
    
    console.log("Attempting to send message");
    console.log("sendChannel:", sendChannel ? sendChannel.readyState : "null");
    console.log("receiveChannel:", receiveChannel ? receiveChannel.readyState : "null");
    console.log("Using channel with state:", channel ? channel.readyState : "no channel");
    
    if (channel && channel.readyState === 'open') {
        channel.send(message);
        addMessageToChat(message, true);
        messageInput.value = '';
        // Ensure chat stays enabled
        chatContainer.classList.remove('chat-disabled');
        console.log("Message sent successfully");
    } else {
        console.log("Cannot send - channel state:", channel ? channel.readyState : "no channel");
        updateStatus('Cannot send message - connection not established');
    }
}

// Chat event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Update STUN server
function updateStunServer() {
    const stunUrl = stunServerInput.value.trim();
    if (stunUrl) {
        configuration = { iceServers: [{ urls: stunUrl }] };
        updateStatus(`STUN server set: ${stunUrl}`);
    } else {
        configuration = { iceServers: [] };
        updateStatus("No STUN server - direct connection only");
    }
}

updateStunBtn.addEventListener('click', updateStunServer);

// Initialize on load - just set status
window.addEventListener('load', () => {
    updateStatus("Ready - create an offer on Peer 1 or paste offer on Peer 2");
    console.log("WebRTC chat ready");
    // Start logging immediately to capture initial states (new, connecting, etc.)
    startStatsLogging();
});

// Parse JSON safely
function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        updateStatus(`Invalid JSON: ${error.message}`);
        console.error("Parse error:", error);
        return null;
    }
}

// Create Offer (Peer 1)
createOfferBtn.addEventListener('click', async () => {
    try {
        // Reset only the local connection for Peer 1
        if (localConnection) localConnection.close();
        sendChannel = null;
        
        localConnection = new RTCPeerConnection(configuration);
        
        localConnection.onicecandidate = () => {
            console.log("ICE candidate for Peer 1");
            localSdp1.value = JSON.stringify(localConnection.localDescription);
            updateStatus("Offer ready - copy to Peer 2");
        };
        
        localConnection.onconnectionstatechange = () => {
            console.log(`Peer 1: ${localConnection.connectionState}`);
            updateStatus(`Peer 1: ${localConnection.connectionState}`);
            
            // Handle disconnection - requires manual reconnection
            if (localConnection.connectionState === 'disconnected') {
                updateStatus("Connection lost - please create a new offer");
                chatContainer.classList.add('chat-disabled');
            } else if (localConnection.connectionState === 'failed') {
                updateStatus("Connection failed - please create a new offer");
                chatContainer.classList.add('chat-disabled');
            }
        };
        
        localConnection.oniceconnectionstatechange = () => {
            console.log(`Peer 1 ICE state: ${localConnection.iceConnectionState}`);
            
            // Handle ICE connection failures
            if (localConnection.iceConnectionState === 'failed') {
                console.log("ICE connection failed - may need ICE restart");
                updateStatus("Network issue detected - connection may be lost");
            }
        };
        
        // Create data channel
        sendChannel = localConnection.createDataChannel("chat");
        
        sendChannel.onopen = () => {
            console.log("Send channel opened");
            updateStatus("Connected! You can now chat");
            chatContainer.classList.remove('chat-disabled');
            startStatsLogging();
        };
        
        sendChannel.onclose = () => {
            console.log("Send channel closed");
           // stopStatsLogging();
            chatContainer.classList.add('chat-disabled');
        };
        
        sendChannel.onerror = (error) => {
            console.error("Data channel error:", error);
            updateStatus("Data channel error occurred");
        };
        
        sendChannel.onmessage = (e) => {
            console.log("Message received:", e.data);
            addMessageToChat(e.data, false);
        };
        
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        updateStatus("Creating offer... gathering ICE candidates");
    } catch (error) {
        updateStatus(`Error: ${error.message}`);
        console.error(error);
    }
});

// Create Answer (Peer 2)
createAnswerBtn.addEventListener('click', async () => {
    try {
        if (!remoteSdp2.value) {
            updateStatus("Please paste the offer first");
            return;
        }
        
        const offer = parseJSON(remoteSdp2.value);
        if (!offer) return;
        
        // Reset only the remote connection for Peer 2
        if (remoteConnection) remoteConnection.close();
        receiveChannel = null;
        
        remoteConnection = new RTCPeerConnection(configuration);
        
        remoteConnection.onicecandidate = () => {
            console.log("ICE candidate for Peer 2");
            localSdp2.value = JSON.stringify(remoteConnection.localDescription);
            updateStatus("Answer ready - copy to Peer 1");
        };
        
        remoteConnection.onconnectionstatechange = () => {
            console.log(`Peer 2: ${remoteConnection.connectionState}`);
            
            // Handle disconnection - requires manual reconnection
            if (remoteConnection.connectionState === 'disconnected') {
                updateStatus("Connection lost - please create a new offer/answer");
                chatContainer.classList.add('chat-disabled');
            } else if (remoteConnection.connectionState === 'failed') {
                updateStatus("Connection failed - please create a new offer/answer");
                chatContainer.classList.add('chat-disabled');
            }
        };
        
        remoteConnection.oniceconnectionstatechange = () => {
            console.log(`Peer 2 ICE state: ${remoteConnection.iceConnectionState}`);
            
            if (remoteConnection.iceConnectionState === 'failed') {
                console.log("ICE connection failed on Peer 2");
                updateStatus("Network issue detected");
            }
        };
        
        // Handle incoming data channel
        remoteConnection.ondatachannel = (event) => {
            console.log("Data channel received on Peer 2");
            receiveChannel = event.channel;
            console.log("Channel state:", receiveChannel.readyState);
            
            receiveChannel.onopen = () => {
                console.log("Receive channel opened");
                updateStatus("Connected! You can now chat");
                chatContainer.classList.remove('chat-disabled');
               
            };
            
            receiveChannel.onmessage = (e) => {
                console.log("Message received:", e.data);
                addMessageToChat(e.data, false);
            };
            
            receiveChannel.onclose = () => {
                console.log("Receive channel closed");
                stopStatsLogging();
                chatContainer.classList.add('chat-disabled');
            };
            
            receiveChannel.onerror = (error) => {
                console.error("Data channel error:", error);
                updateStatus("Data channel error occurred");
            };
        };
        
        await remoteConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await remoteConnection.createAnswer();
        await remoteConnection.setLocalDescription(answer);
        updateStatus("Creating answer... gathering ICE candidates");
    } catch (error) {
        updateStatus(`Error: ${error.message}`);
        console.error(error);
    }
});

// Set Answer (Peer 1)
setRemoteAnswerBtn.addEventListener('click', async () => {
    try {
        if (!remoteSdp1.value) {
            updateStatus("Please paste the answer first");
            return;
        }
        
        const answer = parseJSON(remoteSdp1.value);
        if (!answer) return;
        
        await localConnection.setRemoteDescription(new RTCSessionDescription(answer));
        updateStatus("Answer set - connection establishing...");
    } catch (error) {
        updateStatus(`Error: ${error.message}`);
        console.error(error);
    }
});

// Check WebRTC support
if (typeof RTCPeerConnection === 'undefined') {
    updateStatus("ERROR: WebRTC not supported in this browser");
} else {
    console.log("WebRTC supported");
}