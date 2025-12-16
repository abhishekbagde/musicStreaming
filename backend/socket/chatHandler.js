import { v4 as uuidv4 } from 'uuid'

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

      const messageId = uuidv4()

      // Broadcast message to all clients in the room
      io.to(roomId).emit('chat:message', {
        messageId,
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

  socket.on('chat:reaction', (data) => {
    try {
      const { roomId, messageId, emoji, action } = data
      const session = roomManager.getUserSession(socket.id)

      if (!session || session.roomId !== roomId) {
        socket.emit('error', { message: 'Not in this room' })
        return
      }

      const cleanEmoji = typeof emoji === 'string' ? emoji.trim() : ''
      if (!cleanEmoji) {
        socket.emit('error', { message: 'Invalid emoji' })
        return
      }

      const normalizedAction = action === 'remove' ? 'remove' : 'add'

      io.to(roomId).emit('chat:reaction', {
        roomId,
        messageId,
        emoji: cleanEmoji,
        action: normalizedAction,
        userId: socket.id,
        username: session.username,
      })
    } catch (error) {
      console.error('Error processing chat reaction:', error)
      socket.emit('error', { message: 'Failed to react to message' })
    }
  })
}
