/**
 * 编译期 AST 注入 webpack loader(由 plugin.js 在 transform: true 时挂到
 * jsx/tsx 上, enforce: 'pre' 保证先于 next/babel 拿到原始源码)。
 * 核心转换逻辑复用 transforms/inject-i18n-key.js(ESM, 经动态 import 加载)。
 */
const path = require('path')
const { pathToFileURL } = require('url')

const TRANSFORM_URL = pathToFileURL(path.resolve(__dirname, '../transforms/inject-i18n-key.js')).href
let transformPromise = null
function loadTransform() {
  if (!transformPromise) transformPromise = import(TRANSFORM_URL)
  return transformPromise
}

module.exports = function i18nKeyInjectLoader(content, map, meta) {
  const callback = this.async()
  const options = this.getOptions() || {}
  const filePath = this.resourcePath
  const include = options.include || ['.jsx', '.tsx']

  if (filePath.includes('node_modules') || !include.some((ext) => filePath.endsWith(ext))) {
    return callback(null, content, map)
  }
  if (!/\$?t\(/.test(content)) return callback(null, content, map)

  loadTransform()
    .then(({ injectI18nKey }) => {
      try {
        const result = injectI18nKey(content, {
          tNames: options.tNames || ['t', '$t'],
          attrName: options.attrName || 'data-i18n-path'
        })
        callback(null, result ? result.code : content, result ? result.map : map)
      } catch (e) {
        console.warn(`[i18n-key-inspector-plugin] transform failed: ${filePath}`, e)
        callback(null, content, map)
      }
    })
    .catch((e) => {
      console.warn(`[i18n-key-inspector-plugin] loader load failed: ${filePath}`, e)
      callback(null, content, map)
    })
}
