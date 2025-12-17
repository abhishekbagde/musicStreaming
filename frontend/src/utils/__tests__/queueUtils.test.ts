import { reorderList } from '../queueUtils'

describe('reorderList', () => {
  it('moves item when indices valid', () => {
    const original = ['a', 'b', 'c']
    const reordered = reorderList(original, 0, 2)
    expect(reordered).toEqual(['b', 'c', 'a'])
    expect(original).toEqual(['a', 'b', 'c'])
  })

  it('returns original list when indices invalid', () => {
    const original = ['a', 'b']
    expect(reorderList(original, -1, 1)).toBe(original)
    expect(reorderList(original, 0, 5)).toBe(original)
    expect(reorderList(original, 1, 1)).toBe(original)
  })
})
