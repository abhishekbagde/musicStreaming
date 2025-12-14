export interface Room {
  roomId: string
  roomName: string
  hostId: string
  participants: string[]
  isLive: boolean
  createdAt: Date
}

export interface User {
  userId: string
  username: string
  isHost: boolean
}

export interface ChatMessage {
  userId: string
  username: string
  message: string
  timestamp: string
  isHost: boolean
}

export interface BroadcastStats {
  bitrate: number
  latency: number
  bufferLevel: number
  quality: 'high' | 'medium' | 'low'
  timestamp: number
}

export interface AudioConfig {
  sampleRate: number
  channels: number
}

export interface AudioChunk {
  data: Float32Array
  timestamp: number
  duration: number
  quality: 'high' | 'medium' | 'low'
}
