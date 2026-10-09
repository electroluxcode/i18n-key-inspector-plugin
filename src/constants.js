/** 注入到 JSX 元素上的属性名(与 DOM 上的 data-i18n-path 对应) */
export const I18N_KEY_ATTR = 'data-i18n-path'

/** 识别为翻译函数的调用名: 直接调用 t('a.b') / $t('a.b'),
 *  以及任意对象上的成员调用 i18n.t('a.b') / this.$t('a.b')(按函数名匹配) */
export const DEFAULT_T_NAMES = ['t', '$t']

/** 参与转换的文件后缀 */
export const DEFAULT_INCLUDE_EXTS = ['.jsx', '.tsx']
