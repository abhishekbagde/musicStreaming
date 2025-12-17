import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playlistHandler } from '../socket/playlistHandler.js'

const createMockSocket = () => {
  const listeners = {}
  return {
    listeners,
    on: vi.fn((event, handler) => {
      listeners[event] = handler
    }),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
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
  canManageSongs: vi.fn(),
  getUserSession: vi.fn(),
  addSongToQueue: vi.fn(),
  getQueue: vi.fn(),
  getPlaybackState: vi.fn(),
  getCurrentSong: vi.fn(),
  removeSongFromQueue: vi.fn(),
  setPlaybackState: vi.fn(),
  moveSongInQueue: vi.fn(),
  getCurrentSongIndex: vi.fn(),
  setCurrentSongByIndex: vi.fn(),
  playNextSong: vi.fn(),
  playPreviousSong: vi.fn(),
  pausePlayback: vi.fn(),
  resumePlayback: vi.fn(),
})

describe('playlistHandler socket events', () => {
  let socket
  let roomManager
  let io
  let roomChannel

  beforeEach(() => {
    socket = createMockSocket()
    roomManager = baseRoomManager()
    const ioCtx = createIo()
    io = ioCtx.io
    roomChannel = ioCtx.roomChannel
    playlistHandler(io, socket, roomManager)
  })

  const emitEvent = async (event, payload) => {
    await socket.listeners[event](payload)
  }

  describe('song:add', () => {
    const basePayload = { roomId: 'room-1', song: { id: 'song-1', title: 'Track' } }

    it('emits error when room missing', async () => {
      roomManager.getRoom.mockReturnValue(null)
      await emitEvent('song:add', basePayload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Room not found' })
      expect(roomManager.addSongToQueue).not.toHaveBeenCalled()
    })

    it('emits error when user cannot manage songs', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1' })
      roomManager.canManageSongs.mockReturnValue(false)
      await emitEvent('song:add', basePayload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can add songs' })
      expect(roomManager.addSongToQueue).not.toHaveBeenCalled()
    })

    it('broadcasts playlist update when song added', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-1', hostName: 'Host' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getUserSession.mockReturnValue({ username: 'Tester' })
      roomManager.addSongToQueue.mockReturnValue({ success: true })
      roomManager.getQueue.mockReturnValue([basePayload.song])
      roomManager.getPlaybackState.mockReturnValue({ playing: false, playingFrom: null })
      roomManager.getCurrentSong.mockReturnValue(null)

      await emitEvent('song:add', basePayload)

      expect(roomManager.addSongToQueue).toHaveBeenCalledWith('room-1', basePayload.song)
      expect(io.to).toHaveBeenCalledWith('room-1')
      const calls = roomChannel.emit.mock.calls
      expect(calls[0][0]).toBe('playlist:update')
      expect(calls[1][0]).toBe('system:message')
      expect(calls[1][1].message).toContain('Tester')
    })
  })

  describe('song:remove', () => {
    const removePayload = { roomId: 'room-2', songId: 'gone' }

    it('requires permission to remove songs', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-2' })
      roomManager.canManageSongs.mockReturnValue(false)

      await emitEvent('song:remove', removePayload)

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can remove songs' })
      expect(roomManager.removeSongFromQueue).not.toHaveBeenCalled()
    })

    it('removes song and emits update', async () => {
      const song = { id: 'gone', title: 'Removed' }
      roomManager.getRoom.mockReturnValue({ roomId: 'room-2', hostName: 'Host' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getUserSession.mockReturnValue({ username: 'DJ' })
      roomManager.getQueue.mockReturnValueOnce([song]).mockReturnValueOnce([])
      roomManager.removeSongFromQueue.mockReturnValue({ success: true })
      roomManager.getPlaybackState.mockReturnValue({ playing: true, playingFrom: Date.now() })
      roomManager.getCurrentSong.mockReturnValue(null)

      await emitEvent('song:remove', removePayload)

      expect(roomManager.removeSongFromQueue).toHaveBeenCalledWith('room-2', 'gone')
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'system:message',
        expect.objectContaining({ message: expect.stringContaining('Removed') })
      )
    })
  })

  describe('song:reorder', () => {
    const reorderPayload = { roomId: 'room-3', fromIndex: 0, toIndex: 1 }

    it('requires permission to reorder songs', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-3' })
      roomManager.canManageSongs.mockReturnValue(false)

      await emitEvent('song:reorder', reorderPayload)

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can reorder songs' })
      expect(roomManager.moveSongInQueue).not.toHaveBeenCalled()
    })

    it('returns error when moveSongInQueue fails', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-3' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.moveSongInQueue.mockReturnValue({ success: false, error: 'Invalid indices' })

      await emitEvent('song:reorder', reorderPayload)

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid indices' })
    })

    it('broadcasts updated playlist on success', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-3' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.moveSongInQueue.mockReturnValue({ success: true })
      roomManager.getQueue.mockReturnValue([{ id: 'song-a' }, { id: 'song-b' }])
      roomManager.getCurrentSong.mockReturnValue({ id: 'song-a' })
      roomManager.getPlaybackState.mockReturnValue({ playing: true, playingFrom: 123 })

      await emitEvent('song:reorder', reorderPayload)

      expect(roomManager.moveSongInQueue).toHaveBeenCalledWith('room-3', 0, 1)
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({
          queue: expect.any(Array),
          currentSong: { id: 'song-a' },
        })
      )
    })
  })

  describe('song:play', () => {
    const payload = { roomId: 'room-4' }

    it('requires room and permission', async () => {
      roomManager.getRoom.mockReturnValue(null)
      await emitEvent('song:play', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Room not found' })

      roomManager.getRoom.mockReturnValue({ roomId: 'room-4' })
      roomManager.canManageSongs.mockReturnValue(false)
      await emitEvent('song:play', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can play songs' })
    })

    it('emits error when queue empty', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-4' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getQueue.mockReturnValue([])
      await emitEvent('song:play', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Queue is empty' })
    })

    it('starts playback and emits playlist update', async () => {
      const song = { id: 'song-1', title: 'Track' }
      roomManager.getRoom.mockReturnValue({ roomId: 'room-4' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getQueue.mockReturnValue([song])
      roomManager.getCurrentSongIndex.mockReturnValue(-1)
      roomManager.setCurrentSongByIndex.mockReturnValue({ success: true, currentSong: song })

      await emitEvent('song:play', payload)

      expect(roomManager.setPlaybackState).toHaveBeenCalledWith('room-4', true, expect.any(Number))
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({ playing: true, currentSong: song })
      )
    })
  })

  describe('song:skip', () => {
    const payload = { roomId: 'room-5' }

    it('emits error when playNextSong fails', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-5', hostName: 'Host' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getQueue.mockReturnValue([{ id: 'a' }])
      roomManager.getUserSession.mockReturnValue({ username: 'DJ' })
      roomManager.playNextSong.mockReturnValue({ success: false, error: 'Unable' })

      await emitEvent('song:skip', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unable' })
    })

    it('handles end-of-queue skip', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-5', hostName: 'Host' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getQueue.mockReturnValueOnce([{ id: 'a' }]).mockReturnValueOnce([])
      roomManager.getUserSession.mockReturnValue({ username: 'DJ' })
      roomManager.playNextSong.mockReturnValue({ success: true, song: null })
      roomManager.getPlaybackState.mockReturnValue({ playing: false, playingFrom: null })
      roomManager.getCurrentSong.mockReturnValue(null)

      await emitEvent('song:skip', payload)
      expect(roomManager.setPlaybackState).toHaveBeenCalledWith('room-5', false)
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'system:message',
        expect.objectContaining({ message: expect.stringContaining('skipped') })
      )
    })
  })

  describe('song:pause / song:resume', () => {
    it('requires permission and current song for pause', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-6' })
      roomManager.canManageSongs.mockReturnValue(false)
      await emitEvent('song:pause', { roomId: 'room-6' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only host and co-hosts can pause songs' })

      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getCurrentSong.mockReturnValue(null)
      await emitEvent('song:pause', { roomId: 'room-6' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'No song is currently playing' })
    })

    it('pauses and resumes playback', async () => {
      roomManager.getRoom.mockReturnValue({ roomId: 'room-6' })
      roomManager.canManageSongs.mockReturnValue(true)
      roomManager.getCurrentSong.mockReturnValue({ id: 'song' })
      roomManager.getQueue.mockReturnValue([{ id: 'song' }])
      roomManager.pausePlayback.mockReturnValue(123)
      await emitEvent('song:pause', { roomId: 'room-6' })
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({ playing: false })
      )

      roomManager.resumePlayback.mockReturnValue(456)
      await emitEvent('song:resume', { roomId: 'room-6' })
      expect(roomChannel.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({ playing: true, playingFrom: 456 })
      )
    })
  })
})
