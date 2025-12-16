import type { AppProps } from 'next/app'
import Head from 'next/head'
import { usePreloadEmojis } from '@/hooks/usePreloadEmojis'
import '@/globals.css'

function AppContent({ Component, pageProps }: AppProps) {
  // Preload emoji data on app initialization
  usePreloadEmojis()
  
  return <Component {...pageProps} />
}

export default function App(props: AppProps) {
  return (
    <>
      <Head>
        <title>🎵 Music Streaming - Collaborative YouTube Music</title>
        <meta name="description" content="Enjoy synchronized YouTube music streaming with friends in real-time. Create rooms, share playlists, and listen together!" />
        <meta name="keywords" content="music streaming, youtube music, collaborative listening, real-time streaming" />
        <meta property="og:title" content="🎵 Music Streaming - Collaborative YouTube Music" />
        <meta property="og:description" content="Enjoy synchronized YouTube music streaming with friends in real-time." />
        <meta property="og:type" content="website" />
      </Head>
      <AppContent {...props} />
    </>
  )
}
