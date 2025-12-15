import React from 'react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-white">
      <div className="flex flex-col items-center justify-center min-h-screen px-3 sm:px-4 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold gradient-text mb-3 sm:mb-4">
            🎵 Music Stream
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/70 max-w-2xl mx-auto px-2">
            Share your audio with friends in real-time. No uploads, no hassle.
            Just hit play and stream.
          </p>
        </div>

        {/* Main CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 w-full sm:w-auto px-2 sm:px-0">
          <Link
            href="/broadcast"
            className="px-6 sm:px-10 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-2xl hover:opacity-90 transition shadow-2xl text-sm sm:text-base text-center"
          >
            Start Broadcasting
          </Link>
          <Link
            href="/browse"
            className="px-6 sm:px-10 py-3 sm:py-4 bg-white/10 text-white font-semibold rounded-2xl border border-white/10 hover:bg-white/20 transition shadow-2xl text-sm sm:text-base text-center"
          >
            Join Room
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 max-w-5xl mx-auto mb-8 sm:mb-10 px-2 sm:px-0 w-full">
          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">📡</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Real-time Streaming</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Broadcast audio from Spotify, Apple Music, YouTube, or any player
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">👥</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">No Login Required</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Share a room ID with friends. They click the link and start
              listening instantly
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">💬</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Live Chat</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Chat with all participants in real-time while listening
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="glass p-5 sm:p-8 rounded-3xl max-w-2xl space-y-5 sm:space-y-6 text-white w-full sm:w-auto px-3 sm:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">How It Works</h2>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base">Create a Room</h4>
                <p className="text-purple-100 text-xs sm:text-sm">
                  Click "Start Broadcasting" to create a new room
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base">Play Your Music</h4>
                <p className="text-purple-100 text-xs sm:text-sm">
                  Open Spotify, Apple Music, YouTube, or any player and press
                  play
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base">Share the Link</h4>
                <p className="text-purple-100 text-xs sm:text-sm">
                  Copy your room ID and send it to friends
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base">Everyone Listens</h4>
                <p className="text-purple-100 text-xs sm:text-sm">
                  Friends join the room and hear your music in real-time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white/60 text-xs sm:text-sm">
          <p>No uploads. No accounts. Just pure streaming magic. ✨</p>
        </div>
      </div>
    </div>
  )
}
