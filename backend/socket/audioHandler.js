export function audioHandler(io, socket, roomManager) {
  socket.on('broadcast:start', (data) => {
    try {
      const { roomId } = data
      const session = roomManager.getUserSession(socket.id)

      if (!session || !roomManager.isHostOfRoom(socket.id, roomId)) {
        socket.emit('error', { message: 'Only host can start broadcast' })
        return
      }

      roomManager.setRoomLive(roomId, true)
      io.to(roomId).emit('broadcast:started', {
        audioConfig: {
          sampleRate: 44100,
          channels: 2,
        },
      })

      socket.emit('broadcast:started', { success: true })
      console.log(`Broadcast started in room ${roomId}`)
    } catch (error) {
      console.error('Error starting broadcast:', error)
      socket.emit('error', { message: 'Failed to start broadcast' })
    }
  })

  socket.on('broadcast:audio', (data) => {
    try {
      const session = roomManager.getUserSession(socket.id)
      if (!session) return

      const { roomId } = session

      if (!roomManager.isHostOfRoom(socket.id, roomId)) {
        socket.emit('error', { message: 'Only host can broadcast audio' })
        return
      }

      // Relay audio to all guests in the room (except host)
      socket.to(roomId).emit('broadcast:audio', {
        data: data.data, // Float32Array audio data
        timestamp: data.timestamp,
        duration: data.duration,
        quality: data.quality || 'medium',
      })
    } catch (error) {
      console.error('Error broadcasting audio:', error)
    }
  })

  socket.on('broadcast:stop', (data) => {
    try {
      const { roomId } = data
      const session = roomManager.getUserSession(socket.id)

      if (!session || !roomManager.isHostOfRoom(socket.id, roomId)) {
        socket.emit('error', { message: 'Only host can stop broadcast' })
        return
      }

      roomManager.setRoomLive(roomId, false)
      io.to(roomId).emit('broadcast:stopped', {
        message: 'Host stopped broadcasting',
      })

      socket.emit('broadcast:stopped', { success: true })
      console.log(`Broadcast stopped in room ${roomId}`)
    } catch (error) {
      console.error('Error stopping broadcast:', error)
      socket.emit('error', { message: 'Failed to stop broadcast' })
    }
  })

  socket.on('broadcast:stats', (data) => {
    try {
      const { roomId, bitrate, latency, bufferLevel, quality } = data
      const session = roomManager.getUserSession(socket.id)

      if (!session) return

      // Update room stats (can be sent by host or any client)
      roomManager.updateRoomStats(roomId, {
        bitrate,
        latency,
        bufferLevel,
        quality,
      })

      // Broadcast stats to all clients in the room
      io.to(roomId).emit('broadcast:stats', {
        bitrate,
        latency,
        bufferLevel,
        quality,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('Error updating broadcast stats:', error)
    }
  })
}
