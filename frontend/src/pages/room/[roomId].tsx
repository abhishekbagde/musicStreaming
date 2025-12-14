import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { socket } from '@/utils/socketClient'

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

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

const extractVideoId = (song: Song | null) => {
  if (!song) return null
  if (song.id && /^[a-zA-Z0-9_-]{8,15}$/.test(song.id)) {
    return song.id
  }
  if (song.url) {
    try {
      const parsed = new URL(song.url)
      const fromQuery = parsed.searchParams.get('v')
      if (fromQuery) return fromQuery
      const segments = parsed.pathname.split('/')
      const last = segments[segments.length - 1]
      if (last) return last
    } catch (err) {
      console.warn('Failed to parse YouTube URL', err)
    }
  }
  return song.id || null
}

const computeStartSeconds = (startedAt?: number) => {
  if (!startedAt) return 0
  const elapsedMs = Date.now() - startedAt
  return Math.max(0, Math.floor(elapsedMs / 1000))
}

export default function RoomPage() {
  // --- Router & Query Params ---
  const router = useRouter()
  const { roomId } = router.query

  // --- Chat & Participants ---
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])

  // --- Playlist State ---
  const [queue, setQueue] = useState<Song[]>([])
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // --- Broadcast State ---
  const [isConnected, setIsConnected] = useState(false)
  const [isLive, setIsLive] = useState(false)

  // --- Player state ---
  const playerRef = useRef<any>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [audioConsent, setAudioConsent] = useState(false)
  const playbackRequestRef = useRef<{ song: Song; startedAt?: number } | null>(null)

  const playSongNow = useCallback((song: Song, startedAt?: number) => {
    if (!playerRef.current) return false
    const videoId = extractVideoId(song)
    if (!videoId) {
      console.error('Missing video ID', song)
      return false
    }
    const startSeconds = computeStartSeconds(startedAt)
    try {
      playerRef.current.loadVideoById({ videoId, startSeconds })
      playerRef.current.playVideo()
      setIsPlaying(true)
      return true
    } catch (err) {
      console.error('Failed to start YouTube playback', err)
      return false
    }
  }, [])

  const queuePlayback = useCallback((song: Song, startedAt?: number) => {
    if (audioConsent && playerReady && playerRef.current) {
      const success = playSongNow(song, startedAt)
      if (!success) {
        playbackRequestRef.current = { song, startedAt }
      } else {
        playbackRequestRef.current = null
      }
    } else {
      playbackRequestRef.current = { song, startedAt }
    }
    setIsPlaying(true)
  }, [audioConsent, playSongNow, playerReady])

  const enableAudio = useCallback(() => {
    if (audioConsent) return
    setAudioConsent(true)
  }, [audioConsent])

  // --- Socket.io Listeners ---
  useEffect(() => {
    if (!roomId) return

    // Join room
    const username = router.query.username as string
    socket.emit('room:join', { roomId, username })

    // Room joined confirmation
    socket.on('room:joined', () => {
      setIsConnected(true)
      console.log('✅ Joined room:', roomId)
    })

    // Participants list update
    socket.on('participants:list', (data: any) => {
      const participantsList = data.participants?.map((p: any) => ({
        userId: p.userId,
        username: p.username,
        isHost: p.isHost,
      })) || []
      setParticipants(participantsList)
      console.log('👥 Participants:', participantsList.length)
    })

    // User joined room
    socket.on('user:joined', (data) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.userId === data.userId)
        if (!exists) {
          console.log('➕ User joined:', data.username)
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

    // User left room
    socket.on('user:left', (data) => {
      console.log('➖ User left:', data.userId)
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId))
    })

    // Broadcast started
    socket.on('broadcast:started', () => {
      setIsLive(true)
      console.log('🔴 Broadcast started')
    })

    // Broadcast stopped
    socket.on('broadcast:stopped', () => {
      setIsLive(false)
      console.log('⏹️ Broadcast stopped')
    })

    // Playlist update - show queue and play songs
    socket.on('playlist:update', (data) => {
      setQueue(data.queue || [])
      setCurrentSong(data.currentSong || null)
      console.log('🎵 Queue updated:', data.queue?.length || 0)

      if (typeof data.playing === 'boolean') {
        if (data.playing && data.currentSong) {
          queuePlayback(data.currentSong, data.playingFrom)
        } else {
          playbackRequestRef.current = null
          if (playerRef.current?.stopVideo) {
            playerRef.current.stopVideo()
          }
          setIsPlaying(false)
        }
      }
    })

    // Chat message received
    socket.on('chat:message', (data: ChatMessage) => {
      setMessages((prev) => [...prev, data])
    })

    // Room closed by host
    socket.on('room:closed', () => {
      alert('Host closed the room')
      router.push('/browse')
    })

    // Cleanup
    return () => {
      socket.off('room:joined')
      socket.off('participants:list')
      socket.off('user:joined')
      socket.off('user:left')
      socket.off('broadcast:started')
      socket.off('broadcast:stopped')
      socket.off('playlist:update')
      socket.off('chat:message')
      socket.off('room:closed')
      socket.emit('room:leave')
    }
  }, [queuePlayback, roomId, router])

  useEffect(() => {
    if (audioConsent) return

    const handleFirstInteraction = () => {
      enableAudio()
    }

    window.addEventListener('touchend', handleFirstInteraction, { passive: true, once: true })
    window.addEventListener('click', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('touchend', handleFirstInteraction)
      window.removeEventListener('click', handleFirstInteraction)
    }
  }, [audioConsent, enableAudio])

  useEffect(() => {
    if (!audioConsent) return

    const createPlayer = () => {
      if (playerRef.current || !window.YT?.Player) return
      playerRef.current = new window.YT.Player('guest-youtube-player', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => setPlayerReady(true),
        },
      })
    }

    if (window.YT && window.YT.Player) {
      createPlayer()
    } else {
      window.onYouTubeIframeAPIReady = () => {
        window.onYouTubeIframeAPIReady = undefined
        createPlayer()
      }
      if (!document.getElementById('youtube-iframe-api')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.id = 'youtube-iframe-api'
        document.body.appendChild(tag)
      }
    }

    return () => {
      window.onYouTubeIframeAPIReady = undefined
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      setPlayerReady(false)
    }
  }, [audioConsent])

  useEffect(() => {
    if (!audioConsent || !playerReady || !playerRef.current) return
    if (playbackRequestRef.current) {
      const { song, startedAt } = playbackRequestRef.current
      playbackRequestRef.current = null
      playSongNow(song, startedAt)
    }
  }, [audioConsent, playerReady, playSongNow])

  // --- Chat Handler ---
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim()) return
    socket.emit('chat:message', { roomId, message: messageInput })
    setMessageInput('')
  }

  // --- Render: Loading State ---
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

  // --- Render: Main Interface ---
  const nowPlaying = currentSong || (queue.length > 0 ? queue[0] : null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-2 sm:p-4">
      <div
        id="guest-youtube-player"
        className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none"
        aria-hidden="true"
      />
      {!audioConsent && (
        <div className="fixed inset-x-0 bottom-0 md:top-0 md:bottom-auto z-10 px-4 pb-6 pt-2 pointer-events-none">
          <div className="max-w-md mx-auto bg-yellow-100 text-yellow-900 rounded-xl shadow-lg p-4 flex flex-col gap-3 pointer-events-auto">
            <div className="text-sm md:text-base font-semibold flex items-center gap-2 justify-center">
              <span role="img" aria-label="speaker">🔊</span>
              Tap once to sync audio with the host
            </div>
            <button
              className="w-full bg-yellow-500 text-white font-bold py-2 rounded-lg text-base"
              onClick={enableAudio}
            >
              Enable Audio
            </button>
            <p className="text-xs md:text-sm text-yellow-800 text-center">
              Mobile browsers require a quick tap before playback is allowed. You only need to do this once per visit.
            </p>
          </div>
        </div>
      )}
      
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Player Area */}
        <div className="md:col-span-2 space-y-4 sm:space-y-6">
          {/* Music Queue Card */}
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>🎵</span> <span>Music Queue</span>
            </h2>

            {/* Now Playing */}
            {nowPlaying && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg">
                  <div className="text-sm font-semibold mb-2">NOW PLAYING</div>
                  <div className="text-2xl font-bold mb-2 truncate">{nowPlaying.title}</div>
                  <div className="text-purple-100 mb-4 truncate">{nowPlaying.author}</div>
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-3">Queue ({queue.length})</h3>
              {queue.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">�</div>
                  <p>Waiting for host to add songs...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((song, idx) => {
                    const isCurrent = currentSong?.id === song.id || (!currentSong && idx === 0)
                    return (
                      <div key={song.id} className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${isCurrent ? 'bg-purple-50 border-2 border-purple-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="text-lg font-bold w-10 text-center">
                          {isCurrent ? '▶️' : idx}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{song.title}</div>
                          <div className="text-sm text-gray-500 truncate">{song.author}</div>
                        </div>
                        <div className="text-sm text-gray-400 flex-shrink-0">{song.duration || 'N/A'}</div>
                      </div>
                    )
                  })}
                </div>
              )}
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
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col h-auto md:h-[700px]">
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
