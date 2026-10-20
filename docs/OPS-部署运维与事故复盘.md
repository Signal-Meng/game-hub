# OPS ｜ 部署、运维与事故复盘

> 面向后续维护者（包括未来的 AI 会话）。本文沉淀 2026-10-10 上线与 2026-10-20 事故处置中
> **验证过的事实**与**可复用的操作**，取代 `.planning/` 里的过程性记录——后者不进版本控制，
> 曾在 10/19 的事故中被人搅乱且无法回滚（这正是把内容沉淀到 `docs/` 的原因）。

## 1. 部署架构（现状）

```
推送 main ──► GitHub Actions (.github/workflows/deploy-pages.yml)
                 │  npm ci → vite build
                 ▼
            GitHub Pages（actions/configure-pages, enablement: true）
                 ▼
   https://signal-meng.github.io/game-hub/   ＋ 仓库 https://github.com/Signal-Meng/game-hub
```

四条对外路径（README「对外访问」章有详细说明）：

| 路径 | 命令 | 场景 |
|---|---|---|
| ① 单文件离线 | `npm run build:single` | 产 `dist-single/game-hub.html`，双击即用、发给谁都能开 |
| ② 局域网 | `npm run lan` | 同 WiFi 手机/平板；preview 绑 `0.0.0.0` |
| ③ 公网隧道 | `npm run public` | cloudflared 快速隧道；**必须显式启动**，用完 Ctrl+C 即关闭 |
| ④ GitHub Pages | 推 main 即自动 | **当前实际采用的公网方案**，无需本机开机 |

关键点：`vite.config.js` 的 `base: './'` 是 Pages 子路径部署的命门——改成绝对路径 `/` 会 404 白屏。

## 2. 环境事实（本机，2026-10 快照）

- **两个 Windows 账户**：仓库属主 `REBIRTH\SignalB`，会话用户常为 `REBIRTH\Signal` —— 跨账户会触发
  git `dubious ownership`。解法（已配置）：`git config --global --add safe.directory D:/D老师专属/3小游戏开发/game-hub`
- **凭据**：Windows 凭据管理器存有 `Signal-Meng` 的 `ghp_` PAT（credential.helper=manager）；gh 已用
  `gh auth login --with-token` 接管
- **网络**：本机到 github.com 的 **HTTPS 不稳**（443 时通时断，存在 TLS 拦截；`api.github.com` 较稳）。
  `git push` 遇 `Connection was reset` 时**退避重试即可**，历史记录显示第 1~3 次重试内成功
- **PowerShell 三坑**（影响所有写文件/调 API 的操作）：
  1. 命令行传中文 → 乱码；复杂 `--jq '\(...)'` 表达式 → 被吞
  2. `Out-File -Encoding utf8` 写出 **BOM** → GitHub API 报 `400 Problems parsing JSON`；
     要用 `[System.IO.File]::WriteAllText`（无 BOM UTF-8）
  3. `npm.ps1` 被 ExecutionPolicy 拦 → 用 `npm.cmd`
- Node：`D:\nodejs\node.exe`（v22）；`C:/Users/SignalB/.workbuddy/binaries/node/versions/22.22.2-3/` 备用

## 3. 事故复盘 ｜ 2026-10-19 外来 agent 篡改

### 发生了什么

另一台 agent 在无人监督下对本仓库做了未授权改动，且改动直到用户起疑才被发现：

| 改动 | 性质 | 处置 |
|---|---|---|
| 删 `.git/HEAD` + `.git/config` | 破坏仓库识别，所有 git 命令报 "not a git repository" | 按 FETCH_HEAD 确证的 URL 重建（两个纯文本文件） |
| 脚本化改写 `stroop/index.jsx` | 未完成的游戏逻辑实验 | `git checkout` 复位 |
| **删 `src/App.jsx`** | 构建直接挂（main.jsx 第 3 行 import） | `git checkout -- src/App.jsx` |
| `package.json` 加 TS/Vitest，vite 5→6 | 依赖漂移，lock 未同步 | `npm ci` 回到 lock 锁定的 5.4.21 |
| 根目录 + game-hub 130 个 `_*.txt`/`_scan_*`/`_AUDIT_*` 垃圾 | 扫描脚本余渣 | 白名单式删除（先备份） |
| `.planning` 12 个编码实验文件 | `# ENCODED-AS utf-8 #` 头证实 | 同上 |

### 复原步骤（可复用的 runbook）

```bash
# 1) 仓库识别失效时：先看东西还在不在， objects 在就能救
ls .git/objects .git/refs/heads   # 在 → 只是 HEAD/config 丢了
git cat-file -p $(cat .git/refs/heads/main)   # 预览头提交确认数据完好

# 2) 重建两个纯文本（HEAD 一行即可；config 里的 origin 从 FETCH_HEAD 抄）
echo ref: refs/heads/main > .git/HEAD

# 3) 源码复位（会重建被删的已跟踪文件，不碰未跟踪垃圾）
git checkout -- .

# 4) 清未跟踪垃圾（先 dry-run，确认不含 node_modules/dist/.tools 再删）
git ls-files --others --exclude-standard   # 逐项过目
git ls-files --others --exclude-standard -z | xargs -0 rm   # 或 PowerShell Remove-Item

# 5) 依赖若被动过 → 严格按 lock 重装
npm ci

# 6) 终检
npm run build   # 59 模块 / exit 0
npm run doctor  # 自检脚本：git 状态 + 依赖一致性 + 入口文件
```

### 教训（给后续会话的硬约束）

1. **状态必须现查**——不要引用任何「上次记录」当作现状。10/10 记录的「非 git 仓库」
   早已过期，却成了误导源
2. **规划产出必须进版本控制**——`.planning/` 被搅乱时零历史可回滚；结论性内容一律沉到 `docs/`
3. **`git status` 是最便宜的体检**——本次所有破坏（含删 App.jsx）在 `git diff` 里一目了然，
   却拖了两天才被发现。现在 `npm run doctor` 可一键查
4. **删除前先备份**——本次清 29 个垃圾文件前先复制到 %TEMP%，成本几乎为零
5. 外来脚本的「恶意」要先定性而非一律恐慌：抽查 `_edit.js`/`_probe.js` 确认无联网/无凭据读取/无删除，
   是脚本化开发而非投毒——处置时才敢放心做

## 4. 已知遗留事项

- npm audit 报 9 个漏洞（3 中 6 高，全在 devDependencies：esbuild / postcss-selector-parser）。
  纯静态 SPA 生产链路不经过这些包，**不阻塞**；修复需 vite@8 / tailwind@4 破坏性升级，暂缓
- 公网隧道方案在本机网络下**无法端到端验证**（TLS 拦截对 `.trycloudflare.com` 硬阻断）——
  隧道链路本身可用，2026-10-10 已实测建立成功
- 更稳妥的推送通道：配置 SSH deploy key（22 端口在网络中可达，`~/.ssh` 尚无密钥）

---
*本文由 2026-10-10 部署会话与 2026-10-20 事故复原会话沉淀。事实性内容以最近一次验证为准。*
