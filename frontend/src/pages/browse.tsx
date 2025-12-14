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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="inline-block text-white hover:text-purple-200 mb-4"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">🎵 Join a Room</h1>
          <p className="text-purple-100">
            Pick a live broadcast and start listening
          </p>
        </div>

        {/* Username Input */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 max-w-md mx-auto">
          <label className="block text-gray-700 font-bold mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && rooms.length > 0) {
                handleJoinRoom(rooms[0].roomId)
              }
            }}
          />
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center text-white">
            <p>Loading rooms...</p>
          </div>
        )}

        {/* Rooms Grid */}
        {!loading && rooms.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center max-w-2xl mx-auto">
            <p className="text-xl text-gray-600 mb-4">
              No live broadcasts at the moment.
            </p>
            <Link
              href="/"
              className="text-purple-600 hover:text-purple-700 font-bold"
            >
              Start your own broadcast →
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                {/* Live Badge */}
                {room.isLive && (
                  <div className="mb-3 inline-block">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                )}

                {/* Room Info */}
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {room.roomName}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {room.guestCount} listener{room.guestCount !== 1 ? 's' : ''}
                </p>

                {/* Join Button */}
                <button
                  onClick={() => handleJoinRoom(room.roomId)}
                  disabled={selectedRoom === room.roomId}
                  className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
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
