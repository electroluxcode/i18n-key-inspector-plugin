# i18n-key-inspector

[中文](./README.md) | [English](./README.en.md)

Dev-time i18n key annotation tool. It writes the translation key onto the final
rendered DOM element as a `data-i18n-path` attribute, so you can trace rendered
text back to its message key in browser DevTools.

## How it works

Borrowed from Tolgee's wrapping + observer approach, in two steps:

1. **Marking**: the `t()` return value is wrapped by `wrapWithDevKey`, which
   appends the key to the translation as invisible characters:

   ```
   translation + U+200C(ZWNJ) + key + U+200D(ZWJ)
   ```

   ZWNJ / ZWJ are format characters: invisible on the page and not stripped by
   `trim()`.

2. **Decoding**: the plugin injects a script into the page that sets the
   `window.__I18N_KEY_INSPECTOR_DEV__` flag and starts a MutationObserver. On DOM
   changes the script decodes the key from text nodes and the `placeholder`,
   `title`, `aria-label` attributes, writes it to the `data-i18n-path` attribute
   of the nearest element, then strips the invisible characters.

Benefits of this design:

- Annotation happens at runtime, so dynamic keys (variable concatenation) and
  translations passed through props are all covered.
- `wrapWithDevKey` checks the flag internally, so business code can call it
  unconditionally; in production, without the flag, it returns the value as-is
  with zero overhead.
- The optional `transform: true` compile-time AST injection is a supplement,
  not a requirement.

## Getting started

### 1. Wrap the `t()` return value in your i18n implementation

```ts
import { wrapWithDevKey } from 'i18n-key-inspector/runtime'

function t(key: string, lang?: string) {
  const value = lookupTranslation(key, lang)
  return wrapWithDevKey(key, value)
}
```

You only need to wrap once, in the `t()` implementation that actually looks up
messages. Without this step the plugin still starts the observer, but the page
has no key markers to decode.

### 2. Vite

Add the plugin in `vite.config.ts`:

```ts
import { i18nKeyInspector } from 'i18n-key-inspector'

export default defineConfig({
  plugins: [
    i18nKeyInspector({ bundler: 'vite' })
  ]
})
```

In Vite mode the observer is injected into the `<head>` of the dev page via
`transformIndexHtml`.

### 3. Next.js / webpack

Add the webpack plugin to the client-side dev compilation in `next.config.ts`:

```ts
import { i18nKeyInspector } from 'i18n-key-inspector'

const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  webpack(config, { isServer }) {
    if (isDev && !isServer) {
      config.plugins.push(i18nKeyInspector({ bundler: 'webpack' }))
    }
    return config
  }
}

export default nextConfig
```

In webpack mode the observer entry is prepended to the client entry. Server,
edge and production compilations are skipped automatically, so there is no need
to inject a script manually in `_document.tsx`.

## Optional: compile-time AST injection

The default runtime mode already covers dynamic keys, string concatenation and
translations passed through props, so no extra configuration is usually needed.
To also annotate static JSX calls at compile time, enable `transform`:

```ts
i18nKeyInspector({
  bundler: 'vite',
  transform: true
})

i18nKeyInspector({
  bundler: 'webpack',
  transform: true
})
```

The compile-time mode only processes `.jsx` / `.tsx` source files and skips
`node_modules`. It complements the runtime mode rather than replacing it; keep
`wrapWithDevKey` in the app so dynamic keys and translations produced at
runtime are still annotated.

Translation calls are recognized by function name only (`tNames`), no object
name configuration needed:

- Direct call: `t('a.b')` / `$t('a.b')`
- Member call: `.t()` / `.$t()` on any object, e.g. `i18n.t('a.b')`,
  `this.$t('a.b')`, `props.t('a.b')`

## Options

| Option | Default | Description |
| --- | --- | --- |
| `bundler` | `'vite'` | `'vite'` or `'webpack'` |
| `transform` | `false` | Additionally enable compile-time AST injection |
| `tNames` | `['t', '$t']` | Translation function names (used to match t() calls in transform mode) |

## Example output

```html
<button data-i18n-path="returns.submit">Submit</button>
```

When one element contains multiple translations, keys are joined with `|`:

```html
<span data-i18n-path="returns.title|returns.status">...</span>
```

Text content and the `placeholder`, `title`, `aria-label` attributes are
currently handled. Text keys are written to `data-i18n-path`; attribute
translation keys go to the corresponding `data-i18n-path-<attr>` attribute,
kept separate from text keys:

```html
<button data-i18n-path="demo.greeting" data-i18n-path-aria-label="demo.submit" aria-label="Submit">
  Hello
</button>
<input data-i18n-path-placeholder="demo.searchPlaceholder" placeholder="Search orders…">
```

## Testing

pnpm is the package manager (the repo is a pnpm workspace; the demo lives in
`examples/vite-demo`).

```bash
pnpm install
pnpm test     # Unit tests (vitest + jsdom)
pnpm demo     # Start the demo project (minimal Vite + i18n), inspect data-i18n-path in DevTools
```

Unit tests need no browser and cover:

- `wrapWithDevKey`: with/without the dev flag, non-string and empty values,
  protection against double wrapping, SSR (no window)
- Vite plugin: `transformIndexHtml` observer injection, transform-mode static/
  dynamic key injection for JSX
- Full runtime observer pipeline (jsdom): invisible markers in text nodes and
  `placeholder` / `title` attributes decoded into `data-i18n-path`, invisible
  characters cleaned up

`examples/vite-demo` is a minimal Vite + i18n project (vanilla JS with its own
`t()`, already wired to `wrapWithDevKey` and the plugin), covering static keys,
multi-key merging, attribute translations, dynamic keys and language switching
for manual verification: run `pnpm demo` and open http://localhost:5173.

## FAQ

### The page has no `data-i18n-path`

Check the following:

- You are on the dev server, not a production build.
- The webpack/Next config registers the plugin only in the client compilation.
- The `t()` return value goes through `wrapWithDevKey(key, value)`.
- The browser console shows `[i18n-key-inspector] runtime 模式已启用`.
- The return value is a non-empty string; objects, React nodes and nullish
  values are not annotated by the runtime wrapper.

### Next.js fails with `entry was not found`

Do not manually wire the observer into the webpack entry's `dependOn`. Use:

```ts
config.plugins.push(i18nKeyInspector({ bundler: 'webpack' }))
```

The plugin preserves the webpack entry descriptor's `dependOn`, `filename` and
other metadata, and only adds the observer to `import`.

## API exports

- `i18n-key-inspector`: `i18nKeyInspector`
- `i18n-key-inspector/runtime`: `wrapWithDevKey`
