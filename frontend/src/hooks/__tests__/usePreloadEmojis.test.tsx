import React from 'react'
import { render, waitFor } from '@testing-library/react'
import {
  preloadEmojiData,
  resetEmojiPreloadForTests,
  usePreloadEmojis,
} from '../usePreloadEmojis'
import type { EmojiLoader } from '../usePreloadEmojis'

describe('usePreloadEmojis / preloadEmojiData', () => {
  beforeEach(() => {
    resetEmojiPreloadForTests()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('caches loader promise so imports happen once', async () => {
    let resolve: () => void = () => {}
    const loader = jest.fn<ReturnType<EmojiLoader>, Parameters<EmojiLoader>>(
      () =>
        new Promise<void>((res) => {
          resolve = res
        })
    )

    const firstPromise = preloadEmojiData(loader)
    const secondPromise = preloadEmojiData(loader)
    expect(firstPromise).toBe(secondPromise)
    expect(loader).toHaveBeenCalledTimes(1)

    resolve()
    await expect(firstPromise).resolves.toBeUndefined()
  })

  it('retries when the loader rejects', async () => {
    const loader: jest.MockedFunction<EmojiLoader> = jest.fn()
    loader.mockRejectedValueOnce(new Error('network down'))
    loader.mockResolvedValueOnce(undefined)

    await expect(preloadEmojiData(loader)).rejects.toThrow('network down')

    const retryPromise = preloadEmojiData(loader)
    await expect(retryPromise).resolves.toBeUndefined()
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('only runs loader once even if multiple components use the hook', async () => {
    const loader: jest.MockedFunction<EmojiLoader> = jest.fn(() =>
      Promise.resolve()
    )
    const HookUser = () => {
      usePreloadEmojis({ loader })
      return null
    }

    render(
      <>
        <HookUser />
        <HookUser />
      </>
    )

    await waitFor(() => {
      expect(loader).toHaveBeenCalledTimes(1)
    })
  })
})
