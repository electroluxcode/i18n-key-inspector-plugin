# i18n-key-inspector demo

最小 Vite + 国际化项目，用于验证 i18n-key-inspector。

- vanilla JS 自带 `t()` 实现（[src/i18n.js](src/i18n.js)），已接好 `wrapWithDevKey`
- [vite.config.js](vite.config.js) 注册了 `i18nKeyInspector({ bundler: 'vite' })`
- 页面覆盖：静态 key、同一元素多条翻译（`|` 分隔）、`placeholder` / `aria-label`
  属性翻译、动态 key（`demo.status.${code}`）、语言切换

## 运行

仓库根目录执行（pnpm workspace）：

```bash
pnpm install
pnpm demo
# 打开 http://localhost:5173
```

在 DevTools Elements 面板检查：

```html
<h1 data-i18n-path="demo.title">i18n key 检查器演示</h1>
<input data-i18n-path-placeholder="demo.searchPlaceholder" placeholder="搜索订单…">
<div data-i18n-path="demo.status.pending">待处理</div>
```
