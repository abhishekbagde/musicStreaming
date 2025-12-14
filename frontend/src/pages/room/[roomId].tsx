import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { socket } from '@/utils/socketClient'

interface ChatMessage {
  userId: string
  username: string
  message: string
  timestamp: string
  isHost: boolean
}

interface Participant {
  userId: string
  username: string
  isHost: boolean
}

export default function RoomPage() {
  const router = useRouter()
  const { roomId } = router.query
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<Float32Array>(new Float32Array(44100 * 10)) // 10 seconds buffer
  const writePositionRef = useRef(0)
  const readPositionRef = useRef(0)

  useEffect(() => {
    if (!roomId) return

    // Join room
    const username = router.query.username as string
    socket.emit('room:join', { roomId, username })

    // Listen for room joined
    socket.on('room:joined', (data) => {
      setIsConnected(true)
      console.log('Joined room:', roomId)
    })

    // Listen for participants list - set initial participants
    socket.on('participants:list', (data: any) => {
      const participantsList = data.participants.map((p: any) => ({
        userId: p.userId,
        username: p.username,
        isHost: p.isHost,
      })) || []
      setParticipants(participantsList)
      console.log('Participants list received:', participantsList.length)
    })

    // Listen for broadcast started
    socket.on('broadcast:started', (data) => {
      setIsLive(true)
      console.log('Broadcast started')
    })

    // Listen for broadcast audio
    socket.on('broadcast:audio', (data) => {
      // Add audio data to buffer
      const audioData = new Float32Array(data.data)
      for (let i = 0; i < audioData.length; i++) {
        bufferRef.current[writePositionRef.current % bufferRef.current.length] =
          audioData[i]
        writePositionRef.current++
      }
    })

    // Listen for broadcast stopped
    socket.on('broadcast:stopped', () => {
      setIsLive(false)
      console.log('Broadcast stopped')
    })

    // Listen for chat messages
    socket.on('chat:message', (data: ChatMessage) => {
      setMessages((prev) => [...prev, data])
    })

    // Listen for user joined - only add if not already in list
    socket.on('user:joined', (data) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.userId === data.userId)
        if (!exists) {
          console.log('Adding participant:', data.username)
          return [
            ...prev,
            {
              userId: data.userId,
              username: data.username,
              isHost: data.isHost || false,
            },
          ]
        }
        return prev
      })
    })

    // Listen for user left
    socket.on('user:left', (data) => {
      setParticipants((prev) =>
        prev.filter((p) => p.userId !== data.userId)
      )
    })

    // Listen for room closed
    socket.on('room:closed', () => {
      alert('Host closed the room')
      router.push('/browse')
    })

    return () => {
      // Clean up all listeners
      socket.off('room:joined')
      socket.off('participants:list')
      socket.off('broadcast:started')
      socket.off('broadcast:audio')
      socket.off('broadcast:stopped')
      socket.off('chat:message')
      socket.off('user:joined')
      socket.off('user:left')
      socket.off('room:closed')
      
      // Leave room when component unmounts
      socket.emit('room:leave')
    }
  }, [roomId, router])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim()) return

    socket.emit('chat:message', {
      roomId,
      message: messageInput,
    })
    setMessageInput('')
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-white border-t-purple-300 rounded-full"></div>
          </div>
          <p className="text-white text-lg">Connecting to room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-4">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Main Player Area */}
        <div className="md:col-span-2 space-y-6">
          {/* Player Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-800">
                🎵 Now Listening
              </h1>
              {isLive && (
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <span className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
                  LIVE
                </div>
              )}
            </div>

            {/* Audio Player */}
            <div className="bg-gray-100 rounded-lg p-8 text-center mb-6">
              <div className="text-6xl mb-4">🎧</div>
              <p className="text-gray-600 mb-4">
                {isLive ? 'Streaming...' : 'Waiting for broadcast...'}
              </p>
              <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 animate-pulse"></div>
              </div>
            </div>

            {/* Buffer Info */}
            <div className="text-sm text-gray-600 text-center">
              Buffer: {Math.floor((writePositionRef.current - readPositionRef.current) / 44100)}s
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Participants ({participants.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="bg-purple-100 px-3 py-2 rounded-lg text-purple-700 font-semibold text-center text-sm"
                >
                  {p.isHost ? '🎤' : '👥'} {p.username}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-[600px] md:h-[700px]">
          <h2 className="text-xl font-bold text-gray-800 mb-4">💬 Chat</h2>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center text-sm">
                No messages yet. Say hello!
              </p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-purple-600">
                      {msg.isHost ? '🎤' : ''} {msg.username}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-700 ml-4">{msg.message}</p>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-bold"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
