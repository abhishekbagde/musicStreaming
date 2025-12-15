declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: (() => void) | null
    __youtubeIframeAPIPromise?: Promise<void>
  }
}

const YOUTUBE_SCRIPT_ID = 'youtube-iframe-api'

export const loadYouTubeIframeAPI = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API unavailable on server'))
  }

  if (window.YT && window.YT.Player) {
    return Promise.resolve()
  }

  if (window.__youtubeIframeAPIPromise) {
    return window.__youtubeIframeAPIPromise
  }

  window.__youtubeIframeAPIPromise = new Promise<void>((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      resolve()
    }

    if (!document.getElementById(YOUTUBE_SCRIPT_ID)) {
      const tag = document.createElement('script')
      tag.id = YOUTUBE_SCRIPT_ID
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      document.body.appendChild(tag)
    }
  })

  return window.__youtubeIframeAPIPromise
}

export const destroyYouTubeIframeAPI = () => {
  delete window.__youtubeIframeAPIPromise
}

export {}
