export function chatHandler(io, socket, roomManager) {
  socket.on('chat:message', (data) => {
    try {
      const { roomId, message } = data
      const session = roomManager.getUserSession(socket.id)

      if (!session || session.roomId !== roomId) {
        socket.emit('error', { message: 'Not in this room' })
        return
      }

      // Validate message
      if (!message || message.trim().length === 0 || message.length > 500) {
        socket.emit('error', { message: 'Invalid message' })
        return
      }

      const cleanMessage = message.trim().substring(0, 500)

      // Broadcast message to all clients in the room
      io.to(roomId).emit('chat:message', {
        userId: socket.id,
        username: session.username,
        message: cleanMessage,
        timestamp: new Date().toISOString(),
        isHost: session.isHost,
      })

      console.log(
        `Chat message in ${roomId} from ${session.username}: ${cleanMessage} [isHost: ${session.isHost}]`
      )
    } catch (error) {
      console.error('Error sending chat message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  socket.on('chat:history', (data) => {
    try {
      const { roomId } = data
      const session = roomManager.getUserSession(socket.id)

      if (!session || session.roomId !== roomId) {
        socket.emit('error', { message: 'Not in this room' })
        return
      }

      // For now, return empty history (could be persisted in DB later)
      socket.emit('chat:history', { messages: [] })
    } catch (error) {
      console.error('Error getting chat history:', error)
      socket.emit('error', { message: 'Failed to get chat history' })
    }
  })
}
