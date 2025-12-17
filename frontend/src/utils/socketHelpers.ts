/**
 * Socket Helper Functions
 * Utilities for socket event handling and connection management
 */

interface SocketEventConfig {
  eventName: string
  handler: (...args: any[]) => void
}

interface SocketEventCleanup {
  eventName: string
  handler: (...args: any[]) => void
}

/**
 * Register multiple socket event listeners
 * @param socket - Socket instance
 * @param events - Array of event configurations
 */
export const registerSocketEvents = (
  socket: any,
  events: SocketEventConfig[]
): void => {
  events.forEach(({ eventName, handler }) => {
    socket.on(eventName, handler)
  })
}

/**
 * Cleanup multiple socket event listeners
 * @param socket - Socket instance
 * @param events - Array of events to cleanup
 */
export const cleanupSocketEvents = (
  socket: any,
  events: SocketEventCleanup[]
): void => {
  events.forEach(({ eventName, handler }) => {
    socket.off(eventName, handler)
  })
}

/**
 * Emit socket event with optional data
 * @param socket - Socket instance
 * @param eventName - Event name
 * @param data - Optional data to emit
 */
export const emitSocketEvent = (
  socket: any,
  eventName: string,
  data?: any
): void => {
  if (data !== undefined) {
    socket.emit(eventName, data)
  } else {
    socket.emit(eventName)
  }
}

/**
 * Check if socket is connected
 * @param socket - Socket instance
 * @returns True if connected
 */
export const isSocketConnected = (socket: any): boolean => {
  return socket?.connected ?? false
}

/**
 * Wait for socket event once
 * @param socket - Socket instance
 * @param eventName - Event name to wait for
 * @param timeout - Optional timeout in ms
 * @returns Promise that resolves with event data
 */
export const waitForSocketEvent = (
  socket: any,
  eventName: string,
  timeout?: number
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeoutId = timeout ? setTimeout(() => reject(new Error('Socket event timeout')), timeout) : null

    socket.once(eventName, (data: any) => {
      if (timeoutId) clearTimeout(timeoutId)
      resolve(data)
    })
  })
}

/**
 * Emit socket event and wait for response
 * @param socket - Socket instance
 * @param eventName - Event name
 * @param data - Data to emit
 * @param responseEvent - Event to wait for
 * @param timeout - Optional timeout
 * @returns Promise with response data
 */
export const emitAndWait = (
  socket: any,
  eventName: string,
  data: any,
  responseEvent: string,
  timeout?: number
): Promise<any> => {
  emitSocketEvent(socket, eventName, data)
  return waitForSocketEvent(socket, responseEvent, timeout)
}

/**
 * Create socket error handler
 * @param errorCallback - Callback to handle errors
 * @returns Error handler function
 */
export const createSocketErrorHandler = (errorCallback?: (error: any) => void) => {
  return (error: any) => {
    console.error('Socket error:', error)
    if (errorCallback) {
      errorCallback(error)
    }
  }
}

/**
 * Create socket disconnect handler
 * @param disconnectCallback - Callback on disconnect
 * @returns Disconnect handler function
 */
export const createSocketDisconnectHandler = (disconnectCallback?: (reason: string) => void) => {
  return (reason: string) => {
    console.log('Socket disconnected:', reason)
    if (disconnectCallback) {
      disconnectCallback(reason)
    }
  }
}

/**
 * Handle reconnection with backoff
 * @param socket - Socket instance
 * @param maxRetries - Max reconnection attempts
 * @param baseDelay - Initial delay in ms
 * @returns Cleanup function
 */
export const setupReconnectionHandler = (
  socket: any,
  maxRetries: number = 5,
  baseDelay: number = 1000
): (() => void) => {
  let retryCount = 0

  const attemptReconnect = () => {
    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount)
      console.log(`Attempting reconnect (${retryCount + 1}/${maxRetries}) in ${delay}ms`)
      retryCount++

      setTimeout(() => {
        if (!socket.connected) {
          socket.connect()
        }
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  socket.on('disconnect', attemptReconnect)

  // Cleanup function
  return () => {
    socket.off('disconnect', attemptReconnect)
    retryCount = 0
  }
}

/**
 * Send heartbeat to keep connection alive
 * @param socket - Socket instance
 * @param interval - Interval in ms (default 25 seconds)
 * @returns Cleanup function
 */
export const setupHeartbeat = (
  socket: any,
  interval: number = 25000
): (() => void) => {
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat')
    }
  }, interval)

  return () => {
    clearInterval(heartbeatInterval)
  }
}

/**
 * Batch socket events for better performance
 * @param socket - Socket instance
 * @param eventName - Event name
 * @param data - Data items to batch
 * @param batchSize - Items per batch
 * @param delay - Delay between batches in ms
 */
export const emitBatchedEvents = (
  socket: any,
  eventName: string,
  data: any[],
  batchSize: number = 10,
  delay: number = 100
): Promise<void> => {
  return new Promise((resolve) => {
    let index = 0

    const sendBatch = () => {
      if (index >= data.length) {
        resolve()
        return
      }

      const batch = data.slice(index, index + batchSize)
      batch.forEach((item) => {
        emitSocketEvent(socket, eventName, item)
      })

      index += batchSize
      setTimeout(sendBatch, delay)
    }

    sendBatch()
  })
}

/**
 * Create socket event logger
 * @param socket - Socket instance
 * @param events - Array of events to log
 * @returns Cleanup function
 */
export const setupSocketLogger = (socket: any, events: string[]): (() => void) => {
  const logHandler = (eventName: string, data?: any) => {
    console.log(`[Socket] ${eventName}`, data)
  }

  events.forEach((eventName) => {
    socket.on(eventName, (data: any) => logHandler(eventName, data))
  })

  return () => {
    events.forEach((eventName) => {
      socket.off(eventName)
    })
  }
}
