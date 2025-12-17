/**
 * Common Helper Functions
 * Shared utilities used across broadcast.tsx and room/[roomId].tsx
 */

interface Participant {
  userId: string
  username: string
  isHost: boolean
  role?: 'host' | 'cohost' | 'guest'
}

interface Song {
  id: string
  title: string
  author: string
  duration?: string
  thumbnail?: string
  url: string
}

/**
 * Normalize participant data with proper role assignment
 * @param participant - Raw participant data
 * @returns Normalized participant with guaranteed role
 */
export const normalizeParticipant = (participant: Participant): Participant => ({
  ...participant,
  role: participant.role || (participant.isHost ? 'host' : 'guest'),
})

/**
 * Extract YouTube video ID from song object
 * Handles multiple formats: direct ID, YouTube URL, or song.url
 * @param song - Song object with id or url
 * @returns YouTube video ID or null
 */
export const extractVideoId = (song: Song | null): string | null => {
  if (!song) return null

  // Check if it's already a valid YouTube video ID
  if (song.id && /^[a-zA-Z0-9_-]{8,15}$/.test(song.id)) {
    return song.id
  }

  // Try to extract from URL
  if (song.url) {
    try {
      const parsed = new URL(song.url)
      const fromQuery = parsed.searchParams.get('v')
      if (fromQuery) return fromQuery

      const segments = parsed.pathname.split('/')
      const last = segments[segments.length - 1]
      if (last) return last
    } catch (err) {
      console.warn('Failed to parse YouTube URL', err)
    }
  }

  return song.id || null
}

/**
 * Normalize list of participants
 * @param participants - Array of participant data
 * @returns Array of normalized participants
 */
export const normalizeParticipantList = (participants: Participant[]): Participant[] => {
  return (participants || []).map((p) => normalizeParticipant(p))
}

/**
 * Generate unique message ID
 * Used for both regular and system messages
 * @param prefix - Prefix for message type (e.g., 'system', 'user')
 * @returns Unique message ID
 */
export const generateMessageId = (prefix: string = ''): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

/**
 * Generate timestamp string
 * @returns ISO timestamp string
 */
export const generateTimestamp = (): string => new Date().toISOString()

/**
 * Safely get nested object property
 * @param obj - Object to access
 * @param path - Property path (e.g., 'user.name')
 * @param defaultValue - Default if not found
 * @returns Value or default
 */
export const getNestedProperty = <T = any>(
  obj: any,
  path: string,
  defaultValue: T = null as T
): T => {
  const keys = path.split('.')
  let result: any = obj

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      return defaultValue
    }
  }

  return result as T
}

/**
 * Sanitize username for display
 * @param username - Raw username
 * @returns Sanitized username (1-50 chars)
 */
export const sanitizeUsername = (username: string): string => {
  return (username || 'Guest').trim().substring(0, 50)
}

/**
 * Calculate elapsed seconds from timestamp
 * Used for playback synchronization
 * @param startedAt - Millisecond timestamp
 * @returns Elapsed seconds (minimum 0)
 */
export const computeStartSeconds = (startedAt?: number): number => {
  if (!startedAt) return 0
  const elapsedMs = Date.now() - startedAt
  return Math.max(0, Math.floor(elapsedMs / 1000))
}
