/**
 * Participant Helper Functions
 * Utilities for participant list management and role updates
 */

interface Participant {
  userId: string
  username: string
  isHost: boolean
  role?: 'host' | 'cohost' | 'guest'
}

/**
 * Update participant role in list
 * @param participants - Current participant list
 * @param userId - Target user ID
 * @param newRole - New role to assign
 * @param newHost - Optional new host status
 * @returns Updated participant list
 */
export const updateParticipantRole = (
  participants: Participant[],
  userId: string,
  newRole: 'host' | 'cohost' | 'guest',
  newHost?: boolean
): Participant[] => {
  return participants.map((p) =>
    p.userId === userId
      ? { ...p, role: newRole, isHost: newHost !== undefined ? newHost : p.isHost }
      : p
  )
}

/**
 * Add new participant to list
 * @param participants - Current participant list
 * @param newParticipant - Participant to add
 * @returns Updated participant list
 */
export const addParticipant = (
  participants: Participant[],
  newParticipant: Participant
): Participant[] => {
  // Check if already exists
  if (participants.some((p) => p.userId === newParticipant.userId)) {
    return participants
  }
  return [...participants, newParticipant]
}

/**
 * Remove participant from list
 * @param participants - Current participant list
 * @param userId - User ID to remove
 * @returns Updated participant list
 */
export const removeParticipant = (
  participants: Participant[],
  userId: string
): Participant[] => {
  return participants.filter((p) => p.userId !== userId)
}

/**
 * Promote participant to co-host
 * @param participants - Current participant list
 * @param userId - User ID to promote
 * @returns Updated participant list
 */
export const promoteToCohost = (
  participants: Participant[],
  userId: string
): Participant[] => {
  return participants.map((p) => (p.userId === userId ? { ...p, role: 'cohost' } : p))
}

/**
 * Demote co-host to guest
 * @param participants - Current participant list
 * @param userId - User ID to demote
 * @returns Updated participant list
 */
export const demoteFromCohost = (
  participants: Participant[],
  userId: string
): Participant[] => {
  return participants.map((p) => (p.userId === userId ? { ...p, role: 'guest' } : p))
}

/**
 * Change host (when previous host leaves)
 * @param participants - Current participant list
 * @param newHostId - New host user ID
 * @returns Updated participant list
 */
export const changeHost = (
  participants: Participant[],
  newHostId: string
): Participant[] => {
  return participants.map((p) =>
    p.userId === newHostId
      ? { ...p, isHost: true, role: 'host' }
      : { ...p, isHost: false }
  )
}

/**
 * Get participant by ID
 * @param participants - Participant list
 * @param userId - User ID to find
 * @returns Participant or null
 */
export const getParticipantById = (
  participants: Participant[],
  userId: string
): Participant | null => {
  return participants.find((p) => p.userId === userId) || null
}

/**
 * Get all co-hosts
 * @param participants - Participant list
 * @returns Array of co-hosts
 */
export const getCohosts = (participants: Participant[]): Participant[] => {
  return participants.filter((p) => p.role === 'cohost')
}

/**
 * Get all guests
 * @param participants - Participant list
 * @returns Array of guests
 */
export const getGuests = (participants: Participant[]): Participant[] => {
  return participants.filter((p) => p.role === 'guest')
}

/**
 * Get host
 * @param participants - Participant list
 * @returns Host participant or null
 */
export const getHost = (participants: Participant[]): Participant | null => {
  return participants.find((p) => p.isHost) || null
}

/**
 * Can user manage songs?
 * @param participants - Participant list
 * @param userId - User to check
 * @returns True if user is host or co-host
 */
export const canManageSongs = (
  participants: Participant[],
  userId: string
): boolean => {
  const participant = getParticipantById(participants, userId)
  return participant ? participant.role === 'host' || participant.role === 'cohost' : false
}

/**
 * Get participant count by role
 * @param participants - Participant list
 * @returns Object with role counts
 */
export const getParticipantCounts = (
  participants: Participant[]
): { total: number; hosts: number; cohosts: number; guests: number } => {
  return {
    total: participants.length,
    hosts: participants.filter((p) => p.role === 'host').length,
    cohosts: participants.filter((p) => p.role === 'cohost').length,
    guests: participants.filter((p) => p.role === 'guest').length,
  }
}
