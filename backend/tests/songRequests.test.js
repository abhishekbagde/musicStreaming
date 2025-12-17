import { describe, it, expect, beforeEach, vi } from 'vitest'
import { playlistHandler } from '../socket/playlistHandler.js'

const createMockSocket = () => {
  const listeners = {}
  return {
    id: 'socket-1',
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

const baseRoomManager = () => ({
  getRoom: vi.fn(),
  getUserSession: vi.fn(),
  getSongRequests: vi.fn(),
  addSongRequest: vi.fn(),
  canManageSongs: vi.fn(),
  approveSongRequest: vi.fn(),
  rejectSongRequest: vi.fn(),
  getQueue: vi.fn(),
  getPlaybackState: vi.fn(),
  getCurrentSong: vi.fn(),
})

describe('song request flows', () => {
  let socket
  let roomManager
  let io
  let roomChannel

  beforeEach(() => {
    socket = createMockSocket()
    roomManager = baseRoomManager()
    const ctx = createIo()
    io = ctx.io
    roomChannel = ctx.roomChannel
    playlistHandler(io, socket, roomManager)
  })

  const trigger = (event, payload) => socket.listeners[event](payload)

  describe('song:request', () => {
    const requestPayload = {
      roomId: 'room-1',
      song: { id: 'song-1', title: 'Track' },
    }

    it('validates user session and song', () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.getUserSession.mockReturnValue(null)

      trigger('song:request', requestPayload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Not in this room' })

      roomManager.getUserSession.mockReturnValue({ roomId: 'room-1', username: 'Guest' })
      trigger('song:request', { roomId: 'room-1', song: null })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid song request' })
    })

    it('emits requests update and system message on success', () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-1', username: 'Guest' })
      roomManager.addSongRequest.mockReturnValue({ success: true })
      roomManager.getSongRequests.mockReturnValue([{ id: 'req-1' }])

      trigger('song:request', requestPayload)
      expect(roomManager.addSongRequest).toHaveBeenCalled()
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'song:requests:update',
        expect.objectContaining({ requests: [{ id: 'req-1' }] })
      )
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'system:message',
        expect.objectContaining({ message: expect.stringContaining('requested') })
      )
    })
  })

  describe('song:request:approve', () => {
    const payload = { roomId: 'room-1', requestId: 'req-1' }

    it('requires manage permission', () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.canManageSongs.mockReturnValue(false)
      trigger('song:request:approve', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can approve requests' })
    })

    it('approves and emits updates', () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.approveSongRequest.mockReturnValue({ success: true })
      roomManager.getSongRequests.mockReturnValue([])
      roomManager.getQueue.mockReturnValue([{ id: 'song-1' }])
      roomManager.getCurrentSong.mockReturnValue(null)
      roomManager.getPlaybackState.mockReturnValue({ playing: false, playingFrom: null })

      trigger('song:request:approve', payload)
      expect(roomManager.approveSongRequest).toHaveBeenCalledWith('room-1', 'req-1')
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'song:requests:update',
        expect.objectContaining({ requests: [] })
      )
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({ queue: [{ id: 'song-1' }] })
      )
    })
  })

  describe('song:request:reject', () => {
    const payload = { roomId: 'room-1', requestId: 'req-1' }

    it('rejects without permission', () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.canManageSongs.mockReturnValue(false)
      trigger('song:request:reject', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can reject requests' })
    })

    it('emits update after rejection', () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.rejectSongRequest.mockReturnValue({ success: true })
      roomManager.getSongRequests.mockReturnValue([])

      trigger('song:request:reject', payload)
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'song:requests:update',
        expect.objectContaining({ requests: [] })
      )
    })
  })
})
