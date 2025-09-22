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
        this.isFullscreen = false;
        this.currentCameraFacing = 'user'; // 'user' or 'environment'
        this.chatMessages = []; // Store chat messages per room
        
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
        this.cameraSwitchBtn = document.getElementById('cameraSwitchBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.remoteFullscreenBtn = document.getElementById('remoteFullscreenBtn');
        this.retryBtn = document.getElementById('retryBtn');
        
        // Fullscreen elements
        this.fullscreenOverlay = document.getElementById('fullscreenOverlay');
        this.fullscreenVideo = document.getElementById('fullscreenVideo');
        this.miniPreviewVideo = document.getElementById('miniPreviewVideo');
        this.exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
        
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
        this.endBtn.addEventListener('click', () => {
            if (this.roomId && this.socket) {
                this.socket.emit('end-call', { roomId: this.roomId });
            }
            this.endCall();
        });
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.videoBtn.addEventListener('click', () => this.toggleVideo());
        this.cameraSwitchBtn.addEventListener('click', () => this.switchCamera());
        // Always fullscreen remote video (own video will appear as mini preview)
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen('remote'));
        this.remoteFullscreenBtn.addEventListener('click', () => this.toggleFullscreen('remote'));
        this.exitFullscreenBtn.addEventListener('click', () => this.exitFullscreen());
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
            this.clearChatMessages();
            this.setupRoomChat();
        });
        
        this.socket.on('room-joined', (data) => {
            this.roomId = data.roomId;
            this.roomInfo.textContent = `Oda ID: ${this.roomId} - Bağlanılıyor...`;
            this.updateStatus('Odaya katıldınız. Bağlantı kuruluyor...', 'connecting');
            this.clearChatMessages();
            this.setupRoomChat();
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
            console.log('Chat mesajı alındı:', data.message);
            this.displayMessage(data.message, 'other');
        });

        // Remote requested to end the call
        this.socket.on('remote-end-call', () => {
            this.updateStatus('Karşı taraf görüşmeyi sonlandırdı', 'disconnected');
            this.endCall();
        });
    }
    
    async startCall() {
        // This function is now only for enabling media controls
        // Actual media will be started when joining a room
        this.updateStatus('Oda oluşturun veya katılın. Kamera ve mikrofon odaya katıldığınızda aktif olacak.', 'disconnected');
        
        // Enable room controls
        this.startBtn.disabled = true;
        this.endBtn.disabled = false;
        this.joinRoomBtn.disabled = false;
        this.createRoomBtn.disabled = false;
        
        this.hideRetryButton();
    }
    
    async startMedia() {
        try {
            this.updateStatus('Kamera ve mikrofon erişimi isteniyor...', 'connecting');

            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia desteklenmiyor');
            }

            // Önce izin durumlarını logla (uyumluysa)
            try {
                const camPerm = await navigator.permissions.query({ name: 'camera' });
                const micPerm = await navigator.permissions.query({ name: 'microphone' });
                console.log('Kamera izni:', camPerm.state);
                console.log('Mikrofon izni:', micPerm.state);
            } catch (_) {
                // bazı tarayıcılar permissions API desteklemez
            }

            // Android (ve genel) için: arka kamerayı deviceId ile tercih et, fallback facingMode/env, en son user
            try {
                this.localStream = await this.getPreferredMediaStreamAndroid();
            } catch (videoError) {
                console.log('Video akışı alınamadı, sadece audio deneniyor:', videoError);
                // Yalnızca ses fallback
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                this.updateStatus('Sadece sesli konuşma (kamera bulunamadı)', 'disconnected');
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
                this.cameraSwitchBtn.disabled = true;
                this.cameraSwitchBtn.style.display = 'none';
            } else {
                this.noVideoPlaceholder.style.display = 'none';
                // Check if multiple cameras are available
                this.checkCameraAvailability();
            }
            
            // Enable media controls
            this.muteBtn.disabled = !hasAudio;
            this.videoBtn.disabled = !hasVideo;
            this.fullscreenBtn.disabled = !hasVideo;
            this.remoteFullscreenBtn.disabled = false;
            
            // Enable chat controls
            this.messageInput.disabled = false;
            this.sendBtn.disabled = false;
            
            if (hasVideo && hasAudio) {
                this.updateStatus('Kamera ve mikrofon aktif!', 'connected');
            } else if (hasAudio && !hasVideo) {
                this.updateStatus('Mikrofon aktif! Sadece sesli konuşma yapabilirsiniz.', 'connected');
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

    // Arka kamerayı kesin olarak tercih etmeye çalışan, enumerateDevices + deviceId öncelikli akış sağlayıcı
    async getPreferredMediaStreamAndroid() {
        console.log('[media] geçici izin için akış alınıyor...');
        const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cams = devices.filter(d => d.kind === 'videoinput');
            console.log('[media] videoInputs:', cams.map(v => ({ label: v.label, id: v.deviceId, groupId: v.groupId })));

            const isBack = (label = '') => /back|rear|environment|arka|dış|external|bache|traseira|trasera/i.test(label);

            const currentId = temp.getVideoTracks()[0]?.getSettings?.().deviceId;
            const backCam = cams.find(c => isBack(c.label));
            const otherCam = cams.find(c => c.deviceId && c.deviceId !== currentId);

            const tries = [];
            if (backCam?.deviceId) {
                tries.push({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: { deviceId: { exact: backCam.deviceId } }
                });
            } else if (otherCam?.deviceId) {
                tries.push({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: { deviceId: { exact: otherCam.deviceId } }
                });
            }
            // facingMode environment
            tries.push({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: { facingMode: { ideal: 'environment' } }
            });
            // bazı tarayıcılar için advanced fallback
            tries.push({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: { advanced: [{ facingMode: 'environment' }] }
            });
            // son çare: user
            tries.push({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: { facingMode: { ideal: 'user' } }
            });

            // geçici akışı kapat
            temp.getTracks().forEach(t => t.stop());

            let stream = null;
            let lastErr = null;
            for (const c of tries) {
                try {
                    console.log('[media] try gUM:', c.video);
                    stream = await navigator.mediaDevices.getUserMedia(c);
                    const s = stream.getVideoTracks()[0]?.getSettings?.() || {};
                    console.log('[media] OK ->', { label: stream.getVideoTracks()[0]?.label, deviceId: s.deviceId, facingMode: s.facingMode, width: s.width, height: s.height });
                    break;
                } catch (e) {
                    console.warn('[media] FAIL:', c.video, e?.name, e?.message);
                    lastErr = e;
                }
            }

            if (!stream) throw lastErr || new Error('Kamera akışı alınamadı');
            return stream;
        } catch (e) {
            // hata halinde geçici akış yine kapansın (zaten yukarıda kapattık)
            temp.getTracks().forEach(t => t.stop());
            throw e;
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
    
    async createRoom() {
        // Start media first
        await this.startMedia();
        
        this.socket.emit('create-room');
        this.isInitiator = true;
    }
    
    async joinRoom() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            alert('Lütfen oda ID girin!');
            return;
        }
        
        // Start media first
        await this.startMedia();
        
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
            console.log('Remote track alındı:', event.track.kind, event.track.label);
            console.log('Event streams:', event.streams);
            
            if (event.streams && event.streams.length > 0) {
                this.remoteStream = event.streams[0];
                this.remoteVideo.srcObject = this.remoteStream;
                
                // Check what tracks we have
                const videoTracks = this.remoteStream.getVideoTracks();
                const audioTracks = this.remoteStream.getAudioTracks();
                
                console.log('Remote video tracks:', videoTracks.length);
                console.log('Remote audio tracks:', audioTracks.length);
                
                if (videoTracks.length > 0) {
                    console.log('Video track details:', {
                        label: videoTracks[0].label,
                        enabled: videoTracks[0].enabled,
                        readyState: videoTracks[0].readyState
                    });
                }
                
                // Force video to play
                this.remoteVideo.play().then(() => {
                    console.log('Remote video başarıyla oynatıldı');
                }).catch(e => {
                    console.error('Video play hatası:', e);
                });
                
                this.updateStatus('Bağlantı kuruldu!', 'connected');
                this.updateChatStatus('Bağlı', 'connected');
                this.isConnected = true;
            } else {
                console.error('Remote stream bulunamadı');
            }
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
            console.log('Data channel mesajı alındı:', event.data);
            this.displayMessage(event.data, 'other');
        };
        
        dataChannel.onclose = () => {
            console.log('Data channel kapandı');
            this.updateChatStatus('Bağlantı yok', 'disconnected');
        };
        
        dataChannel.onerror = (error) => {
            console.error('Data channel hatası:', error);
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
        this.cameraSwitchBtn.disabled = true;
        this.cameraSwitchBtn.style.display = 'none';
        this.fullscreenBtn.disabled = true;
        this.remoteFullscreenBtn.disabled = true;
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        this.joinRoomBtn.disabled = true;
        this.createRoomBtn.disabled = true;
        
        // Exit fullscreen if active
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
        
        // Clear chat messages
        this.clearChatMessages();
        
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
    
    async switchCamera() {
        if (!this.localStream) return;
        
        try {
            // Toggle camera facing mode
            this.currentCameraFacing = this.currentCameraFacing === 'user' ? 'environment' : 'user';
            
            console.log('Kamera değiştiriliyor:', this.currentCameraFacing);
            
            // Get new stream with different camera - try multiple approaches
            let newStream;
            let videoConstraints;
            
            // Get all available cameras first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            console.log('Mevcut kameralar:', videoDevices.length);
            
            if (videoDevices.length < 2) {
                throw new Error('Sadece bir kamera mevcut');
            }
            
            // Find current camera device
            const currentDeviceId = this.localStream.getVideoTracks()[0].getSettings().deviceId;
            console.log('Mevcut kamera ID:', currentDeviceId);
            
            // Find a different camera device
            const otherDevice = videoDevices.find(device => device.deviceId !== currentDeviceId);
            
            if (!otherDevice) {
                throw new Error('Alternatif kamera bulunamadı');
            }
            
            console.log('Alternatif kamera bulundu:', otherDevice.deviceId);
            
            // Try with deviceId first (more reliable)
            try {
                videoConstraints = {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    deviceId: { exact: otherDevice.deviceId }
                };
                
                newStream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                
                console.log('DeviceId ile başarılı');
                
            } catch (deviceIdError) {
                console.log('DeviceId ile başarısız, facingMode deneniyor:', deviceIdError);
                
                // Fallback to facingMode
                videoConstraints = {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: this.currentCameraFacing
                };
                
                newStream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                
                console.log('FacingMode ile başarılı');
            }
            
            if (!newStream) {
                throw new Error('Yeni kamera akışı oluşturulamadı');
            }
            
            // Stop old video track
            const oldVideoTrack = this.localStream.getVideoTracks()[0];
            if (oldVideoTrack) {
                oldVideoTrack.stop();
            }
            
            // Replace video track in local stream
            const newVideoTrack = newStream.getVideoTracks()[0];
            if (newVideoTrack) {
                // Remove old video track and add new one
                const oldTracks = this.localStream.getVideoTracks();
                oldTracks.forEach(track => this.localStream.removeTrack(track));
                
                this.localStream.addTrack(newVideoTrack);
                this.localVideo.srcObject = this.localStream;
                
                // Update peer connection
                if (this.peerConnection) {
                    const sender = this.peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    if (sender) {
                        await sender.replaceTrack(newVideoTrack);
                    }
                }
                
                // Update UI
                this.cameraSwitchBtn.classList.add('camera-switched');
                setTimeout(() => {
                    this.cameraSwitchBtn.classList.remove('camera-switched');
                }, 1000);
                
                console.log('Kamera başarıyla değiştirildi');
                
            } else {
                throw new Error('Yeni video track bulunamadı');
            }
            
        } catch (error) {
            console.error('Kamera değiştirme hatası:', error);
            
            // Revert camera facing mode on error
            this.currentCameraFacing = this.currentCameraFacing === 'user' ? 'environment' : 'user';
            
            let errorMessage = 'Kamera değiştirilemedi. ';
            if (error.message.includes('Sadece bir kamera mevcut')) {
                errorMessage += 'Bu cihazda sadece bir kamera mevcut.';
            } else if (error.message.includes('Alternatif kamera bulunamadı')) {
                errorMessage += 'Alternatif kamera bulunamadı.';
            } else {
                errorMessage += 'Teknik bir hata oluştu.';
            }
            
            alert(errorMessage);
        }
    }
    
    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        console.log('Mesaj gönderiliyor:', message);
        console.log('Data channel durumu:', this.dataChannel ? this.dataChannel.readyState : 'null');
        console.log('Socket durumu:', this.socket ? 'bağlı' : 'bağlı değil');
        console.log('Room ID:', this.roomId);
        
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            console.log('Data channel ile gönderiliyor');
            this.dataChannel.send(message);
            this.displayMessage(message, 'own');
            this.messageInput.value = '';
        } else if (this.socket && this.roomId) {
            console.log('Socket ile gönderiliyor');
            // Fallback to socket if data channel is not ready
            this.socket.emit('chat-message', {
                roomId: this.roomId,
                message: message
            });
            this.displayMessage(message, 'own');
            this.messageInput.value = '';
        } else {
            console.log('Bağlantı kurulmadı');
            alert('Bağlantı henüz kurulmadı!');
        }
    }
    
    toggleFullscreen(type) {
        if (this.isFullscreen) {
            this.exitFullscreen();
            return;
        }
        
        this.isFullscreen = true;
        
        if (type === 'local') {
            this.fullscreenVideo.srcObject = this.localVideo.srcObject;
            this.miniPreviewVideo.srcObject = this.remoteVideo.srcObject;
            
            // Set audio properties correctly
            this.fullscreenVideo.muted = true; // Local video should be muted
            this.miniPreviewVideo.muted = false; // Remote video should have audio
        } else {
            this.fullscreenVideo.srcObject = this.remoteVideo.srcObject;
            this.miniPreviewVideo.srcObject = this.localVideo.srcObject;
            
            // Set audio properties correctly
            this.fullscreenVideo.muted = false; // Remote video should have audio
            this.miniPreviewVideo.muted = true; // Local video should be muted
        }
        
        this.fullscreenOverlay.style.display = 'flex';
        this.fullscreenBtn.classList.add('fullscreen-active');
        this.remoteFullscreenBtn.classList.add('fullscreen-active');
        
        // Hide main video container
        document.querySelector('.video-container').style.display = 'none';
    }
    
    exitFullscreen() {
        this.isFullscreen = false;
        this.fullscreenOverlay.style.display = 'none';
        this.fullscreenBtn.classList.remove('fullscreen-active');
        this.remoteFullscreenBtn.classList.remove('fullscreen-active');
        
        // Show main video container
        document.querySelector('.video-container').style.display = 'grid';
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
    
    clearChatMessages() {
        this.chatMessages.innerHTML = '';
        this.chatMessages.classList.remove('room-specific');
    }
    
    setupRoomChat() {
        if (this.roomId) {
            this.chatMessages.classList.add('room-specific');
            this.chatMessages.setAttribute('data-room-id', this.roomId);
        }
    }
    
    async checkCameraAvailability() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            console.log('Mevcut kameralar:', videoDevices.length);
            
            if (videoDevices.length > 1) {
                this.cameraSwitchBtn.disabled = false;
                this.cameraSwitchBtn.style.display = 'inline-block';
                console.log('Kamera değiştirme butonu aktif');
            } else {
                this.cameraSwitchBtn.disabled = true;
                this.cameraSwitchBtn.style.display = 'none';
                console.log('Sadece bir kamera mevcut, değiştirme butonu gizli');
            }
        } catch (error) {
            console.error('Kamera kontrolü hatası:', error);
            this.cameraSwitchBtn.disabled = true;
            this.cameraSwitchBtn.style.display = 'none';
        }
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