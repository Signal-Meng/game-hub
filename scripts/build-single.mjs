/**
 * 单文件构建：把整个应用压成一个 `game-hub.html`。
 *
 * 为什么需要它
 * ------------
 * 常规 `dist/` 是 `index.html` + `assets/*.js` + `assets/*.css`，必须靠 HTTP 服务器才能跑。
 * 而这个应用是**纯静态 + 全部状态在 localStorage**，本可以脱离服务器；
 * 单文件把「浏览器能打开的东西」和「需要服务器的东西」之间那道墙拆掉：
 *
 *   - 双击即可运行（`file://`），不需要装任何东西、连网都不需要
 *   - 一个文件就是全部：发给学生、拷进 U 盘、丢进任何静态空间，都不会散架
 *   - 上传到任意免费静态托管时也只需这一个文件
 *
 * 为什么输出 IIFE 而不是默认的 ESM
 * --------------------------------
 * `file://` 打开的文档 origin 是**不透明源（opaque origin）**，
 * 内联的 `<script type="module">` 属于模块脚本，存在被 CORS 策略拦下的风险。
 * IIFE 是经典脚本，执行路径最可预测 —— 所以这里强制 `format: 'iife'`。
 * （本脚本末尾会用真实浏览器从 `file://` 加载验证，不靠推断。）
 *
 * 用法：`npm run build:single` → 产出 `dist-single/game-hub.html`
 */
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist-single')
const tmpDir = path.join(root, '.single-tmp')

const fmtSize = (n) => `${(n / 1024).toFixed(0)} KB`

async function main() {
  console.log('▸ 步骤 1/2  以 IIFE 格式构建…')
  await build({
    root,
    configFile: false, // 不用项目 vite.config.js，下面显式声明需要的部分
    logLevel: 'warn',
    plugins: [react()],
    build: {
      outDir: '.single-tmp',
      emptyOutDir: true,
      // 关键三项：
      //   format: 'iife'          → 经典脚本，规避 file:// 的 module CORS 问题
      //   inlineDynamicImports   → 必须单块，动态 import 会产出额外的 chunk
      //   assetsInlineLimit: ∞   → 任何静态资源都转成 data URI 内联
      cssCodeSplit: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      modulePreload: false,
      rollupOptions: {
        output: {
          format: 'iife',
          inlineDynamicImports: true,
          entryFileNames: 'app.js',
          assetFileNames: 'app.[ext]',
        },
      },
    },
  })

  const jsPath = path.join(tmpDir, 'app.js')
  const cssPath = path.join(tmpDir, 'app.css')
  if (!fs.existsSync(jsPath)) {
    throw new Error(`构建产物缺失：${jsPath}`)
  }
  const js = fs.readFileSync(jsPath, 'utf8')
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : ''

  console.log('▸ 步骤 2/2  内联 JS / CSS 到单个 HTML…')
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>本地小游戏 / Game Hub</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
${js}
    </script>
  </body>
</html>
`

  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'game-hub.html')
  fs.writeFileSync(outFile, html, 'utf8')
  fs.rmSync(tmpDir, { recursive: true, force: true })

  const size = fs.statSync(outFile).size
  console.log(`\n✅ 已生成单文件：${path.relative(root, outFile)}  (${fmtSize(size)})`)
  console.log('   直接双击即可用浏览器打开，无需服务器、无需联网。')
  console.log('   发给别人、拷进 U 盘、或上传到任意静态空间，都只需要这一个文件。')
}

main().catch((e) => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.error('\n❌ 单文件构建失败：', e.message)
  process.exit(1)
})