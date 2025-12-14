import React, { useState, useRef, useEffect } from 'react'
import { socket } from '@/utils/socketClient'
import { apiClient } from '@/utils/apiClient'

interface Song {
  id: string
  title: string
  author: string
  duration?: string
  thumbnail?: string
  url: string
}

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

export default function BroadcastPage() {
  // --- Room State ---
  const [roomName, setRoomName] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)

  // --- Participants & Chat ---
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')

  // --- Playlist & Search ---
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [queue, setQueue] = useState<Song[]>([])
  const [currentSong, setCurrentSong] = useState<Song | null>(null)

  // --- UI State ---
  const [error, setError] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // --- Scroll to bottom for chat ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // --- Socket.io Listeners ---
  useEffect(() => {
    // Room events
    socket.on('room:created', (data) => {
      setRoomId(data.roomId)
      setError('')
      console.log('✅ Room created:', data.roomId)
      setParticipants([{ userId: socket.id || 'host', username: 'You (Host)', isHost: true }])
    })

    // Participants events
    socket.on('participants:list', (data) => {
      setParticipants(data.participants || [])
      console.log('👥 Participants:', data.participants?.length || 0)
    })

    socket.on('user:joined', (data) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.userId === data.userId)
        if (!exists) {
          console.log('➕ User joined:', data.username)
          return [...prev, { userId: data.userId, username: data.username, isHost: data.isHost || false }]
        }
        return prev
      })
    })

    socket.on('user:left', (data) => {
      console.log('➖ User left:', data.userId)
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId))
    })

    // Playlist events
    socket.on('playlist:update', (data) => {
      setQueue(data.queue || [])
      setCurrentSong(data.currentSong || null)
      console.log('🎵 Queue updated:', data.queue?.length || 0)
      
      // If there's a current song and it's being played, extract and play audio
      if (data.currentSong && data.playing && audioRef.current) {
        const audioUrl = apiClient.getAudio(data.currentSong.url)
        audioRef.current.src = audioUrl
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err)
        })
        setIsPlaying(true)
      }
    })

    // Chat events
    socket.on('chat:message', (data) => {
      setMessages((prev) => [...prev, data])
      scrollToBottom()
    })

    // Error events
    socket.on('error', (data) => {
      setError(data.message)
      console.error('❌ Error:', data.message)
    })

    return () => {
      socket.off('room:created')
      socket.off('participants:list')
      socket.off('user:joined')
      socket.off('user:left')
      socket.off('playlist:update')
      socket.off('chat:message')
      socket.off('error')
    }
  }, [])

  // --- Detect if user is host ---
  useEffect(() => {
    const me = participants.find((p) => p.userId === (socket.id || 'host'))
    setIsHost(!!me?.isHost)
  }, [participants])

  // --- Room Management ---
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim()) {
      setError('Please enter a room name')
      return
    }
    socket.emit('room:create', { roomName })
  }



  // --- Playlist Handlers ---
  const handleYouTubeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    try {
      const data = await apiClient.search(searchQuery)
      setSearchResults(data.results || [])
    } catch (err) {
      setSearchResults([])
      setError('YouTube search failed')
      console.error('Search error:', err)
    }
  }

  const handleAddSong = (song: Song) => {
    if (!roomId) return
    socket.emit('song:add', { roomId, song })
    console.log('➕ Song added:', song.title)
  }

  const handleRemoveSong = (songId: string) => {
    if (!roomId || !isHost) return
    socket.emit('song:remove', { roomId, songId })
    console.log('➖ Song removed:', songId)
  }

  const handlePlayNext = () => {
    if (!roomId || !isHost) return
    socket.emit('song:play', { roomId })
    console.log('▶️ Playing next song')
  }

  const handleSkip = () => {
    if (!roomId || !isHost) return
    socket.emit('song:skip', { roomId })
    console.log('⏭️ Skipped to next song')
  }

  // --- Chat Handler ---
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !roomId) return
    socket.emit('chat:message', { roomId, message: messageInput })
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
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} crossOrigin="anonymous" onEnded={() => setIsPlaying(false)} />
      
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Main Area */}
        <div className="md:col-span-2 space-y-6">
          {/* --- YouTube Search & Playlist UI --- */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🎵 Music Queue</h2>

            {/* Search Bar */}
            <form onSubmit={handleYouTubeSearch} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search YouTube..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-bold transition-colors"
                >
                  🔍 Search
                </button>
              </div>
            </form>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b font-semibold text-sm">Search Results</div>
                <ul className="max-h-72 overflow-y-auto">
                  {searchResults.map((song) => (
                    <li key={song.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors p-3">
                      <div className="flex items-start gap-3">
                        {song.thumbnail && (
                          <img src={song.thumbnail} alt="thumbnail" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{song.title}</div>
                          <div className="text-sm text-gray-500 truncate">{song.author}</div>
                          <div className="text-xs text-gray-400">{song.duration || 'N/A'}</div>
                        </div>
                        <button
                          onClick={() => {
                            handleAddSong(song)
                            setSearchResults([]) // Close dropdown after adding
                          }}
                          className="bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 text-sm font-bold flex-shrink-0 whitespace-nowrap"
                        >
                          + Add
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Now Playing */}
            {queue.length > 0 && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-6 text-white">
                  <div className="text-sm font-semibold mb-2">NOW PLAYING</div>
                  <div className="text-2xl font-bold mb-2 truncate">{queue[0].title}</div>
                  <div className="text-purple-100 mb-4 truncate">{queue[0].author}</div>
                  
                  {isHost && (
                    <div className="flex gap-3">
                      <button
                        onClick={handlePlayNext}
                        className="bg-white text-purple-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors flex-1"
                      >
                        ▶️ Play
                      </button>
                      <button
                        onClick={handleSkip}
                        className="bg-purple-700 text-white px-6 py-2 rounded font-bold hover:bg-purple-800 transition-colors flex-1"
                      >
                        ⏭️ Skip
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-3">Queue ({queue.length})</h3>
              {queue.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">🎵</div>
                  <p>No songs in queue yet. Search and add some!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((song, idx) => (
                    <div key={song.id} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${idx === 0 ? 'bg-purple-100 border-2 border-purple-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <div className="text-lg font-bold w-8 text-center">
                        {idx === 0 ? '▶️' : idx}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 truncate">{song.title}</div>
                        <div className="text-sm text-gray-500 truncate">{song.author}</div>
                      </div>
                      <div className="text-sm text-gray-400 flex-shrink-0">{song.duration || 'N/A'}</div>
                      {isHost && (
                        <button
                          onClick={() => handleRemoveSong(song.id)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition-colors flex-shrink-0"
                          title="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Room Info */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">🎤 Room</h2>
              <div className="text-sm text-gray-500">ID: {roomId?.slice(-8)}</div>
            </div>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/browse`)
                alert('Browse link copied!')
              }}
              className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors mb-6"
            >
              📋 Copy Browse Link for Guests
            </button>

            {/* Participants */}
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-3">Participants ({participants.length})</h3>
              {participants.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Waiting for guests...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <div
                      key={p.userId}
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-full font-semibold text-sm"
                    >
                      {p.isHost ? '🎤' : '👥'} {p.username}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
