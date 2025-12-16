class RoomManager {
  constructor() {
    this.rooms = {}
    this.userSessions = {}
  }

  createRoom(roomName, hostId) {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const room = {
      roomId,
      roomName,
      hostId,
      participants: [hostId],
      cohosts: [], // Array of user IDs who are co-hosts
      isLive: false,
      createdAt: new Date(),
      stats: {
        bitrate: 128,
        latency: 0,
        bufferLevel: 0,
        guestCount: 0,
        quality: 'high',
      },
      queue: [], // Playlist queue: array of song objects
      currentSong: null, // Currently playing song object
      currentSongIndex: -1,
      isPlaying: false,
      playingFrom: null,
      resumeMs: 0,
    }
    this.rooms[roomId] = room
    this.userSessions[hostId] = { roomId, isHost: true, username: 'Host' }
    return room
  }
  // Playlist queue management
  addSongToQueue(roomId, song) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    room.queue.push(song)
    return { success: true, queue: room.queue }
  }

  removeSongFromQueue(roomId, songId) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    const index = room.queue.findIndex((song) => song.id === songId)
    if (index === -1) {
      return { success: false, error: 'Song not found' }
    }

    const [removed] = room.queue.splice(index, 1)
    const wasCurrent = room.currentSongIndex === index

    if (wasCurrent) {
      room.currentSong = null
      room.currentSongIndex = -1
      room.isPlaying = false
      room.playingFrom = null
      room.resumeMs = 0
    } else if (room.currentSongIndex > index) {
      room.currentSongIndex -= 1
    }

    return {
      success: true,
      queue: room.queue,
      removed,
      removedIndex: index,
      removedCurrent: wasCurrent,
    }
  }

  getQueue(roomId) {
    const room = this.rooms[roomId]
    if (!room) return []
    return room.queue
  }

  setCurrentSong(roomId, song, index = null) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    room.currentSong = song
    if (song) {
      const inferredIndex = index ?? room.queue.findIndex((s) => s.id === song.id)
      room.currentSongIndex = inferredIndex
    } else {
      room.currentSongIndex = -1
    }
    room.resumeMs = 0
    return { success: true, currentSong: song }
  }

  getCurrentSong(roomId) {
    const room = this.rooms[roomId]
    if (!room) return null
    return room.currentSong
  }

  setCurrentSongByIndex(roomId, index) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    if (index < 0 || index >= room.queue.length) {
      room.currentSong = null
      room.currentSongIndex = -1
      room.resumeMs = 0
      return { success: false, error: 'Invalid song index' }
    }
    const song = room.queue[index]
    room.currentSong = song
    room.currentSongIndex = index
    room.resumeMs = 0
    return { success: true, currentSong: song }
  }

  getCurrentSongIndex(roomId) {
    const room = this.rooms[roomId]
    if (!room) return -1
    return typeof room.currentSongIndex === 'number' ? room.currentSongIndex : -1
  }

  playNextSong(roomId) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    if (room.queue.length === 0) return { success: false, error: 'Queue is empty' }

    const currentIndex = room.currentSongIndex
    const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1

    if (nextIndex >= room.queue.length) {
      this.setCurrentSong(roomId, null)
      return { success: true, song: null, index: -1, ended: true }
    }

    const song = room.queue[nextIndex]
    this.setCurrentSong(roomId, song, nextIndex)
    return { success: true, song, index: nextIndex }
  }

  playPreviousSong(roomId) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    if (room.queue.length === 0) return { success: false, error: 'Queue is empty' }

    const currentIndex = room.currentSongIndex
    let prevIndex = currentIndex === -1 ? 0 : currentIndex - 1
    if (prevIndex < 0) prevIndex = 0

    const song = room.queue[prevIndex]
    this.setCurrentSong(roomId, song, prevIndex)
    return { success: true, song, index: prevIndex }
  }

  playSongById(roomId, songId) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    const index = room.queue.findIndex((song) => song.id === songId)
    if (index === -1) return { success: false, error: 'Song not found' }
    const song = room.queue[index]
    this.setCurrentSong(roomId, song, index)
    return { success: true, song, index }
  }

  joinRoom(roomId, userId, username) {
    const room = this.rooms[roomId]
    if (!room) {
      return { success: false, error: 'Room not found' }
    }

    if (room.participants.length >= 100) {
      return { success: false, error: 'Room is full' }
    }

    room.participants.push(userId)
    this.userSessions[userId] = {
      roomId,
      isHost: false,
      username,
    }

    return {
      success: true,
      room: {
        roomId: room.roomId,
        roomName: room.roomName,
        hostId: room.hostId,
        participants: room.participants,
        isLive: room.isLive,
      },
    }
  }

  leaveRoom(userId) {
    const session = this.userSessions[userId]
    if (!session) return { success: false }

    const { roomId } = session
    const room = this.rooms[roomId]
    if (!room) return { success: false }

    room.participants = room.participants.filter((id) => id !== userId)
    delete this.userSessions[userId]

    // If host leaves, close room
    if (room.hostId === userId) {
      delete this.rooms[roomId]
      return { roomId, closed: true, success: true }
    }

    return { roomId, closed: false, success: true }
  }

  removeUserFromRoom(userId) {
    return this.leaveRoom(userId)
  }

  getRoom(roomId) {
    return this.rooms[roomId]
  }

  getAllRooms() {
    return this.rooms
  }

  updateRoomStats(roomId, stats) {
    const room = this.rooms[roomId]
    if (room) {
      room.stats = { ...room.stats, ...stats }
      room.stats.guestCount = Math.max(0, room.participants.length - 1)
    }
  }

  getRoomStats(roomId) {
    const room = this.rooms[roomId]
    if (!room) return null
    return room.stats
  }

  setRoomLive(roomId, isLive) {
    const room = this.rooms[roomId]
    if (room) {
      room.isLive = isLive
    }
  }

  setPlaybackState(roomId, playing, startedAt = null) {
    const room = this.rooms[roomId]
    if (!room) return
    room.isPlaying = playing
    if (playing) {
      room.playingFrom = startedAt || Date.now()
      room.resumeMs = 0
    } else {
      room.playingFrom = null
    }
  }

  getPlaybackState(roomId) {
    const room = this.rooms[roomId]
    if (!room) {
      return { playing: false, playingFrom: null, resumeMs: 0 }
    }
    return {
      playing: room.isPlaying || false,
      playingFrom: room.playingFrom || null,
      resumeMs: room.resumeMs || 0,
    }
  }

  pausePlayback(roomId) {
    const room = this.rooms[roomId]
    if (!room || !room.playingFrom) return 0
    const elapsed = Date.now() - room.playingFrom
    room.resumeMs = elapsed
    room.isPlaying = false
    room.playingFrom = null
    return elapsed
  }

  resumePlayback(roomId) {
    const room = this.rooms[roomId]
    if (!room || !room.currentSong) return null
    const resumeMs = room.resumeMs || 0
    const startedAt = Date.now() - resumeMs
    room.isPlaying = true
    room.playingFrom = startedAt
    room.resumeMs = 0
    return startedAt
  }

  getUserSession(userId) {
    return this.userSessions[userId]
  }

  isHostOfRoom(userId, roomId) {
    const room = this.rooms[roomId]
    return room && room.hostId === userId
  }

  promoteCohost(roomId, userId) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    if (!room.participants.includes(userId)) {
      return { success: false, error: 'User not in room' }
    }
    if (!room.cohosts.includes(userId)) {
      room.cohosts.push(userId)
      console.log(`✅ User ${userId} promoted to co-host in room ${roomId}`)
      return { success: true, message: 'User promoted to co-host' }
    }
    return { success: false, error: 'User is already a co-host' }
  }

  demoteCohost(roomId, userId) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    const index = room.cohosts.indexOf(userId)
    if (index > -1) {
      room.cohosts.splice(index, 1)
      console.log(`👤 User ${userId} demoted from co-host in room ${roomId}`)
      return { success: true, message: 'User demoted from co-host' }
    }
    return { success: false, error: 'User is not a co-host' }
  }

  isCohost(roomId, userId) {
    const room = this.rooms[roomId]
    return room && room.cohosts.includes(userId)
  }

  canManageSongs(roomId, userId) {
    const room = this.rooms[roomId]
    if (!room) return false
    return room.hostId === userId || room.cohosts.includes(userId)
  }
}

export const roomManager = new RoomManager()
