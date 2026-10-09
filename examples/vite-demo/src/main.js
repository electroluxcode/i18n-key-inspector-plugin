import { getLang, setLang, statusKey, t } from './i18n.js'

/**
 * 演示页覆盖的场景:
 * 1. 静态 key 文本      -> <h1 data-i18n-path="demo.title">
 * 2. 同一文本多个标记   -> data-i18n-path 只保留第一个 key
 * 3. 属性翻译           -> key 写到独立的 data-i18n-path-<属性名>, 不与正文混合
 * 4. 动态 key           -> statusKey(code) 运行时拼接
 * 5. 语言切换后重渲染   -> 文案变化, key 覆盖为最新
 */
function render() {
  const app = document.getElementById('app')
  app.innerHTML = ''

  const title = document.createElement('h1')
  title.textContent = t('demo.title')
  app.appendChild(title)

  const desc = document.createElement('p')
  desc.textContent = t('demo.description')
  app.appendChild(desc)

  // 同一元素两条翻译: 标题 + 状态
  const order = document.createElement('span')
  order.textContent = `${t('demo.status.pending')} / ${t('demo.status.done')}`
  app.appendChild(order)

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = t('demo.searchPlaceholder')
  app.appendChild(input)

  // 动态 key: `demo.status.${code}`
  const dynamic = document.createElement('div')
  dynamic.id = 'status-dynamic'
  dynamic.textContent = t(statusKey('pending'))
  app.appendChild(dynamic)

  // 属性翻译: aria-label 的 key 会写到 data-i18n-path-aria-label, 正文 key 不受影响
  const submit = document.createElement('button')
  submit.id = 'submit-btn'
  submit.setAttribute('aria-label', t('demo.submit'))
  submit.textContent = t('demo.greeting')
  app.appendChild(submit)

  const switcher = document.createElement('button')
  switcher.id = 'lang-switch'
  switcher.textContent = t('demo.langSwitch')
  switcher.addEventListener('click', () => {
    setLang(getLang() === 'zh' ? 'en' : 'zh')
    render()
  })
  app.appendChild(switcher)
}

render()
