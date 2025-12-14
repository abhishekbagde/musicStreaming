import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { socket } from '@/utils/socketClient'

interface Room {
  roomId: string
  roomName: string
  hostId: string
  guestCount: number
  isLive: boolean
  createdAt: string
}

export default function BrowsePage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const fetchRooms = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
      console.log('Fetching rooms from:', `${backendUrl}/api/rooms`)
      const response = await fetch(`${backendUrl}/api/rooms`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      console.log('Rooms fetched:', data)
      setRooms(data)
      setError('')
    } catch (err) {
      console.error('Error fetching rooms:', err)
      setError(`Failed to fetch rooms: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = (roomId: string) => {
    if (!username.trim()) {
      setError('Please enter your name')
      return
    }

    socket.emit('room:join', {
      roomId,
      username: username.trim(),
    })

    socket.on('room:joined', (data) => {
      // Redirect to room page
      window.location.href = `/room/${roomId}?username=${encodeURIComponent(username)}`
    })

    socket.on('error', (data) => {
      setError(data.message)
    })

    setSelectedRoom(roomId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="inline-block text-white/70 hover:text-white mb-4"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold gradient-text mb-2">🎵 Join a Room</h1>
          <p className="text-white/70">
            Pick a live broadcast and start listening
          </p>
        </div>

        {/* Username Input */}
        <div className="glass rounded-3xl p-6 max-w-md mx-auto space-y-4">
          <label className="block text-sm uppercase tracking-widest text-white/60 font-semibold">
            Your Name
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border border-white/10 rounded-2xl bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && rooms.length > 0) {
                handleJoinRoom(rooms[0].roomId)
              }
            }}
          />
          {error && (
            <div className="bg-red-500/20 border border-red-400/40 text-red-100 px-3 py-2 rounded-2xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center text-white/70">
            <p>Loading rooms...</p>
          </div>
        )}

        {/* Rooms Grid */}
        {!loading && rooms.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center max-w-2xl mx-auto">
            <p className="text-xl text-white/80 mb-4">
              No live broadcasts at the moment.
            </p>
            <Link
              href="/"
              className="text-purple-300 hover:text-purple-100 font-bold"
            >
              Start your own broadcast →
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="glass rounded-3xl p-6 hover:shadow-purple-500/20 transition-shadow"
              >
                {/* Live Badge */}
                {room.isLive && (
                  <div className="mb-3 inline-block">
                    <span className="bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                )}

                {/* Room Info */}
                <h3 className="text-xl font-bold text-white mb-2">
                  {room.roomName}
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  {room.guestCount} listener{room.guestCount !== 1 ? 's' : ''}
                </p>

                {/* Join Button */}
                <button
                  onClick={() => handleJoinRoom(room.roomId)}
                  disabled={selectedRoom === room.roomId}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-2 px-4 rounded-2xl hover:opacity-90 transition-colors disabled:bg-white/20 disabled:text-white/60"
                >
                  {selectedRoom === room.roomId ? 'Joining...' : '▶️ Join Room'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
