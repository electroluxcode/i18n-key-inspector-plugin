/**
 * MutationObserver 客户端(ESM 模块版, 供 webpack 插件通过入口前置注入;
 * 与 client.js 的内联字符串版本逻辑保持一致, vite 侧用字符串内联注入,
 * webpack 侧用本模块作为 entry 前置依赖注入)
 */
if (typeof window !== 'undefined' && !window.__I18N_KEY_INSPECTOR_DEV__) {
  // 必须先置 flag, 应用代码里 t() 的包装逻辑依赖它
  window.__I18N_KEY_INSPECTOR_DEV__ = true

  var ATTR = 'data-i18n-path'
  // ‌(ZWNJ)=标记开始 ‍(ZWJ)=标记结束
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

  console.info('[i18n-key-inspector] runtime 模式已启用: 渲染文案所在元素将带上 data-i18n-path 属性')
}
