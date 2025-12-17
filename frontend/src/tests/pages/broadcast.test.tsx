import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import BroadcastPage from '@/pages/broadcast'

const mockPush = jest.fn()
const emittedEvents: any[] = []
var listenerStore: { current: Record<string, Function> }

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
  }),
}))

jest.mock('@/utils/socketClient', () => {
  listenerStore = { current: {} }
  const emit = (...args: unknown[]) => {
    emittedEvents.push(args)
  }
  const socket = {
    id: 'socket-1',
    on: jest.fn((event: string, handler: Function) => {
      listenerStore.current[event] = handler
    }),
    off: jest.fn((event: string) => {
      delete listenerStore.current[event]
    }),
    emit,
  }
  return {
    __esModule: true,
    socket,
    default: socket,
    __listeners: listenerStore.current,
  }
})

jest.mock('@/utils/apiClient', () => ({
  __esModule: true,
  apiClient: {
    search: jest.fn(() => Promise.resolve({ results: [] })),
  },
  default: {
    search: jest.fn(() => Promise.resolve({ results: [] })),
  },
}))

jest.mock('@/utils/youtubeLoader', () => ({
  loadYouTubeIframeAPI: jest.fn(() => Promise.resolve()),
}))

describe('BroadcastPage start screen interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    emittedEvents.length = 0
    if (listenerStore) {
      listenerStore.current = {}
    }
    ;(window as any).YT = {
      Player: jest.fn(() => ({
        destroy: jest.fn(),
      })),
    }
    window.localStorage.clear()
    if (window.sessionStorage) {
      window.sessionStorage.clear()
    }
  })

  it('shows error when required fields are missing', () => {
    render(<BroadcastPage />)
    const roomInput = screen.getByPlaceholderText('e.g., My Music Night')
    fireEvent.change(roomInput, { target: { value: 'LoFi Lounge' } })
    fireEvent.click(screen.getByRole('button', { name: /create room/i }))
    expect(screen.getByText('Please enter your display name')).toBeInTheDocument()
    expect(emittedEvents.find(([event]) => event === 'room:create')).toBeUndefined()
  })

  it('emits room:create when form is valid', () => {
    render(<BroadcastPage />)
    fireEvent.change(screen.getByPlaceholderText('e.g., DJ Aurora'), {
      target: { value: 'DJ Test' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., My Music Night'), {
      target: { value: 'Chill Session' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create room/i }))

    expect(emittedEvents).toContainEqual([
      'room:create',
      {
        roomName: 'Chill Session',
        hostName: 'DJ Test',
      },
    ])
  })
})

describe('BroadcastPage audio consent overlay', () => {
  const setupAudioContext = () => {
    const oscillator = {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    }
    const gain = {
      gain: { value: 0 },
      connect: jest.fn(),
    }
    const ctx = {
      resume: jest.fn().mockResolvedValue(undefined),
      createOscillator: jest.fn(() => oscillator),
      createGain: jest.fn(() => gain),
      destination: {},
      currentTime: 0,
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: jest.fn(() => ctx),
    })
    return ctx
  }

  it('renders consent overlay and hides after enable', async () => {
    const audioCtx = setupAudioContext()
    const originalAddEvent = window.addEventListener
    window.addEventListener = jest.fn((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type === 'touchend' || type === 'click') {
        return
      }
      return originalAddEvent.call(window, type, listener, options as any)
    })
    render(<BroadcastPage />)
    fireEvent.change(screen.getByPlaceholderText('e.g., DJ Aurora'), {
      target: { value: 'DJ Test' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., My Music Night'), {
      target: { value: 'Chill Session' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create room/i }))
    await waitFor(() => expect(listenerStore.current['room:created']).toBeDefined())
    await act(async () => {
      listenerStore.current['room:created']?.({
        roomId: 'room-1',
        hostName: 'DJ Test',
        hostId: 'socket-1',
        roomName: 'Chill Session',
      })
    })
    await screen.findByText(/Enable Audio for This Session/i)
    fireEvent.click(screen.getByRole('button', { name: /Enable Audio/i }))
    await waitFor(() => expect(audioCtx.resume).toHaveBeenCalled())
    expect(screen.queryByText(/Enable Audio for This Session/i)).not.toBeInTheDocument()
    window.addEventListener = originalAddEvent
  })
})
