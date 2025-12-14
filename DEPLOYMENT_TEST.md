# Deployment & Testing Guide

## Local Testing (Before Deployment)

### Prerequisites
- Backend running on `http://localhost:3001`
- Frontend running on `http://localhost:3000`

### Test Scenario 1: Host Screen (Broadcast)

1. Open `http://localhost:3000/broadcast`
2. Enter a room name (e.g., "Test Room")
3. Click "Create Room"
4. Should see:
   - Room created successfully
   - Room ID displayed
   - YouTube search bar
   - Queue section (empty initially)
   - Participants list (just you)
   - Chat area
   - Copy Browse Link button

### Test Scenario 2: Search & Add Songs

1. In the search bar, search for a song (e.g., "never gonna give you up")
2. Results should display with:
   - Thumbnail image
   - Title
   - Author
   - Duration
   - "+ Add" button
3. Click "+ Add" on a song
4. Song should appear in the Queue section below
5. Queue should show "NOW PLAYING" card with song details

### Test Scenario 3: Guest Screen (Room Viewer)

1. Open a second browser tab/window
2. Navigate to `http://localhost:3000/browse`
3. Click on the room you created (or use the copy link from host)
4. Enter a username
5. Should see:
   - Connection status (Connecting... then Connected)
   - Same queue as host
   - Same "NOW PLAYING" card
   - Same participants list
   - Chat area

### Test Scenario 4: Audio Playback Sync

**Host Side:**
1. Make sure you have at least one song in the queue
2. Click the "▶️ Play" button in the NOW PLAYING card
3. Audio should start playing
4. Should see visual feedback (audio element playing)

**Guest Side:**
1. Guest should immediately see the "NOW PLAYING" card update
2. Audio should automatically start playing in sync
3. Both should hear the same song at (approximately) the same time

### Test Scenario 5: Queue Management

**Host Side:**
1. Add multiple songs to the queue
2. Try removing a song by clicking the "✕" button
3. Try skipping to the next song with "⏭️ Skip" button
4. Try clicking "▶️ Play" to restart the current song

**Guest Side:**
1. Guest should see all queue updates in real-time
2. When host removes a song, it should disappear from guest's queue
3. When host skips, the NOW PLAYING card should update
4. Audio should stay in sync

### Test Scenario 6: Multiple Guests

1. Open a third browser tab/window
2. Navigate to `http://localhost:3000/browse`
3. Join the same room with a different username
4. Host adds/removes/skips songs
5. All guests should see the same updates simultaneously
6. All guests should hear the same audio

## Deployment Checklist

### Frontend (Vercel)
- [ ] Build passes locally (`npm run build`)
- [ ] Environment variables configured (.env.local with NEXT_PUBLIC_API_URL)
- [ ] All pages compile without errors
- [ ] No TypeScript errors
- [ ] Git changes committed and pushed

### Backend (Render)
- [ ] Node server starts without errors (`node server.js`)
- [ ] YouTube search endpoint working (`GET /api/youtube/search`)
- [ ] Audio extraction endpoint working (`GET /api/youtube/audio`)
- [ ] Socket.io connections working
- [ ] Playlist handlers functioning correctly
- [ ] No runtime errors in console

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001  # For local testing
# Or for production:
# NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Backend (.env)
```
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

## Expected Behavior After Deployment

1. **Host can search YouTube songs** ✓
2. **Host can add songs to queue** ✓
3. **Host can play/skip/remove songs** ✓
4. **Guests see real-time queue updates** ✓
5. **Guests hear audio in sync with host** ✓
6. **Multiple guests can join same room** ✓
7. **Chat works for all participants** ✓
8. **Room persistence across sessions** ✓
