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
        };
        
        // Create data channel
        sendChannel = localConnection.createDataChannel("chat");
        
        sendChannel.onopen = () => {
            console.log("Send channel opened");
            updateStatus("Connected! You can now chat");
            chatContainer.classList.remove('chat-disabled');
        };
        
        sendChannel.onclose = () => {
            console.log("Send channel closed");
            chatContainer.classList.add('chat-disabled');
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
                chatContainer.classList.add('chat-disabled');
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