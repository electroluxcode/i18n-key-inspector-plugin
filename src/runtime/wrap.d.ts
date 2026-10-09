/**
 * dev 环境把 i18n key 以不可见字符(U+200C/U+200D)附加到译文上,
 * 由 vite 插件注入的 MutationObserver 解码后在最近父元素上打 data-i18n-path。
 * 生产环境(无 window.__I18N_KEY_INSPECTOR_DEV__ flag)原样返回。
 */
export function wrapWithDevKey(key: string, val: any): any
