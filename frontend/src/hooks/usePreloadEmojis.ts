import { useEffect } from 'react'

/**
 * Preloads emoji picker data during page load to avoid delay when opening emoji picker
 * This runs once on app initialization to ensure emojis are ready when user clicks the button
 */
export function usePreloadEmojis() {
  useEffect(() => {
    // Start preloading emoji data immediately when the page loads
    const preloadEmojis = async () => {
      try {
        // Dynamically import the emoji picker component to trigger data loading
        const EmojiMart = await import('@emoji-mart/react')
        const emojiData = await import('@emoji-mart/data')
        
        // Log for debugging
        console.log('✨ Emoji data preloaded successfully')
      } catch (error) {
        console.warn('Failed to preload emojis, will load on-demand', error)
      }
    }

    preloadEmojis()
  }, [])
}
