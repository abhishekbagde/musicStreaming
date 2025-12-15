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

  // --- Player state ---
  const [audioConsent, setAudioConsent] = useState(false)
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
  const [playerContainerReady, setPlayerContainerReady] = useState(false)
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
      console.log('🎬 [guest] Starting playback via player', { videoId, startSeconds })
      playerRef.current.loadVideoById({ videoId, startSeconds })
      playerRef.current.unMute?.()
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
  }, [flushPendingPlayback])

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
    } catch (err) {
      console.error('Failed to unlock audio context', err)
    } finally {
      setAudioConsent(true)
      triggerPendingPlayback()
      if (!playerRef.current && !pendingPlayerInitRef.current && playerContainerRef.current) {
        console.log('🧩 [guest] Consent granted, kickstarting player init')
        pendingPlayerInitRef.current = loadYouTubeIframeAPI()
          .then(() => {
            if (playerRef.current || !playerContainerRef.current) return
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
              },
              events: {
                onReady: () => {
                  console.log('🧩 [guest] Player ready (via consent init)')
                  setPlayerReady(true)
                  flushPendingPlayback()
                },
                onError: (event: any) => console.error('YouTube player error', event?.data),
              },
            })
          })
          .catch((err) => console.error('Failed to load YouTube iframe API', err))
          .finally(() => {
            pendingPlayerInitRef.current = null
          })
      }
    }
  }, [audioConsent, triggerPendingPlayback, flushPendingPlayback])

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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center text-white">
          <div className="inline-block animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-purple-300 rounded-full"></div>
          </div>
          <p className="text-lg">Connecting to room...</p>
        </div>
      </div>
    )
  }

  // --- Render: Main Interface ---
  const nowPlaying = currentSong || (queue.length > 0 ? queue[0] : null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-white p-2 sm:p-6">
      <div
        ref={registerPlayerContainer}
        className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      />
      {!audioConsent && (
        <div className="fixed inset-x-0 bottom-0 md:top-auto z-10 px-4 pb-6 pt-2 pointer-events-none">
          <div className="max-w-md mx-auto bg-slate-900/90 border border-white/10 text-white rounded-3xl shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto backdrop-blur">
            <div className="text-sm md:text-base font-semibold flex items-center gap-2 justify-center text-white/80">
              <span role="img" aria-label="speaker">🔊</span>
              Tap once to sync audio with the host
            </div>
            <button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-2 rounded-2xl text-base shadow-lg"
              onClick={enableAudio}
            >
              Enable Audio
            </button>
            <p className="text-xs md:text-sm text-white/60 text-center">
              Mobile browsers require a quick tap before playback is allowed. You only need to do this once per visit.
            </p>
          </div>
        </div>
      )}
      
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Player Area */}
        <div className="md:col-span-2 space-y-4 sm:space-y-6">
          {/* Music Queue Card */}
          <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🎵</span> <span>Music Queue</span>
            </h2>

            {/* Now Playing */}
            {nowPlaying && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-3xl p-5 sm:p-6 text-white shadow-2xl border border-white/10">
                  <div className="text-sm font-semibold tracking-wider mb-2 text-white/70">NOW PLAYING</div>
                  <div className="text-2xl font-bold mb-2 truncate">{nowPlaying.title}</div>
                  <div className="text-white/80 mb-4 truncate">{nowPlaying.author}</div>
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <div>
              <h3 className="font-bold text-lg text-white mb-3">Queue ({queue.length})</h3>
              {queue.length === 0 ? (
                <div className="bg-white/5 rounded-3xl p-8 text-center text-white/60 border border-white/10">
                  <div className="text-4xl mb-2">🎧</div>
                  <p>Waiting for host to add songs...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((song, idx) => {
                    const isCurrent = currentSong?.id === song.id
                    return (
                      <div
                        key={song.id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl border transition-colors ${
                          isCurrent
                            ? 'bg-gradient-to-r from-purple-700/30 to-indigo-700/20 border-purple-400/40 shadow-lg'
                            : 'bg-slate-900/40 border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <span className="text-lg font-bold w-8 text-center">
                            {isCurrent ? '▶️' : idx + 1}
                          </span>
                          <span className="text-xs uppercase tracking-wide px-2 py-1 rounded-full bg-white/5">
                            {song.duration || 'N/A'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{song.title}</div>
                          <div className="text-sm text-white/60 truncate">{song.author}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4 text-white">
              Participants ({participants.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className="bg-white/10 px-3 py-2 rounded-2xl text-white font-semibold text-center text-sm border border-white/10"
                >
                  {p.isHost ? '🎤' : '👥'} {p.username}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col h-auto md:h-[700px]">
          <h2 className="text-xl font-bold mb-4">💬 Chat</h2>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-white/50 text-center text-sm">
                No messages yet. Say hello!
              </p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="text-sm bg-white/5 rounded-2xl p-3 border border-white/5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-purple-300">
                      {msg.isHost ? '🎤' : ''} {msg.username}
                    </span>
                    <span className="text-xs text-white/50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white/80 ml-4">{msg.message}</p>
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
              className="flex-1 px-3 py-3 border border-white/10 rounded-2xl text-sm bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-2xl font-semibold hover:opacity-90 transition text-sm"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
