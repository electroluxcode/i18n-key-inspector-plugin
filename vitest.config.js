import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 默认 node 环境; 需要 DOM 的用例通过文件内 `@vitest-environment jsdom` 注释切换
    environment: 'node',
    environmentOptions: {
      jsdom: {
        // pretendToBeVisual 提供 requestAnimationFrame, observer 依赖它批量处理
        pretendToBeVisual: true
      }
    },
    include: ['test/**/*.test.js']
  }
})
