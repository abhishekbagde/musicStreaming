import { describe, it, expect, beforeEach, vi } from 'vitest'
import youtubeRouter from '../routes/youtube.js'
import youtubeSearchApi from 'youtube-search-api'

vi.mock('youtube-search-api', () => ({
  default: {
    GetListByKeyword: vi.fn(),
  },
}))

describe('YouTube search route', () => {
  const getSearchHandler = () => {
    const layer = youtubeRouter.stack.find(
      (entry) => entry.route?.path === '/search' && entry.route?.methods?.get
    )
    return layer.route.stack[0].handle
  }

  const runHandler = async (reqOverrides = {}) => {
    const handler = getSearchHandler()
    const req = {
      query: {},
      ...reqOverrides,
    }
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
        return this
      },
    }
    await handler(req, res)
    return res
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when query is missing', async () => {
    const res = await runHandler({ query: {} })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('Missing')
  })

  it('returns mapped results from YouTube API', async () => {
    youtubeSearchApi.GetListByKeyword.mockResolvedValueOnce({
      items: [
        {
          type: 'video',
          id: 'abc123',
          title: 'Demo Track',
          channelTitle: 'Artist',
          length: { simpleText: '4:00' },
          thumbnail: [{ url: 'https://img.youtube.com/vi/abc123/default.jpg' }],
        },
      ],
    })

    const res = await runHandler({ query: { q: 'demo' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0]).toMatchObject({
      id: 'abc123',
      title: 'Demo Track',
      author: 'Artist',
      duration: '4:00',
    })
    expect(youtubeSearchApi.GetListByKeyword).toHaveBeenCalledWith('demo', false, 10)
  })

  it('returns 500 when search API fails', async () => {
    youtubeSearchApi.GetListByKeyword.mockRejectedValueOnce(new Error('API down'))
    const res = await runHandler({ query: { q: 'fail' } })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('YouTube search failed')
  })

  it('filters out non-video items and handles missing fields', async () => {
    youtubeSearchApi.GetListByKeyword.mockResolvedValueOnce({
      items: [
        { type: 'channel', id: 'channel-1' }, // ignored
        {
          type: 'video',
          id: 'vid-1',
          title: 'Track',
          channelTitle: 'Artist',
          length: null,
          thumbnail: [],
        },
      ],
    })

    const res = await runHandler({ query: { q: 'mixed' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0].id).toBe('vid-1')
    expect(res.body.results[0].duration).toBeNull()
    expect(res.body.results[0].thumbnail).toBeUndefined()
  })

  it('returns empty array when YouTube API yields no videos', async () => {
    youtubeSearchApi.GetListByKeyword.mockResolvedValueOnce({ items: [] })
    const res = await runHandler({ query: { q: 'empty' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.results).toEqual([])
  })
})
