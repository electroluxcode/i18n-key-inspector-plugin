import { describe, it, expect } from 'vitest'
import { i18nKeyInspector, CLIENT_CODE } from '../src/index.js'
import { injectI18nKey } from '../src/transforms/inject-i18n-key.js'

describe('vite plugin', () => {
  it('transformIndexHtml 把 observer 脚本注入到 <head> 内部顶部', () => {
    const plugin = i18nKeyInspector({ bundler: 'vite' })
    const html = '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="app"></div></body></html>'
    const result = plugin.transformIndexHtml(html)

    const headEnd = result.indexOf('</head>')
    const scriptStart = result.indexOf('<script>')
    const metaStart = result.indexOf('<meta charset')
    expect(scriptStart).toBeGreaterThan(-1)
    expect(scriptStart).toBeGreaterThan(result.indexOf('<head'))
    expect(scriptStart).toBeLessThan(metaStart)
    expect(scriptStart).toBeLessThan(headEnd)
    expect(result).toContain(CLIENT_CODE)
    // 必须自设 flag
    expect(result).toContain('window.__I18N_KEY_INSPECTOR_DEV__ = true')
  })

  it('默认仅 apply 到 serve, 不影响构建产物', () => {
    const plugin = i18nKeyInspector()
    expect(plugin.apply).toBe('serve')
    expect(plugin.name).toBe('i18n-key-inspector')
  })

  it('transform 模式: 静态 key 注入到 JSX 元素', () => {
    const plugin = i18nKeyInspector({ bundler: 'vite', transform: true })
    const code = `export default function App() { return <button className="ok">{t('returns.submit')}</button> }`
    const result = plugin.transform(code, '/src/App.tsx')
    expect(result).not.toBeNull()
    expect(result.code).toContain('data-i18n-path="returns.submit"')
  })

  it('transform 模式: 动态 key 原样注入为运行时表达式', () => {
    const plugin = i18nKeyInspector({ bundler: 'vite', transform: true })
    const code = 'export default function App({ code }) { return <div>{t(`demo.status.${code}`)}</div> }'
    const result = plugin.transform(code, '/src/App.tsx')
    expect(result).not.toBeNull()
    expect(result.code).toContain('data-i18n-path={')
    expect(result.code).toContain('`demo.status.${code}`')
  })

  it('transform 模式: 成员调用 i18n.t / this.$t 均可识别', () => {
    const plugin = i18nKeyInspector({ bundler: 'vite', transform: true })
    const member = plugin.transform('const A = () => <p>{i18n.t("a.b")}</p>', '/src/A.jsx')
    expect(member.code).toContain('data-i18n-path="a.b"')
    const thisT = plugin.transform('const B = () => <p>{this.$t("c.d")}</p>', '/src/B.jsx')
    expect(thisT.code).toContain('data-i18n-path="c.d"')
  })

  it('transform 模式: 非 jsx/tsx 文件与 node_modules 返回 null', () => {
    const plugin = i18nKeyInspector({ bundler: 'vite', transform: true })
    expect(plugin.transform('const x = t("a.b")', '/src/App.js')).toBeNull()
    expect(plugin.transform('const x = <p>{t("a.b")}</p>', '/node_modules/pkg/index.jsx')).toBeNull()
  })

  it('webpack bundler 返回 webpack 插件对象', () => {
    const plugin = i18nKeyInspector({ bundler: 'webpack' })
    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('i18n-key-inspector')
  })

  it('不支持的 bundler 打警告并返回占位插件', () => {
    const warnings = []
    const originalWarn = console.warn
    console.warn = (msg) => warnings.push(msg)
    try {
      const plugin = i18nKeyInspector({ bundler: 'rollup' })
      expect(plugin.name).toBe('i18n-key-inspector')
    } finally {
      console.warn = originalWarn
    }
    expect(warnings.some((w) => w.includes('rollup'))).toBe(true)
  })
})

describe('injectI18nKey (compile-time AST)', () => {
  it('同一元素多条翻译用 | 合并', () => {
    const code = 'const A = () => <span>{t("a.title")}{t("a.status")}</span>'
    const result = injectI18nKey(code, {})
    expect(result.code).toContain('data-i18n-path="a.title|a.status"')
  })

  it('字符串拼接 key 动态注入', () => {
    const code = 'const A = ({ k }) => <span>{t("a." + k)}</span>'
    const result = injectI18nKey(code, {})
    expect(result.code).toContain('data-i18n-path={')
    expect(result.code).toContain('"a." + k')
  })

  it('已有同名属性的元素跳过', () => {
    const code = 'const A = () => <span data-i18n-path="x.y">{t("a.b")}</span>'
    const result = injectI18nKey(code, {})
    expect(result).toBeNull()
  })

  it('无翻译调用的 JSX 返回 null', () => {
    const result = injectI18nKey('const A = () => <span>hello</span>', {})
    expect(result).toBeNull()
  })
})
