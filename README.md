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

## Live Demo

🚀 **Frontend**: https://musicstreaming-frontend.vercel.app/  
🎵 **Backend**: https://musicstreaming-backend.onrender.com/

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Local Development

**Backend Setup**

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

**Frontend Setup** (in another terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

### Production Deployment

**Frontend** (Vercel)
- Connected to GitHub: auto-deploys on push to main
- URL: https://musicstreaming-frontend.vercel.app/

**Backend** (Render)
- Connected to GitHub: auto-deploys on push to main
- URL: https://musicstreaming-backend.onrender.com/
- Connects to frontend via `NEXT_PUBLIC_SOCKET_URL` environment variable

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

## How to Use

### For Hosts (Broadcasting)

1. Go to https://musicstreaming-frontend.vercel.app/broadcast
2. Enter your name and click "Create Room"
3. Click "Copy Room ID" to share with guests
4. Click "Start Broadcast" and grant microphone/audio permission
5. System audio will start streaming to all joined guests
6. Chat with guests in real-time

### For Guests (Listening)

1. Go to https://musicstreaming-frontend.vercel.app/browse
2. Enter your name
3. Select a room from the list and click "Join"
4. Audio automatically starts playing when host broadcasts
5. Chat with the host and other guests
6. Leave when done

### Testing Locally

1. Terminal 1: Start backend (`cd backend && npm run dev`)
2. Terminal 2: Start frontend (`cd frontend && npm run dev`)
3. Open http://localhost:3000/broadcast in browser 1
4. Open http://localhost:3000/browse in browser 2
5. Create room and test streaming + chat

## How It Works

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

### Prerequisites for Deployment

1. GitHub account with repository access
2. Vercel account (for frontend)
3. Render account (for backend)

### Frontend Deployment (Vercel)

1. Push code to GitHub main branch
2. Go to https://vercel.com/dashboard
3. Import repository `abhishekbagde/musicStreaming`
4. Set **Root Directory** to `frontend`
5. Add environment variable:
   - `NEXT_PUBLIC_SOCKET_URL` = `https://musicstreaming-backend.onrender.com`
6. Deploy (auto-deploys on push)

### Backend Deployment (Render)

1. Push code to GitHub main branch
2. Go to https://render.com/dashboard
3. Create new **Web Service**
4. Connect `abhishekbagde/musicStreaming` repository
5. Configure:
   - **Name**: musicstreaming-backend
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
6. Add environment variables:
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `https://musicstreaming-frontend.vercel.app`
7. Deploy

### CI/CD

Both services auto-deploy when you push to the main branch on GitHub.

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
