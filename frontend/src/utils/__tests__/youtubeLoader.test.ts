import * as youtubeLoader from '../youtubeLoader'

describe('YouTube loader', () => {
  beforeEach(() => {
    youtubeLoader.destroyYouTubeIframeAPI()
    delete (window as any).YT
    document.body.innerHTML = ''
  })

  it('injects script on first call and reuses promise', async () => {
    const promise = youtubeLoader.loadYouTubeIframeAPI()
    expect(document.getElementById('youtube-iframe-api')).toBeTruthy()
    const samePromise = youtubeLoader.loadYouTubeIframeAPI()
    expect(samePromise).toBe(promise)
  })

  it('resolves immediately when YT already available', async () => {
    ;(window as any).YT = { Player: jest.fn() }
    await expect(youtubeLoader.loadYouTubeIframeAPI()).resolves.toBeUndefined()
  })

  it('rejects on server side without window', async () => {
    const envSpy = jest
      .spyOn(youtubeLoader.browserEnv, 'isBrowser')
      .mockReturnValue(false)
    await expect(youtubeLoader.loadYouTubeIframeAPI()).rejects.toThrow(
      'YouTube API unavailable on server'
    )
    envSpy.mockRestore()
  })
})
