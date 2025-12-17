/**
 * Chat Helper Functions
 * Utilities for message creation and handling
 */

interface ChatMessage {
  messageId: string
  userId: string
  username: string
  message: string
  timestamp: string
  isHost: boolean
  isSystemMessage?: boolean
}

/**
 * Create a regular chat message object
 * @param data - Message data from socket
 * @returns Formatted ChatMessage
 */
export const createChatMessage = (
  data: Partial<ChatMessage> & { messageId?: string; userId: string; timestamp?: string }
): ChatMessage => {
  const messageId =
    typeof data.messageId === 'string' && data.messageId.length > 0
      ? data.messageId
      : `${data.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    messageId,
    userId: data.userId,
    username: data.username || 'Unknown',
    message: data.message || '',
    timestamp: data.timestamp || new Date().toISOString(),
    isHost: data.isHost || false,
  }
}

/**
 * Create a system message object
 * Used for action logs (user joined, song added, etc.)
 * @param message - System message text
 * @param timestamp - Optional timestamp
 * @returns Formatted ChatMessage (system type)
 */
export const createSystemMessage = (message: string, timestamp?: string): ChatMessage => {
  return {
    messageId: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'system',
    username: 'System',
    message,
    timestamp: timestamp || new Date().toISOString(),
    isHost: false,
    isSystemMessage: true,
  }
}

/**
 * Initialize empty message reactions object
 * @param messageId - Message ID
 * @returns Empty reactions map
 */
export const initializeMessageReactions = (messageId: string) => {
  return { [messageId]: {} }
}

/**
 * Add reaction to message
 * @param currentReactions - Current reactions map
 * @param messageId - Message to react to
 * @param emoji - Emoji reaction
 * @param userId - User adding reaction
 * @returns Updated reactions
 */
export const addReaction = (
  currentReactions: Record<string, Record<string, string[]>>,
  messageId: string,
  emoji: string,
  userId: string
): Record<string, Record<string, string[]>> => {
  const reactions = { ...currentReactions }
  if (!reactions[messageId]) reactions[messageId] = {}
  if (!reactions[messageId][emoji]) reactions[messageId][emoji] = []

  if (!reactions[messageId][emoji].includes(userId)) {
    reactions[messageId][emoji].push(userId)
  }

  return reactions
}

/**
 * Remove reaction from message
 * @param currentReactions - Current reactions map
 * @param messageId - Message to remove reaction from
 * @param emoji - Emoji reaction
 * @param userId - User removing reaction
 * @returns Updated reactions
 */
export const removeReaction = (
  currentReactions: Record<string, Record<string, string[]>>,
  messageId: string,
  emoji: string,
  userId: string
): Record<string, Record<string, string[]>> => {
  const reactions = { ...currentReactions }
  if (reactions[messageId]?.[emoji]) {
    reactions[messageId][emoji] = reactions[messageId][emoji].filter((id) => id !== userId)
    if (reactions[messageId][emoji].length === 0) {
      delete reactions[messageId][emoji]
    }
  }

  return reactions
}

/**
 * Check if user has reacted with emoji
 * @param reactions - Reactions map
 * @param messageId - Message ID
 * @param emoji - Emoji to check
 * @param userId - User ID
 * @returns True if user has reacted with this emoji
 */
export const hasUserReacted = (
  reactions: Record<string, Record<string, string[]>>,
  messageId: string,
  emoji: string,
  userId: string
): boolean => {
  return reactions[messageId]?.[emoji]?.includes(userId) || false
}
