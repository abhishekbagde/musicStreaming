import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { socket } from '@/utils/socketClient'
import { loadYouTubeIframeAPI } from '@/utils/youtubeLoader'

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
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected')

  // --- Player state ---
  const [audioConsent, setAudioConsent] = useState(false)
  const [audioConsentNeeded, setAudioConsentNeeded] = useState(false)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pendingPlaybackOnConsentRef = useRef<{ song: Song; startedAt: number } | null>(null)
  const playbackRequestRef = useRef<{ videoId: string; startSeconds: number; startedAt: number } | null>(null)
  const playbackMetaRef = useRef<{ videoId: string | null; startedAt: number | null }>({
    videoId: null,
    startedAt: null,
  })
  const audioContextRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const [playerContainerReady, setPlayerContainerReady] = useState(false)
  const registerPlayerContainer = useCallback((node: HTMLDivElement | null) => {
    playerContainerRef.current = node
    if (node) {
      setPlayerContainerReady(true)
    }
  }, [])
  const [playerReady, setPlayerReady] = useState(false)
  const pendingPlayerInitRef = useRef<Promise<void> | null>(null)

  const flushPendingPlayback = useCallback(() => {
    if (!playerReady || !playerRef.current) return
    if (!playbackRequestRef.current) {
      console.log('🎬 [guest] No pending playback to flush', {
        audioConsent,
        playerReady,
        hasPlayer: !!playerRef.current,
      })
      return
    }
    const { videoId, startSeconds } = playbackRequestRef.current
    playbackRequestRef.current = null
    try {
      console.log('🎬 [guest] Starting playback via player', { videoId, startSeconds, audioConsent })
      
      // Unmute BEFORE loading video for mobile compatibility
      if (audioConsent) {
        playerRef.current.unMute?.()
        console.log('🔊 [guest] Unmuting player')
      } else {
        playerRef.current.mute?.()
        console.log('🔇 [guest] Muting player')
      }
      
      // Load and play the video
      playerRef.current.loadVideoById({ videoId, startSeconds })
      playerRef.current.playVideo?.()
    } catch (err) {
      console.error('Failed to start playback', err)
    }
  }, [audioConsent, playerReady])

  const queuePlayback = useCallback((song: Song, startedAt?: number) => {
    const videoId = extractVideoId(song)
    if (!videoId) {
      console.error('Unable to determine video ID for', song)
      return
    }
    
    // Check if we need audio consent (mobile browser policy)
    if (!audioConsent && typeof window !== 'undefined') {
      const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      if (isMobileOrTablet) {
        console.log('📱 [guest] Audio consent needed on mobile')
        pendingPlaybackOnConsentRef.current = { song, startedAt: startedAt || Date.now() }
        setAudioConsentNeeded(true)
        return
      }
    }
    
    const safeStart = startedAt || Date.now()
    const last = playbackMetaRef.current
    if (last.videoId === videoId && last.startedAt === safeStart) {
      setIsPlaying(true)
      return
    }
    const payload = {
      videoId,
      startSeconds: computeStartSeconds(safeStart),
      startedAt: safeStart,
    }
    playbackMetaRef.current = { videoId, startedAt: safeStart }
    playbackRequestRef.current = payload
    flushPendingPlayback()
    setIsPlaying(true)
  }, [audioConsent, flushPendingPlayback])

  const enableAudio = useCallback(async () => {
    if (audioConsent) return
    try {
      if (typeof window === 'undefined') return
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx()
        }
        await audioContextRef.current.resume()
        const ctx = audioContextRef.current
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.value = 0.0001
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.01)
      }
      
      // Unmute player while in user interaction context (important for mobile!)
      if (playerRef.current) {
        console.log('🔊 [guest] Unmuting player in enableAudio')
        playerRef.current.unMute?.()
      }
    } catch (err) {
      console.error('Failed to unlock audio context', err)
    } finally {
      setAudioConsent(true)
      setAudioConsentNeeded(false)
      
      // Retry pending playback if it exists
      if (pendingPlaybackOnConsentRef.current) {
        const { song, startedAt } = pendingPlaybackOnConsentRef.current
        pendingPlaybackOnConsentRef.current = null
        console.log('🔄 [guest] Retrying pending playback after audio consent')
        queuePlayback(song, startedAt)
      } else {
        flushPendingPlayback()
      }
    }
  }, [audioConsent, flushPendingPlayback, queuePlayback])

  // --- Socket.io Listeners ---
  useEffect(() => {
    if (!roomId) return

    // Connection status monitoring
    socket.on('connect', () => {
      console.log('✅ [guest] Connected to server')
      setConnectionStatus('connected')
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ [guest] Disconnected:', reason)
      setConnectionStatus('disconnected')
    })

    socket.on('reconnect_attempt', () => {
      console.log('🔄 [guest] Attempting to reconnect...')
      setConnectionStatus('reconnecting')
    })

    socket.on('reconnect', () => {
      console.log('✅ [guest] Reconnected successfully!')
      setConnectionStatus('connected')
      // Re-join room after reconnection
      const username = router.query.username as string
      if (username) {
        socket.emit('room:join', { roomId, username })
      }
    })

    socket.on('connect_error', (error) => {
      console.error('🔌 [guest] Connection error:', error)
      setConnectionStatus('disconnected')
    })

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
          playbackMetaRef.current = { videoId: null, startedAt: null }
          playerRef.current?.stopVideo?.()
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

    if (typeof window === 'undefined') return

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

  // --- Heartbeat to keep connection alive while playing ---
  useEffect(() => {
    if (!isPlaying || !roomId) {
      // Clear heartbeat when not playing
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Send heartbeat every 25 seconds while song is playing
    heartbeatIntervalRef.current = setInterval(() => {
      if (roomId) {
        socket.emit('heartbeat', { roomId })
        console.log('💓 [guest] Heartbeat sent to keep connection alive')
      }
    }, 25000)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
  }, [isPlaying, roomId])

  useEffect(() => {
    flushPendingPlayback()
  }, [flushPendingPlayback])

  useEffect(() => {
    if (playerRef.current || !playerContainerReady || !playerContainerRef.current) return
    if (pendingPlayerInitRef.current) return
    let cancelled = false
    console.log('🧩 [guest] Initialising YouTube player (eager)', {
      consent: audioConsent,
      hasContainer: !!playerContainerRef.current,
    })

    pendingPlayerInitRef.current = loadYouTubeIframeAPI()
      .then(() => {
        if (cancelled || playerRef.current || !playerContainerRef.current) return
        console.log('🧩 [guest] Creating YT.Player instance (eager)')
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          height: '0',
          width: '0',
          videoId: 'M7lc1UVf-VE',
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            mute: 1,
          },
          events: {
            onReady: () => {
              if (!cancelled) {
                console.log('🧩 [guest] Player ready (eager)')
                setPlayerReady(true)
                flushPendingPlayback()
              }
            },
            onError: (event: any) => console.error('YouTube player error', event?.data),
          },
        })
      })
      .catch((err) => {
        console.error('Failed to load YouTube iframe API', err)
      })
      .finally(() => {
        pendingPlayerInitRef.current = null
      })

    return () => {
      cancelled = true
    }
  }, [audioConsent, flushPendingPlayback, playerContainerReady])

  useEffect(() => {
    return () => {
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [])

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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-900 to-slate-900 flex items-center justify-center px-3 sm:px-4">
        <div className="text-center text-white">
          <div className="inline-block animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-purple-300 rounded-full"></div>
          </div>
          <p className="text-base sm:text-lg">Connecting to room...</p>
        </div>
      </div>
    )
  }

  // --- Render: Main Interface ---
  const nowPlaying = currentSong || (queue.length > 0 ? queue[0] : null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-white p-3 sm:p-4 lg:p-6">
      <div
        ref={registerPlayerContainer}
        className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      />

      {/* Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold backdrop-blur">
        {connectionStatus === 'connected' && (
          <>
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-green-300">Connected</span>
          </>
        )}
        {connectionStatus === 'reconnecting' && (
          <>
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-spin"></span>
            <span className="text-yellow-300">Reconnecting...</span>
          </>
        )}
        {connectionStatus === 'disconnected' && (
          <>
            <span className="inline-block w-2 h-2 bg-red-400 rounded-full"></span>
            <span className="text-red-300">Disconnected</span>
          </>
        )}
      </div>
      {!audioConsent && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-6 pt-2 pointer-events-none">
          <div className="max-w-md mx-auto bg-slate-900/90 border border-white/10 text-white rounded-3xl shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto backdrop-blur">
            <div className="text-sm md:text-base font-semibold flex items-center gap-2 justify-center text-white/80">
              <span role="img" aria-label="speaker">🔊</span>
              Enable Audio for This Session
            </div>
            <button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 rounded-2xl text-base shadow-lg hover:shadow-xl transition-all"
              onClick={enableAudio}
            >
              Enable Audio
            </button>
            <p className="text-xs md:text-sm text-white/60 text-center">
              Tap to enable playback. On some mobile browsers, you may also need to unmute the volume in your device settings or YouTube player controls.
            </p>
          </div>
        </div>
      )}
      
      <div className="w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 px-0 max-w-6xl">
        {/* Main Player Area */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6 w-full">
          {/* Music Queue Card */}
          <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-5 lg:p-6 w-full overflow-hidden">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🎵</span> <span>Music Queue</span>
            </h2>

            {/* Now Playing */}
            {nowPlaying && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-3xl p-4 sm:p-5 lg:p-6 text-white shadow-2xl border border-white/10">
                  <div className="text-xs sm:text-sm font-semibold tracking-wider mb-2 text-white/70">NOW PLAYING</div>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 line-clamp-2">{nowPlaying.title}</div>
                  <div className="text-sm sm:text-base text-white/80 mb-4 line-clamp-1">{nowPlaying.author}</div>
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <div className="w-full">
              <h3 className="font-bold text-lg sm:text-xl text-white mb-3">Queue ({queue.length})</h3>
              {queue.length === 0 ? (
                <div className="bg-white/5 rounded-3xl p-6 sm:p-8 text-center text-white/60 border border-white/10 w-full">
                  <div className="text-3xl sm:text-4xl mb-2">🎧</div>
                  <p className="text-sm sm:text-base">Waiting for host to add songs...</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 w-full">
                  {queue.map((song, idx) => {
                    const isCurrent = currentSong?.id === song.id
                    return (
                      <div
                        key={song.id}
                        className={`flex flex-col gap-3 p-3 rounded-2xl border transition-colors w-full ${
                          isCurrent
                            ? 'bg-gradient-to-r from-purple-700/30 to-indigo-700/20 border-purple-400/40 shadow-lg'
                            : 'bg-slate-900/40 border-white/5'
                        }`}
                      >
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 w-full">
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-white/70 flex-shrink-0">
                            <span className="text-base sm:text-lg font-bold w-6 sm:w-8 text-center">
                              {isCurrent ? '▶️' : idx + 1}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-white/5 whitespace-nowrap">
                              {song.duration || 'N/A'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm sm:text-base line-clamp-1">{song.title}</div>
                            <div className="text-xs sm:text-sm text-white/60 line-clamp-1">{song.author}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-5 lg:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">
              👥 Participants ({participants.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="bg-white/10 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-white font-semibold text-center text-xs sm:text-sm border border-white/10"
                >
                  {p.isHost ? '🎤' : '👥'} {p.username}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-5 lg:p-6 flex flex-col h-auto lg:h-[700px]">
          <h2 className="text-lg sm:text-xl font-bold mb-4">💬 Chat</h2>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1 sm:pr-2 max-h-[280px] sm:max-h-[360px] lg:max-h-none">
            {messages.length === 0 ? (
              <p className="text-white/50 text-center text-xs sm:text-sm">
                No messages yet. Say hello!
              </p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="text-xs sm:text-sm bg-white/5 rounded-2xl p-3 border border-white/5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-purple-300 text-xs sm:text-sm">
                      {msg.isHost ? '🎤' : ''} {msg.username}
                    </span>
                    <span className="text-xs text-white/50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white/80 ml-4 break-words text-xs sm:text-sm">
                    {msg.message}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-white/10 pt-4">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 sm:py-3 border border-white/10 rounded-2xl text-xs sm:text-sm bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-2xl font-semibold hover:opacity-90 transition text-xs sm:text-sm whitespace-nowrap"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
