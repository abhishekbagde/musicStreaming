import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Image from 'next/image'
import { socket } from '@/utils/socketClient'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { EmojiPickerButton } from '@/components/EmojiPickerButton'
import { MessageReactions } from '@/components/MessageReactions'
import { apiClient } from '@/utils/apiClient'
import { loadYouTubeIframeAPI } from '@/utils/youtubeLoader'
import { reorderList } from '@/utils/queueUtils'
import { extractVideoId, computeStartSeconds, normalizeParticipant, normalizeParticipantList, generateMessageId, generateTimestamp } from '@/utils/commonHelpers'
import { createChatMessage, createSystemMessage, initializeMessageReactions, addReaction, removeReaction } from '@/utils/chatHelpers'
import { updateParticipantRole, promoteToCohost, demoteFromCohost, changeHost } from '@/utils/participantHelpers'
import { formatParticipantCount, getRoleDisplayText, getRoleIcon } from '@/utils/uiHelpers'

interface Song {
  id: string
  title: string
  author: string
  duration?: string
  thumbnail?: string
  url: string
}

interface SongRequest {
  id: string
  song: Song
  requestedBy: string
  requestedByName: string
  requestedAt: string
}

interface ChatMessage {
  messageId: string
  userId: string
  username: string
  message: string
  timestamp: string
  isHost: boolean
  isSystemMessage?: boolean
}

interface Participant {
  userId: string
  username: string
  isHost: boolean
  role?: 'host' | 'cohost' | 'guest' // 'cohost' = promoted guest
}

export default function RoomPage() {
  // --- Router & Query Params ---
  const router = useRouter()
  const { roomId } = router.query
  const currentRoomId = typeof roomId === 'string' ? roomId : Array.isArray(roomId) ? roomId[0] : null

  // --- Chat & Participants ---
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string[]>>>({})
  const [messageInput, setMessageInput] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [canManageSongs, setCanManageSongs] = useState(false)

  // --- User Permissions ---
  const [currentUserIsHost, setCurrentUserIsHost] = useState(false)
  const [currentUserIsCohost, setCurrentUserIsCohost] = useState(false)

  // --- Playlist State ---
  const [queue, setQueue] = useState<Song[]>([])
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [songRequests, setSongRequests] = useState<SongRequest[]>([])

  // --- Broadcast State ---
  const [isConnected, setIsConnected] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected')

  // --- Player state ---
  const [audioConsent, setAudioConsent] = useState(false)
  const [audioConsentNeeded, setAudioConsentNeeded] = useState(false)
  const pendingPlaybackOnConsentRef = useRef<{ song: Song; startedAt: number } | null>(null)
  const playbackRequestRef = useRef<{ videoId: string; startSeconds: number; startedAt: number } | null>(null)
  const playbackMetaRef = useRef<{ videoId: string | null; startedAt: number | null }>({
    videoId: null,
    startedAt: null,
  })
  const audioContextRef = useRef<AudioContext | null>(null)
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const messageInputRef = useRef<HTMLInputElement | null>(null)
  const dragSongIndexRef = useRef<number | null>(null)
  const [playerContainerReady, setPlayerContainerReady] = useState(false)
  const registerPlayerContainer = useCallback((node: HTMLDivElement | null) => {
    playerContainerRef.current = node
    if (node) {
      setPlayerContainerReady(true)
    }
  }, [])
  const [playerReady, setPlayerReady] = useState(false)
  const pendingPlayerInitRef = useRef<Promise<void> | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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
  const queuePlaybackRef = useRef(queuePlayback)

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

  const applyReactionUpdate = useCallback(
    (messageId: string, emoji: string, userId: string, action: 'add' | 'remove') => {
      if (!messageId || !emoji || !userId) return
      setMessageReactions((prev) => {
        const nextState = { ...prev }
        const current = { ...(nextState[messageId] || {}) }
        const existingUsers = current[emoji] || []
        let updatedUsers = existingUsers
        if (action === 'remove') {
          updatedUsers = existingUsers.filter((id) => id !== userId)
        } else if (!existingUsers.includes(userId)) {
          updatedUsers = [...existingUsers, userId]
        }
        if (updatedUsers.length === 0) {
          delete current[emoji]
        } else {
          current[emoji] = updatedUsers
        }
        if (Object.keys(current).length === 0) {
          delete nextState[messageId]
        } else {
          nextState[messageId] = current
        }
        return nextState
      })
    },
    []
  )
  const applyReactionUpdateRef = useRef(applyReactionUpdate)

  const handleReactToMessage = useCallback(
    (messageId: string, emoji: string, hasReacted: boolean) => {
      if (!currentRoomId || !emoji) return
      const action = hasReacted ? 'remove' : 'add'
      socket.emit('chat:reaction', { roomId: currentRoomId, messageId, emoji, action })
      const userId = socket.id
      if (userId) {
        applyReactionUpdate(messageId, emoji, userId, action)
      }
    },
    [currentRoomId, applyReactionUpdate]
  )

  useEffect(() => {
    queuePlaybackRef.current = queuePlayback
  }, [queuePlayback])

  useEffect(() => {
    applyReactionUpdateRef.current = applyReactionUpdate
  }, [applyReactionUpdate])

  // --- Socket.io Listeners ---
  useEffect(() => {
    if (!currentRoomId) return

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
      if (username && currentRoomId) {
        socket.emit('room:join', { roomId: currentRoomId, username })
      }
    })

    socket.on('connect_error', (error) => {
      console.error('🔌 [guest] Connection error:', error)
      setConnectionStatus('disconnected')
    })

    // Join room
    const username = router.query.username as string
    socket.emit('room:join', { roomId: currentRoomId, username })

    // Room joined confirmation
    socket.on('room:joined', () => {
      setIsConnected(true)
      console.log('✅ Joined room:', currentRoomId)
    })

    // Participants list update
    socket.on('participants:list', (data: any) => {
      const participantsList =
        data.participants?.map((p: any) =>
          normalizeParticipant({
            userId: p.userId,
            username: p.username,
            isHost: p.isHost,
            role: p.role,
          })
        ) || []
      setParticipants(participantsList)
      
      // Update current user's permissions based on the participants list
      const currentUser = participantsList.find((p: Participant) => p.userId === socket.id)
      if (currentUser) {
        setCurrentUserIsHost(currentUser.isHost)
        setCurrentUserIsCohost(currentUser.role === 'cohost')
      }
      
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
            normalizeParticipant({
              userId: data.userId,
              username: data.username,
              isHost: data.isHost || false,
              role: data.role,
            }),
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
          queuePlaybackRef.current?.(data.currentSong, data.playingFrom)
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
      const messageId =
        typeof data.messageId === 'string' && data.messageId.length > 0
          ? data.messageId
          : `${data.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setMessages((prev) => [...prev, { ...data, messageId }])
      setMessageReactions((prev) => {
        if (prev[messageId]) return prev
        return { ...prev, [messageId]: {} }
      })
    })

    // System message received (action logs)
    socket.on('system:message', (data: any) => {
      const systemMsg: ChatMessage = {
        messageId: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: 'system',
        username: 'System',
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        isHost: false,
        isSystemMessage: true,
      }
      setMessages((prev) => [...prev, systemMsg])
    })

    socket.on('chat:reaction', (data) => {
      if (!data?.messageId || !data?.emoji || !data?.userId) return
      const action = data.action === 'remove' ? 'remove' : 'add'
      applyReactionUpdateRef.current?.(data.messageId, data.emoji, data.userId, action)
    })

    socket.on('song:requests:update', (data) => {
      setSongRequests(data.requests || [])
    })

    // Room closed by host
    socket.on('room:closed', () => {
      alert('Host closed the room')
      router.push('/browse')
    })

    // User promoted to co-host
    socket.on('user:promoted-cohost', (data) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId ? { ...p, role: 'cohost' } : p
        )
      )
      // Update current user's state if they were promoted
      if (data.userId === socket.id) {
        setCurrentUserIsCohost(true)
      }
      console.log('⭐ User promoted to co-host:', data.userId)
    })

    // User demoted from co-host
    socket.on('user:demoted-cohost', (data) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId ? { ...p, role: 'guest' } : p
        )
      )
      // Update current user's state if they were demoted
      if (data.userId === socket.id) {
        setCurrentUserIsCohost(false)
      }
      console.log('👤 User demoted from co-host:', data.userId)
    })

    // Host changed (when previous host left and co-host was promoted)
    socket.on('host:changed', (data) => {
      const { newHostId, newHostName } = data
      
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === newHostId
            ? { ...p, isHost: true, role: 'host' }
            : { ...p, isHost: false }
        )
      )
      
      // Update current user's state if they became the new host
      if (newHostId === socket.id) {
        setCurrentUserIsHost(true)
        setCurrentUserIsCohost(false)
      } else {
        setCurrentUserIsHost(false)
      }
      
      // Request updated participants list to ensure all data is current
      if (currentRoomId) {
        socket.emit('participants:list', { roomId: currentRoomId })
      }
      
      console.log('👑 Host changed to:', newHostName)
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
      socket.off('system:message')
      socket.off('chat:reaction')
      socket.off('song:requests:update')
      socket.off('room:closed')
      socket.off('user:promoted-cohost')
      socket.off('user:demoted-cohost')
      socket.off('host:changed')
    }
  }, [currentRoomId, router])

  useEffect(() => {
    if (!currentRoomId) return
    return () => {
      socket.emit('room:leave')
    }
  }, [currentRoomId])

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

  useHeartbeat({
    isPlaying,
    roomId: currentRoomId,
    socket,
    role: 'guest',
  })

  useEffect(() => {
    flushPendingPlayback()
  }, [flushPendingPlayback])

  useEffect(() => {
    const myId = socket.id
    if (!myId) {
      setCanManageSongs(false)
      return
    }
    const me = participants.find((p) => p.userId === myId)
    setCanManageSongs(!!me && (me.isHost || me.role === 'cohost'))
  }, [participants])

  useEffect(() => {
    if (!canManageSongs) {
      setSearchResults([])
      setSearchQuery('')
    }
  }, [canManageSongs])

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

  const handleYouTubeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    try {
      const data = await apiClient.search(searchQuery)
      setSearchResults(data.results || [])
      console.log('🔍 Search results:', data.results?.length || 0)
    } catch (err) {
      console.error('YouTube search failed', err)
      setSearchResults([])
    }
  }

  const handleAddSong = (song: Song) => {
    if (!currentRoomId || !canManageSongs) return
    socket.emit('song:add', { roomId: currentRoomId, song })
  }

  const handleRemoveSong = (songId: string) => {
    if (!currentRoomId || !canManageSongs) return
    socket.emit('song:remove', { roomId: currentRoomId, songId })
  }

  const handleSkip = () => {
    if (!currentRoomId || !canManageSongs) return
    socket.emit('song:skip', { roomId: currentRoomId })
  }

  const handlePrevious = () => {
    if (!currentRoomId || !canManageSongs) return
    socket.emit('song:previous', { roomId: currentRoomId })
  }

  const handlePlaySpecific = (songId: string) => {
    if (!currentRoomId || !canManageSongs) return
    socket.emit('song:playSpecific', { roomId: currentRoomId, songId })
  }

  const reorderLocalQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => reorderList(prev, fromIndex, toIndex))
  }, [])

  const handleQueueDragStart = useCallback(
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!canManageSongs) return
      dragSongIndexRef.current = index
      setDragOverIndex(index)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    },
    [canManageSongs]
  )

  const handleQueueDragOver = useCallback(
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!canManageSongs) return
      event.preventDefault()
      if (dragOverIndex !== index) {
        setDragOverIndex(index)
      }
    },
    [canManageSongs, dragOverIndex]
  )

  const handleQueueDrop = useCallback(
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!canManageSongs) return
      event.preventDefault()
      const fromIndex = dragSongIndexRef.current
      setDragOverIndex(null)
      dragSongIndexRef.current = null
      if (fromIndex === null || fromIndex === index || !currentRoomId) return
      reorderLocalQueue(fromIndex, index)
      socket.emit('song:reorder', { roomId: currentRoomId, fromIndex, toIndex: index })
    },
    [canManageSongs, currentRoomId, reorderLocalQueue]
  )

  const handleQueueDragEnd = useCallback(() => {
    setDragOverIndex(null)
    dragSongIndexRef.current = null
  }, [])

  const handlePromoteUser = useCallback(
    (userId: string) => {
      if (!currentRoomId || !currentUserIsHost) return
      socket.emit('user:promote-cohost', { roomId: currentRoomId, userId })
    },
    [currentRoomId, currentUserIsHost]
  )

  const handleDemoteUser = useCallback(
    (userId: string) => {
      if (!currentRoomId || !currentUserIsHost) return
      socket.emit('user:demote-cohost', { roomId: currentRoomId, userId })
    },
    [currentRoomId, currentUserIsHost]
  )

  const handleApproveRequest = useCallback(
    (requestId: string) => {
      if (!currentRoomId || !canManageSongs) return
      socket.emit('song:request:approve', { roomId: currentRoomId, requestId })
    },
    [currentRoomId, canManageSongs]
  )

  const handleRejectRequest = useCallback(
    (requestId: string) => {
      if (!currentRoomId || !canManageSongs) return
      socket.emit('song:request:reject', { roomId: currentRoomId, requestId })
    },
    [currentRoomId, canManageSongs]
  )

  const handleRequestSong = useCallback(
    (song: Song) => {
      if (!currentRoomId) return
      socket.emit('song:request', { roomId: currentRoomId, song })
      console.log('📮 Requested song:', song.title)
    },
    [currentRoomId]
  )

  const handleTogglePlayback = () => {
    if (!currentRoomId || !canManageSongs) return
    if (isPlaying) {
      socket.emit('song:pause', { roomId: currentRoomId })
      return
    }
    if (currentSong) {
      socket.emit('song:resume', { roomId: currentRoomId })
    } else {
      socket.emit('song:play', { roomId: currentRoomId })
    }
  }

  const handleLeaveRoom = () => {
    if (confirm('Are you sure you want to leave this room?')) {
      socket.emit('room:leave')
      router.push('/browse')
    }
  }
  const handleInsertEmoji = useCallback((emoji: string) => {
    setMessageInput((prev) => {
      const input = messageInputRef.current
      if (input && typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number') {
        const start = input.selectionStart
        const end = input.selectionEnd
        const nextValue = prev.slice(0, start) + emoji + prev.slice(end)
        requestAnimationFrame(() => {
          const cursor = start + emoji.length
          input.setSelectionRange(cursor, cursor)
          input.focus()
        })
        return nextValue
      }
      return `${prev}${emoji}`
    })
  }, [])

  // --- Chat Handler ---
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim()) return
    if (!currentRoomId) return
    socket.emit('chat:message', { roomId: currentRoomId, message: messageInput })
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
  const currentUserId = socket.id || null

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

            <form onSubmit={handleYouTubeSearch} className="space-y-3 mb-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    canManageSongs ? 'Search YouTube to add songs...' : 'Search YouTube to request a song...'
                  }
                  className="w-full px-3 sm:px-4 py-3 border border-white/10 rounded-2xl bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm sm:text-base"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 sm:px-6 py-3 rounded-2xl font-semibold transition shadow-lg text-sm sm:text-base whitespace-nowrap"
                >
                  🔍 Search
                </button>
              </div>
              {!canManageSongs && (
                <p className="text-xs text-white/60">
                  You&apos;ll send a request for the host or co-host to approve.
                </p>
              )}
            </form>

            {searchResults.length > 0 && (
              <div className="mb-6 border border-white/10 rounded-2xl overflow-hidden bg-slate-950/60">
                <div className="px-3 sm:px-4 py-2 border-b border-white/5 font-semibold text-xs sm:text-sm text-white/70">Search Results</div>
                <ul className="max-h-[40vh] overflow-y-auto divide-y divide-white/5">
                  {searchResults.map((song) => (
                    <li key={song.id} className="p-3 hover:bg-white/5 transition-colors">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {song.thumbnail && (
                            <Image
                              src={song.thumbnail}
                              alt={`${song.title} thumbnail`}
                              width={64}
                              height={64}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-semibold text-white text-sm sm:text-base line-clamp-2">{song.title}</div>
                            <div className="text-xs sm:text-sm text-white/60 line-clamp-1">{song.author}</div>
                            <div className="text-xs text-white/50">{song.duration || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (canManageSongs) {
                                handleAddSong(song)
                              } else {
                                handleRequestSong(song)
                              }
                              setSearchResults([])
                            }}
                            className={`flex-1 px-3 py-2 rounded-2xl font-semibold text-center tracking-wide text-sm transition ${
                              canManageSongs
                                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                : 'bg-blue-500/80 text-white hover:bg-blue-400'
                            }`}
                          >
                            {canManageSongs ? '+ Add to Queue' : 'Request Song'}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Now Playing */}
            {nowPlaying && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-3xl p-4 sm:p-5 lg:p-6 text-white shadow-2xl border border-white/10">
                  <div className="text-xs sm:text-sm font-semibold tracking-wider mb-2 text-white/70">NOW PLAYING</div>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 line-clamp-2">{nowPlaying.title}</div>
                  <div className="text-sm sm:text-base text-white/80 mb-4 line-clamp-1">{nowPlaying.author}</div>
                  {canManageSongs && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <button
                        onClick={handlePrevious}
                        className="bg-purple-900/70 text-white px-4 py-2 sm:py-3 rounded-2xl font-semibold hover:bg-purple-800 transition text-sm sm:text-base"
                      >
                        ⏮️ Previous
                      </button>
                      <button
                        onClick={handleTogglePlayback}
                        className="bg-white/90 text-purple-700 px-4 py-2 sm:py-3 rounded-2xl font-semibold hover:bg-white transition text-sm sm:text-base"
                      >
                        {isPlaying ? '⏸️ Pause' : currentSong ? '▶️ Resume' : '▶️ Play'}
                      </button>
                      <button
                        onClick={handleSkip}
                        className="bg-purple-900/70 text-white px-4 py-2 sm:py-3 rounded-2xl font-semibold hover:bg-purple-800 transition text-sm sm:text-base"
                      >
                        ⏭️ Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <div className="w-full">
              <h3 className="font-bold text-lg sm:text-xl text-white mb-3">Queue ({queue.length})</h3>
              {queue.length === 0 ? (
                <div className="bg-white/5 rounded-3xl p-6 sm:p-8 text-center text-white/60 border border-white/10 w-full">
                  <div className="text-3xl sm:text-4xl mb-2">🎧</div>
                  <p className="text-sm sm:text-base">
                    {canManageSongs ? 'No songs in queue yet. Use the search above to add something!' : 'Waiting for host to add songs...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 w-full">
                  {queue.map((song, idx) => {
                    const isCurrent = currentSong?.id === song.id
                    const isDragTarget = canManageSongs && dragOverIndex === idx
                    return (
                      <div
                        key={song.id}
                        draggable={canManageSongs}
                        onDragStart={handleQueueDragStart(idx)}
                        onDragOver={handleQueueDragOver(idx)}
                        onDrop={handleQueueDrop(idx)}
                        onDragEnd={handleQueueDragEnd}
                        className={`flex flex-col gap-3 p-3 rounded-2xl border transition-colors w-full ${
                          isCurrent
                            ? 'bg-gradient-to-r from-purple-700/30 to-indigo-700/20 border-purple-400/60 shadow-lg'
                            : 'bg-slate-900/40 border-white/5'
                        } ${isDragTarget ? 'border-dashed border-purple-300/80 bg-purple-950/30' : ''} ${
                          canManageSongs ? 'cursor-grab' : ''
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
                        {canManageSongs && (
                          <div className="flex items-center gap-2 flex-wrap w-full">
                            <button
                              onClick={() => handlePlaySpecific(song.id)}
                              className={`flex-1 min-w-[80px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition ${
                                isCurrent ? 'bg-white text-purple-700' : 'bg-emerald-500/90 text-slate-950 hover:bg-emerald-400'
                              }`}
                            >
                              ▶ Play
                            </button>
                            <button
                              onClick={() => handleRemoveSong(song.id)}
                              className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-2 rounded-2xl transition text-xs sm:text-sm font-semibold"
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

            <div className="bg-slate-900/70 border border-yellow-200/10 rounded-3xl shadow-2xl p-4 sm:p-5 lg:p-6 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg sm:text-xl text-white">Song Requests ({songRequests.length})</h3>
                {canManageSongs ? (
                  <span className="text-xs text-white/50">Approve or dismiss guest suggestions</span>
                ) : (
                  <span className="text-xs text-white/50">Requests go to the host/co-host</span>
                )}
              </div>
              {songRequests.length === 0 ? (
                <div className="text-white/60 text-sm sm:text-base bg-white/5 rounded-2xl p-4 text-center border border-white/10">
                  No pending requests yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {songRequests.map((request) => {
                    const isMine = currentUserId ? request.requestedBy === currentUserId : false
                    return (
                      <div
                        key={request.id}
                        className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm sm:text-base font-semibold text-white line-clamp-1">
                              {request.song.title}
                            </div>
                            <div className="text-xs text-white/60 line-clamp-1">{request.song.author}</div>
                          </div>
                          <span className="text-xs text-white/50">
                            {new Date(request.requestedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs text-white/60">
                          Requested by{' '}
                          <span className="text-white">
                            {isMine ? 'You' : request.requestedByName || 'Guest'}
                          </span>
                        </div>
                        {canManageSongs ? (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="flex-1 min-w-[120px] bg-emerald-500/80 hover:bg-emerald-400 text-slate-950 font-semibold rounded-2xl px-3 py-2 text-sm transition"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="flex-1 min-w-[120px] bg-red-500/60 hover:bg-red-500 text-white font-semibold rounded-2xl px-3 py-2 text-sm transition"
                            >
                              ✕ Dismiss
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-white/50">
                            Waiting for host approval
                          </div>
                        )}
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
            <div className="space-y-2">
              {participants.map((p) => {
                const canManageUser = currentUserIsHost && p.userId !== currentUserId
                const isCohost = p.role === 'cohost'
                
                return (
                  <div
                    key={p.userId}
                    className="bg-white/10 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{p.isHost ? '🎤' : p.role === 'cohost' ? '⭐' : '👥'}</span>
                      <span className="truncate">{p.username}</span>
                      <span className="text-[11px] text-white/50 whitespace-nowrap">
                        ({p.isHost ? 'Host' : p.role === 'cohost' ? 'Co-Host' : 'Guest'})
                      </span>
                    </div>

                    {canManageUser && (
                      <div className="flex gap-1 flex-shrink-0">
                        {!isCohost ? (
                          <button
                            onClick={() => handlePromoteUser(p.userId)}
                            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-2 py-1 rounded text-xs transition"
                            title="Promote to Co-Host"
                          >
                            ⭐
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDemoteUser(p.userId)}
                            className="bg-slate-500/20 hover:bg-slate-500/30 text-slate-200 px-2 py-1 rounded text-xs transition"
                            title="Demote from Co-Host"
                          >
                            👥
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
              messages.map((msg) => (
                <div
                  key={msg.messageId}
                  className={`rounded-2xl p-3 border ${
                    msg.isSystemMessage
                      ? 'bg-transparent border-transparent p-1 py-1'
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  {msg.isSystemMessage ? (
                    <div className="text-xs text-white/50 italic">
                      {msg.message}
                    </div>
                  ) : (
                    <>
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
                      <MessageReactions
                        messageId={msg.messageId}
                        reactions={messageReactions[msg.messageId] || {}}
                        currentUserId={currentUserId}
                        onReact={handleReactToMessage}
                      />
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center border-t border-white/10 pt-4">
            <EmojiPickerButton onEmojiSelect={handleInsertEmoji} />
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              ref={messageInputRef}
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
