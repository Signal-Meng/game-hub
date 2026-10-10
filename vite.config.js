import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  /**
   * 相对路径产物：把 `/assets/xxx.js` 变成 `./assets/xxx.js`。
   *
   * 为什么必须这样：部署到 GitHub Pages 时，项目页的实际路径是
   * `https://<用户名>.github.io/<仓库名>/`，而不是根路径 `/`。
   * 默认的绝对路径会让所有资源 404（白屏）。
   *
   * 用 `'./'`（相对）而不是写成 `'/仓库名/'`，是因为它**不挑部署位置**：
   * 用户页、项目页、任意子目录、本地静态服务器都能直接跑，
   * 以后换托管平台也不用回来改配置。
   */
  base: './',

  server: {
    open: false,
  },
})
