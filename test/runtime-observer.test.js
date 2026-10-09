// @vitest-environment jsdom
// runtime observer 全链路: 注入客户端脚本 -> 模拟带标记的 DOM 更新 -> 断言
// data-i18n-path 打标 + 不可见字符清理(无需真实浏览器)
import { describe, it, expect, beforeAll } from 'vitest'
import { CLIENT_CODE } from '../src/index.js'

const ZWNJ = '‌'
const ZWJ = '‍'

const marked = (key, text) => `${text}${ZWNJ}${key}${ZWJ}`

// observer 通过 requestAnimationFrame 批量处理, 等两个动画帧保证已落盘
const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
  })

beforeAll(() => {
  window.eval(CLIENT_CODE)
})

describe('runtime observer (jsdom 全链路)', () => {
  it('注入脚本后设置 dev flag', () => {
    expect(window.__I18N_KEY_INSPECTOR_DEV__).toBe(true)
  })

  it('带标记的文本节点 -> 最近的父元素打 data-i18n-path, 不可见字符被清理', async () => {
    const el = document.createElement('button')
    el.textContent = marked('returns.submit', '提交')
    document.body.appendChild(el)

    await flush()

    expect(el.getAttribute('data-i18n-path')).toBe('returns.submit')
    expect(el.textContent).toBe('提交')
    expect(el.textContent).not.toContain(ZWNJ)
    expect(el.textContent).not.toContain(ZWJ)
  })

  it('同一文本内多个 key 合并为 | 分隔', async () => {
    const el = document.createElement('span')
    el.textContent = `${marked('a.title', '标题')} ${marked('a.status', '状态')}`
    document.body.appendChild(el)

    await flush()

    expect(el.getAttribute('data-i18n-path')).toBe('a.title|a.status')
    expect(el.textContent).toBe('标题 状态')
  })

  it('placeholder 属性的 key 写到独立的 data-i18n-path-placeholder, 不与正文混合', async () => {
    const input = document.createElement('input')
    input.setAttribute('placeholder', marked('demo.searchPlaceholder', '搜索订单…'))
    document.body.appendChild(input)

    await flush()

    expect(input.getAttribute('data-i18n-path-placeholder')).toBe('demo.searchPlaceholder')
    expect(input.getAttribute('placeholder')).toBe('搜索订单…')
    expect(input.hasAttribute('data-i18n-path')).toBe(false)
  })

  it('title 属性同样写到独立的 data-i18n-path-title', async () => {
    const el = document.createElement('div')
    el.setAttribute('title', marked('a.tip', '提示'))
    document.body.appendChild(el)

    await flush()

    expect(el.getAttribute('data-i18n-path-title')).toBe('a.tip')
    expect(el.getAttribute('title')).toBe('提示')
  })

  it('同一元素上正文 key 与属性 key 分开存放', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('aria-label', marked('a.submit', '提交'))
    btn.textContent = marked('a.greeting', '你好')
    document.body.appendChild(btn)

    await flush()

    expect(btn.getAttribute('data-i18n-path')).toBe('a.greeting')
    expect(btn.getAttribute('data-i18n-path-aria-label')).toBe('a.submit')
    expect(btn.getAttribute('aria-label')).toBe('提交')
    expect(btn.textContent).toBe('你好')
  })

  it('同一元素追加新 key 时不会丢失旧 key', async () => {
    const el = document.createElement('p')
    el.textContent = marked('a.first', '第一')
    document.body.appendChild(el)
    await flush()

    const child = document.createElement('b')
    child.textContent = marked('a.second', '第二')
    el.appendChild(child)
    await flush()

    // 子元素自己的 key, 以及父元素累计的 key
    expect(child.getAttribute('data-i18n-path')).toBe('a.second')
    expect(el.getAttribute('data-i18n-path')).toBe('a.first')
  })

  it('不带标记的普通文本不会被打标', async () => {
    const el = document.createElement('div')
    el.textContent = '纯文本, 无标记'
    document.body.appendChild(el)

    await flush()

    expect(el.hasAttribute('data-i18n-path')).toBe(false)
    expect(el.textContent).toBe('纯文本, 无标记')
  })
})
