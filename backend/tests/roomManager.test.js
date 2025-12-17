import { describe, it, expect, beforeEach } from 'vitest'
import RoomManager from '../utils/roomManager.js'

const sampleSong = (id, title = 'Test Song') => ({
  id,
  title,
  author: 'Tester',
  duration: '3:00',
})

describe('RoomManager', () => {
  let manager
  let room

  beforeEach(() => {
    manager = new RoomManager()
    room = manager.createRoom('Lofi', 'host-1', 'DJ Test')
  })

  it('creates room and host session', () => {
    expect(room.roomId).toMatch(/^room-/)
    expect(room.queue).toEqual([])
    expect(manager.getQueue(room.roomId)).toEqual([])
    expect(manager.userSessions['host-1']).toEqual({
      roomId: room.roomId,
      isHost: true,
      username: 'DJ Test',
    })
  })

  it('adds and removes songs from queue', () => {
    manager.addSongToQueue(room.roomId, sampleSong('song-1'))
    manager.addSongToQueue(room.roomId, sampleSong('song-2'))

    expect(manager.getQueue(room.roomId)).toHaveLength(2)

    const removal = manager.removeSongFromQueue(room.roomId, 'song-1')
    expect(removal.success).toBe(true)
    expect(removal.removed.id).toBe('song-1')
    expect(manager.getQueue(room.roomId)).toHaveLength(1)
  })

  it('plays through queue with next/previous helpers', () => {
    const songs = ['a', 'b', 'c'].map((id) => sampleSong(id, id))
    songs.forEach((song) => manager.addSongToQueue(room.roomId, song))

    const first = manager.setCurrentSongByIndex(room.roomId, 0)
    expect(first.success).toBe(true)
    expect(manager.getCurrentSong(room.roomId).id).toBe('a')

    const next = manager.playNextSong(room.roomId)
    expect(next.song.id).toBe('b')

    const prev = manager.playPreviousSong(room.roomId)
    expect(prev.song.id).toBe('a')

    manager.playNextSong(room.roomId) // move to b
    manager.playNextSong(room.roomId) // move to c
    const finished = manager.playNextSong(room.roomId)
    expect(finished.song).toBeNull()
    expect(manager.getCurrentSong(room.roomId)).toBeNull()
  })

  it('reorders songs safely', () => {
    const songs = ['1', '2', '3'].map((id) => sampleSong(id))
    songs.forEach((song) => manager.addSongToQueue(room.roomId, song))

    const result = manager.moveSongInQueue(room.roomId, 0, 2)
    expect(result.success).toBe(true)
    expect(manager.getQueue(room.roomId).map((s) => s.id)).toEqual(['2', '3', '1'])
  })

  it('handles invalid queue operations gracefully', () => {
    const invalidRemoval = manager.removeSongFromQueue(room.roomId, 'missing')
    expect(invalidRemoval.success).toBe(false)
    expect(invalidRemoval.error).toMatch(/not found/i)

    const invalidSet = manager.setCurrentSongByIndex(room.roomId, 5)
    expect(invalidSet.success).toBe(false)
    expect(manager.getCurrentSong(room.roomId)).toBeNull()

    const nextOnEmpty = manager.playNextSong(room.roomId)
    expect(nextOnEmpty.success).toBe(false)
    expect(nextOnEmpty.error).toMatch(/empty/i)

    const songs = ['x', 'y'].map((id) => sampleSong(id))
    songs.forEach((song) => manager.addSongToQueue(room.roomId, song))
    manager.setCurrentSongByIndex(room.roomId, 0)

    const moveInvalid = manager.moveSongInQueue(room.roomId, 0, 5)
    expect(moveInvalid.success).toBe(false)
    expect(moveInvalid.error).toMatch(/invalid/i)

    const removalOfCurrent = manager.removeSongFromQueue(room.roomId, 'x')
    expect(removalOfCurrent.removedCurrent).toBe(true)
    expect(manager.getCurrentSong(room.roomId)).toBeNull()
  })

  it('rejects queue operations for unknown rooms', () => {
    const fakeRoom = 'missing-room'
    expect(manager.addSongToQueue(fakeRoom, sampleSong('ghost')).success).toBe(false)
    expect(manager.removeSongFromQueue(fakeRoom, 'ghost').success).toBe(false)
    expect(manager.playNextSong(fakeRoom).success).toBe(false)
    expect(manager.moveSongInQueue(fakeRoom, 0, 1).success).toBe(false)
  })

  describe('Co-host promotion and room ownership', () => {
    it('promotes co-host to host when host leaves with co-hosts present', () => {
      // Create room with host and guests
      manager.joinRoom(room.roomId, 'guest-1', 'Guest One')
      manager.joinRoom(room.roomId, 'guest-2', 'Guest Two')

      // Promote guest-1 to co-host
      const promoteResult = manager.promoteCohost(room.roomId, 'guest-1')
      expect(promoteResult.success).toBe(true)

      // Verify guest-1 is a co-host
      let roomData = manager.getRoom(room.roomId)
      expect(roomData.cohosts).toContain('guest-1')

      // Host leaves
      const leaveResult = manager.leaveRoom('host-1')
      expect(leaveResult.hostChanged).toBe(true)
      expect(leaveResult.newHostId).toBe('guest-1')
      expect(leaveResult.closed).toBe(false)

      // Verify co-host is now host
      roomData = manager.getRoom(room.roomId)
      expect(roomData.hostId).toBe('guest-1')
      expect(roomData.cohosts).not.toContain('guest-1')
      expect(roomData.participants).toContain('guest-1')
    })

    it('closes room when host leaves with no co-hosts', () => {
      // Create room with host and guest (no co-hosts)
      manager.joinRoom(room.roomId, 'guest-1', 'Guest One')

      // Host leaves (no co-hosts to promote)
      const leaveResult = manager.leaveRoom('host-1')
      expect(leaveResult.closed).toBe(true)
      expect(leaveResult.hostChanged).toBeUndefined()

      // Verify room is deleted
      const roomData = manager.getRoom(room.roomId)
      expect(roomData).toBeUndefined()
    })

    it('does not close room when guest leaves', () => {
      // Create room with host and guest
      manager.joinRoom(room.roomId, 'guest-1', 'Guest One')

      // Guest leaves
      const leaveResult = manager.leaveRoom('guest-1')
      expect(leaveResult.closed).toBe(false)
      expect(leaveResult.hostChanged).toBeUndefined()

      // Verify room still exists
      const roomData = manager.getRoom(room.roomId)
      expect(roomData).toBeDefined()
      expect(roomData.hostId).toBe('host-1')
      expect(roomData.participants).not.toContain('guest-1')
    })

    it('handles multiple co-hosts - promotes first one', () => {
      // Create room with multiple guests
      manager.joinRoom(room.roomId, 'guest-1', 'Guest One')
      manager.joinRoom(room.roomId, 'guest-2', 'Guest Two')
      manager.joinRoom(room.roomId, 'guest-3', 'Guest Three')

      // Promote two guests to co-hosts
      manager.promoteCohost(room.roomId, 'guest-1')
      manager.promoteCohost(room.roomId, 'guest-2')

      // Host leaves
      const leaveResult = manager.leaveRoom('host-1')
      expect(leaveResult.hostChanged).toBe(true)
      expect(leaveResult.newHostId).toBe('guest-1') // First promoted co-host

      // Verify guest-1 is now host, guest-2 is still co-host
      const roomData = manager.getRoom(room.roomId)
      expect(roomData.hostId).toBe('guest-1')
      expect(roomData.cohosts).toContain('guest-2')
      expect(roomData.cohosts).not.toContain('guest-1')
    })

    it('updates user session when promoted to host', () => {
      // Create room with guest
      manager.joinRoom(room.roomId, 'guest-1', 'Guest One')

      // Promote to co-host
      manager.promoteCohost(room.roomId, 'guest-1')

      // Host leaves
      manager.leaveRoom('host-1')

      // Verify user session reflects host status
      const guestSession = manager.getUserSession('guest-1')
      expect(guestSession.isHost).toBe(true)
    })
  })
})

