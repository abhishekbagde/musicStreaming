import type { AppProps } from 'next/app'
import Head from 'next/head'
import { usePreloadEmojis } from '@/hooks/usePreloadEmojis'
import '@/globals.css'

function AppContent({ Component, pageProps }: AppProps) {
  // Preload emoji data on app initialization
  usePreloadEmojis()
  
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default function App(props: AppProps) {
  return <AppContent {...props} />
}
