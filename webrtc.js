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

// QR Code Functions
function generateQRCode(data, elementId) {
    try {
        const container = document.getElementById(elementId);
        container.innerHTML = ''; // Clear previous QR code
        
        // Check if QRCode library is available
        if (typeof QRCode === 'undefined') {
            updateStatus("QR Code library not loaded. Please check console for errors.");
            console.error("QRCode library is not defined");
            return;
        }
        
        // Simple QR generation without using correctLevel
        var qrcode = new QRCode(container, {
            text: data,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L
        });
        
        updateStatus("QR code generated successfully");
    } catch (error) {
        updateStatus(`Error generating QR code: ${error.message}`);
        console.error("QR Code Error:", error);
    }
}

// Generate QR codes for SDPs
function generateSDPQRCodes() {
    // Generate QR for local SDP (Peer 1 - Offer)
    document.getElementById('genQRBtn1').addEventListener('click', () => {
        if (localSdp1.value) {
            generateQRCode(localSdp1.value, 'qrcode1');
            updateStatus("QR code generated for offer");
        } else {
            updateStatus("No offer SDP available to generate QR code");
        }
    });
    
    // Generate QR for local SDP (Peer 2 - Answer)
    document.getElementById('genQRBtn2').addEventListener('click', () => {
        if (localSdp2.value) {
            generateQRCode(localSdp2.value, 'qrcode2');
            updateStatus("QR code generated for answer");
        } else {
            updateStatus("No answer SDP available to generate QR code");
        }
    });
}

// Initialize QR scanner
function initQRScanner() {
    // Start scanning on button click for Peer 1
    document.getElementById('scanQRBtn1').addEventListener('click', () => {
        startQRScanner('qrScanner1', remoteSdp1);
    });
    
    // Start scanning on button click for Peer 2
    document.getElementById('scanQRBtn2').addEventListener('click', () => {
        startQRScanner('qrScanner2', remoteSdp2);
    });
}

// Start QR scanner
function startQRScanner(videoElementId, targetTextarea) {
    const videoElem = document.getElementById(videoElementId);
    
    // Request camera access
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function(stream) {
            videoElem.srcObject = stream;
            videoElem.play();
            
            // Create canvas for QR detection
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            let scanning = true;
            
            const scanQRCode = function() {
                if (!scanning) return;
                
                if (videoElem.readyState === videoElem.HAVE_ENOUGH_DATA) {
                    canvas.height = videoElem.videoHeight;
                    canvas.width = videoElem.videoWidth;
                    context.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // Use jsQR library for QR detection (this integrates with jsQR.js)
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (code) {
                        // We found a QR code
                        scanning = false;
                        
                        // Stop video stream
                        videoElem.srcObject.getTracks().forEach(track => track.stop());
                        videoElem.srcObject = null;
                        
                        // Set the scanned data to the textarea
                        targetTextarea.value = code.data;
                        updateStatus("QR code scanned successfully!");
                        
                        // Hide video element
                        videoElem.style.display = 'none';
                    }
                }
                
                // Continue scanning
                if (scanning) {
                    requestAnimationFrame(scanQRCode);
                }
            };
            
            // Start scanning
            scanQRCode();
        })
        .catch(function(error) {
            updateStatus(`Error accessing camera: ${error.message}`);
            console.error("Camera Error:", error);
        });
}

// Make sure the libraries are loaded before initializing the QR features
function checkLibrariesAndInitQR() {
    // Wait a short time to make sure libraries have been loaded
    setTimeout(() => {
        console.log("Checking for QR libraries...");
        console.log("QRCode availability:", typeof QRCode !== 'undefined');
        console.log("jsQR availability:", typeof jsQR !== 'undefined');

        // Initialize QR code functionality
        if (typeof QRCode !== 'undefined') {
            generateSDPQRCodes();
            updateStatus("QR code generation ready");
        } else {
            console.error("QRCode library not loaded, adding it dynamically");
            
            // Attempt to dynamically load the QR code library
            const qrScript = document.createElement('script');
            qrScript.src = 'https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js';
            qrScript.onload = () => {
                console.log("QRCode library loaded dynamically");
                generateSDPQRCodes();
                updateStatus("QR code generation ready (loaded dynamically)");
            };
            qrScript.onerror = () => {
                console.error("Failed to load QRCode library");
                updateStatus("QR code generation unavailable - library failed to load");
            };
            document.head.appendChild(qrScript);
        }
        
        // Initialize QR scanner
        if (typeof jsQR !== 'undefined') {
            initQRScanner();
            updateStatus("QR code scanning ready");
        } else {
            console.error("jsQR library not loaded, adding it dynamically");
            
            // Attempt to dynamically load the jsQR library
            const jsqrScript = document.createElement('script');
            jsqrScript.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            jsqrScript.onload = () => {
                console.log("jsQR library loaded dynamically");
                initQRScanner();
                updateStatus("QR code scanning ready (loaded dynamically)");
            };
            jsqrScript.onerror = () => {
                console.error("Failed to load jsQR library");
                updateStatus("QR code scanning unavailable - library failed to load");
            };
            document.head.appendChild(jsqrScript);
        }
    }, 1000);
}

// Update the load event listener to use our new initialization function
window.addEventListener('load', function() {
     
    // Check if libraries are loaded and initialize QR features
    checkLibrariesAndInitQR();
});
