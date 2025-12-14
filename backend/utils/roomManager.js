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
    room.queue = room.queue.filter((song) => song.id !== songId)
    return { success: true, queue: room.queue }
  }

  getQueue(roomId) {
    const room = this.rooms[roomId]
    if (!room) return []
    return room.queue
  }

  setCurrentSong(roomId, song) {
    const room = this.rooms[roomId]
    if (!room) return { success: false, error: 'Room not found' }
    room.currentSong = song
    return { success: true, currentSong: song }
  }

  getCurrentSong(roomId) {
    const room = this.rooms[roomId]
    if (!room) return null
    return room.currentSong
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

  getUserSession(userId) {
    return this.userSessions[userId]
  }

  isHostOfRoom(userId, roomId) {
    const room = this.rooms[roomId]
    return room && room.hostId === userId
  }
}

export const roomManager = new RoomManager()
