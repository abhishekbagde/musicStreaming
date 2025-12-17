describe('apiClient.search', () => {
  const originalFetch = global.fetch
  const originalBase = process.env.NEXT_PUBLIC_API_URL

  const mockFetchSuccess = () =>
    jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ results: [] }),
    }) as unknown as typeof fetch

  const loadClient = async (base?: string) => {
    if (typeof base === 'undefined') {
      delete process.env.NEXT_PUBLIC_API_URL
    } else {
      process.env.NEXT_PUBLIC_API_URL = base
    }
    jest.resetModules()
    return (await import('../apiClient')).apiClient
  }

  afterEach(() => {
    global.fetch = originalFetch
    process.env.NEXT_PUBLIC_API_URL = originalBase
    jest.restoreAllMocks()
  })

  it('encodes query using custom API base', async () => {
    global.fetch = mockFetchSuccess()
    const apiClient = await loadClient('https://api.example.com')
    const data = await apiClient.search('lofi beats')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/youtube/search?q=lofi%20beats'
    )
    expect(data).toEqual({ results: [] })
  })

  it('falls back to localhost when env is unset', async () => {
    global.fetch = mockFetchSuccess()
    const apiClient = await loadClient(undefined)
    await apiClient.search('pop')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/youtube/search?q=pop'
    )
  })

  it('propagates fetch errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch
    const apiClient = await loadClient('https://api.example.com')
    await expect(apiClient.search('fails')).rejects.toThrow('network')
  })
})
