import { transformSync } from '@babel/core'

/**
 * 编译期 AST 转换(参照 code-inspector-plugin 对 JSXOpeningElement 注入
 * data-insp-* 属性的做法):
 * 遍历 JSXElement, 收集其直接子节点表达式里出现的翻译函数调用
 * (如 {$t('a.b')}), 把 key 以 attrName 属性注入到该元素的
 * JSXOpeningElement 上。
 *
 * 翻译调用识别(收敛为只看函数名, 不再配置对象名):
 * - 直接调用: 标识符 callee 名称 ∈ tNames, 如 t('a.b') / $t('a.b')
 * - 成员调用: callee 属性名 ∈ tNames, 如 i18n.t('a.b') / this.$t('a.b') /
 *   props.t('a.b') / ctx.i18n.t('a.b'), 任意对象上的 .t()/. $t() 都能覆盖;
 *   宿主可通过 tNames 传入自己的翻译函数名(默认 ['t', '$t'])
 *
 * key 解析规则:
 * - 字符串字面量: $t('a.b') -> data-i18n-path="a.b"(静态注入)
 * - 动态 key: $t(`a.${code}`) / $t('a.' + code) / $t(keyVar) 等
 *   -> 把首个参数表达式原样注入为属性值 data-i18n-path={...},
 *      由 React 在渲染时求值, 得到运行时真实 key
 *   (仅接受无副作用表达式: 模板字符串/标识符/成员访问/字符串拼接;
 *    表达式中含函数调用的跳过)
 * - 静态与动态混合时注入 {['静态key', 动态表达式].join('|')}
 * - 子节点表达式内部嵌套的 JSXElement 由其自身的访问处理, 不向上冒泡
 * - JSXFragment 不产生 DOM, 其内部的翻译调用归到最近的父元素上
 *
 * @param {string} code
 * @param {{ tNames?: string[], attrName?: string }} options
 * @returns {{ code: string, map: any } | null}
 */
export function injectI18nKey(code, options = {}) {
  const tNames = options.tNames || ['t', '$t']
  const attrName = options.attrName || 'data-i18n-path'
  let changed = false

  const result = transformSync(code, {
    sourceType: 'unambiguous',
    sourceMaps: true,
    retainLines: true, // 保持行号对齐, 减少对编辑器定位与 HMR 的干扰
    compact: false,
    parserOpts: {
      plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy']
    },
    generatorOpts: { retainLines: true, compact: false },
    plugins: [
      function i18nKeyInjectBabelPlugin({ types: t }) {
        // 翻译调用识别: 直接调用与成员调用统一按"函数名 ∈ tNames"匹配
        const isTCall = (callee) => {
          if (!callee) return false
          if (callee.type === 'Identifier') return tNames.includes(callee.name)
          if (callee.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
            return tNames.includes(callee.property.name)
          }
          return false
        }

        // 表达式内是否含函数调用(求值可能有副作用, 不适合二次求值注入)
        const hasCallInside = (node) => {
          if (!node || typeof node.type !== 'string') return false
          if (node.type === 'CallExpression' || node.type === 'NewExpression') return true
          for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'start' || key === 'end') continue
            const value = node[key]
            if (Array.isArray(value)) {
              for (const item of value) if (hasCallInside(item)) return true
            } else if (value && typeof value === 'object' && typeof value.type === 'string') {
              if (hasCallInside(value)) return true
            }
          }
          return false
        }

        // 解析 t() 首参为 key 片段: { kind: 'static', value } | { kind: 'dynamic', expr }
        const toKeyPart = (first) => {
          if (!first) return null
          if (first.type === 'StringLiteral') {
            return first.value ? { kind: 'static', value: first.value } : null
          }
          const dynamicTypes = ['TemplateLiteral', 'Identifier', 'MemberExpression', 'BinaryExpression']
          if (dynamicTypes.includes(first.type) && !hasCallInside(first)) {
            return { kind: 'dynamic', expr: first }
          }
          return null
        }

        // 遍历表达式收集 key 片段; 不进入嵌套的 JSXElement 内部(由它自己的访问注入)
        const collectKeyParts = (node, parts) => {
          if (!node || typeof node.type !== 'string') return
          if (node.type === 'CallExpression' && isTCall(node.callee)) {
            const part = toKeyPart(node.arguments?.[0])
            if (part) parts.push(part)
            return
          }
          if (node.type === 'JSXElement') return // 嵌套元素由它自己的访问注入
          for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'start' || key === 'end') continue
            const value = node[key]
            if (Array.isArray(value)) {
              for (const item of value) collectKeyParts(item, parts)
            } else if (value && typeof value === 'object' && typeof value.type === 'string') {
              // JSXFragment 不产生 DOM, 继续向下收集
              collectKeyParts(value, parts)
            }
          }
        }

        // 把 key 片段构建为属性值节点: 全静态用字符串, 含动态用 join 表达式
        const buildAttrValue = (parts) => {
          const statics = [...new Set(parts.filter((p) => p.kind === 'static').map((p) => p.value))]
          const seen = new Set()
          const dynamics = []
          for (const p of parts) {
            if (p.kind !== 'dynamic') continue
            const id = `${p.expr.start}:${p.expr.end}`
            if (seen.has(id)) continue
            seen.add(id)
            dynamics.push(t.cloneNode(p.expr, true))
          }
          if (!statics.length && dynamics.length === 1) return t.jsxExpressionContainer(dynamics[0])
          if (!dynamics.length) return t.stringLiteral(statics.join('|'))
          const items = [...statics.map((s) => t.stringLiteral(s)), ...dynamics]
          return t.jsxExpressionContainer(
            t.callExpression(t.memberExpression(t.arrayExpression(items), t.identifier('join')), [t.stringLiteral('|')])
          )
        }

        return {
          visitor: {
            JSXElement(path) {
              const { node } = path
              const parts = []
              for (const child of node.children ?? []) {
                if (child.type === 'JSXExpressionContainer') {
                  collectKeyParts(child.expression, parts)
                }
              }
              if (!parts.length) return
              const opening = node.openingElement
              if (opening.attributes.some((attr) => attr.type === 'JSXAttribute' && attr.name?.name === attrName)) {
                return
              }
              opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(attrName), buildAttrValue(parts)))
              changed = true
            }
          }
        }
      }
    ]
  })

  if (!changed || !result) return null
  return { code: result.code, map: result.map }
}
