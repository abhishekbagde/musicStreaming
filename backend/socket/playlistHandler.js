export const playlistHandler = (io, socket, roomManager) => {
  // Handle adding a song to the queue
  socket.on('song:add', (data) => {
    const { roomId, song } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can add songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can add songs' })
      return
    }

    // Add song to queue
    roomManager.addSongToQueue(roomId, song)
    const queue = roomManager.getQueue(roomId)

    // Broadcast updated queue to all users in room
    const playbackState = roomManager.getPlaybackState(roomId)
    io.to(roomId).emit('playlist:update', {
      queue,
      currentSong: roomManager.getCurrentSong(roomId),
      playing: playbackState.playing,
      playingFrom: playbackState.playingFrom,
    })
  })

  // Handle removing a song from the queue
  socket.on('song:remove', (data) => {
    const { roomId, songId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can remove songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can remove songs' })
      return
    }

    roomManager.removeSongFromQueue(roomId, songId)
    const queue = roomManager.getQueue(roomId)

    // Broadcast updated queue to all users in room
    const playbackState = roomManager.getPlaybackState(roomId)
    io.to(roomId).emit('playlist:update', {
      queue,
      currentSong: roomManager.getCurrentSong(roomId),
      playing: playbackState.playing,
      playingFrom: playbackState.playingFrom,
    })
  })

  // Handle playing the next song
  socket.on('song:play', (data) => {
    const { roomId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can play songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can play songs' })
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      socket.emit('error', { message: 'Queue is empty' })
      return
    }

    const currentIndex = roomManager.getCurrentSongIndex(roomId)
    const startIndex = currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
    const { success, currentSong } = roomManager.setCurrentSongByIndex(roomId, startIndex)
    if (!success || !currentSong) {
      socket.emit('error', { message: 'Unable to start playback' })
      return
    }
    const startedAt = Date.now()
    roomManager.setPlaybackState(roomId, true, startedAt)

    console.log(`▶️ Now playing: ${currentSong.title} in room ${roomId}`)

    // Broadcast to all users in room with playing flag
    io.to(roomId).emit('playlist:update', {
      queue,
      currentSong,
      playing: true,
      playingFrom: startedAt,
    })
  })

  // Handle skipping to the next song
  socket.on('song:skip', (data) => {
    const { roomId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can skip songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can skip songs' })
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      socket.emit('error', { message: 'Queue is empty' })
      return
    }

    const result = roomManager.playNextSong(roomId)
    if (!result.success) {
      socket.emit('error', { message: result.error || 'Unable to skip song' })
      return
    }

    const updatedQueue = roomManager.getQueue(roomId)
    if (!result.song) {
      roomManager.setPlaybackState(roomId, false)
      io.to(roomId).emit('playlist:update', {
        queue: updatedQueue,
        currentSong: null,
        playing: false,
        playingFrom: null,
      })
      return
    }

    const playingFrom = Date.now()
    roomManager.setPlaybackState(roomId, true, playingFrom)

    io.to(roomId).emit('playlist:update', {
      queue: updatedQueue,
      currentSong: result.song,
      playing: true,
      playingFrom,
    })
  })

  socket.on('song:autoAdvance', (data) => {
    const { roomId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      return
    }

    if (room.hostId !== socket.id) {
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      roomManager.setPlaybackState(roomId, false)
      io.to(roomId).emit('playlist:update', {
        queue: [],
        currentSong: null,
        playing: false,
        playingFrom: null,
      })
      return
    }

    const result = roomManager.playNextSong(roomId)
    if (!result.success) {
      return
    }

    const updatedQueue = roomManager.getQueue(roomId)
    if (!result.song) {
      roomManager.setPlaybackState(roomId, false)
      io.to(roomId).emit('playlist:update', {
        queue: updatedQueue,
        currentSong: null,
        playing: false,
        playingFrom: null,
      })
      return
    }

    const playingFrom = Date.now()
    roomManager.setPlaybackState(roomId, true, playingFrom)

    io.to(roomId).emit('playlist:update', {
      queue: updatedQueue,
      currentSong: result.song,
      playing: true,
      playingFrom,
    })
  })

  // Handle pausing current song
  socket.on('song:pause', (data) => {
    const { roomId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can pause songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can pause songs' })
      return
    }

    if (!roomManager.getCurrentSong(roomId)) {
      socket.emit('error', { message: 'No song is currently playing' })
      return
    }

    const pausedMs = roomManager.pausePlayback(roomId)

    io.to(roomId).emit('playlist:update', {
      queue: roomManager.getQueue(roomId),
      currentSong: roomManager.getCurrentSong(roomId),
      playing: false,
      playingFrom: pausedMs,
    })
  })

  socket.on('song:resume', (data) => {
    const { roomId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can resume songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can resume songs' })
      return
    }

    if (!roomManager.getCurrentSong(roomId)) {
      socket.emit('error', { message: 'No song to resume' })
      return
    }

    const startedAt = roomManager.resumePlayback(roomId)
    if (!startedAt) {
      socket.emit('error', { message: 'Unable to resume playback' })
      return
    }

    io.to(roomId).emit('playlist:update', {
      queue: roomManager.getQueue(roomId),
      currentSong: roomManager.getCurrentSong(roomId),
      playing: true,
      playingFrom: startedAt,
    })
  })

  socket.on('song:previous', (data) => {
    const { roomId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can go to previous song
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can go to previous song' })
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      socket.emit('error', { message: 'Queue is empty' })
      return
    }

    const result = roomManager.playPreviousSong(roomId)
    if (!result.success || !result.song) {
      socket.emit('error', { message: result.error || 'Unable to play previous song' })
      return
    }

    const playingFrom = Date.now()
    roomManager.setPlaybackState(roomId, true, playingFrom)

    io.to(roomId).emit('playlist:update', {
      queue,
      currentSong: result.song,
      playing: true,
      playingFrom,
    })
  })

  socket.on('song:playSpecific', (data) => {
    const { roomId, songId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }

    // Only host and co-hosts can choose songs
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can choose songs' })
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      socket.emit('error', { message: 'Queue is empty' })
      return
    }

    const result = roomManager.playSongById(roomId, songId)
    if (!result.success || !result.song) {
      socket.emit('error', { message: result.error || 'Unable to play that song' })
      return
    }

    const playingFrom = Date.now()
    roomManager.setPlaybackState(roomId, true, playingFrom)

    io.to(roomId).emit('playlist:update', {
      queue,
      currentSong: result.song,
      playing: true,
      playingFrom,
    })
  })

  socket.on('song:reorder', (data) => {
    const { roomId, fromIndex, toIndex } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can reorder songs' })
      return
    }

    const result = roomManager.moveSongInQueue(roomId, fromIndex, toIndex)
    if (!result.success) {
      socket.emit('error', { message: result.error || 'Unable to reorder songs' })
      return
    }

    const playbackState = roomManager.getPlaybackState(roomId)
    io.to(roomId).emit('playlist:update', {
      queue: roomManager.getQueue(roomId),
      currentSong: roomManager.getCurrentSong(roomId),
      playing: playbackState.playing,
      playingFrom: playbackState.playingFrom,
    })
  })

  socket.on('song:request', (data) => {
    const { roomId, song } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    if (!song || !song.id) {
      socket.emit('error', { message: 'Invalid song request' })
      return
    }
    const session = roomManager.getUserSession(socket.id)
    if (!session || session.roomId !== roomId) {
      socket.emit('error', { message: 'Not in this room' })
      return
    }
    const result = roomManager.addSongRequest(roomId, song, socket.id, session.username)
    if (!result.success) {
      socket.emit('error', { message: result.error || 'Failed to request song' })
      return
    }
    io.to(roomId).emit('song:requests:update', {
      requests: roomManager.getSongRequests(roomId),
    })
  })

  socket.on('song:request:approve', (data) => {
    const { roomId, requestId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can approve requests' })
      return
    }
    const result = roomManager.approveSongRequest(roomId, requestId)
    if (!result.success) {
      socket.emit('error', { message: result.error || 'Failed to approve request' })
      return
    }
    const playbackState = roomManager.getPlaybackState(roomId)
    io.to(roomId).emit('song:requests:update', {
      requests: roomManager.getSongRequests(roomId),
    })
    io.to(roomId).emit('playlist:update', {
      queue: roomManager.getQueue(roomId),
      currentSong: roomManager.getCurrentSong(roomId),
      playing: playbackState.playing,
      playingFrom: playbackState.playingFrom,
    })
  })

  socket.on('song:request:reject', (data) => {
    const { roomId, requestId } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    if (!roomManager.canManageSongs(roomId, socket.id)) {
      socket.emit('error', { message: 'Only host and co-hosts can reject requests' })
      return
    }
    const result = roomManager.rejectSongRequest(roomId, requestId)
    if (!result.success) {
      socket.emit('error', { message: result.error || 'Failed to reject request' })
      return
    }
    io.to(roomId).emit('song:requests:update', {
      requests: roomManager.getSongRequests(roomId),
    })
  })
}
