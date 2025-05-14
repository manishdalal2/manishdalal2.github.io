// Global variables
let pc1 = null;
let pc2 = null;
let configuration = { 
    iceServers: [ ] 
};

// Elements
const createOfferBtn = document.getElementById('createOffer');
const createAnswerBtn = document.getElementById('createAnswer');
const setRemoteOfferBtn = document.getElementById('setRemoteOffer');
const setRemoteAnswerBtn = document.getElementById('setRemoteAnswer');
const localSdp1 = document.getElementById('localSdp1');
const remoteSdp1 = document.getElementById('remoteSdp1');
const localSdp2 = document.getElementById('localSdp2');
const remoteSdp2 = document.getElementById('remoteSdp2');
const statusDiv = document.getElementById('status');
const stunServerInput = document.getElementById('stunServer');
const updateStunBtn = document.getElementById('updateStun');

// Chat elements
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Variables for peer connections and data channels
let localConnection = null;
let remoteConnection = null;
let sendChannel = null;
let receiveChannel = null;

// Status update function
function updateStatus(message) {
    statusDiv.textContent = `Status: ${message}`;
    console.log(message);
}

// Add a message to the chat
function addMessageToChat(text, isLocal = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isLocal ? 'local' : 'remote');
    messageElement.textContent = isLocal ? `You: ${text}` : `Peer: ${text}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a message via data channel
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && sendChannel && sendChannel.readyState === 'open') {
        sendChannel.send(message);
        addMessageToChat(message, true);
        messageInput.value = '';
    }
}

// Add event listeners for chat
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Update STUN server configuration
function updateStunServer() {
    const stunUrl = stunServerInput.value.trim();
    if (stunUrl) {
        configuration = {
            iceServers: [
                { urls: stunUrl }
            ]
        };
        updateStatus(`STUN server updated to: ${stunUrl}`);
    } else {
        configuration = {
            iceServers: []
        };
        updateStatus("STUN server removed. Using direct connection only.");
    }
    // Reinitialize peer connections with new configuration
    createPeerConnections();
}

// Add event listener for STUN server update button
updateStunBtn.addEventListener('click', updateStunServer);

// Initialize RTCPeerConnection objects
function createPeerConnections() {
    if (localConnection) localConnection.close();
    if (remoteConnection) remoteConnection.close();
    
    // Create local connection
    localConnection = new RTCPeerConnection(configuration);
    
    localConnection.onicecandidate = e => {
        console.log("NEW ice candidate!! on localconnection reprinting SDP");
        console.log(JSON.stringify(localConnection.localDescription));
        
        // Update the local SDP textarea
        localSdp1.value = JSON.stringify(localConnection.localDescription);
        updateStatus("Offer created with ICE candidates. Copy it to Peer 2.");
    };
    
    // Connection state change to enable/disable chat
    localConnection.onconnectionstatechange = () => {
        console.log(`Peer 1 connection state: ${localConnection.connectionState}`);
        updateStatus(`Peer 1 connection state: ${localConnection.connectionState}`);
        
        if (localConnection.connectionState === 'connected') {
            // Enable chat when connected
            chatContainer.classList.remove('chat-disabled');
        } else {
            // Disable chat when not connected
            chatContainer.classList.add('chat-disabled');
        }
    };
    
    // Create remote connection
    remoteConnection = new RTCPeerConnection(configuration);
    
    remoteConnection.onicecandidate = e => {
        console.log("NEW ice candidate!! on remoteConnection reprinting SDP");
        console.log(JSON.stringify(remoteConnection.localDescription));
        
        // Update the local SDP textarea
        localSdp2.value = JSON.stringify(remoteConnection.localDescription);
        updateStatus("Answer created with ICE candidates. Copy it to Peer 1.");
    };
    
    // Create data channel
    sendChannel = localConnection.createDataChannel("sendChannel");
    sendChannel.onmessage = e => {
        console.log("message received!!! " + e.data);
        addMessageToChat(e.data, false);
    };
    sendChannel.onopen = e => {
        console.log("open!!!!");
        updateStatus("Data channel is open!");
        chatContainer.classList.remove('chat-disabled');
    };
    sendChannel.onclose = e => {
        console.log("closed!!!!!!");
        chatContainer.classList.add('chat-disabled');
    };
    
    // Handle incoming data channel on remote connection
    remoteConnection.ondatachannel = (event) => {
        receiveChannel = event.channel;
        receiveChannel.onmessage = e => {
            console.log("Message from data channel: " + e.data);
            updateStatus(`Message received: ${e.data}`);
            addMessageToChat(e.data, false);
        };
        receiveChannel.onopen = e => {
            console.log("Data channel connection established");
            updateStatus("Data channel connection established on Peer 2");
        };
        receiveChannel.onclose = e => {
            console.log("Remote data channel closed");
            chatContainer.classList.add('chat-disabled');
        };
    };
    
    updateStatus("Peer connections initialized");
}

// Initialize on page load
window.addEventListener('load', createPeerConnections);

// Function to safely parse JSON
function safeJsonParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        updateStatus(`JSON parsing error: ${error.message}. Please check the SDP format.`);
        console.error("JSON Parse Error:", error);
        return null;
    }
}

// Create offer
createOfferBtn.addEventListener('click', async () => {
    try {
        createPeerConnections(); // Reset connections
        
        // Simple offer creation as requested
        localConnection.createOffer()
            .then(o => localConnection.setLocalDescription(o))
            .then(() => {
                updateStatus("Creating offer... waiting for ICE gathering to complete");
            })
            .catch(err => {
                updateStatus(`Error setting local description: ${err.message}`);
            });
    } catch (error) {
        updateStatus(`Error creating offer: ${error.message}`);
    }
});

// Set remote offer and create answer
createAnswerBtn.addEventListener('click', async () => {
    try {
        if (!remoteSdp2.value) {
            updateStatus("Please paste the offer SDP first");
            return;
        }
        
        const offerDesc = safeJsonParse(remoteSdp2.value);
        if (!offerDesc) return;
        
        remoteConnection.setRemoteDescription(new RTCSessionDescription(offerDesc))
            .then(() => remoteConnection.createAnswer())
            .then(a => remoteConnection.setLocalDescription(a))
            .then(() => {
                updateStatus("Creating answer... waiting for ICE gathering to complete");
            })
            .catch(err => {
                updateStatus(`Error in answer creation: ${err.message}`);
            });
    } catch (error) {
        updateStatus(`Error creating answer: ${error.message}`);
    }
});

// Set remote offer (for Peer 2)
setRemoteOfferBtn.addEventListener('click', async () => {
    try {
        if (!remoteSdp2.value) {
            updateStatus("Please paste the offer SDP first");
            return;
        }
        
        const offerDesc = safeJsonParse(remoteSdp2.value);
        if (!offerDesc) return;
        
        remoteConnection.setRemoteDescription(new RTCSessionDescription(offerDesc))
            .then(() => {
                updateStatus("Remote offer set on Peer 2");
            })
            .catch(err => {
                updateStatus(`Error setting remote description: ${err.message}`);
            });
    } catch (error) {
        updateStatus(`Error setting remote offer: ${error.message}`);
    }
});

// Set remote answer (for Peer 1)
setRemoteAnswerBtn.addEventListener('click', async () => {
    try {
        if (!remoteSdp1.value) {
            updateStatus("Please paste the answer SDP first");
            return;
        }
        
        const answerDesc = safeJsonParse(remoteSdp1.value);
        if (!answerDesc) return;
        
        localConnection.setRemoteDescription(new RTCSessionDescription(answerDesc))
            .then(() => {
                updateStatus("Remote answer set on Peer 1");
            })
            .catch(err => {
                updateStatus(`Error setting remote answer: ${err.message}`);
            });
    } catch (error) {
        updateStatus(`Error setting remote answer: ${error.message}`);
    }
});

// Add debug console output to help diagnose issues
console.log("WebRTC script loaded and running");

// Check browser WebRTC support
if (typeof RTCPeerConnection === 'undefined') {
    updateStatus("ERROR: Your browser doesn't support WebRTC");
    console.error("WebRTC not supported");
} else {
    console.log("WebRTC is supported in this browser");
}
