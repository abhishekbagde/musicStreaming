export function roomHandler(io, socket, roomManager) {
  socket.on('room:create', (data) => {
    try {
      const { roomName } = data
      const userId = socket.id

      if (!roomName || roomName.trim().length === 0) {
        socket.emit('error', { message: 'Room name is required' })
        return
      }

      const room = roomManager.createRoom(roomName, userId)
      socket.join(room.roomId)

      // Emit room created with full participants list including host
      const room_data = roomManager.getRoom(room.roomId)
      socket.emit('room:created', {
        roomId: room.roomId,
        roomName: room.roomName,
        hostId: room.hostId,
        createdAt: room.createdAt,
      })

      // Send participants list to the host
      socket.emit('participants:list', {
        participants: room_data.participants.map((id) => {
          const session = roomManager.getUserSession(id)
          return {
            userId: id,
            username: session?.username || 'Host',
            isHost: room_data.hostId === id,
          }
        }),
      })

      // Send initial empty playlist state to host
      socket.emit('playlist:update', {
        queue: roomManager.getQueue(room.roomId),
        currentSong: roomManager.getCurrentSong(room.roomId),
        ...roomManager.getPlaybackState(room.roomId),
      })

      console.log(`Room created: ${room.roomId} by ${userId}`)
    } catch (error) {
      console.error('Error creating room:', error)
      socket.emit('error', { message: 'Failed to create room' })
    }
  })

  socket.on('room:join', (data) => {
    try {
      const { roomId, username } = data
      const userId = socket.id

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' })
        return
      }

      const result = roomManager.joinRoom(roomId, userId, username || `Guest_${Math.random().toString(36).substr(2, 5)}`)

      if (!result.success) {
        socket.emit('error', { message: result.error })
        return
      }

      socket.join(roomId)
      socket.emit('room:joined', result.room)

      // Send full participants list to the new user
      const room = roomManager.getRoom(roomId)
      socket.emit('participants:list', {
        participants: room.participants.map((id) => {
          const session = roomManager.getUserSession(id)
          return {
            userId: id,
            username: session?.username || 'Unknown',
            isHost: room.hostId === id,
          }
        }),
      })

      // Notify OTHERS (excluding the new user themselves) about the new participant
      socket.broadcast.to(roomId).emit('user:joined', {
        userId,
        username: username || `Guest_${Math.random().toString(36).substr(2, 5)}`,
        isHost: false,
        participantCount: room.participants.length,
      })

      // Send current playlist state to the new user
      socket.emit('playlist:update', {
        queue: roomManager.getQueue(roomId),
        currentSong: roomManager.getCurrentSong(roomId),
        ...roomManager.getPlaybackState(roomId),
      })

      console.log(`User ${userId} joined room ${roomId}`)
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  })

  socket.on('room:leave', () => {
    try {
      const session = roomManager.getUserSession(socket.id)
      if (!session) return

      const { roomId } = session
      const result = roomManager.leaveRoom(socket.id)

      socket.leave(roomId)

      if (result.closed) {
        // Room closed because host left
        io.to(roomId).emit('room:closed', { message: 'Host closed the room' })
      } else {
        // Just update participant list
        const room = roomManager.getRoom(roomId)
        if (room) {
          io.to(roomId).emit('user:left', {
            userId: socket.id,
            participantCount: room.participants.length,
          })
        }
      }

      console.log(`User ${socket.id} left room ${roomId}`)
    } catch (error) {
      console.error('Error leaving room:', error)
      socket.emit('error', { message: 'Failed to leave room' })
    }
  })

  socket.on('participants:list', (data) => {
    try {
      const { roomId } = data
      const room = roomManager.getRoom(roomId)

      if (!room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }

      socket.emit('participants:list', {
        participants: room.participants.map((id) => {
          const session = roomManager.getUserSession(id)
          return {
            userId: id,
            username: session?.username || 'Unknown',
            isHost: room.hostId === id,
          }
        }),
      })
    } catch (error) {
      console.error('Error getting participants:', error)
      socket.emit('error', { message: 'Failed to get participants' })
    }
  })

  // Heartbeat handler - keeps connection alive while songs are playing
  socket.on('heartbeat', (data) => {
    try {
      const { roomId } = data
      if (roomId) {
        console.log(`💓 Heartbeat received from ${socket.id} in room ${roomId}`)
      }
    } catch (error) {
      console.error('Error processing heartbeat:', error)
    }
  })

  // Room rejoin handler - for reconnection after disconnect
  socket.on('room:rejoin', (data) => {
    try {
      const { roomId } = data
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' })
        return
      }

      const room = roomManager.getRoom(roomId)
      if (!room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }

      // Add user back to the room if they were previously a member
      const isAlreadyMember = room.participants.includes(socket.id)
      if (!isAlreadyMember) {
        room.participants.push(socket.id)
      }

      socket.join(roomId)
      socket.emit('room:rejoined', { roomId, success: true })

      // Send current state to reconnected user
      socket.emit('participants:list', {
        participants: room.participants.map((id) => {
          const session = roomManager.getUserSession(id)
          return {
            userId: id,
            username: session?.username || 'Unknown',
            isHost: room.hostId === id,
          }
        }),
      })

      // Send current playlist state
      socket.emit('playlist:update', {
        queue: roomManager.getQueue(roomId),
        currentSong: roomManager.getCurrentSong(roomId),
        ...roomManager.getPlaybackState(roomId),
      })

      console.log(`User ${socket.id} rejoined room ${roomId}`)
    } catch (error) {
      console.error('Error rejoining room:', error)
      socket.emit('error', { message: 'Failed to rejoin room' })
    }
  })
}
