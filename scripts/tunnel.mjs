/**
 * 对外访问：局域网 + 公网隧道。
 *
 * 这个应用是纯静态 + 状态全在 localStorage，没有后端，
 * 所以「对外访问」不需要任何服务器 —— 只需要把已经构建好的 `dist/`
 * 用一个静态服务器绑定到 `0.0.0.0`，再按需要决定要不要再套一层公网隧道。
 *
 * 三种用法
 * --------
 *   npm run lan      仅局域网：同一 WiFi 下的手机 / 平板 / 电脑可访问
 *   npm run public   局域网 + 公网隧道：任何人凭一个公网 URL 都能打开（免账号）
 *   npm run build:single   产出单文件，双击即用，不需要本脚本
 *
 * ⚠ 安全提示
 *   `--public` 会把本机端口暴露到**整个互联网**，任何拿到 URL 的人都能打开这个应用。
 *   （虽然成绩只存在各自浏览器里、互不可见，但这台机器的该端口确实对公网敞开。）
 *   所以它**必须显式执行**，绝不会随 `dev` / `preview` / 构建自动启动。
 *   用完按 Ctrl+C 即刻关闭隧道。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, chmodSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const toolsDir = path.join(root, '.tools')
const cloudflared = path.join(toolsDir, 'cloudflared.exe')
const PORT = Number(process.env.PORT || 4173)
const MODE = process.argv.includes('--public') ? 'public' : 'lan'

const GH_API = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'
const ASSET_NAME = 'cloudflared-windows-amd64.exe'

const kids = []
function cleanup() {
  console.log('\n正在关闭…')
  for (const k of kids) { try { k.kill() } catch { /* 已退出 */ } }
  process.exit(0)
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

/** 列出可用于局域网访问的本机 IPv4（跳过回环与虚拟网卡常见前缀） */
function lanAddresses() {
  const out = []
  const ifaces = os.networkInterfaces()
  for (const [name, list] of Object.entries(ifaces)) {
    for (const ni of list || []) {
      // 只取 IPv4 —— IPv6 链接本地地址（fe80::/10）带 %zone 后缀，
      // 手机浏览器对这类地址的支持也不如 IPv4，别给用户添麻烦
      if (ni.family !== 'IPv4' || ni.internal) continue
      if (/^(vEthernet|VMware|VirtualBox|Loopback|Hyper-V|docker|WSL)/i.test(name)) continue
      out.push({ name, address: ni.address })
    }
  }
  return out
}

/** 组装可点击的访问地址 */
function urlFor(address) {
  return `http://${address}:${PORT}/`
}

/**
 * 下载 cloudflared。
 *
 * ⚠ 通道顺序是**实测选出来的**，不是想当然：
 * 直连 `github.com/.../releases/latest/download/...` 在很多网络下会 TCP 超时
 * （实测本机 github.com:443 直接不通，而 api.github.com 却通）；
 * 走 **GitHub API 的资产端点**（`Accept: application/octet-stream`）会 302 到
 * `release-assets.githubusercontent.com`，那条链路可用。
 * 所以：先试 API 端点，失败再退回浏览器直链。
 */
async function ensureCloudflared() {
  if (existsSync(cloudflared)) {
    console.log(`▸ 已存在 cloudflared（${(statSync(cloudflared).size / 1048576).toFixed(1)} MB），跳过下载`)
    return
  }

  const attempts = [
    {
      name: 'GitHub API 资产端点',
      run: async () => {
        const api = await fetch(GH_API, { headers: { 'User-Agent': 'game-hub', Accept: 'application/vnd.github+json' } })
        if (!api.ok) throw new Error(`GitHub API HTTP ${api.status}`)
        const rel = await api.json()
        const asset = (rel.assets || []).find((a) => a.name === ASSET_NAME)
        if (!asset) throw new Error(`未在 ${rel.tag_name} 中找到 ${ASSET_NAME}`)
        const res = await fetch(asset.url, {
          headers: { 'User-Agent': 'game-hub', Accept: 'application/octet-stream' },
          redirect: 'follow',
        })
        if (!res.ok) throw new Error(`资产 HTTP ${res.status}`)
        return Buffer.from(await res.arrayBuffer())
      },
    },
    {
      name: '浏览器直链',
      run: async () => {
        const res = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${ASSET_NAME}`, {
          headers: { 'User-Agent': 'game-hub' },
          redirect: 'follow',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return Buffer.from(await res.arrayBuffer())
      },
    },
  ]

  const errors = []
  for (const a of attempts) {
    try {
      console.log(`▸ 正在下载 cloudflared（约 53 MB，通道：${a.name}）…`)
      const buf = await a.run()
      // 校验：必须是合法 PE 且体积合理，避免把一个错误页当成可执行文件存下来
      if (buf.length < 5_000_000) throw new Error(`内容仅 ${buf.length} 字节，不是有效的可执行文件`)
      if (buf[0] !== 0x4d || buf[1] !== 0x5a) throw new Error('文件头不是 PE 格式（MZ）')
      mkdirSync(toolsDir, { recursive: true })
      writeFileSync(cloudflared, buf)
      try { chmodSync(cloudflared, 0o755) } catch { /* Windows 下无意义 */ }
      console.log(`▸ 已下载到 ${path.relative(root, cloudflared)}（${(buf.length / 1048576).toFixed(1)} MB）`)
      return
    } catch (e) {
      console.log(`  ⚠ ${a.name} 失败：${e.message}`)
      errors.push(`${a.name}: ${e.message}`)
    }
  }

  throw new Error(
    `cloudflared 下载失败（已尝试 ${attempts.length} 条通道）。\n` +
    `    ${errors.join('\n    ')}\n` +
    '    可能原因：当前网络无法访问 GitHub。\n' +
    '    解决办法：① 换网络后重试；② 手动下载 cloudflared-windows-amd64.exe\n' +
    `    放到 ${path.join(root, '.tools', ASSET_NAME)} 后再运行；\n` +
    '    ③ 或者只用局域网模式 npm run lan（不需要隧道）。',
  )
}

function startPreview() {
  console.log(`▸ 启动静态服务器（0.0.0.0:${PORT}）…`)
  if (!existsSync(path.join(root, 'dist', 'index.html'))) {
    throw new Error('dist/ 不存在，请先运行 `npm run build`')
  }
  const p = spawn('npm.cmd', ['run', 'preview', '--', '--host', '0.0.0.0', '--port', String(PORT)], {
    cwd: root,
    stdio: 'ignore',
    shell: true,
  })
  kids.push(p)
  return p
}

async function startTunnel() {
  console.log('▸ 建立公网隧道（cloudflared 快速隧道，免账号）…')
  const p = spawn(cloudflared, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'], {
    cwd: root,
  })
  kids.push(p)

  let announced = false
  const grab = (buf) => {
    const text = String(buf)
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
    if (m && !announced) {
      announced = true
      printPublicUrl(m[0])
    }
    if (/ERR|error/i.test(text) && /failed|cannot|unable/i.test(text)) {
      console.error('  ⚠ cloudflared 报错（详见上方输出）')
    }
  }
  p.stdout.on('data', grab)
  p.stderr.on('data', grab)
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`\n❌ 隧道进程退出（code ${code}）`)
  })
  return p
}

function printPublicUrl(url) {
  // 按实际内容宽度算，不写死 —— trycloudflare 随机域名常有 40~60 字符，
  // 固定宽度会撑破右边框
  const lines = [
    '公网地址（任何人、在任何网络下都能打开）',
    url,
    '按 Ctrl+C 立即关闭隧道',
  ]
  const inner = Math.max(...lines.map((l) => l.length)) + 4
  const bar = '─'.repeat(inner)
  console.log(`\n╔${bar}╗`)
  for (const l of lines) console.log(`║  ${l.padEnd(inner - 2)}║`)
  console.log(`╚${bar}╝\n`)
}

function printHeader() {
  console.log('\n' + '═'.repeat(58))
  console.log('  Game Hub · 对外访问')
  console.log('═'.repeat(58))
}

function printUrls() {
  const addrs = lanAddresses()
  console.log(`\n  本机：      ${urlFor('localhost')}`)
  if (!addrs.length) {
    console.log('  局域网：    未检测到可用的局域网地址（可能未连 WiFi / 网线）')
  } else {
    console.log('\n  局域网（同一 WiFi / 局域网内可直接打开）：')
    for (const a of addrs) console.log(`             ${urlFor(a.address)}   (${a.name})`)
  }
  console.log('\n  提示：手机与电脑必须连同一个 WiFi；首次访问需信任本机防火墙提示。')
  console.log('  按 Ctrl+C 停止。\n')
}

async function main() {
  printHeader()

  if (MODE === 'public') {
    await ensureCloudflared()
    console.log(`▸ cloudflared ${(statSync(cloudflared).size / 1048576).toFixed(1)} MB 就绪`)
  }

  startPreview()
  // 等端口起来再打印地址，避免用户点开还是 connection refused
  await new Promise((r) => setTimeout(r, 1500))
  printUrls()

  if (MODE === 'public') {
    await startTunnel()
    console.log('  正在分配公网域名，通常 5~20 秒…\n')
  }

  console.log('  说明：成绩只存在各自浏览器的 localStorage 里，互不可见；')
  console.log('        但本机该端口确实可被外部访问，请知悉后再使用公网模式。')
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`)
  for (const k of kids) { try { k.kill() } catch { /* noop */ } }
  process.exit(1)
})