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

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.SOCKET_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

// Middleware
app.use(express.json())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
)

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.getAllRooms()
  const roomList = Object.values(rooms).map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName,
    hostId: room.hostId,
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    const session = roomManager.getUserSession(socket.id)
    if (session) {
      const { roomId } = session
      const result = roomManager.removeUserFromRoom(socket.id)
      
      if (result?.closed) {
        // Room closed because host disconnected
        io.to(roomId).emit('room:closed', { message: 'Host disconnected' })
      } else if (result?.roomId) {
        // Notify others that this user left
        io.to(roomId).emit('user:left', {
          userId: socket.id,
        })
      }
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`🎵 Music Streaming Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})
