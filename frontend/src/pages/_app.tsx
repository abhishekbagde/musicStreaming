import type { AppProps } from 'next/app'
import { usePreloadEmojis } from '@/hooks/usePreloadEmojis'
import '@/globals.css'

function AppContent({ Component, pageProps }: AppProps) {
  // Preload emoji data on app initialization
  usePreloadEmojis()
  
  return <Component {...pageProps} />
}

export default function App(props: AppProps) {
  return <AppContent {...props} />
}
