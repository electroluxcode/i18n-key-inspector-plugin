// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { wrapWithDevKey } from '../src/runtime/wrap.js'

const ZWNJ = '‌'
const ZWJ = '‍'

describe('wrapWithDevKey (runtime wrapper)', () => {
  beforeEach(() => {
    delete window.__I18N_KEY_INSPECTOR_DEV__
  })

  it('没有 dev flag 时原样返回(生产环境零开销)', () => {
    expect(wrapWithDevKey('demo.title', '标题')).toBe('标题')
  })

  it('dev flag 开启时在译文后附加不可见 key 标记', () => {
    window.__I18N_KEY_INSPECTOR_DEV__ = true
    expect(wrapWithDevKey('demo.title', '标题')).toBe(`标题${ZWNJ}demo.title${ZWJ}`)
  })

  it('非字符串返回值不包装(对象/React 节点等)', () => {
    window.__I18N_KEY_INSPECTOR_DEV__ = true
    const node = { $$typeof: Symbol('react.element') }
    expect(wrapWithDevKey('a.b', node)).toBe(node)
    expect(wrapWithDevKey('a.b', null)).toBe(null)
    expect(wrapWithDevKey('a.b', undefined)).toBe(undefined)
    expect(wrapWithDevKey('a.b', 42)).toBe(42)
  })

  it('空译文或空 key 不包装', () => {
    window.__I18N_KEY_INSPECTOR_DEV__ = true
    expect(wrapWithDevKey('a.b', '')).toBe('')
    expect(wrapWithDevKey('', '标题')).toBe('标题')
  })

  it('已包含标记的值不会二次包裹(格式化嵌套场景)', () => {
    window.__I18N_KEY_INSPECTOR_DEV__ = true
    const marked = `外层${ZWNJ}a.b${ZWJ}`
    expect(wrapWithDevKey('c.d', marked)).toBe(marked)
  })
})
