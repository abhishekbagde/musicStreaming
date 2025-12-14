export const playlistHandler = (io, socket, roomManager) => {
  // Handle adding a song to the queue
  socket.on('song:add', (data) => {
    const { roomId, song } = data
    const room = roomManager.getRoom(roomId)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
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

    // Only host can remove songs
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only host can remove songs' })
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

    // Only host can play songs
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only host can play songs' })
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      socket.emit('error', { message: 'Queue is empty' })
      return
    }

    // Set the first song in queue as current
    const currentSong = queue[0]
    roomManager.setCurrentSong(roomId, currentSong)
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

    // Only host can skip songs
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only host can skip songs' })
      return
    }

    const queue = roomManager.getQueue(roomId)
    if (queue.length === 0) {
      socket.emit('error', { message: 'Queue is empty' })
      return
    }

    // Remove current song and set next as current
    roomManager.removeSongFromQueue(roomId, queue[0].id)
    const updatedQueue = roomManager.getQueue(roomId)
    const nextSong = updatedQueue.length > 0 ? updatedQueue[0] : null

    roomManager.setCurrentSong(roomId, nextSong)
    let playingFrom = null
    if (nextSong) {
      playingFrom = Date.now()
      roomManager.setPlaybackState(roomId, true, playingFrom)
    } else {
      roomManager.setPlaybackState(roomId, false)
    }

    // Broadcast to all users in room
    io.to(roomId).emit('playlist:update', {
      queue: updatedQueue,
      currentSong: nextSong,
      playing: nextSong ? true : false,
      playingFrom,
    })
  })
}
