// SSR / 无 window 环境: wrapWithDevKey 必须原样返回, 不能抛错
import { describe, it, expect } from 'vitest'
import { wrapWithDevKey } from '../src/runtime/wrap.js'

describe('wrapWithDevKey (no window / SSR)', () => {
  it('无 window 时原样返回', () => {
    expect(typeof window).toBe('undefined')
    expect(wrapWithDevKey('demo.title', '标题')).toBe('标题')
    expect(wrapWithDevKey('demo.title', null)).toBe(null)
  })
})
