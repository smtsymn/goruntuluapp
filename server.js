const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store rooms and their users
const rooms = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);

    // Create room
    socket.on('create-room', () => {
        const roomId = generateRoomId();
        rooms.set(roomId, {
            users: [socket.id],
            createdAt: new Date()
        });
        
        socket.join(roomId);
        socket.emit('room-created', { roomId });
        console.log(`Oda oluşturuldu: ${roomId}`);
    });

    // Join room
    socket.on('join-room', (data) => {
        const { roomId } = data;
        
        if (!rooms.has(roomId)) {
            socket.emit('room-not-found');
            return;
        }
        
        const room = rooms.get(roomId);
        
        if (room.users.length >= 2) {
            socket.emit('room-full');
            return;
        }
        
        room.users.push(socket.id);
        socket.join(roomId);
        socket.emit('room-joined', { roomId });
        
        // Notify other users in the room
        socket.to(roomId).emit('user-joined');
        
        console.log(`Kullanıcı odaya katıldı: ${roomId}`);
    });

    // Leave room
    socket.on('leave-room', (data) => {
        const { roomId } = data;
        
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.users = room.users.filter(userId => userId !== socket.id);
            
            if (room.users.length === 0) {
                rooms.delete(roomId);
                console.log(`Oda silindi: ${roomId}`);
            } else {
                // Notify remaining users
                socket.to(roomId).emit('user-left');
            }
        }
        
        socket.leave(roomId);
        console.log(`Kullanıcı odadan ayrıldı: ${roomId}`);
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
        const { roomId, offer } = data;
        socket.to(roomId).emit('offer', { offer });
        console.log(`Offer gönderildi: ${roomId}`);
    });

    socket.on('answer', (data) => {
        const { roomId, answer } = data;
        socket.to(roomId).emit('answer', { answer });
        console.log(`Answer gönderildi: ${roomId}`);
    });

    socket.on('ice-candidate', (data) => {
        const { roomId, candidate } = data;
        socket.to(roomId).emit('ice-candidate', { candidate });
        console.log(`ICE candidate gönderildi: ${roomId}`);
    });

    // Chat messages
    socket.on('chat-message', (data) => {
        const { roomId, message } = data;
        socket.to(roomId).emit('chat-message', { message });
        console.log(`Chat mesajı gönderildi: ${roomId}`);
    });

    // End call - either participant can end for both
    socket.on('end-call', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('remote-end-call');
        console.log(`Görüşme sonlandırıldı: ${roomId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Kullanıcı bağlantısı kesildi:', socket.id);
        
        // Remove user from all rooms
        for (const [roomId, room] of rooms.entries()) {
            if (room.users.includes(socket.id)) {
                room.users = room.users.filter(userId => userId !== socket.id);
                
                if (room.users.length === 0) {
                    rooms.delete(roomId);
                    console.log(`Oda silindi: ${roomId}`);
                } else {
                    // Notify remaining users
                    socket.to(roomId).emit('user-left');
                }
            }
        }
    });
});

// Generate random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        totalUsers: Array.from(rooms.values()).reduce((sum, room) => sum + room.users.length, 0)
    });
});

// API endpoint to get room info
app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.entries()).map(([roomId, room]) => ({
        roomId,
        userCount: room.users.length,
        createdAt: room.createdAt
    }));
    
    res.json(roomList);
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
    console.log(`http://localhost:${PORT} adresinden erişebilirsiniz`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM alındı, sunucu kapatılıyor...');
    server.close(() => {
        console.log('Sunucu kapatıldı');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT alındı, sunucu kapatılıyor...');
    server.close(() => {
        console.log('Sunucu kapatıldı');
        process.exit(0);
    });
});
