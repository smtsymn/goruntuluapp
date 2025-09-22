# Görüntülü Konuşma Sitesi

Bu site, 2 kişinin WebRTC ile P2P görüntülü ve sesli konuşma yapabileceği profesyonel bir web uygulamasıdır. Socket.io ile signaling sistemi kullanır.

## Özellikler

- 🎥 **Görüntülü Konuşma**: WebRTC ile gerçek zamanlı video akışı
- 🎤 **Sesli Konuşma**: WebRTC ile gerçek zamanlı ses akışı
- 💬 **Chat**: Data Channel ile anlık mesajlaşma
- 📱 **Mobil Uyumlu**: Responsive tasarım
- 🔒 **P2P Bağlantı**: Güvenli peer-to-peer iletişim
- 🎛️ **Kontrol**: Mikrofon ve kamera açma/kapama
- 🏠 **Oda Sistemi**: Oda ID ile katılım

## Teknik Detaylar

### Kullanılan Teknolojiler
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **WebRTC**: P2P video/audio streaming
- **Data Channel**: Chat mesajlaşması

### Dosya Yapısı
```
├── index.html          # Ana HTML dosyası
├── style.css           # CSS stilleri
├── script.js           # Frontend JavaScript
├── server.js           # Backend Node.js server
├── package.json        # NPM dependencies
└── README.md           # Bu dosya
```

## Kurulum ve Çalıştırma

### Yerel Geliştirme

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Sunucuyu başlatın:**
   ```bash
   npm start
   ```

3. **Tarayıcıda açın:**
   ```
   http://localhost:3000
   ```

### Geliştirme Modu
```bash
npm run dev
```

## Render.com'a Yükleme

### 1. GitHub'a Yükleyin
- Tüm dosyaları GitHub repository'sine yükleyin

### 2. Render.com'da Web Service Oluşturun
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node.js

### 3. Deploy Edin
- Repository'nizi bağlayın
- Deploy butonuna tıklayın

## Nasıl Kullanılır

### 1. Siteyi Açın
- Render.com URL'nizi açın
- HTTPS otomatik olarak sağlanır

### 2. İzinleri Verin
- Tarayıcı kamera ve mikrofon erişimi isteyecek
- "İzin Ver" butonuna tıklayın

### 3. Konuşmaya Başlayın
- "Konuşmaya Başla" butonuna tıklayın
- Kamera ve mikrofonunuz aktif olacak

### 4. Oda Oluşturun veya Katılın
- **Oda Oluştur**: Yeni oda oluşturun, ID'yi paylaşın
- **Odaya Katıl**: Diğer kişinin oda ID'sini girin

### 5. Kontroller
- **Mikrofon**: Sağ alt köşedeki mikrofon butonu
- **Kamera**: Sağ alt köşedeki kamera butonu
- **Konuşmayı Bitir**: Ana kontrol butonu

### 6. Chat
- Alt kısımdaki mesaj kutusuna yazın
- Enter tuşuna basın veya "Gönder" butonuna tıklayın

## API Endpoints

- `GET /` - Ana sayfa
- `GET /health` - Sunucu durumu
- `GET /api/rooms` - Aktif odalar listesi

## WebSocket Events

### Client → Server
- `create-room` - Oda oluştur
- `join-room` - Odaya katıl
- `leave-room` - Odadan ayrıl
- `offer` - WebRTC offer gönder
- `answer` - WebRTC answer gönder
- `ice-candidate` - ICE candidate gönder
- `chat-message` - Chat mesajı gönder

### Server → Client
- `room-created` - Oda oluşturuldu
- `room-joined` - Odaya katıldı
- `room-full` - Oda dolu
- `room-not-found` - Oda bulunamadı
- `user-joined` - Kullanıcı katıldı
- `user-left` - Kullanıcı ayrıldı
- `offer` - WebRTC offer al
- `answer` - WebRTC answer al
- `ice-candidate` - ICE candidate al
- `chat-message` - Chat mesajı al

## Tarayıcı Desteği

- Chrome 56+
- Firefox 52+
- Safari 11+
- Edge 79+

## Önemli Notlar

- **HTTPS Gerekli**: Kamera/mikrofon erişimi için
- **İzin Gerekli**: Kullanıcılar kamera/mikrofon izni vermelidir
- **Modern Tarayıcı**: WebRTC destekleyen tarayıcı gerekli
- **Stabil İnternet**: P2P bağlantı için gerekli

## Sorun Giderme

### Kamera/Mikrofon Çalışmıyor
- Tarayıcı izinlerini kontrol edin
- HTTPS bağlantısı kullandığınızdan emin olun
- Farklı tarayıcı deneyin

### Bağlantı Kurulamıyor
- İnternet bağlantınızı kontrol edin
- Firewall ayarlarınızı kontrol edin
- Sunucu durumunu kontrol edin (`/health` endpoint)

### Chat Çalışmıyor
- WebRTC bağlantısının kurulduğundan emin olun
- Data channel durumunu kontrol edin

## Geliştirme

### Yeni Özellik Ekleme
1. Frontend: `script.js` dosyasını düzenleyin
2. Backend: `server.js` dosyasını düzenleyin
3. Stil: `style.css` dosyasını düzenleyin

### Debug
- Browser console'da hataları kontrol edin
- Server console'da log'ları takip edin
- Network tab'da WebSocket bağlantısını kontrol edin

## Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.
