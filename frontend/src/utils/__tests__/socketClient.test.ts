const originalEnv = process.env.NEXT_PUBLIC_SOCKET_URL

describe('socket client', () => {
  afterEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_SOCKET_URL = originalEnv
  })

  it('uses fallback URL when env missing', async () => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL
    const mockIo = jest.fn()
    jest.doMock('socket.io-client', () => ({
      __esModule: true,
      default: mockIo,
    }))
    await import('../socketClient')
    expect(mockIo).toHaveBeenCalledWith('http://localhost:3001', expect.any(Object))
  })

  it('passes reconnection options', async () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = 'https://example.com'
    const mockIo = jest.fn()
    jest.doMock('socket.io-client', () => ({
      __esModule: true,
      default: mockIo,
    }))
    jest.resetModules()
    await import('../socketClient')
    expect(mockIo).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    }))
  })
})
