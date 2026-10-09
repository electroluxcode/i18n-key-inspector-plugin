import { wrapWithDevKey } from 'i18n-key-inspector/runtime'

/**
 * 最小 i18n 实现: 词典 + t()。
 * 唯一要求: 在真正查词条的 t() 里用 wrapWithDevKey 包一次返回值,
 * 开发环境下译文会带上不可见 key 标记, 由插件注入的 observer 解码。
 */
const dict = {
  zh: {
    'demo.title': 'i18n key 检查器演示',
    'demo.description': '打开 DevTools 检查元素上的 data-i18n-path 属性',
    'demo.submit': '提交',
    'demo.searchPlaceholder': '搜索订单…',
    'demo.langSwitch': '切换到 English',
    'demo.status.pending': '待处理',
    'demo.status.done': '已完成',
    'demo.greeting': '你好，世界'
  },
  en: {
    'demo.title': 'i18n key inspector demo',
    'demo.description': 'Open DevTools and inspect the data-i18n-path attribute',
    'demo.submit': 'Submit',
    'demo.searchPlaceholder': 'Search orders…',
    'demo.langSwitch': 'Switch to 中文',
    'demo.status.pending': 'Pending',
    'demo.status.done': 'Done',
    'demo.greeting': 'Hello, world'
  }
}

let lang = 'zh'

export function setLang(next) {
  lang = next
}

export function getLang() {
  return lang
}

/** 动态 key 场景: 状态码 -> 词条 key 在运行时才确定 */
export function statusKey(code) {
  return `demo.status.${code}`
}

export function t(key) {
  const value = dict[lang][key] ?? key
  return wrapWithDevKey(key, value)
}
