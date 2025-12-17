import { describe, it, expect, beforeEach, vi } from 'vitest'
import { chatHandler } from '../socket/chatHandler.js'

const createMockSocket = () => {
  const listeners = {}
  return {
    listeners,
    on: vi.fn((event, handler) => {
      listeners[event] = handler
    }),
    emit: vi.fn(),
  }
}

const createIo = () => {
  const roomChannel = {
    emit: vi.fn(),
  }
  return {
    io: {
      to: vi.fn(() => roomChannel),
    },
    roomChannel,
  }
}

describe('chatHandler', () => {
  let socket
  let roomManager
  let io
  let roomChannel

  beforeEach(() => {
    socket = createMockSocket()
    roomManager = {
      getUserSession: vi.fn(),
    }
    const ctx = createIo()
    io = ctx.io
    roomChannel = ctx.roomChannel
    chatHandler(io, socket, roomManager)
  })

  const trigger = (event, payload) => socket.listeners[event](payload)

  describe('chat:message', () => {
    const payload = { roomId: 'room-1', message: '  hello world  ' }

    it('rejects messages when user not in room', () => {
      roomManager.getUserSession.mockReturnValue(null)
      trigger('chat:message', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Not in this room' })
      expect(roomChannel.emit).not.toHaveBeenCalled()
    })

    it('rejects invalid message content', () => {
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-1', username: 'Tester' })
      trigger('chat:message', { roomId: 'room-1', message: '   ' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid message' })
    })

    it('broadcasts sanitized message when valid', () => {
      roomManager.getUserSession.mockReturnValue({
        roomId: 'room-1',
        username: 'Tester',
        isHost: false,
      })
      trigger('chat:message', payload)
      expect(io.to).toHaveBeenCalledWith('room-1')
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'chat:message',
        expect.objectContaining({
          username: 'Tester',
          message: 'hello world',
        })
      )
    })
  })

  describe('chat:history', () => {
    it('rejects when not in room', () => {
      roomManager.getUserSession.mockReturnValue(null)
      trigger('chat:history', { roomId: 'room-2' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Not in this room' })
    })

    it('returns empty history for valid request', () => {
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-2' })
      trigger('chat:history', { roomId: 'room-2' })
      expect(socket.emit).toHaveBeenCalledWith('chat:history', { messages: [] })
    })
  })

  describe('chat:reaction', () => {
    const reactionPayload = { roomId: 'room-3', messageId: 'msg', emoji: '😀', action: 'add' }

    it('rejects reaction from other rooms', () => {
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-2' })
      trigger('chat:reaction', reactionPayload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Not in this room' })
    })

    it('rejects invalid emoji', () => {
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-3' })
      trigger('chat:reaction', { ...reactionPayload, emoji: '  ' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid emoji' })
    })

    it('broadcasts valid reaction', () => {
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-3', username: 'DJ' })
      trigger('chat:reaction', reactionPayload)
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'chat:reaction',
        expect.objectContaining({ emoji: '😀', username: 'DJ', action: 'add' })
      )
    })
  })
})
