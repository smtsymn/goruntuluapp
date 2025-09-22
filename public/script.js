class VideoCallApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isInitiator = false;
        this.isConnected = false;
        this.isMuted = false;
        this.isVideoOff = false;
        
        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeSocket();
    }
    
    initializeElements() {
        // Video elements
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.noVideoPlaceholder = document.getElementById('noVideoPlaceholder');
        
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.endBtn = document.getElementById('endBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.videoBtn = document.getElementById('videoBtn');
        this.retryBtn = document.getElementById('retryBtn');
        
        // Room controls
        this.roomIdInput = document.getElementById('roomIdInput');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.roomInfo = document.getElementById('roomInfo');
        
        // Chat elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatStatus = document.getElementById('chatStatus');
        
        // Status
        this.connectionStatus = document.getElementById('connectionStatus');
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCall());
        this.endBtn.addEventListener('click', () => this.endCall());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.videoBtn.addEventListener('click', () => this.toggleVideo());
        this.retryBtn.addEventListener('click', () => this.retryPermissions());
        
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Chrome için ek izin kontrolü
        this.checkPermissions();
    }
    
    async checkPermissions() {
        try {
            // Check if permissions API is supported
            if ('permissions' in navigator) {
                const cameraPermission = await navigator.permissions.query({ name: 'camera' });
                const micPermission = await navigator.permissions.query({ name: 'microphone' });
                
                console.log('Kamera izin durumu:', cameraPermission.state);
                console.log('Mikrofon izin durumu:', micPermission.state);
                
                // Listen for permission changes
                cameraPermission.onchange = () => {
                    console.log('Kamera izni değişti:', cameraPermission.state);
                };
                
                micPermission.onchange = () => {
                    console.log('Mikrofon izni değişti:', micPermission.state);
                };
            }
        } catch (error) {
            console.log('İzin kontrolü yapılamadı:', error);
        }
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket bağlandı');
            this.updateStatus('Sunucuya bağlandı', 'connecting');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket bağlantısı kesildi');
            this.updateStatus('Sunucu bağlantısı kesildi', 'disconnected');
            this.updateChatStatus('Bağlantı yok', 'disconnected');
        });
        
        this.socket.on('room-created', (data) => {
            this.roomId = data.roomId;
            this.roomInfo.textContent = `Oda ID: ${this.roomId} - Diğer kişi bu ID ile katılsın`;
            this.updateStatus('Oda oluşturuldu. Diğer kişi katıldığında bağlantı kurulacak.', 'connecting');
        });
        
        this.socket.on('room-joined', (data) => {
            this.roomId = data.roomId;
            this.roomInfo.textContent = `Oda ID: ${this.roomId} - Bağlanılıyor...`;
            this.updateStatus('Odaya katıldınız. Bağlantı kuruluyor...', 'connecting');
        });
        
        this.socket.on('room-full', () => {
            alert('Oda dolu! Başka bir oda deneyin.');
            this.updateStatus('Oda dolu', 'disconnected');
        });
        
        this.socket.on('room-not-found', () => {
            alert('Oda bulunamadı! Geçerli bir oda ID girin.');
            this.updateStatus('Oda bulunamadı', 'disconnected');
        });
        
        this.socket.on('user-joined', () => {
            console.log('Kullanıcı odaya katıldı');
            this.updateStatus('Kullanıcı katıldı. Bağlantı kuruluyor...', 'connecting');
            if (this.isInitiator) {
                this.createOffer();
            }
        });
        
        this.socket.on('user-left', () => {
            console.log('Kullanıcı odadan ayrıldı');
            this.updateStatus('Kullanıcı ayrıldı', 'disconnected');
            this.updateChatStatus('Bağlantı yok', 'disconnected');
            this.cleanup();
        });
        
        this.socket.on('offer', async (data) => {
            console.log('Offer alındı');
            await this.handleOffer(data);
        });
        
        this.socket.on('answer', async (data) => {
            console.log('Answer alındı');
            await this.handleAnswer(data);
        });
        
        this.socket.on('ice-candidate', async (data) => {
            console.log('ICE candidate alındı');
            await this.handleIceCandidate(data);
        });
        
        this.socket.on('chat-message', (data) => {
            this.displayMessage(data.message, 'other');
        });
    }
    
    async startCall() {
        try {
            this.updateStatus('Kamera ve mikrofon erişimi isteniyor...', 'connecting');
            
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia desteklenmiyor');
            }
            
            // Check permissions first
            const permissions = await navigator.permissions.query({ name: 'camera' });
            const micPermissions = await navigator.permissions.query({ name: 'microphone' });
            
            console.log('Kamera izni:', permissions.state);
            console.log('Mikrofon izni:', micPermissions.state);
            
            // Get user media with specific constraints
            // First try with both video and audio
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (videoError) {
                console.log('Video ile başarısız, sadece audio deneniyor:', videoError);
                
                // If video fails, try only audio
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    
                    // Show message that only audio is available
                    this.updateStatus('Sadece sesli konuşma (kamera bulunamadı)', 'disconnected');
                    
                } catch (audioError) {
                    console.log('Audio da başarısız:', audioError);
                    throw audioError;
                }
            }
            
            this.localVideo.srcObject = this.localStream;
            
            // Check if video is available
            const hasVideo = this.localStream.getVideoTracks().length > 0;
            const hasAudio = this.localStream.getAudioTracks().length > 0;
            
            console.log('Video mevcut:', hasVideo);
            console.log('Audio mevcut:', hasAudio);
            
            // Hide video if not available
            if (!hasVideo) {
                this.localVideo.style.display = 'none';
                this.noVideoPlaceholder.style.display = 'flex';
                this.videoBtn.disabled = true;
                this.videoBtn.style.display = 'none';
            } else {
                this.noVideoPlaceholder.style.display = 'none';
            }
            
            // Enable controls
            this.startBtn.disabled = true;
            this.endBtn.disabled = false;
            this.muteBtn.disabled = !hasAudio;
            this.messageInput.disabled = false;
            this.sendBtn.disabled = false;
            
            if (hasVideo && hasAudio) {
                this.updateStatus('Kamera ve mikrofon hazır. Oda oluşturun veya katılın.', 'disconnected');
            } else if (hasAudio && !hasVideo) {
                this.updateStatus('Mikrofon hazır. Sadece sesli konuşma yapabilirsiniz.', 'disconnected');
            }
            
            this.hideRetryButton();
            
        } catch (error) {
            console.error('Kamera/mikrofon erişim hatası:', error);
            
            let errorMessage = 'Mikrofon erişimi gerekli. ';
            
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Lütfen tarayıcı ayarlarından mikrofon iznini verin.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'Mikrofon bulunamadı. Lütfen mikrofon bağlı olduğundan emin olun.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Mikrofon başka bir uygulama tarafından kullanılıyor.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += 'Mikrofon ayarları desteklenmiyor.';
            } else {
                errorMessage += 'Bilinmeyen hata: ' + error.message;
            }
            
            this.updateStatus('Kamera/mikrofon erişimi reddedildi', 'disconnected');
            this.showRetryButton();
            alert(errorMessage);
        }
    }
    
    showRetryButton() {
        this.retryBtn.style.display = 'inline-block';
        this.startBtn.disabled = true;
    }
    
    hideRetryButton() {
        this.retryBtn.style.display = 'none';
        this.startBtn.disabled = false;
    }
    
    async retryPermissions() {
        this.hideRetryButton();
        this.updateStatus('İzinler tekrar deneniyor...', 'connecting');
        
        // Clear any existing stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Wait a bit before retrying
        setTimeout(() => {
            this.startCall();
        }, 1000);
    }
    
    createRoom() {
        if (!this.localStream) {
            alert('Önce kamera ve mikrofonu başlatın!');
            return;
        }
        
        this.socket.emit('create-room');
        this.isInitiator = true;
    }
    
    joinRoom() {
        if (!this.localStream) {
            alert('Önce kamera ve mikrofonu başlatın!');
            return;
        }
        
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            alert('Lütfen oda ID girin!');
            return;
        }
        
        this.socket.emit('join-room', { roomId });
        this.isInitiator = false;
    }
    
    async setupPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        // Add local stream
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Remote stream alındı');
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
            this.updateStatus('Bağlantı kuruldu!', 'connected');
            this.updateChatStatus('Bağlı', 'connected');
            this.isConnected = true;
        };
        
        // Setup data channel for chat
        if (this.isInitiator) {
            this.dataChannel = this.peerConnection.createDataChannel('chat');
            this.setupDataChannel(this.dataChannel);
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel(this.dataChannel);
            };
        }
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate
                });
            }
        };
        
        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.updateStatus('Bağlantı kuruldu!', 'connected');
                this.updateChatStatus('Bağlı', 'connected');
                this.isConnected = true;
            } else if (this.peerConnection.connectionState === 'disconnected' || 
                      this.peerConnection.connectionState === 'failed') {
                this.updateStatus('Bağlantı kesildi', 'disconnected');
                this.updateChatStatus('Bağlantı yok', 'disconnected');
                this.isConnected = false;
            }
        };
    }
    
    async createOffer() {
        try {
            await this.setupPeerConnection();
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                roomId: this.roomId,
                offer: offer
            });
        } catch (error) {
            console.error('Offer oluşturma hatası:', error);
        }
    }
    
    async handleOffer(data) {
        try {
            await this.setupPeerConnection();
            await this.peerConnection.setRemoteDescription(data.offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                roomId: this.roomId,
                answer: answer
            });
        } catch (error) {
            console.error('Offer işleme hatası:', error);
        }
    }
    
    async handleAnswer(data) {
        try {
            await this.peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
            console.error('Answer işleme hatası:', error);
        }
    }
    
    async handleIceCandidate(data) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(data.candidate);
            }
        } catch (error) {
            console.error('ICE candidate işleme hatası:', error);
        }
    }
    
    setupDataChannel(dataChannel) {
        dataChannel.onopen = () => {
            console.log('Data channel açıldı');
            this.updateChatStatus('Bağlı', 'connected');
        };
        
        dataChannel.onmessage = (event) => {
            this.displayMessage(event.data, 'other');
        };
        
        dataChannel.onclose = () => {
            console.log('Data channel kapandı');
            this.updateChatStatus('Bağlantı yok', 'disconnected');
        };
    }
    
    endCall() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Leave room
        if (this.roomId) {
            this.socket.emit('leave-room', { roomId: this.roomId });
        }
        
        // Reset UI
        this.localVideo.srcObject = null;
        this.localVideo.style.display = 'block'; // Show video element again
        this.noVideoPlaceholder.style.display = 'none'; // Hide placeholder
        this.remoteVideo.srcObject = null;
        this.startBtn.disabled = false;
        this.endBtn.disabled = true;
        this.muteBtn.disabled = true;
        this.videoBtn.disabled = true;
        this.videoBtn.style.display = 'inline-block'; // Show video button again
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        
        this.updateStatus('Bağlantı kesildi', 'disconnected');
        this.updateChatStatus('Bağlantı yok', 'disconnected');
        this.isConnected = false;
        this.roomInfo.textContent = '';
        this.roomId = null;
        
        this.cleanup();
    }
    
    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.dataChannel = null;
        this.remoteStream = null;
        this.isConnected = false;
    }
    
    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                
                if (this.isMuted) {
                    this.muteBtn.classList.add('muted');
                    this.muteBtn.innerHTML = '<span class="icon">🔇</span>';
                } else {
                    this.muteBtn.classList.remove('muted');
                    this.muteBtn.innerHTML = '<span class="icon">🎤</span>';
                }
            }
        }
    }
    
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoOff = !videoTrack.enabled;
                
                if (this.isVideoOff) {
                    this.videoBtn.classList.add('video-off');
                    this.videoBtn.innerHTML = '<span class="icon">📷</span>';
                } else {
                    this.videoBtn.classList.remove('video-off');
                    this.videoBtn.innerHTML = '<span class="icon">📹</span>';
                }
            }
        }
    }
    
    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(message);
            this.displayMessage(message, 'own');
            this.messageInput.value = '';
        } else if (this.socket && this.roomId) {
            // Fallback to socket if data channel is not ready
            this.socket.emit('chat-message', {
                roomId: this.roomId,
                message: message
            });
            this.displayMessage(message, 'own');
            this.messageInput.value = '';
        } else {
            alert('Bağlantı henüz kurulmadı!');
        }
    }
    
    displayMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = message;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    updateStatus(message, status) {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = `connection-status ${status}`;
    }
    
    updateChatStatus(message, status) {
        this.chatStatus.textContent = message;
        this.chatStatus.className = `chat-status ${status}`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.videoCallApp = new VideoCallApp();
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Sayfa gizlendi');
    } else {
        console.log('Sayfa görünür');
    }
});

// Handle beforeunload to clean up
window.addEventListener('beforeunload', () => {
    if (window.videoCallApp) {
        window.videoCallApp.endCall();
    }
});