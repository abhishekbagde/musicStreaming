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
            Stream YouTube music with friends in real-time. Collaborate, chat, and enjoy music together instantly.
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
            <div className="text-2xl sm:text-3xl mb-3">🎬</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">YouTube Music Library</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Search and stream millions of songs from YouTube. Build your own playlist in real-time
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">👥</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Collaborative Control</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Host manages the room. Promote guests to co-hosts for shared playlist control
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">💬</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Live Chat & Reactions</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Chat with all participants and react to messages with emojis in real-time
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">�</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">No Accounts Needed</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Share a room link with friends. Instant access, no sign-ups required
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">⭐</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Guest Requests</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Guests can request songs. Host/co-hosts approve to add to the queue
            </p>
          </div>

          <div className="glass p-4 sm:p-6 rounded-3xl">
            <div className="text-2xl sm:text-3xl mb-3">�</div>
            <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Works Everywhere</h3>
            <p className="text-white/70 text-xs sm:text-sm">
              Desktop, tablet, mobile. All major browsers supported including Safari & Brave
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
                  Click "Start Broadcasting" and enter your display name to create your room
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base">Search & Add Songs</h4>
                <p className="text-purple-100 text-xs sm:text-sm">
                  Use the built-in YouTube search to find and add songs to your queue
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
                  Copy your room link and send to friends. No login needed for them to join
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base">Enjoy Together</h4>
                <p className="text-purple-100 text-xs sm:text-sm">
                  Everyone syncs to the same song. Chat, request songs, and enjoy music together
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white/60 text-xs sm:text-sm">
          <p>YouTube music library. Zero setup. Pure streaming joy. 🎧✨</p>
        </div>
      </div>
    </div>
  )
}
