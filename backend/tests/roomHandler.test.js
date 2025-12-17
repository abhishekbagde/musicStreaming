import { describe, it, expect, beforeEach, vi } from 'vitest'
import { roomHandler } from '../socket/roomHandler.js'

const createMockSocket = () => {
  const listeners = {}
  return {
    id: 'socket-1',
    listeners,
    on: vi.fn((event, handler) => {
      listeners[event] = handler
    }),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    broadcast: {
      to: vi.fn(() => ({ emit: vi.fn() })),
    },
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

const mockRoom = () => ({
  roomId: 'room-1',
  roomName: 'Lofi',
  hostId: 'socket-1',
  hostName: 'Host',
  participants: ['socket-1'],
  cohosts: [],
  createdAt: new Date(),
})

const baseRoomManager = () => ({
  createRoom: vi.fn(),
  getRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  getUserSession: vi.fn(),
  getQueue: vi.fn(),
  getCurrentSong: vi.fn(),
  getPlaybackState: vi.fn(),
  getSongRequests: vi.fn(),
  promoteCohost: vi.fn(),
  demoteCohost: vi.fn(),
  isHostOfRoom: vi.fn(),
  getSongRequests: vi.fn(),
  setRoomLive: vi.fn(),
})

describe('roomHandler socket events', () => {
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
    roomHandler(io, socket, roomManager)
  })

  const trigger = async (event, payload) => {
    await socket.listeners[event](payload)
  }

  describe('room:create', () => {
    it('rejects empty room name', async () => {
      await trigger('room:create', { roomName: ' ', hostName: 'DJ' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Room name is required' })
    })

    it('creates room and emits initial data', async () => {
      const room = mockRoom()
      roomManager.createRoom.mockReturnValue(room)
      roomManager.getRoom.mockReturnValue({ ...room, participants: ['socket-1'] })
      roomManager.getQueue.mockReturnValue([])
      roomManager.getCurrentSong.mockReturnValue(null)
      roomManager.getPlaybackState.mockReturnValue({ playing: false, playingFrom: null })
      roomManager.getSongRequests.mockReturnValue([])

      await trigger('room:create', { roomName: 'Lofi', hostName: 'Host' })

      expect(socket.join).toHaveBeenCalledWith('room-1')
      expect(socket.emit).toHaveBeenCalledWith(
        'room:created',
        expect.objectContaining({ roomId: 'room-1', hostName: 'Host' })
      )
      expect(socket.emit).toHaveBeenCalledWith('participants:list', expect.any(Object))
      expect(socket.emit).toHaveBeenCalledWith(
        'playlist:update',
        expect.objectContaining({ queue: [] })
      )
    })
  })

  describe('room:join', () => {
    it('rejects invalid roomId', async () => {
      await trigger('room:join', { roomId: '', username: 'Guest' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Room ID is required' })
    })

    it('joins room and notifies others', async () => {
      const room = { ...mockRoom(), participants: ['socket-1', 'socket-2'], cohosts: [] }
      roomManager.joinRoom.mockReturnValue({ success: true, room })
      roomManager.getRoom.mockReturnValue(room)
      roomManager.getUserSession.mockReturnValue({ username: 'Guest' })
      roomManager.getQueue.mockReturnValue([])
      roomManager.getCurrentSong.mockReturnValue(null)
      roomManager.getPlaybackState.mockReturnValue({ playing: false, playingFrom: null })
      roomManager.getSongRequests.mockReturnValue([])

      await trigger('room:join', { roomId: room.roomId, username: 'Guest' })

      expect(socket.join).toHaveBeenCalledWith(room.roomId)
      expect(socket.emit).toHaveBeenCalledWith('room:joined', room)
      expect(io.to).toHaveBeenCalledWith(room.roomId)
      expect(roomChannel.emit).toHaveBeenCalledWith('system:message', expect.any(Object))
    })
  })

  describe('room:leave', () => {
    it('leaves room and emits user:left', async () => {
      roomManager.getUserSession.mockReturnValue({ roomId: 'room-1', username: 'Guest' })
      roomManager.leaveRoom.mockReturnValue({ closed: false })
      roomManager.getRoom.mockReturnValue({ ...mockRoom(), participants: [] })

      await trigger('room:leave')

      expect(socket.leave).toHaveBeenCalledWith('room-1')
      expect(io.to).toHaveBeenCalledWith('room-1')
      expect(roomChannel.emit).toHaveBeenCalledWith('user:left', expect.any(Object))
    })
  })

  describe('user:promote-cohost', () => {
    const payload = { roomId: 'room-1', userId: 'socket-2' }

    it('requires host privileges', async () => {
      roomManager.isHostOfRoom.mockReturnValue(false)
      await trigger('user:promote-cohost', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only the host can promote users' })
      expect(roomManager.promoteCohost).not.toHaveBeenCalled()
    })

    it('promotes user and emits event', async () => {
      roomManager.isHostOfRoom.mockReturnValue(true)
      roomManager.promoteCohost.mockReturnValue({ success: true })
      roomManager.getUserSession.mockReturnValue({ username: 'Guest' })

      await trigger('user:promote-cohost', payload)

      expect(roomManager.promoteCohost).toHaveBeenCalledWith('room-1', 'socket-2')
      expect(io.to).toHaveBeenCalledWith('room-1')
      expect(roomChannel.emit).toHaveBeenCalledWith('user:promoted-cohost', expect.any(Object))
    })
  })

  describe('user:demote-cohost', () => {
    const payload = { roomId: 'room-1', userId: 'socket-2' }

    it('demotes only when host', async () => {
      roomManager.isHostOfRoom.mockReturnValue(false)
      await trigger('user:demote-cohost', payload)
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Only the host can demote users' })
    })

    it('demotes user and emits event', async () => {
      roomManager.isHostOfRoom.mockReturnValue(true)
      roomManager.demoteCohost.mockReturnValue({ success: true })
      roomManager.getUserSession.mockReturnValue({ username: 'Guest' })

      await trigger('user:demote-cohost', payload)
      expect(roomManager.demoteCohost).toHaveBeenCalledWith('room-1', 'socket-2')
      expect(roomChannel.emit).toHaveBeenCalledWith('user:demoted-cohost', expect.any(Object))
    })
  })

  describe('heartbeat', () => {
    it('logs heartbeat when payload valid', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      await trigger('heartbeat', { roomId: 'room-1' })
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('💓 Heartbeat received'))
      console.log.mockRestore()
    })
  })

  describe('room:rejoin', () => {
    it('requires roomId', async () => {
      await trigger('room:rejoin', { roomId: '' })
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Room ID is required' })
    })

    it('rejoins existing room and emits lists', async () => {
      const room = { ...mockRoom(), participants: [] }
      roomManager.getRoom.mockReturnValue(room)
      roomManager.getUserSession.mockReturnValue({ username: 'Host' })
      roomManager.getQueue.mockReturnValue([])
      roomManager.getCurrentSong.mockReturnValue(null)
      roomManager.getPlaybackState.mockReturnValue({ playing: false, playingFrom: null })
      roomManager.getSongRequests.mockReturnValue([])

      await trigger('room:rejoin', { roomId: room.roomId })

      expect(socket.join).toHaveBeenCalledWith(room.roomId)
      expect(socket.emit).toHaveBeenCalledWith('room:rejoined', { roomId: room.roomId, success: true })
      expect(socket.emit).toHaveBeenCalledWith('participants:list', expect.any(Object))
      expect(socket.emit).toHaveBeenCalledWith('playlist:update', expect.any(Object))
    })
  })
})
