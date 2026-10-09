/**
 * 运行时 key 包装(Tolgee 同款机制):
 * t() 在 dev 环境把 key 以不可见字符附加到译文上, 由页面里的
 * MutationObserver 解码后在最近的父元素上打 data-i18n-path 属性。
 *
 * 标记格式: 译文 + U+200C(ZWNJ) + key + U+200D(ZWJ)
 * ZWNJ/ZWJ 属于 Cf(格式字符): 不可见、不会被 String.prototype.trim() 去除。
 *
 * 仅当 dev server 注入的脚本设置了 window.__I18N_KEY_INSPECTOR_DEV__
 * 时才生效, 生产环境(无 flag)直接原样返回, 无任何开销。
 */

const MARKER_START = String.fromCharCode(0x200c) // U+200C ZWNJ
const MARKER_END = String.fromCharCode(0x200d) // U+200D ZWJ

/**
 * @param {string} key i18n 词条 key
 * @param {any} val t() 的返回值(仅字符串会被包装)
 * @returns {any}
 */
export function wrapWithDevKey(key, val) {
  if (typeof val !== 'string' || !val || !key || typeof window === 'undefined' || !window.__I18N_KEY_INSPECTOR_DEV__) {
    return val
  }
  if (val.indexOf(MARKER_START) !== -1) return val // 已包含标记(如格式化嵌套), 防止二次包裹
  return val + MARKER_START + key + MARKER_END
}
