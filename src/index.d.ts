export interface I18nKeyInspectorOptions {
  bundler?: 'vite' | 'webpack'
  /** 额外启用编译期 AST 注入(默认关闭, 运行时机制已覆盖) */
  transform?: boolean
  /** 翻译函数名列表(transform 模式下用于识别 t() 调用, 默认 ['t', '$t']) */
  tNames?: string[]
  /** 注入到 JSX 元素上的属性名(默认 'data-i18n-path') */
  attrName?: string
}

export function i18nKeyInspector(userOptions?: I18nKeyInspectorOptions): any
export default i18nKeyInspector
