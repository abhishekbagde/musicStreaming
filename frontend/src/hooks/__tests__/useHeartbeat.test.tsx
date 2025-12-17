import { renderHook, act } from '@testing-library/react'
import { useHeartbeat } from '../useHeartbeat'
import type { HeartbeatRole, SocketLike } from '../useHeartbeat'

describe('useHeartbeat', () => {
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  const renderHeartbeat = (props: {
    isPlaying: boolean
    roomId?: string | null
    role?: HeartbeatRole
    intervalMs?: number
  }) => {
    const emitMock = jest.fn()
    const socket: SocketLike = {
      emit: emitMock,
    }

    const hook = renderHook(
      (hookProps) =>
        useHeartbeat({
          socket,
          ...hookProps,
        }),
      { initialProps: props }
    )

    return { socket, hook, emitMock }
  }

  it('emits heartbeat on an interval for host variant', () => {
    const { hook, emitMock } = renderHeartbeat({
      isPlaying: true,
      roomId: 'room-123',
      role: 'host',
      intervalMs: 500,
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(emitMock).toHaveBeenCalledWith('heartbeat', { roomId: 'room-123' })

    hook.rerender({
      isPlaying: false,
      roomId: 'room-123',
      role: 'host',
      intervalMs: 500,
    })

    emitMock.mockClear()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(emitMock).not.toHaveBeenCalled()
  })

  it('logs guest specific label and clears when room missing', () => {
    const { hook, emitMock } = renderHeartbeat({
      isPlaying: true,
      roomId: 'guest-room',
      role: 'guest',
      intervalMs: 400,
    })

    act(() => {
      jest.advanceTimersByTime(400)
    })

    expect(emitMock).toHaveBeenCalledWith('heartbeat', { roomId: 'guest-room' })
    expect(logSpy).toHaveBeenCalledWith(
      '💓 [guest] Heartbeat sent to keep connection alive'
    )

    hook.rerender({
      isPlaying: true,
      roomId: null,
      role: 'guest',
      intervalMs: 400,
    })
    emitMock.mockClear()

    act(() => {
      jest.advanceTimersByTime(800)
    })

    expect(emitMock).not.toHaveBeenCalled()
  })

  it('does nothing when playback never starts', () => {
    const { emitMock } = renderHeartbeat({
      isPlaying: false,
      roomId: 'room-1',
      role: 'host',
      intervalMs: 600,
    })

    act(() => {
      jest.advanceTimersByTime(1200)
    })

    expect(emitMock).not.toHaveBeenCalled()
  })
})
