import { injectI18nKey } from './transforms/inject-i18n-key.js'
import { webpackPlugin } from './webpack/plugin.js'

const DEFAULT_T_NAMES = ['t', '$t']
const DEFAULT_INCLUDE_EXTS = ['.jsx', '.tsx']
const ATTR = 'data-i18n-path'

/**
 * i18n key 标注插件(运行时机制, 架构参照 Tolgee 的 wrapping + observer:
 * 在 t() 返回值上附加不可见字符标记, 页面内 MutationObserver 解码后
 * 在最近的父元素上打 data-i18n-path 属性, 仅开发环境生效)
 *
 * 用法:
 *   import { i18nKeyInspector } from 'i18n-key-inspector-plugin'
 *   i18nKeyInspector({ bundler: 'vite' })    // vite.config.ts
 *   i18nKeyInspector({ bundler: 'webpack' }) // next.config.ts webpack(config) 内
 *
 * 与编译期 AST 方案相比的优势:
 * - 动态 key(模板字符串/变量拼接)在运行时已解析, 100% 命中
 * - 经 props 传入组件渲染的文案(label={\$t(...)})也能命中
 * - 不需要 Babel 解析, 无编译开销
 *
 * @typedef {Object} I18nKeyInspectorOptions
 * @property {'vite'|'webpack'} [bundler] vite 插件 / webpack 插件(webpack
 *   通过入口前置注入 observer, 宿主应用需在 t() 返回值上调用 wrapWithDevKey)
 * @property {boolean} [transform] 额外启用编译期 AST 注入(默认关闭,
 *   运行时机制已覆盖静态与动态 key)
 * @property {string[]} [tNames] 翻译函数名列表(transform 模式下用于识别
 *   t() 调用: 直接调用按 callee 名匹配, 成员调用按属性名匹配, 如
 *   i18n.t / this.$t; 默认 ['t', '$t'])
 */

/**
 * MutationObserver 客户端脚本(vite 通过 transformIndexHtml 内联注入到 <head>
 * 顶部, 必须在应用代码执行前设置 flag 并启动观察者; webpack 侧为
 * runtime/observer.js 模块, 经入口前置注入, 两者逻辑保持一致)。
 * 导出以便测试环境(jsdom)中直接注入验证。
 */
export const CLIENT_CODE = String.raw`
;(function () {
  if (window.__I18N_KEY_INSPECTOR_DEV__) return
  // 必须先置 flag, 应用代码里 t() 的包装逻辑依赖它
  window.__I18N_KEY_INSPECTOR_DEV__ = true

  var ATTR = 'data-i18n-path'
  // ‌(ZWNJ)=标记开始 ‍(ZWJ)=标记结束, 由 RegExp 构造器解析转义
  var MARKER_RX = new RegExp('[\\u200c]([^\\u200c\\u200d]+)[\\u200d]', 'g')
  var HAS_MARKER_RX = new RegExp('[\\u200c\\u200d]')
  var TEXT_ATTRS = ['placeholder', 'title', 'aria-label']

  function decodeAll(text) {
    MARKER_RX.lastIndex = 0
    var keys = []
    var m
    while ((m = MARKER_RX.exec(text))) {
      if (m[1]) keys.push(m[1])
    }
    return { keys: keys, clean: keys.length ? text.replace(MARKER_RX, '') : text }
  }

  function stamp(el, keys) {
    var existing = (el.getAttribute(ATTR) || '').split('|').filter(Boolean)
    for (var i = 0; i < keys.length; i++) {
      if (existing.indexOf(keys[i]) === -1) existing.push(keys[i])
    }
    if (existing.length) el.setAttribute(ATTR, existing.join('|'))
  }

  // 属性翻译的 key 写到独立的 data-i18n-path-<属性名> 上, 不与正文 key 混合
  function stampAttr(el, name, keys) {
    var keyAttr = ATTR + '-' + name
    var existing = (el.getAttribute(keyAttr) || '').split('|').filter(Boolean)
    for (var i = 0; i < keys.length; i++) {
      if (existing.indexOf(keys[i]) === -1) existing.push(keys[i])
    }
    if (existing.length) el.setAttribute(keyAttr, existing.join('|'))
  }

  function cleanAttrs(el) {
    for (var i = 0; i < TEXT_ATTRS.length; i++) {
      var name = TEXT_ATTRS[i]
      var value = el.getAttribute && el.getAttribute(name)
      if (value && HAS_MARKER_RX.test(value)) {
        var r = decodeAll(value)
        if (r.keys.length) stampAttr(el, name, r.keys)
        el.setAttribute(name, r.clean)
      }
    }
  }

  function handleTextNode(node) {
    if (!node.data || !HAS_MARKER_RX.test(node.data)) return
    var r = decodeAll(node.data)
    node.data = r.clean
    var el = node.parentElement
    if (el) {
      if (r.keys.length) stamp(el, r.keys)
      cleanAttrs(el)
    }
  }

  // 仅带 placeholder/title 等属性的元素(如 input)没有文本节点, 需单独处理属性
  function handleElement(el) {
    cleanAttrs(el)
  }

  function walk(node) {
    if (!node) return
    if (node.nodeType === 3) {
      handleTextNode(node)
      return
    }
    if (node.nodeType !== 1) return
    handleElement(node)
    // 遍历后代: 元素节点查属性(placeholder/title 等), 文本节点查正文标记
    var walker = document.createTreeWalker(node, 5 /* SHOW_ELEMENT | SHOW_TEXT */)
    var current = walker.nextNode() // 根节点已在 handleElement 处理过
    while (current) {
      if (current.nodeType === 1) handleElement(current)
      else if (current.nodeType === 3 && current.data && HAS_MARKER_RX.test(current.data)) handleTextNode(current)
      current = walker.nextNode()
    }
  }

  var pending = []
  var scheduled = false
  function schedule(node) {
    if (pending.indexOf(node) === -1) pending.push(node)
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(function () {
      scheduled = false
      var list = pending.slice()
      pending.length = 0
      for (var i = 0; i < list.length; i++) {
        if (list[i].isConnected) walk(list[i])
      }
    })
  }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i]
      if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) schedule(m.addedNodes[j])
      } else if (m.type === 'characterData' && m.target) {
        schedule(m.target)
      } else if (m.type === 'attributes' && m.target) {
        // React 后续更新 placeholder/title 等属性时也会带上标记
        schedule(m.target)
      }
    }
  })
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TEXT_ATTRS
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      walk(document.body || document.documentElement)
    })
  } else {
    walk(document.body || document.documentElement)
  }

  console.info('[i18n-key-inspector-plugin] runtime 模式已启用: 渲染文案所在元素将带上 data-i18n-path 属性')
})()
`

/**
 * @param {Partial<I18nKeyInspectorOptions>} [userOptions]
 */
export function i18nKeyInspector(userOptions = {}) {
  const options = { bundler: 'vite', transform: false, ...userOptions }

  if (options.bundler === 'webpack') return webpackPlugin(options)

  if (options.bundler !== 'vite') {
    console.warn(`[i18n-key-inspector-plugin] 暂不支持 bundler: ${options.bundler}, 插件未启用`)
    return { name: 'i18n-key-inspector-plugin' }
  }

  const vitePlugin = {
    name: 'i18n-key-inspector-plugin',
    apply: 'serve', // 仅开发服务器, 构建产物不受影响
    transformIndexHtml(html) {
      // 注入到 <head> 顶部, 保证在应用代码执行前设置 flag 并启动观察者
      return html.replace(/<head[^>]*>/, (match) => `${match}\n<script>${CLIENT_CODE}</script>`)
    }
  }

  if (options.transform) {
    const transformOptions = {
      tNames: options.tNames || DEFAULT_T_NAMES,
      attrName: ATTR,
      include: DEFAULT_INCLUDE_EXTS
    }
    vitePlugin.enforce = 'pre' // 必须在 @vitejs/plugin-react 转换 JSX 之前拿到原始源码
    vitePlugin.transform = (code, id) => {
      const filePath = id.split('?')[0]
      if (id.includes('node_modules')) return null
      if (!transformOptions.include.some((ext) => filePath.endsWith(ext))) return null
      if (!/\$?t\(/.test(code)) return null
      try {
        return injectI18nKey(code, transformOptions)
      } catch (e) {
        console.warn(`[i18n-key-inspector-plugin] transform failed: ${filePath}`, e)
        return null
      }
    }
  }

  return vitePlugin
}

export default i18nKeyInspector
