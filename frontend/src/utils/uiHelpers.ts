/**
 * UI Helper Functions
 * Utilities for UI rendering, formatting, and display logic
 */

/**
 * Format participant count display
 * @param count - Number of participants
 * @returns Formatted string
 */
export const formatParticipantCount = (count: number): string => {
  if (count === 1) return '1 person'
  return `${count} people`
}

/**
 * Format song duration display
 * @param seconds - Duration in seconds
 * @returns Formatted time string (MM:SS)
 */
export const formatSongDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format queue position
 * @param position - Queue position (0-indexed)
 * @returns Display string
 */
export const formatQueuePosition = (position: number): string => {
  return `#${position + 1}`
}

/**
 * Truncate username for display
 * @param username - Username to truncate
 * @param maxLength - Max length (default 20)
 * @returns Truncated username
 */
export const truncateUsername = (username: string, maxLength: number = 20): string => {
  if (username.length <= maxLength) return username
  return `${username.substring(0, maxLength - 3)}...`
}

/**
 * Get role display text
 * @param role - Role string
 * @returns Display text
 */
export const getRoleDisplayText = (role: string): string => {
  const roleMap: Record<string, string> = {
    host: 'Host',
    cohost: 'Co-Host',
    guest: 'Guest',
  }
  return roleMap[role] || 'Unknown'
}

/**
 * Get role badge color class
 * @param role - Role string
 * @returns Tailwind color class
 */
export const getRoleBadgeColor = (role: string): string => {
  const colorMap: Record<string, string> = {
    host: 'bg-red-500 text-white',
    cohost: 'bg-orange-500 text-white',
    guest: 'bg-gray-500 text-white',
  }
  return colorMap[role] || 'bg-gray-400 text-white'
}

/**
 * Get role icon
 * @param role - Role string
 * @returns Icon string (emoji or symbol)
 */
export const getRoleIcon = (role: string): string => {
  const iconMap: Record<string, string> = {
    host: '👑',
    cohost: '⭐',
    guest: '👤',
  }
  return iconMap[role] || '•'
}

/**
 * Format chat message timestamp
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string
 */
export const formatChatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Get message type display class
 * @param isSystem - Whether message is system message
 * @returns CSS class string
 */
export const getMessageTypeClass = (isSystem: boolean): string => {
  return isSystem
    ? 'text-xs italic text-gray-500 my-1'
    : 'text-sm text-gray-800 dark:text-gray-200 my-1'
}

/**
 * Get connection status display
 * @param connected - Whether connected
 * @param isHost - Whether user is host
 * @returns Display text
 */
export const getConnectionStatus = (connected: boolean, isHost: boolean = false): string => {
  if (!connected) return 'Disconnected'
  return isHost ? 'Connected (Host)' : 'Connected'
}

/**
 * Get connection status color
 * @param connected - Whether connected
 * @returns Tailwind color class
 */
export const getConnectionStatusColor = (connected: boolean): string => {
  return connected ? 'text-green-500' : 'text-red-500'
}

/**
 * Format room info display
 * @param roomId - Room ID
 * @param participantCount - Number of participants
 * @param isActive - Whether room is active
 * @returns Display text
 */
export const formatRoomInfo = (
  roomId: string,
  participantCount: number,
  isActive: boolean
): string => {
  const status = isActive ? '🟢' : '🔴'
  return `${status} ${roomId} (${participantCount} ${participantCount === 1 ? 'listener' : 'listeners'})`
}

/**
 * Get video thumbnail URL
 * @param videoId - YouTube video ID
 * @param quality - Thumbnail quality (default, medium, high)
 * @returns Thumbnail URL
 */
export const getYoutubeThumbnailUrl = (
  videoId: string,
  quality: 'default' | 'medium' | 'high' = 'medium'
): string => {
  const qualityMap: Record<string, string> = {
    default: '0',
    medium: '1',
    high: '2',
  }
  const qualityNum = qualityMap[quality] || '1'
  return `https://img.youtube.com/vi/${videoId}/${qualityNum}.jpg`
}

/**
 * Highlight search term in text
 * @param text - Text to search in
 * @param searchTerm - Term to highlight
 * @returns Text with HTML markup (use dangerouslySetInnerHTML with care)
 */
export const highlightSearchTerm = (text: string, searchTerm: string): string => {
  if (!searchTerm) return text
  const regex = new RegExp(`(${searchTerm})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

/**
 * Get placeholder text for empty states
 * @param type - Type of empty state
 * @returns Placeholder text
 */
export const getEmptyStatePlaceholder = (type: string): string => {
  const placeholders: Record<string, string> = {
    queue: 'No songs in queue. Add one to get started!',
    participants: 'No participants yet.',
    chat: 'No messages yet. Start a conversation!',
    rooms: 'No active rooms. Create one to broadcast!',
  }
  return placeholders[type] || 'Nothing to display.'
}

/**
 * Truncate song title for display
 * @param title - Song title
 * @param maxLength - Max length (default 50)
 * @returns Truncated title
 */
export const truncateSongTitle = (title: string, maxLength: number = 50): string => {
  if (title.length <= maxLength) return title
  return `${title.substring(0, maxLength - 3)}...`
}

/**
 * Get queue position color class
 * @param position - Queue position
 * @param currentPosition - Current playing position
 * @returns CSS class string
 */
export const getQueuePositionColorClass = (
  position: number,
  currentPosition: number
): string => {
  if (position === currentPosition) {
    return 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500'
  }
  return 'hover:bg-gray-100 dark:hover:bg-gray-800'
}

/**
 * Format reaction count display
 * @param count - Number of reactions
 * @returns Display text
 */
export const formatReactionCount = (count: number): string => {
  if (count === 0) return ''
  if (count === 1) return '1'
  return count.toString()
}

/**
 * Get loading skeleton count
 * @param containerHeight - Container height in pixels
 * @param itemHeight - Item height in pixels (default 60)
 * @returns Number of skeleton items to show
 */
export const getLoadingSkeletonCount = (
  containerHeight: number,
  itemHeight: number = 60
): number => {
  return Math.max(1, Math.ceil(containerHeight / itemHeight))
}
