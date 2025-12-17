import { useEffect, useRef } from 'react'

export type HeartbeatRole = 'host' | 'guest'

export type SocketLike = {
  emit: (event: string, payload: unknown) => void
}

type UseHeartbeatOptions = {
  isPlaying: boolean
  roomId?: string | null
  socket: SocketLike
  role?: HeartbeatRole
  intervalMs?: number
}

const DEFAULT_INTERVAL_MS = 25000

export function useHeartbeat({
  isPlaying,
  roomId,
  socket,
  role = 'host',
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseHeartbeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!isPlaying || !roomId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const logLabel =
      role === 'guest'
        ? '💓 [guest] Heartbeat sent to keep connection alive'
        : '💓 Heartbeat sent to keep connection alive'

    intervalRef.current = setInterval(() => {
      if (!roomId) return
      socket.emit('heartbeat', { roomId })
      console.log(logLabel)
    }, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [intervalMs, isPlaying, role, roomId, socket])
}
