# Music Streaming Site - System Design

## Project Overview
A real-time music streaming platform where:
- **Any user can be the host** - Start a room and share their audio
- Host can play music from **any source** (Spotify, Apple Music, YouTube Music, local player)
- **Audio is captured** from host's computer/browser using Web Audio API
- Multiple guests can join a room and **listen in real-time sync**
- All participants can **chat in real-time**
- No authentication required (guest-only access)
- Share room ID/link to invite guests
- Deployed on Vercel (frontend) + Backend server

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  HOST CLIENT (Vercel)                       │
├─────────────────────────────────────────────────────────────┤
│  Next.js/React Frontend                                     │
│  ├─ Audio Capture (Web Audio API)                           │
│  │  ├─ Gets audio from speaker/microphone                   │
│  │  ├─ Works with: Spotify, Apple Music, YouTube, etc.      │
│  │  └─ Uses: getUserMedia() + AudioContext                  │
│  ├─ Room Controls & Creation                                │
│  └─ WebSocket Client                                        │
└────────────┬────────────────────────────────────────────────┘
             │ WebSocket (Audio chunks + Metadata)
             │
┌────────────▼────────────────────────────────────┐           ┌─────────────────────────┐
│       BACKEND (Node.js + WebSocket)             │           │  GUEST CLIENTS (Vercel) │
├─────────────────────────────────────────────────┤           ├─────────────────────────┤
│  Express Server with Socket.io                  │◄──────────│  Next.js/React Frontend │
│  ├─ Room Management (Create, Join, List)       │ WebSocket │  ├─ Room Browser        │
│  ├─ Audio Stream Relay & Buffer                │           │  ├─ Audio Playback      │
│  ├─ Audio Broadcast to Guests                  │           │  ├─ Chat                │
│  ├─ Chat WebSocket Handler                     │           │  └─ Participant List    │
│  ├─ Sync Management (timestamp/position)       │           └─────────────────────────┘
│  └─ Latency Compensation                       │
└─────────────────────────────────────────────────┘

Note: No file storage needed - real-time audio streaming only
```

---

## 1. FRONTEND ARCHITECTURE (Next.js)

### Technology Stack
- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.io-client
- **State Management**: Zustand or Context API
- **Audio Playback**: HTML5 Audio API
- **HTTP Client**: Axios

### Key Components

```
HOST FRONTEND:
src/
├── components/
│   ├── CreateRoom.tsx           # Host creates room & starts broadcasting
│   ├── AudioCapture.tsx         # Web Audio API capture control
│   ├── BroadcastStatus.tsx      # Shows: broadcasting, connected guests, quality
│   ├── ChatBox.tsx              # Real-time chat
│   └── ParticipantsList.tsx     # Connected guest list
├── pages/
│   ├── index.tsx                # Home page
│   ├── host/index.tsx           # Host broadcasting page
│   └── api/                      # Optional API routes
├── hooks/
│   ├── useAudioCapture.ts       # Web Audio API hook
│   ├── useWebSocket.ts          # WebSocket connection
│   ├── useChat.ts               # Chat management
│   └── useRoom.ts               # Room state
├── types/
│   └── index.ts                 # TypeScript definitions
└── utils/
    ├── audioProcessor.ts        # Audio processing & encoding
    ├── socketClient.ts          # Socket.io setup
    └── constants.ts             # Config constants

GUEST FRONTEND:
src/
├── components/
│   ├── JoinRoom.tsx             # Guest joins room
│   ├── AudioPlayer.tsx          # Playback audio from host
│   ├── ChatBox.tsx              # Real-time chat
│   ├── HostInfo.tsx             # Shows host status & quality
│   └── ParticipantsList.tsx     # Connected users
├── pages/
│   ├── index.tsx                # Home/room browser
│   ├── room/[roomId].tsx        # Join room page
│   └── api/
├── hooks/
│   ├── useWebSocket.ts          # WebSocket connection
│   ├── useAudioPlayback.ts      # Audio playback hook
│   └── useChat.ts               # Chat management
├── types/
│   └── index.ts
└── utils/
    ├── audioBuffer.ts           # Circular audio buffer
    ├── socketClient.ts          # Socket.io setup
    └── latencyCompensation.ts   # Sync calculations
```

---

## 2. BACKEND ARCHITECTURE (Node.js/Express)

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Audio Streaming**: Streaming API
- **Database**: Optional (MongoDB or PostgreSQL for stats/history)

### Key Modules

```
backend/
├── server.js                     # Express server setup
├── socket/
│   ├── roomHandler.js           # Room creation/join events
│   ├── audioHandler.js          # Audio stream relay
│   ├── chatHandler.js           # Chat events
│   └── syncHandler.js           # Synchronization logic
├── routes/
│   ├── roomRoutes.js            # Room CRUD endpoints
│   └── healthRoutes.js          # Server health check
├── middleware/
│   ├── cors.js                  # CORS configuration
│   └── roomAuth.js              # Room access validation
├── utils/
│   ├── roomManager.js           # Room state management
│   ├── audioBuffer.js           # Audio buffering
│   └── validators.js            # Input validation
├── config/
│   └── socketConfig.js          # Socket.io configuration
└── .env                         # Environment variables

Note: No file storage - all audio is streamed in real-time
```

---

## 3. DATA FLOW & REAL-TIME EVENTS

### Room Creation Flow (Host)
1. **Host opens site** → Click "Start Broadcasting"
2. **Host grants microphone permission** → Browser asks for `getUserMedia()`
3. **Room created** → Server generates unique Room ID
4. **Audio capture starts** → Web Audio API captures system audio
5. **Share room ID** → Host shares link with guests (e.g., musicstreaming.app/room/abc123)

### Audio Capture & Streaming Flow (Host → Guests)

**Host Side:**
```
Spotify/Apple Music/YouTube/Local Player
    ↓
Browser's Web Audio API (AudioContext)
    ↓
Audio Data (PCM chunks, 44.1kHz, 16-bit)
    ↓
Optional: Compression/Encoding (WebM, Opus)
    ↓
WebSocket → Server
    ↓
Server buffers audio chunks
```

**Guest Side:**
```
Server (buffered audio)
    ↓
WebSocket ← Guest receives chunks
    ↓
Circular audio buffer (5-10 second buffer)
    ↓
Web Audio API (AudioContext)
    ↓
Audio playback on guest's speakers
```

### Audio Synchronization Flow
1. **Host starts audio capture**
2. **Server timestamps each audio chunk** - `{ timestamp, data, duration }`
3. **Guests receive chunks in order** - Build buffer as they arrive
4. **Playback starts after 5-second buffer** - Ensures continuous playback
5. **Monitor buffer level** - Add padding if network is slow
6. **Automatic adjustment** - Playback speed slightly adjusted if needed

### Event Definitions

**Room Events:**
```javascript
// Room Management
socket.emit('room:create', { roomName })
socket.on('room:created', { roomId, roomName, hostId })

socket.emit('room:join', { roomId })
socket.on('room:joined', { roomId, participants, hostId })

socket.emit('room:leave')
socket.on('user:joined', { userId, username, isHost })
socket.on('user:left', { userId })

socket.on('participants:list', (users) => { ... })
```

**Audio Events:**
```javascript
// Host - Audio Capture Control
socket.emit('broadcast:start', { roomId, audioBitrate, sampleRate })
socket.on('broadcast:started', { roomId })

socket.emit('broadcast:audio', { 
  roomId, 
  audioData,           // Float32Array or encoded data
  timestamp,           // Server timestamp
  duration,            // Duration of this chunk
  quality              // 'high', 'medium', 'low'
})

socket.emit('broadcast:stop', { roomId })
socket.on('broadcast:stopped')

// Guests - Audio Playback
socket.on('broadcast:audio', (data) => {
  // Add to circular buffer
  // Play if buffer >= 5 seconds
})

socket.on('broadcast:started', (metadata) => {
  // Reset buffers
  // Ready to receive audio
})

socket.on('broadcast:stopped', () => {
  // Stop playback
  // Show "Host stopped broadcasting"
})
```

**Chat Events:**
```javascript
socket.emit('chat:message', { roomId, message })
socket.on('chat:message', { userId, username, message, timestamp, isHost })
socket.on('chat:history', (messages) => { ... })
```

**Status Events:**
```javascript
// Broadcast quality & statistics
socket.on('broadcast:stats', {
  bitrate,             // Current bitrate in kbps
  latency,             // Network latency
  bufferLevel,         // Guest's buffer level (%)
  guestCount,          // Number of connected guests
  quality              // 'high', 'medium', 'low'
})
```

---

## 4. AUDIO CAPTURE & STREAMING TECHNOLOGY

### How It Works: Web Audio API

#### Step 1: Get Host Audio Permission
```javascript
// Browser asks user for permission to record audio
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: true 
})
```

#### Step 2: Create Audio Context
```javascript
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const source = audioContext.createMediaStreamSource(stream)
const processor = audioContext.createScriptProcessor(4096, 2, 2)

source.connect(processor)
processor.connect(audioContext.destination)

// Get raw PCM audio data
processor.onaudioprocess = (e) => {
  const audioData = e.inputBuffer.getChannelData(0)
  // Send to server via WebSocket
  socket.emit('broadcast:audio', { audioData })
}
```

#### Step 3: Stream to Server
```javascript
// Host → Server (real-time streaming)
// Send audio chunks (e.g., every 100ms)
const audioChunk = {
  data: Float32Array,          // Raw audio samples
  timestamp: Date.now(),       // When captured
  duration: 100,               // milliseconds
  sampleRate: 44100,
  channels: 2
}

socket.emit('broadcast:audio', audioChunk)
```

#### Step 4: Server Relays to Guests
```javascript
// Server receives from host
socket.on('broadcast:audio', (chunk) => {
  // Relay to all guests in the room
  io.to(roomId).emit('broadcast:audio', {
    ...chunk,
    serverReceivedTime: Date.now()
  })
})
```

#### Step 5: Guest Playback
```javascript
// Guest receives audio chunks
const audioBuffer = new Float32Array(44100 * 10) // 10 seconds buffer
let bufferPosition = 0

socket.on('broadcast:audio', (chunk) => {
  // Add to circular buffer
  addToBuffer(audioBuffer, chunk.data)
  
  // Start playback when buffer is 5 seconds
  if (bufferPosition > 220500) {  // 5 * 44100
    if (!isPlaying) startPlayback()
  }
})

function startPlayback() {
  const audioContext = new AudioContext()
  const source = audioContext.createBufferSource()
  
  // Create AudioBuffer from our data
  const buffer = audioContext.createBuffer(2, audioBuffer.length, 44100)
  buffer.copyToChannel(audioBuffer, 0)
  
  source.buffer = buffer
  source.connect(audioContext.destination)
  source.start(0)
}
```

### Audio Encoding Options

#### Option 1: Raw PCM (Simple, Uncompressed)
```
Bandwidth: ~1.4 Mbps (44.1kHz, 16-bit, stereo)
Pros: Simple, no latency added
Cons: High bandwidth, not practical over internet
Use: LAN only
```

#### Option 2: Opus Codec (Recommended)
```
Bandwidth: ~64-128 kbps (adaptive bitrate)
Pros: Excellent quality, low latency, standard codec
Cons: Need encoding library (e.g., libopus)
Use: Internet streaming
```

#### Option 3: WebM Container
```
Format: Audio in WebM container with Opus codec
Bandwidth: ~64-128 kbps
Pros: Native browser support, standardized
Cons: Requires encoder
Use: Most compatible option
```

#### Option 4: Adaptive Bitrate
```
Quality: Adjusts based on network conditions
High quality: 128 kbps
Medium quality: 64 kbps
Low quality: 32 kbps
```

**Recommended for MVP**: Raw PCM or Opus (depending on network)

### Latency Considerations

**Typical Latency Breakdown:**
```
Host capture        → 10-50ms
Encoding (if any)   → 10-50ms
Network delay       → 20-500ms (depends on internet)
Buffering           → 5000ms (intentional, for stability)
Playback            → 0-100ms
─────────────────────────────
Total: 5-6 seconds average
```

**Latency Optimization:**
```javascript
// Reduce buffer size when network is good
if (bufferLevel > 50%) {
  playbackBuffer = 3000  // 3 seconds instead of 5
}

// Increase buffer when network is poor
if (bufferLevel < 30%) {
  playbackBuffer = 7000  // 7 seconds for stability
}

// Monitor jitter
const latencyHistory = []
latencyHistory.push(Date.now() - chunk.timestamp)
const jitter = Math.max(...latencyHistory) - Math.min(...latencyHistory)

if (jitter > 1000) {
  // Network is unstable, reduce quality
  socket.emit('request:quality', 'low')
}
```

### Network Bandwidth Requirements

```
For 128 kbps Opus codec:
  Single host streaming: 128 kbps upload
  Single guest listening: 128 kbps download
  
  Example: 1 host + 10 guests
  - Host upload: 128 kbps
  - Server download: 128 kbps
  - Server upload to each guest: 128 kbps
  - Total server bandwidth: ~1.3 Mbps

  For 100 guests:
  - Server bandwidth: ~12.8 Mbps (manageable)
```

---

## 5. SYNCHRONIZATION MECHANISM

### Challenge: Real-time Sync with 5+ Second Latency
Since audio has 5+ seconds intentional buffer, we can't sync like traditional players. Instead:

**Approach: Client-Side Buffered Playback**
```
Host Audio → Encode → Server Buffer → Guest Client Buffer → Playback

All sync happens within the guest's circular buffer
```

### Circular Audio Buffer Implementation

**Guest Side Buffer:**
```javascript
class AudioBuffer {
  constructor(sampleRate = 44100, bufferSeconds = 10) {
    this.sampleRate = sampleRate
    this.totalSamples = sampleRate * bufferSeconds  // 441,000 samples for 10s
    this.buffer = new Float32Array(this.totalSamples)
    this.writePosition = 0
    this.readPosition = 0
    this.isPlaying = false
  }
  
  addAudioData(data) {
    // Circular write - wrap around when reaching end
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writePosition % this.totalSamples] = data[i]
      this.writePosition++
    }
  }
  
  getBufferedDuration() {
    const diff = this.writePosition - this.readPosition
    return diff / this.sampleRate  // in seconds
  }
  
  getBufferPercent() {
    return (this.getBufferedDuration() / 10) * 100
  }
}
```

### Playback Strategy

1. **Receive First Chunk** → Start adding to buffer
2. **Wait for 5-Second Buffer** → Ensures uninterrupted playback
3. **Start Playback** → Read from buffer continuously
4. **Monitor Buffer Level**:
   - If buffer > 80% → Stop reading (buffer getting too full)
   - If buffer < 30% → Playback might stutter, reduce quality
   - If buffer < 10% → Network very slow, show warning

### Handling Network Issues

```javascript
// Monitor buffer health
setInterval(() => {
  const bufferLevel = audioBuffer.getBufferPercent()
  
  if (bufferLevel < 20) {
    // Network is slow
    socket.emit('quality:request', { quality: 'low', bitrate: 32 })
    showWarning('Buffering...')
  } else if (bufferLevel > 90) {
    // Network is good
    socket.emit('quality:request', { quality: 'high', bitrate: 128 })
  } else {
    // Normal
    socket.emit('quality:request', { quality: 'medium', bitrate: 64 })
  }
}, 1000)
```

### Handling Stream Interruptions

```javascript
// Host stops broadcasting
socket.on('broadcast:stopped', () => {
  // Fade out remaining audio
  fadeOutAndStop()
  
  // Show status
  showStatus('Host stopped broadcasting')
})

// Network dropped (no data for 10 seconds)
socket.on('disconnect', () => {
  stopPlayback()
  showError('Connection lost')
  autoReconnect()
})

// Resume broadcasting (host comes back)
socket.on('broadcast:started', () => {
  // Reset buffers
  audioBuffer.clear()
  bufferStartTime = null
  
  showStatus('Host is live')
})
```

### Why Not Sync Every 5 Seconds?
- With 5+ second buffer, we can't rewind/forward
- Guests are always playing what was streamed 5 seconds ago
- Host and guest audio is **intentionally asynchronous**
- This is similar to live TV broadcast (not on-demand streaming)

---

## 6. DEPLOYMENT ARCHITECTURE

### Frontend Deployment (Vercel)
```
musicstreaming.vercel.app
├── Next.js App (client-side)
├── Environment: NEXT_PUBLIC_API_URL=https://api.example.com
└── Auto-deploys on git push
```

### Backend Deployment (Multiple Options)

**Option A: Render or Railway** (Recommended - Easiest)
- Node.js hosting platform
- Free tier available (with limits)
- Easy deployment from GitHub
- Automatic restart on crashes
- Example: `https://musicstreaming-api.onrender.com`

**Option B: Vercel Serverless Functions** (Advanced)
- Use Vercel's serverless functions for backend
- Works with WebSocket via Socket.io adapter
- Limited to Vercel's infrastructure

**Option C: Heroku** (Classic but being phased out)
- Reliable Node.js hosting
- Simple deployment process
- Paid tier required (free tier discontinued)

**Option D: AWS EC2 / DigitalOcean** (Full Control)
- Full control over environment
- Better for large scale
- More complex setup & maintenance

**Option E: Railway** (Great Alternative)
- Similar to Render
- Good free tier
- Simple GitHub integration

### Architecture Diagram
```
┌──────────────────────────────┐
│   Frontend (Vercel)          │
│  musicstreaming.vercel.app   │
└──────────┬───────────────────┘
           │ HTTPS + WebSocket
           │
┌──────────▼───────────────────┐
│   Backend (Render/Railway)   │
│  musicstreaming-api.com      │
│  - Express + Socket.io       │
│  - File uploads/streaming    │
└──────────┬───────────────────┘
           │
    ┌──────▼──────┐
    │   Storage   │
    │  - Local or │
    │    Cloud    │
    └─────────────┘
```

---

## 7. DATABASE STRUCTURE (Optional)

### In-Memory Storage (Recommended for MVP)
Store room & user data in memory with Socket.io:

```javascript
// Backend in-memory store
const rooms = {
  'room-123': {
    roomId: 'room-123',
    roomName: 'My Music Room',
    hostId: 'user-456',
    createdAt: Date.now(),
    currentTrack: 'track-789',
    isPlaying: true,
    playlist: ['track-1', 'track-2', 'track-3'],
    participants: ['user-456', 'user-789', 'user-101'],
    tracks: {
      'track-1': { id: 'track-1', name: 'Song 1', duration: 180 },
      'track-2': { id: 'track-2', name: 'Song 2', duration: 240 }
    }
  }
}
```

**Pros:**
- Simple, fast
- No external database
- Perfect for MVP/demo
- Easy to understand

**Cons:**
- Data lost on server restart
- Limited to single server
- Not scalable

### MongoDB Collections (For Persistence)

**Rooms Collection:**
```javascript
{
  _id: ObjectId,
  roomId: "room-123",
  roomName: "Abhishek's Music Room",
  hostId: "host-user-456",
  createdAt: ISODate("2025-12-14T10:00:00Z"),
  updatedAt: ISODate("2025-12-14T10:05:00Z"),
  currentTrackId: "track-789",
  isPlaying: true,
  playlist: ["track-1", "track-2", "track-3"],
  participants: ["host-456", "guest-789", "guest-101"],
  maxParticipants: 50,
  isActive: true
}
```

**Tracks Collection:**
```javascript
{
  _id: ObjectId,
  trackId: "track-123",
  roomId: "room-123",
  fileName: "song.mp3",
  displayName: "My Favorite Song",
  duration: 240,
  fileSize: 5242880,  // 5MB
  uploadedBy: "host-456",
  uploadedAt: ISODate,
  storageUrl: "s3://bucket/room-123/track-123.mp3"
}
```

**Users/Sessions Collection:**
```javascript
{
  _id: ObjectId,
  sessionId: "session-abc123",
  username: "Guest_12345",
  roomId: "room-123",
  joinedAt: ISODate,
  lastSeen: ISODate,
  isHost: false,
  socketId: "socket-xyz"
}
```

**Messages Collection (Optional):**
```javascript
{
  _id: ObjectId,
  roomId: "room-123",
  sessionId: "session-abc123",
  username: "Guest_123",
  message: "Love this song!",
  isHost: false,
  timestamp: ISODate
}
```

### Migration Path
```
Phase 1: In-memory storage (MVP)
↓
Phase 2: Add MongoDB for persistence
↓
Phase 3: Add Redis for caching
↓
Phase 4: Scale with load balancing
```

---

## 8. ENVIRONMENT VARIABLES

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://musicstreaming-api.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://musicstreaming-api.onrender.com
NEXT_PUBLIC_ENV=production

# Audio Settings
NEXT_PUBLIC_AUDIO_SAMPLE_RATE=44100
NEXT_PUBLIC_AUDIO_CHANNELS=2
NEXT_PUBLIC_BUFFER_SIZE_SECONDS=10
NEXT_PUBLIC_MIN_BUFFER_TO_PLAY=5
```

### Backend (.env)
```env
# Server
PORT=3001
NODE_ENV=production

# CORS & Security
SOCKET_ORIGIN=https://musicstreaming.vercel.app
CORS_ORIGIN=https://musicstreaming.vercel.app
ALLOWED_ORIGINS=https://musicstreaming.vercel.app,http://localhost:3000

# Audio Settings
AUDIO_SAMPLE_RATE=44100
AUDIO_CHANNELS=2
MAX_BITRATE=128                 # kbps
MIN_BITRATE=32

# Room Settings
MAX_USERS_PER_ROOM=100
ROOM_INACTIVITY_TIMEOUT=3600000 # 1 hour in ms
SYNC_INTERVAL=1000              # 1 second (for stats)

# Audio Processing
AUDIO_CHUNK_SIZE=4096           # samples per chunk
ENCODING_METHOD=opus            # raw, opus, or webm

# Optional: Cloud Storage
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your-bucket

# Optional: Analytics
SENTRY_DSN=https://your-sentry-dsn
```

---

## 9. SECURITY CONSIDERATIONS

### Privacy & Permissions
- **Microphone Permission** - Browser explicitly asks user's permission
- **No Recording** - Audio is only captured, not stored on disk
- **Real-time Only** - Guests hear live audio, not recordings
- **HTTPS Required** - Media access only works on secure connections

### Current Implementation (Guest-only)
- **No Authentication** - Anyone with room ID can join
- **Room ID Privacy** - Share room ID only with intended guests
- **Input Sanitization** - Sanitize chat messages
- **Rate Limiting** - Prevent spam & DoS attacks
- **Connection Limits** - Max 100 users per room

### Security Measures

**Audio Stream Validation:**
```javascript
// Verify audio data format before relaying
const validateAudioChunk = (chunk) => {
  if (!chunk.data || !(chunk.data instanceof Float32Array)) {
    throw new Error('Invalid audio data')
  }
  if (chunk.data.length > 44100) {  // Max 1 second
    throw new Error('Audio chunk too large')
  }
  // Check for noise (not silence/empty)
  const hasAudio = chunk.data.some(sample => Math.abs(sample) > 0.01)
  return hasAudio
}
```

**Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000                  // limit each IP to 1000 messages
})

app.use('/api/', limiter)
```

**Chat Message Validation:**
```javascript
const validateMessage = (message) => {
  if (!message || message.length > 500) throw new Error('Invalid message')
  return sanitizeHtml(message.trim().substring(0, 500))
}
```

### HTTPS & WSS Required
```javascript
// Only allow secure WebSocket connections in production
if (process.env.NODE_ENV === 'production') {
  io.engine.on('connection_error', (err) => {
    if (!req.secure) {
      throw new Error('HTTPS required for audio access')
    }
  })
}
```

### Future Security Enhancements
- Room password protection (optional)
- Ban/mute functionality
- Content moderation
- IP whitelisting
- Rate limiting per room
- Automated abuse detection

---

## 10. PERFORMANCE & SCALABILITY

### Bandwidth Analysis

**Single Broadcast (1 host + 50 guests):**
```
Host upload:     128 kbps (Opus codec)
Server download: 128 kbps
Server upload:   128 * 50 = 6,400 kbps (6.4 Mbps)

Total server bandwidth: ~6.5 Mbps
Cost: ~$0.50/hour on AWS (typical egress pricing)
```

**Scaling to 1000 Concurrent Guests:**
```
Load balancing needed (Redis adapter for Socket.io)
Multiple backend instances
Multiple server locations (CDN-like architecture)
Use of WebRTC for peer-to-peer (advanced)
```

### Optimization Tips
1. **Compression** - Use Opus codec (128 → 32 kbps at low quality)
2. **Adaptive Bitrate** - Auto-adjust based on network
3. **Connection Pooling** - Reuse WebSocket connections
4. **Message Batching** - Send multiple audio chunks at once
5. **Load Balancing** - Distribute connections across servers

### Scaling Path
```
Phase 1: Single server (up to 100 users)
         ↓
Phase 2: Load balanced with Redis (100-1000 users)
         ↓
Phase 3: Multi-region deployment (1000+ users)
         ↓
Phase 4: Edge nodes with WebRTC (10000+ users)
```

### Typical Performance Metrics
```
Audio latency: 5-6 seconds
CPU usage per guest: ~5%
Memory per guest: ~2-5 MB
Server connections limit: ~5000 per instance
```

---

## 11. TECHNOLOGY DECISION MATRIX

| Component | Technology | Reason |
|-----------|-----------|--------|
| Frontend | Next.js | Built-in API routes, SSR, fast deployment |
| Styling | Tailwind CSS | Quick UI development |
| Real-time | Socket.io | Mature, reliable, WebSocket fallback |
| Backend | Express.js | Lightweight, perfect for small projects |
| Hosting (Frontend) | Vercel | Native Next.js support, free tier |
| Hosting (Backend) | Render/Railway | Simple Node.js hosting |
| Database | MongoDB | Optional, good for analytics |
| Audio Format | MP3/FLAC | Browser support |

---

## 11. API ENDPOINTS

### Room Management

```
POST /api/rooms
- Create new broadcast room
- Body: { roomName }
- Response: { roomId, roomName, hostId, createdAt }

GET /api/rooms
- List active rooms
- Response: [{ roomId, roomName, hostId, guestCount, isLive, createdAt }]

GET /api/rooms/:roomId
- Get room details
- Response: { roomId, roomName, hostId, participants, isLive, stats }

DELETE /api/rooms/:roomId
- Close room (host only)
- Response: { success: true }

GET /api/rooms/:roomId/stats
- Get broadcast statistics
- Response: { bitrate, latency, guestCount, duration, bufferLevel }
```

### WebSocket Events

**Room Management:**
```javascript
socket.emit('room:create', { roomName })
socket.on('room:created', { roomId, roomName, hostId })

socket.emit('room:join', { roomId })
socket.on('room:joined', { roomId, participants, isLive })

socket.emit('room:leave')
socket.on('user:joined', { username, participantCount })
socket.on('user:left', { username, participantCount })

socket.on('participants:list', { participants, isHost })
```

**Audio Broadcasting (Host):**
```javascript
socket.emit('broadcast:start', { 
  roomId, 
  audioConfig: { sampleRate: 44100, channels: 2 }
})
socket.on('broadcast:started', { success: true })

socket.emit('broadcast:audio', { 
  roomId,
  data: Float32Array,      // Raw audio samples
  timestamp: number,       // Server timestamp
  duration: number,        // In milliseconds
  quality: 'high'          // 'high', 'medium', 'low'
})

socket.emit('broadcast:stop', { roomId })
socket.on('broadcast:stopped')
```

**Audio Playback (Guest):**
```javascript
socket.on('broadcast:started', { audioConfig })
  // Ready to receive audio, start buffer

socket.on('broadcast:audio', { 
  data: Float32Array,
  timestamp: number,
  duration: number
})
  // Add chunk to circular buffer

socket.on('broadcast:stopped')
  // Host stopped broadcasting

socket.on('broadcast:stats', {
  bitrate: number,
  latency: number,
  bufferLevel: number,
  guestCount: number,
  quality: string
})
```

**Chat:**
```javascript
socket.emit('chat:message', { roomId, message })
socket.on('chat:message', { 
  userId, 
  username, 
  message, 
  timestamp, 
  isHost 
})

socket.on('chat:history', { messages })
```

**Connection & Errors:**
```javascript
socket.on('connect')
socket.on('disconnect')
socket.on('error', { message })

socket.on('room:notfound')
socket.on('room:full')
socket.on('broadcast:error', { message })
```

---

## 12. IMPLEMENTATION TIMELINE

**Week 1: Project Setup & Core Backend**
- [ ] Initialize Next.js frontend + Express backend
- [ ] Setup Socket.io connections
- [ ] Implement basic room creation/joining
- [ ] Test WebSocket communication
- [ ] Setup authentication & room access control

**Week 2: Audio Capture & Streaming**
- [ ] Implement Web Audio API capture (host side)
- [ ] Build circular audio buffer (guest side)
- [ ] Implement audio chunk relay logic
- [ ] Add basic audio playback
- [ ] Test audio sync across multiple clients

**Week 3: Chat & Polish**
- [ ] Implement real-time chat with Socket.io
- [ ] Add participant list display
- [ ] Implement host indicators & UI
- [ ] Add connection status indicators
- [ ] Implement error handling & reconnection logic

**Week 4: Testing & Optimization**
- [ ] Unit & integration tests
- [ ] Load testing (multiple users)
- [ ] Audio quality optimization
- [ ] Latency benchmarking
- [ ] Performance profiling

**Week 5: Deployment**
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Render/Railway
- [ ] Setup custom domain
- [ ] Configure HTTPS/WSS
- [ ] Monitor production

**Week 6+: Enhancements**
- [ ] Add adaptive bitrate
- [ ] Implement noise suppression
- [ ] Add room password protection
- [ ] User analytics & monitoring
- [ ] Mobile optimization

---

## Quick Start Commands

```bash
# Frontend (Next.js)
npm create next-app@latest frontend -- --typescript --tailwind
cd frontend
npm install socket.io-client axios zustand

# Backend (Express)
mkdir backend && cd backend
npm init -y
npm install express socket.io cors dotenv multer uuid
npm install -D nodemon typescript @types/express

# Start Development

# Terminal 1: Backend
cd backend
npm run dev                # Ensure script is: "dev": "nodemon server.js"

# Terminal 2: Frontend
cd frontend
npm run dev

# Visit: http://localhost:3000
# Backend: http://localhost:3001
```

### Backend Setup (server.js)
```javascript
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: process.env.SOCKET_ORIGIN }
})

app.use(express.json())
app.use(cors())

// Middleware & routes here
// Socket.io handlers here

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

### Frontend Setup (socket connection)
```typescript
// utils/socketClient.ts
import io from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL

export const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
})
```

---

## File Structure Summary

```
musicStreaming/
├── SYSTEM_DESIGN.md              # This file
├── frontend/                      # Next.js app
│   ├── package.json
│   ├── next.config.js
│   ├── .env.local
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── types/
│   │   └── utils/
│   └── public/
├── backend/                       # Express server
│   ├── package.json
│   ├── .env
│   ├── server.js
│   ├── socket/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   └── config/
└── docker-compose.yml            # Optional: Local development
```

## KEY FEATURES SUMMARY

### ✅ MVP Features
- **Flexible Host Model** - Any user can start a room and broadcast
- **Audio Capture** - Host can play from any source (Spotify, Apple Music, YouTube, local player)
- **Real-time Streaming** - Guests hear audio with 5-6 second latency (like live TV)
- **Guest Access** - No login required, share room ID to invite
- **Chat** - Real-time messaging with host indicator
- **Participant List** - See who's connected with host badge
- **Adaptive Quality** - Auto-adjusts bitrate based on network
- **Buffer Management** - Automatic buffering for smooth playback

### 🎯 Key Advantages
- **No File Upload** - Just capture & stream, much simpler
- **Works with Any Music Source** - Spotify, Apple Music, YouTube, local files
- **Browser-based** - No app installation required
- **Low Friction** - Share link, guests click, listen immediately
- **Live Experience** - Closer to broadcast experience than file streaming

### 🚀 Future Enhancements
- Password-protected rooms
- Screen sharing (show what you're playing)
- Queue/request system
- User-to-user messaging
- Room themes & customization
- Mobile app version
- Noise suppression
- Spatial audio
- Multi-host support

---

## Technology Decision Summary

| Component | Technology | Reasoning |
|-----------|-----------|-----------|
| **Audio Capture** | Web Audio API | Built-in browser support, no install needed |
| **Frontend** | Next.js | Fast, great for real-time apps |
| **Real-time** | Socket.io | Mature, reliable, auto-fallback |
| **Backend** | Express.js | Lightweight, perfect for WebSocket relay |
| **Hosting (Frontend)** | Vercel | Native Next.js support, free tier |
| **Hosting (Backend)** | Render/Railway | Simple Node.js hosting, easy deployment |
| **Audio Format** | Opus/WebM | Best quality-to-bandwidth ratio |
| **Buffering** | Circular Buffer | Handles latency gracefully |

---

## Deployment Checklist

- [ ] Create Next.js frontend project
- [ ] Create Express backend project
- [ ] Setup Socket.io with proper CORS
- [ ] Implement room management (create, join, leave)
- [ ] Implement Web Audio API capture (host)
- [ ] Implement circular audio buffer (guest)
- [ ] Implement real-time audio relay
- [ ] Implement chat system
- [ ] Add error handling & logging
- [ ] Add connection status UI
- [ ] Setup environment variables
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Render/Railway
- [ ] Configure HTTPS/WSS
- [ ] Test with multiple users
- [ ] Performance & load testing
- [ ] Security audit
- [ ] Setup monitoring & analytics

---

**Next Steps:**
1. ✅ Review & approve updated system design
2. Setup project folder structure
3. Create frontend boilerplate
4. Create backend boilerplate
5. Implement core features incrementally

Ready to code! 🎵
