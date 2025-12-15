import React, { useState, useRef, useEffect, useCallback } from 'react'
import { socket } from '@/utils/socketClient'
import { apiClient } from '@/utils/apiClient'
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
  const [audioConsent, setAudioConsent] = useState(false)

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const playbackMetaRef = useRef<{ videoId: string | null; startedAt: number | null }>({
    videoId: null,
    startedAt: null,
  })
  const playbackRequestRef = useRef<{ videoId: string; startSeconds: number; startedAt: number } | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const [playerContainerReady, setPlayerContainerReady] = useState(false)
  const latestRoomMetaRef = useRef<{ roomId: string | null; isHost: boolean }>({ roomId: null, isHost: false })

  const registerPlayerContainer = useCallback((node: HTMLDivElement | null) => {
    playerContainerRef.current = node
    if (node) {
      setPlayerContainerReady(true)
    }
  }, [])
  const [playerReady, setPlayerReady] = useState(false)
  const pendingPlayerInitRef = useRef<Promise<void> | null>(null)
  const [playerInitAttempted, setPlayerInitAttempted] = useState(false)

  const flushPendingPlayback = useCallback(() => {
    if (!playerReady || !playerRef.current) {
      return
    }
    if (!playbackRequestRef.current) {
      console.log('🎬 No pending playback to flush', {
        audioConsent,
        playerReady,
        hasPlayer: !!playerRef.current,
      })
      return
    }
    const { videoId, startSeconds } = playbackRequestRef.current
    playbackRequestRef.current = null
    try {
      console.log('🎬 Starting playback via player', { videoId, startSeconds, audioConsent })
      
      // Unmute BEFORE loading video for mobile compatibility
      if (audioConsent) {
        playerRef.current.unMute?.()
        console.log('🔊 Unmuting player')
      } else {
        playerRef.current.mute?.()
        console.log('🔇 Muting player')
      }
      
      // Load and play the video
      playerRef.current.loadVideoById({ videoId, startSeconds })
      playerRef.current.playVideo?.()
    } catch (err) {
      console.error('Failed to start YouTube playback', err)
    }
  }, [audioConsent, playerReady])

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
    console.log('🎵 Queue updated:', data.queue?.length || 0, {
      playingFlag: data.playing,
      currentSongId: data.currentSong?.id,
      consent: audioConsent,
      playerReady,
      hasPlayer: !!playerRef.current,
    })

      if (typeof data.playing === 'boolean') {
        if (data.playing && data.currentSong) {
          const videoId = extractVideoId(data.currentSong)
          if (videoId) {
            const startedAt = data.playingFrom || Date.now()
            const startSeconds = computeStartSeconds(startedAt)
            const last = playbackMetaRef.current
            playbackMetaRef.current = { videoId, startedAt }
            setIsPlaying(true)
            if (last.videoId === videoId && last.startedAt === startedAt) {
              return
            }
            playbackRequestRef.current = { videoId, startSeconds, startedAt }
            console.log('🎬 Received playback request', {
              videoId,
              startSeconds,
              audioConsent,
              playerReady,
              hasPlayer: !!playerRef.current,
            })
            flushPendingPlayback()
          } else {
            console.error('Unable to determine video ID for', data.currentSong)
            playbackMetaRef.current = { videoId: null, startedAt: null }
            playbackRequestRef.current = null
            setIsPlaying(false)
          }
        } else {
          playbackMetaRef.current = { videoId: null, startedAt: null }
          playbackRequestRef.current = null
          setIsPlaying(false)
          playerRef.current?.stopVideo?.()
        }
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
  }, [flushPendingPlayback])

  // --- Detect if user is host ---
  useEffect(() => {
    const me = participants.find((p) => p.userId === (socket.id || 'host'))
    setIsHost(!!me?.isHost)
  }, [participants])

  useEffect(() => {
    latestRoomMetaRef.current = { roomId, isHost }
  }, [roomId, isHost])

  useEffect(() => {
    if (audioConsent && playerReady && playbackRequestRef.current && playerRef.current) {
      const { videoId, startSeconds } = playbackRequestRef.current
      playbackRequestRef.current = null
      playerRef.current.loadVideoById({ videoId, startSeconds })
      playerRef.current.playVideo?.()
    }
  }, [audioConsent, playerReady])

  useEffect(() => {
    flushPendingPlayback()
  }, [flushPendingPlayback])

  useEffect(() => {
    if (playerRef.current || !playerContainerReady || !playerContainerRef.current) return
    if (pendingPlayerInitRef.current) return
    let cancelled = false
    console.log('🧩 Initialising YouTube player (eager)', {
      consent: audioConsent,
      hasContainer: !!playerContainerRef.current,
    })

    pendingPlayerInitRef.current = loadYouTubeIframeAPI()
      .then(() => {
        if (cancelled || playerRef.current || !playerContainerRef.current) return
        console.log('🧩 Creating YT.Player instance (eager)')
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
                console.log('🧩 Player ready (eager)')
                setPlayerReady(true)
                flushPendingPlayback()
              }
            },
            onStateChange: (event: any) => {
              if (!event || typeof window === 'undefined' || !window.YT || !window.YT.PlayerState) {
                return
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                const meta = latestRoomMetaRef.current
                if (!meta.roomId || !meta.isHost) {
                  console.log('⏹️ Ignoring auto-advance - missing host context', meta)
                  return
                }
                console.log('🔁 Current song ended, requesting auto advance')
                socket.emit('song:autoAdvance', { roomId: meta.roomId })
              }
            },
            onError: (event: any) => {
              console.error('YouTube player error', event?.data)
            },
          },
        })
      })
      .catch((err) => {
        console.error('Failed to load YouTube iframe API', err)
      })
      .finally(() => {
        pendingPlayerInitRef.current = null
        setPlayerInitAttempted(true)
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
        console.log('🔊 Unmuting player in enableAudio')
        playerRef.current.unMute?.()
      }
    } catch (err) {
      console.error('Failed to unlock audio context', err)
    } finally {
      setAudioConsent(true)
      flushPendingPlayback()
    }
  }, [audioConsent, flushPendingPlayback])

  useEffect(() => {
    if (audioConsent) return
    if (typeof window === 'undefined') return
    const handler = () => {
      enableAudio()
    }
    window.addEventListener('touchend', handler, { passive: true, once: true })
    window.addEventListener('click', handler, { once: true })
    return () => {
      window.removeEventListener('touchend', handler)
      window.removeEventListener('click', handler)
    }
  }, [audioConsent, enableAudio])

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

  const handleSkip = () => {
    if (!roomId || !isHost) return
    socket.emit('song:skip', { roomId })
    console.log('⏭️ Skipped to next song')
  }

  const handlePrevious = () => {
    if (!roomId || !isHost) return
    socket.emit('song:previous', { roomId })
    console.log('⏮️ Went to previous song')
  }

  const handlePlaySpecific = (songId: string) => {
    if (!roomId || !isHost) return
    socket.emit('song:playSpecific', { roomId, songId })
    console.log('🎯 Playing requested song:', songId)
  }

  const handleTogglePlayback = () => {
    if (!roomId || !isHost) return
    if (isPlaying) {
      socket.emit('song:pause', { roomId })
      return
    }
    if (currentSong) {
      socket.emit('song:resume', { roomId })
    } else {
      socket.emit('song:play', { roomId })
    }
  }

  // --- Chat Handler ---
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !roomId) return
    socket.emit('chat:message', { roomId, message: messageInput })
    setMessageInput('')
  }

  const nowPlaying = currentSong || (queue.length > 0 ? queue[0] : null)

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-slate-900/85 border border-white/10 rounded-3xl shadow-2xl p-8 max-w-md w-full text-white">
          <h1 className="text-3xl font-bold mb-6 gradient-text">
            🎤 Start Broadcasting
          </h1>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-100 px-4 py-3 rounded-2xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-sm uppercase tracking-widest text-white/70 font-semibold mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g., My Music Night"
                className="w-full px-4 py-3 border border-white/10 rounded-2xl bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-4 rounded-2xl hover:opacity-90 transition shadow-lg"
            >
              Create Room
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-white p-2 sm:p-6">
      <div
        ref={registerPlayerContainer}
        className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      />
      
      {!audioConsent && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-6 pt-2 pointer-events-none">
          <div className="max-w-md mx-auto bg-slate-900/90 border border-white/10 text-white rounded-3xl shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto backdrop-blur">
            <div className="text-sm md:text-base font-semibold flex items-center gap-2 justify-center text-white/80">
              <span role="img" aria-label="speaker">🔊</span>
              Tap once to enable audio playback
            </div>
            <button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-2 rounded-2xl text-base shadow-lg"
              onClick={enableAudio}
            >
              Enable Audio
            </button>
            <p className="text-xs md:text-sm text-white/60 text-center">
              Mobile browsers block autoplay until you interact. Tap once to unlock playback for this session.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Area */}
        <div className="md:col-span-2 space-y-4 sm:space-y-6">
          {/* --- YouTube Search & Playlist UI --- */}
          <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span>🎵</span> <span>Music Queue</span>
            </h2>

            {/* Search Bar */}
            <form onSubmit={handleYouTubeSearch} className="mb-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search YouTube..."
                  className="flex-1 px-4 py-3 border border-white/10 rounded-2xl bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 text-base"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-2xl font-semibold transition shadow-lg text-base"
                >
                  🔍 Search
                </button>
              </div>
            </form>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mb-6 border border-white/10 rounded-2xl overflow-hidden bg-slate-950/60">
                <div className="px-4 py-2 border-b border-white/5 font-semibold text-sm text-white/70">Search Results</div>
                <ul className="max-h-[55vh] sm:max-h-72 overflow-y-auto divide-y divide-white/5">
                  {searchResults.map((song) => (
                    <li key={song.id} className="hover:bg-white/5 transition-colors p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-center gap-3 sm:flex-1">
                          {song.thumbnail && (
                            <img
                              src={song.thumbnail}
                              alt={`${song.title} thumbnail`}
                              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-semibold text-white text-sm sm:text-base break-words">{song.title}</div>
                            <div className="text-xs sm:text-sm text-white/60 break-words">{song.author}</div>
                            <div className="text-xs text-white/50">{song.duration || 'N/A'}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleAddSong(song)
                            setSearchResults([]) // Close dropdown after adding
                          }}
                          className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-2xl font-semibold w-full sm:w-32 text-center tracking-wide"
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
            {nowPlaying && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-3xl p-5 sm:p-6 text-white shadow-2xl border border-white/10">
                  <div className="text-sm font-semibold tracking-wider mb-2 text-white/70">NOW PLAYING</div>
                  <div className="text-2xl font-bold mb-2 truncate">{nowPlaying.title}</div>
                  <div className="text-white/80 mb-4 truncate">{nowPlaying.author}</div>

                  {isHost && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handlePrevious}
                        className="bg-purple-900/70 text-white px-6 py-2 rounded-2xl font-semibold hover:bg-purple-800 transition flex-1"
                      >
                        ⏮️ Previous
                      </button>
                      <button
                        onClick={handleTogglePlayback}
                        className="bg-white/90 text-purple-700 px-6 py-2 rounded-2xl font-semibold hover:bg-white transition flex-1"
                      >
                        {isPlaying ? '⏸️ Pause' : currentSong ? '▶️ Resume' : '▶️ Play'}
                      </button>
                      <button
                        onClick={handleSkip}
                        className="bg-purple-900/70 text-white px-6 py-2 rounded-2xl font-semibold hover:bg-purple-800 transition flex-1"
                      >
                        ⏭️ Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <div>
              <h3 className="font-bold text-lg text-white mb-3">Queue ({queue.length})</h3>
              {queue.length === 0 ? (
                <div className="bg-white/5 rounded-3xl p-8 text-center text-white/60 border border-white/10">
                  <div className="text-4xl mb-2">🎵</div>
                  <p>No songs in queue yet. Search and add some!</p>
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
                            : 'bg-slate-900/40 border-white/5 hover:bg-slate-900/70'
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
                        {isHost && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePlaySpecific(song.id)}
                              className={`px-3 py-2 rounded-2xl text-sm font-semibold transition ${
                                isCurrent
                                  ? 'bg-white text-purple-700'
                                  : 'bg-emerald-500/90 text-slate-950 hover:bg-emerald-400'
                              }`}
                            >
                              ▶ Play
                            </button>
                            <button
                              onClick={() => handleRemoveSong(song.id)}
                              className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-2 rounded-2xl transition"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Room Info */}
          <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-bold">🎤 Room</h2>
              <div className="text-sm text-white/60">ID: {roomId?.slice(-8)}</div>
            </div>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/browse`)
                alert('Browse link copied!')
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 px-4 rounded-2xl shadow-lg hover:opacity-90 transition mb-4"
            >
              📋 Copy Browse Link for Guests
            </button>

            {/* Participants */}
            <div>
              <h3 className="font-bold text-lg mb-3 text-white/80">Participants ({participants.length})</h3>
              {participants.length === 0 ? (
                <p className="text-white/50 text-center py-4">Waiting for guests...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <div
                      key={p.userId}
                      className="bg-white/10 text-white px-4 py-2 rounded-full font-semibold text-sm border border-white/10"
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
        <div className="bg-slate-900/70 border border-white/5 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col h-auto md:h-[720px]">
          <h2 className="text-xl font-bold mb-4">💬 Chat</h2>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1 sm:pr-2 max-h-[360px] md:max-h-none">
            {messages.length === 0 ? (
              <p className="text-white/50 text-center text-sm">
                No messages yet. Start chatting!
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
                  <p className="text-white/80 ml-4 break-words">
                    {msg.message}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
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
