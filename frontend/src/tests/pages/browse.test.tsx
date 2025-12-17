import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BrowsePage from '@/pages/browse'

const emittedEvents: any[] = []
var listenerStore: { current: Record<string, Function> }
const originalFetch = global.fetch

jest.mock('@/utils/socketClient', () => {
  listenerStore = { current: {} }
  const socket = {
    emit: (...args: unknown[]) => emittedEvents.push(args),
    on: jest.fn((event: string, handler: Function) => {
      listenerStore.current[event] = handler
    }),
  }
  return {
    __esModule: true,
    socket,
    default: socket,
    __listeners: listenerStore.current,
  }
})

describe('BrowsePage interactions', () => {
  const mockRooms = [
    { roomId: 'room-1', roomName: 'Chill', hostId: 'host', guestCount: 2, isLive: true, createdAt: '' },
  ]

  beforeEach(() => {
    emittedEvents.length = 0
    if (listenerStore) {
      listenerStore.current = {}
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRooms),
    } as any)
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('shows error when joining without name', async () => {
    render(<BrowsePage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const joinButton = await screen.findByRole('button', { name: /join room/i })
    fireEvent.click(joinButton)
    expect(screen.getByText('Please enter your name')).toBeInTheDocument()
    expect(emittedEvents.find(([event]) => event === 'room:join')).toBeUndefined()
  })

  it('emits join when username provided', async () => {
    render(<BrowsePage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    fireEvent.change(screen.getByPlaceholderText('Enter your name'), {
      target: { value: 'Guest' },
    })
    const joinButton = await screen.findByRole('button', { name: /join room/i })
    fireEvent.click(joinButton)
    expect(emittedEvents).toContainEqual(['room:join', { roomId: 'room-1', username: 'Guest' }])
  })
})
