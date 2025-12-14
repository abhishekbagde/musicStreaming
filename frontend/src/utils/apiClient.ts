// API Base URL - points to backend server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const apiClient = {
  search: async (query: string) => {
    const response = await fetch(`${API_BASE_URL}/api/youtube/search?q=${encodeURIComponent(query)}`)
    return response.json()
  },

  getAudio: (url: string) => {
    return `${API_BASE_URL}/api/youtube/audio?url=${encodeURIComponent(url)}`
  },
}

export default apiClient
