export function roomHandler(io, socket, roomManager) {
  socket.on('room:create', (data) => {
    try {
      const { roomName, hostName } = data
      const userId = socket.id

      if (!roomName || roomName.trim().length === 0) {
        socket.emit('error', { message: 'Room name is required' })
        return
      }

      if (!hostName || hostName.trim().length === 0) {
        socket.emit('error', { message: 'Your display name is required' })
        return
      }

      const sanitizedRoomName = roomName.trim().substring(0, 80)
      const sanitizedHostName = hostName.trim().substring(0, 40)

      const room = roomManager.createRoom(sanitizedRoomName, userId, sanitizedHostName)
      socket.join(room.roomId)

      // Emit room created with full participants list including host
      const room_data = roomManager.getRoom(room.roomId)
      socket.emit('room:created', {
        roomId: room.roomId,
        roomName: room.roomName,
        hostId: room.hostId,
        hostName: room.hostName,
        createdAt: room.createdAt,
      })

      // Send participants list to the host
      socket.emit('participants:list', {
        participants: room_data.participants.map((id) => {
          const session = roomManager.getUserSession(id)
          return {
            userId: id,
            username: session?.username || (room_data.hostId === id ? room_data.hostName : 'Host'),
            isHost: room_data.hostId === id,
            role: room_data.hostId === id ? 'host' : room_data.cohosts.includes(id) ? 'cohost' : 'guest',
          }
        }),
      })

      // Send initial empty playlist state to host
      socket.emit('playlist:update', {
        queue: roomManager.getQueue(room.roomId),
        currentSong: roomManager.getCurrentSong(room.roomId),
        ...roomManager.getPlaybackState(room.roomId),
      })

      socket.emit('song:requests:update', {
        requests: roomManager.getSongRequests(room.roomId),
      })

      console.log(`Room created: ${room.roomId} by ${userId} (${room.hostName})`)
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
            role: room.hostId === id ? 'host' : room.cohosts.includes(id) ? 'cohost' : 'guest',
          }
        }),
      })

      // Notify OTHERS (excluding the new user themselves) about the new participant
      socket.broadcast.to(roomId).emit('user:joined', {
        userId,
        username: username || `Guest_${Math.random().toString(36).substr(2, 5)}`,
        isHost: false,
        role: 'guest',
        participantCount: room.participants.length,
      })

      // Emit system message to all users in room
      io.to(roomId).emit('system:message', {
        message: `👤 ${username || `Guest_${Math.random().toString(36).substr(2, 5)}`} joined the room`,
        timestamp: new Date().toISOString(),
      })

      // Send current playlist state to the new user
      socket.emit('playlist:update', {
        queue: roomManager.getQueue(roomId),
        currentSong: roomManager.getCurrentSong(roomId),
        ...roomManager.getPlaybackState(roomId),
      })

      socket.emit('song:requests:update', {
        requests: roomManager.getSongRequests(roomId),
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
      const username = session.username || 'Unknown'
      const result = roomManager.leaveRoom(socket.id)

      socket.leave(roomId)

      if (result.closed) {
        // Room closed because host left and no co-hosts
        io.to(roomId).emit('room:closed', { message: 'Host closed the room' })
      } else if (result.hostChanged) {
        // Host was promoted from co-hosts
        const newHostSession = roomManager.getUserSession(result.newHostId)
        const newHostName = newHostSession?.username || 'New Host'
        
        io.to(roomId).emit('user:left', {
          userId: socket.id,
          participantCount: roomManager.getRoom(roomId)?.participants.length || 0,
        })

        // Emit system message about user leaving
        io.to(roomId).emit('system:message', {
          message: `👋 ${username} left the room`,
          timestamp: new Date().toISOString(),
        })

        // Emit system message about host change
        io.to(roomId).emit('system:message', {
          message: `👑 ${newHostName} is now the host`,
          timestamp: new Date().toISOString(),
        })

        // Notify all users about the new host
        io.to(roomId).emit('host:changed', {
          newHostId: result.newHostId,
          newHostName,
        })
      } else {
        // Just update participant list
        const room = roomManager.getRoom(roomId)
        if (room) {
          io.to(roomId).emit('user:left', {
            userId: socket.id,
            participantCount: room.participants.length,
          })

          // Emit system message
          io.to(roomId).emit('system:message', {
            message: `👋 ${username} left the room`,
            timestamp: new Date().toISOString(),
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
            role: room.hostId === id ? 'host' : room.cohosts.includes(id) ? 'cohost' : 'guest',
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
        socket.emit('room:closed', { message: 'This room has been closed by the host' })
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
            role: room.hostId === id ? 'host' : room.cohosts.includes(id) ? 'cohost' : 'guest',
          }
        }),
      })

      // Send current playlist state
      socket.emit('playlist:update', {
        queue: roomManager.getQueue(roomId),
        currentSong: roomManager.getCurrentSong(roomId),
        ...roomManager.getPlaybackState(roomId),
      })

      socket.emit('song:requests:update', {
        requests: roomManager.getSongRequests(roomId),
      })

      console.log(`User ${socket.id} rejoined room ${roomId}`)
    } catch (error) {
      console.error('Error rejoining room:', error)
      socket.emit('error', { message: 'Failed to rejoin room' })
    }
  })

  // Promote user to co-host
  socket.on('user:promote-cohost', (data) => {
    try {
      const { roomId, userId } = data
      const requesterId = socket.id

      if (!roomId || !userId) {
        socket.emit('error', { message: 'Room ID and User ID are required' })
        return
      }

      // Check if requester is the host OR a co-host with permission
      const room = roomManager.getRoom(roomId)
      if (!room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }

      // Only the host can promote users (not co-hosts)
      if (room.hostId !== requesterId) {
        socket.emit('error', { message: 'Only the host can promote users' })
        return
      }

      // Promote the user
      const result = roomManager.promoteCohost(roomId, userId)
      if (!result.success) {
        socket.emit('error', { message: result.error })
        return
      }

      // Get promoted user's name
      const promotedUserSession = roomManager.getUserSession(userId)
      const promotedUsername = promotedUserSession?.username || 'Unknown'

      // Broadcast promotion event to all users in the room
      io.to(roomId).emit('user:promoted-cohost', {
        userId,
        promotedBy: requesterId,
      })

      // Emit system message
      io.to(roomId).emit('system:message', {
        message: `⭐ ${promotedUsername} was promoted to co-host`,
        timestamp: new Date().toISOString(),
      })

      console.log(`⭐ User ${userId} promoted to co-host in room ${roomId}`)
    } catch (error) {
      console.error('Error promoting co-host:', error)
      socket.emit('error', { message: 'Failed to promote user' })
    }
  })

  // Demote user from co-host
  socket.on('user:demote-cohost', (data) => {
    try {
      const { roomId, userId } = data
      const requesterId = socket.id

      if (!roomId || !userId) {
        socket.emit('error', { message: 'Room ID and User ID are required' })
        return
      }

      // Check if requester is the host
      const room = roomManager.getRoom(roomId)
      if (!room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }

      // Only the host can demote users
      if (room.hostId !== requesterId) {
        socket.emit('error', { message: 'Only the host can demote users' })
        return
      }

      // Demote the user
      const result = roomManager.demoteCohost(roomId, userId)
      if (!result.success) {
        socket.emit('error', { message: result.error })
        return
      }

      // Get demoted user's name
      const demotedUserSession = roomManager.getUserSession(userId)
      const demotedUsername = demotedUserSession?.username || 'Unknown'

      // Broadcast demotion event to all users in the room
      io.to(roomId).emit('user:demoted-cohost', {
        userId,
        demotedBy: requesterId,
      })

      // Emit system message
      io.to(roomId).emit('system:message', {
        message: `👤 ${demotedUsername} was demoted from co-host`,
        timestamp: new Date().toISOString(),
      })

      console.log(`👤 User ${userId} demoted from co-host in room ${roomId}`)
    } catch (error) {
      console.error('Error demoting co-host:', error)
      socket.emit('error', { message: 'Failed to demote user' })
    }
  })
}
