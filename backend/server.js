import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'
import { roomManager } from './utils/roomManager.js'
import { audioHandler } from './socket/audioHandler.js'
import { chatHandler } from './socket/chatHandler.js'
import { roomHandler } from './socket/roomHandler.js'
import { playlistHandler } from './socket/playlistHandler.js'
import youtubeRouter from './routes/youtube.js'

dotenv.config()

// Parse allowed origins from environment variable
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())

const app = express()
const httpServer = createServer(app)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

// Middleware
app.use(express.json())
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)

// Routes
app.use('/api/youtube', youtubeRouter)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.getAllRooms()
  const roomList = Object.values(rooms).map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName,
    hostId: room.hostId,
    hostName: room.hostName,
    guestCount: room.participants.length - 1, // Exclude host
    isLive: room.isLive,
    createdAt: room.createdAt,
  }))
  res.json(roomList)
})

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params
  const room = roomManager.getRoom(roomId)

  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }

  res.json({
    roomId: room.roomId,
    roomName: room.roomName,
    hostId: room.hostId,
    hostName: room.hostName,
    participants: room.participants,
    isLive: room.isLive,
    createdAt: room.createdAt,
  })
})

app.get('/api/rooms/:roomId/stats', (req, res) => {
  const { roomId } = req.params
  const stats = roomManager.getRoomStats(roomId)

  if (!stats) {
    return res.status(404).json({ error: 'Room not found' })
  }

  res.json(stats)
})

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Attach handlers
  roomHandler(io, socket, roomManager)
  audioHandler(io, socket, roomManager)
  chatHandler(io, socket, roomManager)
  playlistHandler(io, socket, roomManager)

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    const session = roomManager.getUserSession(socket.id)
    if (!session) return

    const { roomId, username = 'Unknown' } = session
    const result = roomManager.removeUserFromRoom(socket.id)
    if (!result) return

    const roomChannel = io.to(roomId)
    const room = roomManager.getRoom(roomId)
    const participantCount = room?.participants.length ?? 0

    if (result.closed) {
      roomChannel.emit('room:closed', { message: 'Host disconnected' })
      return
    }

    // Notify participants about the disconnect
    roomChannel.emit('user:left', {
      userId: socket.id,
      participantCount,
    })
    roomChannel.emit('system:message', {
      message: `👋 ${username} left the room`,
      timestamp: new Date().toISOString(),
    })

    if (result.hostChanged && result.newHostId) {
      const newHostSession = roomManager.getUserSession(result.newHostId)
      const newHostName = newHostSession?.username || 'New Host'

      roomChannel.emit('system:message', {
        message: `👑 ${newHostName} is now the host`,
        timestamp: new Date().toISOString(),
      })

      roomChannel.emit('host:changed', {
        newHostId: result.newHostId,
        newHostName,
      })
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`🎵 Music Streaming Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})
