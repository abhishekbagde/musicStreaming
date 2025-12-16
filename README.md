# Music Streaming

A real-time, browser-based listening party platform where a host can broadcast a shared YouTube-powered playlist to any number of guests. The app keeps everybody in sync, supports live chat, and now lets hosts promote trusted listeners to **co-hosts** who can help run the queue.

## Highlights

- 🎧 **Shared playback queue** – Search YouTube, queue tracks, and keep everyone synced with automatic next/previous handling.
- 🧑‍🤝‍🧑 **Role-aware controls** – Hosts can promote or demote co-hosts, and co-hosts get the same queue/playback powers without owning the room.
- 💬 **Live chat** – Lightweight room chat keeps hosts and guests connected.
- 📊 **Room controls & telemetry** – Hosts see participant counts plus playback state, with safety checks so only authorized users can change the playlist.
- 🌐 **Zero-install listening** – Guests just open a link, pick a nickname, and the player buffers enough audio (~5–6 seconds) for stable playback.

## Repository Layout

```
musicStreaming/
├── backend/                 # Express + Socket.io server
│   ├── socket/              # Socket event handlers (rooms, playlist, chat, co-hosting)
│   ├── routes/              # REST endpoints (e.g. YouTube search proxy)
│   ├── utils/               # Room manager, playback state, helpers
│   └── server.js            # Entry point
├── frontend/                # Next.js 14 application
│   ├── src/pages/           # Broadcast, browse, and guest room pages
│   ├── src/utils/           # Socket client, API client, YouTube loader
│   └── tailwind.config.ts   # Styling
├── node_modules/            # Root dependencies (YouTube helpers)
├── package.json             # Root-level shared deps
├── README.md                # You are here
└── SYSTEM_DESIGN.md         # Architecture deep dive
```

## Getting Started

### Prerequisites

- Node.js **18+**
- npm (ships with Node) or yarn/pnpm if you prefer
- Two terminals/browsers to simulate host + guest while testing locally

### 1. Install Dependencies

```bash
git clone https://github.com/abhishekbagde/musicStreaming.git
cd musicStreaming

# Backend deps
cd backend && npm install && cd ..

# Frontend deps
cd frontend && npm install && cd ..
```

### 2. Configure Environment Variables

Create the following files if they do not exist.

**`frontend/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_AUDIO_SAMPLE_RATE=44100
NEXT_PUBLIC_AUDIO_CHANNELS=2
NEXT_PUBLIC_BUFFER_SIZE_SECONDS=10
NEXT_PUBLIC_MIN_BUFFER_TO_PLAY=5
```

**`backend/.env`**

```env
PORT=3001
NODE_ENV=development
SOCKET_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
AUDIO_SAMPLE_RATE=44100
AUDIO_CHANNELS=2
MAX_USERS_PER_ROOM=100
```

These defaults wire the frontend (Next.js) to the backend (Express/Socket.io) on localhost.

### 3. Run Locally

```bash
# Terminal 1 – backend
cd backend
npm run dev   # http://localhost:3001

# Terminal 2 – frontend
cd frontend
npm run dev   # http://localhost:3000
```

Open two tabs:
1. `http://localhost:3000/broadcast` (host dashboard)
2. `http://localhost:3000/browse` or a direct room URL (guest/co-host view)

## Using the App

### Host Workflow

1. **Create a room** on `/broadcast`.
2. **Search YouTube** from the built-in search box and add tracks to the queue.
3. **Manage playback** – play, pause, skip, go previous, or play a specific song.
4. **Promote co-hosts** – from the participant list, click ⭐ to give a guest queue permissions.
5. **Demote when needed** – one click removes co-host rights without kicking the user.

### Co-Host Workflow

1. Join the room from `/browse` or a shared room URL.
2. After the host promotes you, the guest player unlocks:
   - YouTube search & add to queue
   - Play/pause/skip/previous controls
   - Remove songs or jump to a specific track
3. Co-host permissions persist until the host demotes you or you leave the room.

### Guest Workflow

1. Join via `/browse`, pick a nickname, and select a live room.
2. Audio auto-starts once the host plays a track (buffered ~5 seconds for stability).
3. Use chat to talk with the host or request songs.

## Live Deployments

- **Frontend** – https://music-streaming-dun.vercel.app/
- **Backend** – https://musicstreaming-backend.onrender.com/

> Tip: The production frontend already points at the hosted backend via `NEXT_PUBLIC_SOCKET_URL`.

## Architecture Overview

- **Transport**: Socket.io keeps rooms synchronized (playlist updates, chat, co-host events).
- **Room state**: `backend/utils/roomManager.js` stores queues, playback indexes, host/co-host ids, and permission checks (`canManageSongs`).
- **Playback**: Hosts initiate playback; guests receive `playlist:update` events with `playingFrom` timestamps so everyone aligns to the same offset.
- **YouTube search**: Frontend uses `apiClient.search` which proxies to the backend’s YouTube search route to avoid CORS and API key exposure.
- **Roles & permissions**: Every socket event that mutates the queue calls `roomManager.canManageSongs(roomId, socketId)` ensuring only hosts/co-hosts succeed.

## Deployment Notes

### Frontend (Vercel)

1. Set the project root to `frontend`.
2. Provide the production `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL`.
3. Push to `main`; Vercel auto-builds and deploys.

### Backend (Render/Railway/Server)

1. Create a Node service pointing to this repo.
2. Build command: `cd backend && npm install`
3. Start command: `cd backend && npm start`
4. Mirror the `.env` variables with production values and ensure CORS origins match the deployed frontend.

## Troubleshooting

- **Guests stuck as listeners** – Confirm the host promoted them (⭐). Co-hosts now see full controls in the guest UI.
- **Playlist actions rejected** – Backend logs “Only host and co-hosts can …”. Make sure the emitting socket id matches a host/co-host in `roomManager`.
- **Audio not starting on mobile** – Mobile browsers require a tap; both broadcast and room pages include an “Enable Audio” banner to unlock playback.
- **Latency seems high** – Check `NEXT_PUBLIC_BUFFER_SIZE_SECONDS`. Lowering reduces delay at the cost of resilience.

---

Maintained by [@abhishekbagde](https://github.com/abhishekbagde) and contributors. PRs and issues welcome! 🎶
