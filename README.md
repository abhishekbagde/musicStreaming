# Music Streaming Site

A real-time music streaming platform where any user can broadcast audio from their computer to multiple guests in real-time with chat functionality.

## Features

- 🎵 **Audio Capture** - Broadcast audio from any source (Spotify, Apple Music, YouTube, local player)
- 📡 **Real-time Streaming** - Multiple guests listen in sync with 5-6 second latency
- 💬 **Live Chat** - Real-time messaging between host and guests
- 👥 **Guest Management** - No login required, share room ID to invite
- 🎚️ **Adaptive Quality** - Auto-adjusts bitrate based on network conditions
- 📊 **Room Management** - Create, join, and manage broadcast rooms

## Project Structure

```
musicStreaming/
├── frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Next.js pages
│   │   ├── hooks/         # Custom React hooks
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   ├── public/            # Static assets
│   └── package.json
├── backend/           # Node.js/Express backend
│   ├── socket/            # Socket.io handlers
│   ├── routes/            # API routes
│   ├── utils/             # Utility functions
│   ├── server.js          # Express server
│   └── package.json
└── SYSTEM_DESIGN.md   # Architecture documentation
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.io
- **Real-time**: WebSocket via Socket.io
- **State Management**: Zustand
- **Deployment**: Vercel (frontend), Render/Railway (backend)

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_AUDIO_SAMPLE_RATE=44100
NEXT_PUBLIC_AUDIO_CHANNELS=2
NEXT_PUBLIC_BUFFER_SIZE_SECONDS=10
NEXT_PUBLIC_MIN_BUFFER_TO_PLAY=5
```

### Backend (.env)

```env
PORT=3001
NODE_ENV=development
SOCKET_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
AUDIO_SAMPLE_RATE=44100
AUDIO_CHANNELS=2
MAX_USERS_PER_ROOM=100
```

## How It Works

1. **Host Creates Room** → Click "Start Broadcasting"
2. **Host Grants Permission** → Browser asks for microphone access
3. **Audio Capture Starts** → Web Audio API captures system audio
4. **Share Room ID** → Send link to guests
5. **Guests Join** → Click link and audio automatically plays
6. **Real-time Streaming** → All hear the same audio (5-6 second delay)

## Architecture

### Audio Flow

```
Host Audio Source → Web Audio API Capture
         ↓
    Encode & Send to Server via WebSocket
         ↓
    Server Relays to All Guests
         ↓
Guest Receives → Circular Buffer → Playback
```

### Latency

- Host capture: 10-50ms
- Network delay: 20-500ms
- Intentional buffer: 5000ms (for stability)
- **Total: ~5-6 seconds** (like live TV broadcast)

## Deployment

### Frontend (Vercel)

```bash
vercel deploy
```

### Backend (Render/Railway)

1. Connect GitHub repository
2. Set environment variables
3. Deploy with auto-restart on crashes

## API Endpoints

### REST APIs

- `GET /health` - Server health check
- `GET /api/rooms` - List active rooms
- `GET /api/rooms/:roomId` - Get room details
- `GET /api/rooms/:roomId/stats` - Get broadcast statistics

### WebSocket Events

**Room Management:**
- `room:create` - Create new broadcast room
- `room:join` - Join existing room
- `room:leave` - Leave room

**Audio Broadcasting:**
- `broadcast:start` - Start broadcasting
- `broadcast:audio` - Send audio chunks
- `broadcast:stop` - Stop broadcasting
- `broadcast:stats` - Broadcast statistics

**Chat:**
- `chat:message` - Send chat message
- `chat:history` - Get message history

## Performance

- Single server: ~100 concurrent users
- Bandwidth per user: 128 kbps (adaptive)
- Total for 50 guests: ~6.5 Mbps server egress

## Security

- Microphone permission required
- Room ID privacy (share with intended users only)
- Input sanitization for chat
- Rate limiting on messages
- HTTPS/WSS in production

## Future Enhancements

- [ ] Password-protected rooms
- [ ] Screen sharing
- [ ] Queue/request system
- [ ] User-to-user messaging
- [ ] Noise suppression
- [ ] Persistent chat history
- [ ] Mobile app
- [ ] Analytics dashboard

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
