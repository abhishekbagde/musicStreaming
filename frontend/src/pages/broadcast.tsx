import React, { useState, useRef, useEffect } from 'react'
import { socket } from '@/utils/socketClient'
import { useRoomStore } from '@/utils/roomStore'

interface ChatMessage {
  userId: string
  username: string
  message: string
  timestamp: string
  isHost: boolean
}

export default function BroadcastPage() {
  const [roomName, setRoomName] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [participants, setParticipants] = useState<Array<{ userId: string; username: string; isHost: boolean }>>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [error, setError] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Listen for room creation
    socket.on('room:created', (data) => {
      setRoomId(data.roomId)
      setError('')
      console.log('Room created:', data.roomId)
      // Add host as initial participant
      setParticipants([
        {
          userId: socket.id || 'host',
          username: 'You (Host)',
          isHost: true,
        },
      ])
    })

    // Listen for participants list update - replace entire list
    socket.on('participants:list', (data) => {
      const participantsList = data.participants || []
      setParticipants(participantsList)
      console.log('Participants list updated:', participantsList.length)
    })

    // Listen for user joined - only add if not in current list
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
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId))
    })

    // Listen for chat messages
    socket.on('chat:message', (data: ChatMessage) => {
      setMessages((prev) => [...prev, data])
      scrollToBottom()
    })

    // Listen for errors
    socket.on('error', (data) => {
      setError(data.message)
    })

    return () => {
      // Clean up all listeners
      socket.off('room:created')
      socket.off('participants:list')
      socket.off('user:joined')
      socket.off('user:left')
      socket.off('chat:message')
      socket.off('error')
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim()) {
      setError('Please enter a room name')
      return
    }
    socket.emit('room:create', { roomName })
  }

  const handleStartBroadcast = async () => {
    try {
      let stream: MediaStream | null = null
      
      // Try audio-only capture first (no screen needed)
      try {
        console.log('Attempting audio-only capture...')
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          } as any,
          video: false,
        } as any)
        console.log('Audio-only capture successful')
      } catch (displayError) {
        // Fallback to microphone if audio-only not supported
        console.log('Audio-only not available, using microphone:', displayError)
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
      }

      const audioContext =
        new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 2, 2)
      processorRef.current = processor

      source.connect(processor)
      processor.connect(audioContext.destination)

      processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0)
        if (roomId) {
          socket.emit('broadcast:audio', {
            roomId,
            data: Array.from(audioData),
            timestamp: Date.now(),
            duration: 100,
            quality: 'high',
          })
        }
      }

      setIsRecording(true)

      if (roomId) {
        socket.emit('broadcast:start', { roomId })
      }
    } catch (err) {
      setError('Audio capture access denied. Browser may not support audio capture.')
      console.error('Error accessing audio:', err)
    }
  }

  const handleStopBroadcast = () => {
    if (processorRef.current) {
      processorRef.current.disconnect()
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    setIsRecording(false)

    if (roomId) {
      socket.emit('broadcast:stop', { roomId })
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !roomId) return

    socket.emit('chat:message', {
      roomId,
      message: messageInput,
    })
    setMessageInput('')
  }

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            🎤 Start Broadcasting
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g., My Music Night"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Room
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-4">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Main Area */}
        <div className="md:col-span-2 space-y-6">
          {/* Broadcast Header */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              🎤 Broadcasting
            </h1>
            <p className="text-gray-600 mb-4">Room: {roomId}</p>

            {/* Copy Room ID */}
            <div className="flex items-center gap-2 mb-6">
              <input
                type="text"
                value={roomId}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/browse`
                  )
                  alert('Browse link copied!')
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Copy Link
              </button>
            </div>

            {/* Info Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-900">
                <strong>🎵 How to stream audio:</strong>
                <br/>
                1. Click "Start Broadcast"
                <br/>
                2. Your browser will ask to share audio
                <br/>
                3. Select your audio source (YouTube, Spotify, System Audio, etc.)
                <br/>
                4. ✅ Audio will automatically start streaming to all guests!
              </p>
            </div>

            {/* Broadcast Controls */}
            <div className="flex gap-4">
              {!isRecording ? (
                <button
                  onClick={handleStartBroadcast}
                  className="flex-1 bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
                >
                  ▶️ Start Broadcast
                </button>
              ) : (
                <button
                  onClick={handleStopBroadcast}
                  className="flex-1 bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition-colors"
                >
                  ⏹️ Stop Broadcast
                </button>
              )}
            </div>

            {isRecording && (
              <div className="mt-4 flex items-center gap-2 text-green-600 font-bold">
                <span className="inline-block w-3 h-3 bg-green-600 rounded-full animate-pulse"></span>
                LIVE
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Participants ({participants.length})
            </h2>
            {participants.length === 0 ? (
              <p className="text-gray-600">
                Waiting for guests to join... Share the room ID above!
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {participants.map((p) => (
                  <div
                    key={p.userId}
                    className="bg-purple-100 px-4 py-2 rounded-lg text-purple-700 font-semibold text-center"
                  >
                    {p.isHost ? '🎤' : '👥'} {p.username}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-[600px] md:h-[750px]">
          <h2 className="text-xl font-bold text-gray-800 mb-4">💬 Chat</h2>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center text-sm">
                No messages yet. Start chatting!
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
                  <p className="text-gray-700 ml-4 break-words">
                    {msg.message}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2 border-t pt-4">
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
