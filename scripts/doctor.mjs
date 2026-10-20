#!/usr/bin/env node
/**
 * doctor.mjs —— 项目自检（P4 防复发）
 *
 * 背景：2026-10-19 一个外来 agent 未授权改动源码、删除 src/App.jsx、
 * 升级依赖（vite 5 → 6），还删了 .git/HEAD 与 .git/config，而以上种种
 * 直到用户起疑才被发现。本脚本一键检查最容易出事的两类状态：
 *
 *   1. 工作区是否干净（有没有未提交改动 / 未跟踪文件）
 *   2. 依赖是否与 package-lock 一致（npm ci 后是否又被动过）
 *
 * 用法：npm run doctor    （全部通过退出码 0；异常 1，并把要点打到 stdout）
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const problems = []
const notes = []
const ok = (msg) => console.log('  ✓ ' + msg)
const bad = (msg, hint) => {
  problems.push(msg)
  console.log('  ✗ ' + msg)
  if (hint) notes.push('    ↳ ' + hint)
}

// git 在本仓库可能因 dubious ownership 被拦，先放开再跑
const git = (args) => execFileSync(
  'git',
  ['-c', 'safe.directory=' + root.split('\\').join('/'), '-C', root, ...args],
  { encoding: 'utf8', windowsHide: true },
)

console.log('game-hub doctor\n')

/* ── 1. git 仓库完整性 ─────────────────────────────── */
try {
  git(['rev-parse', '--is-inside-work-tree'])
  ok('.git 结构完整（HEAD/config 可读）')

  const head = git(['rev-parse', '--short', 'HEAD']).trim()
  const branch = git(['branch', '--show-current']).trim()
  const origin = git(['config', 'get', 'remote.origin.url']).trim()
  ok(`分支 ${branch} @ ${head}，远端 ${origin}`)

  /* 2. 工作区状态（关键检查） */
  const status = git(['status', '--porcelain']).trim()
  if (!status) {
    ok('工作区与 HEAD 一致，无未提交改动、无未跟踪文件')
  } else {
    const lines = status.split('\n')
    const modified = lines.filter((l) => l.startsWith(' M') || l.startsWith('M '))
    const deleted = lines.filter((l) => l.startsWith(' D') || l.startsWith('D '))
    const untracked = lines.filter((l) => l.startsWith('??'))
    bad(`工作区有 ${lines.length} 处与 HEAD 不同：${modified.length} 改 / ${deleted.length} 删 / ${untracked.length} 新增未跟踪`,
      '先自查改动来源（git diff），确认后 git checkout -- . 复位；未跟踪垃圾用 git ls-files --others --exclude-standard 列出再删')
    lines.slice(0, 12).forEach((l) => notes.push('    · ' + l))
    if (lines.length > 12) notes.push(`    · …共 ${lines.length} 项`)
  }
} catch (e) {
  bad('git 无法读取仓库：' + String(e.message).split('\n')[0],
    '若报 not a git repository 而 .git 目录在 → 检查 .git/HEAD 与 .git/config 是否还在（两者都是纯文本，可重建）')
}

/* ── 3. 依赖与 lock 一致性 ─────────────────────────── */
const lockPath = join(root, 'package-lock.json')
const pkgPath = join(root, 'package.json')
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const lockVite = lock.packages?.['node_modules/vite']?.version

  try {
    const instVite = JSON.parse(readFileSync(join(root, 'node_modules/vite/package.json'), 'utf8')).version
    if (!existsSync(join(root, 'node_modules'))) throw new Error('no node_modules')
    if (instVite === lockVite) {
      ok(`依赖与 lock 一致（vite ${instVite}）`)
    } else {
      bad(`依赖与 lock 不一致：node_modules vite=${instVite}，lock 锁定 ${lockVite}`,
        '跑一次 npm ci 严格按 lock 重装')
    }
  } catch {
    bad('node_modules 缺失或不完整', '跑 npm ci')
  }

  const declared = Object.keys(pkg.devDependencies ?? {})
  const missing = declared.filter((d) =>
    !existsSync(join(root, 'node_modules', d.split('/')[0])))
  if (missing.length) {
    bad(`devDependencies 未安装：${missing.join(', ')}`, '跑一次 npm ci')
  } else if (declared.length) {
    ok(`devDependencies ${declared.length} 个全部在位`)
  }
} catch (e) {
  bad('package.json / package-lock.json 无法解析：' + e.message, '怀疑编码被改坏，用字节级检查确认是否仍是合法 UTF-8')
}

/* ── 4. 源码入口存在性（本次事故的直接受害者） ────── */
for (const f of ['src/main.jsx', 'src/App.jsx', 'src/games/registry.js']) {
  existsSync(join(root, f)) ? ok(`${f} 在位`) : bad(`${f} 缺失！应用无法启动`, 'git checkout -- ' + f)
}

/* ── 汇总 ─────────────────────────────────────────── */
console.log('')
if (problems.length === 0) {
  console.log('✅ 全部通过：工作区干净、依赖对齐、入口完整')
  process.exit(0)
} else {
  console.log(`❌ ${problems.length} 个异常：`)
  if (notes.length) console.log(notes.join('\n'))
  process.exit(1)
}
