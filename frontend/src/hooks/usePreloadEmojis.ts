import { useEffect } from 'react'

export type EmojiLoader = () => Promise<void>

const defaultLoader: EmojiLoader = async () => {
  await import('@emoji-mart/react')
  await import('@emoji-mart/data')
}

let preloadPromise: Promise<void> | null = null

export function preloadEmojiData(loader: EmojiLoader = defaultLoader) {
  if (!preloadPromise) {
    preloadPromise = loader()
      .then(() => {
        console.log('✨ Emoji data preloaded successfully')
      })
      .catch((error) => {
        console.warn('Failed to preload emojis, will load on-demand', error)
        preloadPromise = null
        throw error
      })
  }
  return preloadPromise
}

export function resetEmojiPreloadForTests() {
  if (process.env.NODE_ENV === 'test') {
    preloadPromise = null
  }
}

/**
 * Preloads emoji picker data during page load to avoid delay when opening emoji picker
 * This runs once on app initialization to ensure emojis are ready when user clicks the button
 */
export function usePreloadEmojis(options?: { loader?: EmojiLoader }) {
  const loader = options?.loader

  useEffect(() => {
    preloadEmojiData(loader).catch(() => {
      // Loader errors are already logged inside preloadEmojiData
    })
  }, [loader])
}
