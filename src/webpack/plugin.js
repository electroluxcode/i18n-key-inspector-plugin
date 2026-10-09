import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 编译期 AST 注入 loader(可选, transform: true 时启用)
export const LOADER_PATH = path.resolve(__dirname, './loader.cjs')
// runtime observer 入口(前置到应用入口前执行, 设置 __I18N_KEY_INSPECTOR_DEV__ flag)
export const OBSERVER_ENTRY = path.resolve(__dirname, '../runtime/observer.js')

/**
 * 把注入模块前置到 webpack entry 上, 支持函数/对象/数组/字符串形式
 * (参照 next.config 中 polyfill 入口前置的既有做法)
 */
function prependEntry(entry, inject) {
  if (typeof entry === 'function') {
    return async () => prependEntry(await entry(), inject)
  }
  if (typeof entry === 'string') return [inject, entry]
  if (Array.isArray(entry)) return entry[0] === inject ? entry : [inject, ...entry]
  if (entry && typeof entry === 'object') {
    // webpack entry descriptors keep metadata such as dependOn alongside import.
    // Only import is an entry; transforming dependOn makes webpack look for the
    // observer as a dependency entry and fails with "entry was not found".
    if (Object.prototype.hasOwnProperty.call(entry, 'import')) {
      return { ...entry, import: prependEntry(entry.import, inject) }
    }

    const result = {}
    for (const key of Object.keys(entry)) {
      result[key] = prependEntry(entry[key], inject)
    }
    return result
  }
  return entry
}

/**
 * webpack 插件(仅开发环境生效, 架构参照 @code-inspector/webpack:
 * 推入 module rules + 入口前置注入客户端代码)
 *
 * @param {{ transform?: boolean, tNames?: string[], attrName?: string, include?: string[] }} options
 */
export function webpackPlugin(options = {}) {
  return {
    name: 'i18n-key-inspector-plugin',
    apply(compiler) {
      const mode = compiler.options.mode || process.env.NODE_ENV
      if (mode !== 'development') return
      // 跳过 SSR/edge 编译: observer 依赖 DOM, 仅客户端构建需要
      const name = compiler.options.name || ''
      const target = String(compiler.options.target || '')
      if (/server|edge/i.test(name) || /^node|^async-node/.test(target)) return

      // runtime observer: 入口前置注入, 保证 flag 在应用代码执行前设置
      compiler.options.entry = prependEntry(compiler.options.entry, OBSERVER_ENTRY)

      // 可选编译期 AST 注入(必须在 next/babel 转换 JSX 之前拿到原始源码)
      if (options.transform) {
        compiler.options.module.rules.push({
          test: /\.(jsx|tsx)$/,
          exclude: /node_modules/,
          enforce: 'pre',
          use: [
            {
              loader: LOADER_PATH,
              options: {
                tNames: options.tNames,
                attrName: options.attrName,
                include: options.include
              }
            }
          ]
        })
      }
    }
  }
}
