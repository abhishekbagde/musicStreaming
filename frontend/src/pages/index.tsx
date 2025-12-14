import React from 'react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-white">
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 space-y-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-extrabold gradient-text mb-4">
            🎵 Music Stream
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
            Share your audio with friends in real-time. No uploads, no hassle.
            Just hit play and stream.
          </p>
        </div>

        {/* Main CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Link
            href="/broadcast"
            className="px-10 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-2xl hover:opacity-90 transition shadow-2xl"
          >
            Start Broadcasting
          </Link>
          <Link
            href="/browse"
            className="px-10 py-4 bg-white/10 text-white font-semibold rounded-2xl border border-white/10 hover:bg-white/20 transition shadow-2xl"
          >
            Join Room
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          <div className="glass p-6 rounded-3xl">
            <div className="text-3xl mb-3">📡</div>
            <h3 className="text-white font-semibold mb-2">Real-time Streaming</h3>
            <p className="text-white/70 text-sm">
              Broadcast audio from Spotify, Apple Music, YouTube, or any player
            </p>
          </div>

          <div className="glass p-6 rounded-3xl">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="text-white font-semibold mb-2">No Login Required</h3>
            <p className="text-white/70 text-sm">
              Share a room ID with friends. They click the link and start
              listening instantly
            </p>
          </div>

          <div className="glass p-6 rounded-3xl">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="text-white font-semibold mb-2">Live Chat</h3>
            <p className="text-white/70 text-sm">
              Chat with all participants in real-time while listening
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="glass p-8 rounded-3xl max-w-2xl space-y-6 text-white">
          <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="text-white font-bold">Create a Room</h4>
                <p className="text-purple-100 text-sm">
                  Click "Start Broadcasting" to create a new room
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="text-white font-bold">Play Your Music</h4>
                <p className="text-purple-100 text-sm">
                  Open Spotify, Apple Music, YouTube, or any player and press
                  play
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="text-white font-bold">Share the Link</h4>
                <p className="text-purple-100 text-sm">
                  Copy your room ID and send it to friends
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h4 className="text-white font-bold">Everyone Listens</h4>
                <p className="text-purple-100 text-sm">
                  Friends join the room and hear your music in real-time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white/60 text-sm">
          <p>No uploads. No accounts. Just pure streaming magic. ✨</p>
        </div>
      </div>
    </div>
  )
}
