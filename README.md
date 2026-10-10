# 本地小游戏合集 / Game Hub

一个在浏览器内运行的**小游戏启动器**。带大厅菜单，可在游戏之间自由切换；
架构设计为 **可插拔（pluggable）** —— 之后新增游戏，只需新建一个文件夹 + 在注册表里加一行。

技术栈：**Vite + React 18 + Tailwind CSS**（纯 JSX，无 TypeScript，无 MUI，无路由库）。
视图切换基于 React `state`（无需刷新页面、无需 react-router）。

## 在线体验

| | 地址 |
| --- | --- |
| **线上站点**（推荐） | <https://signal-meng.github.io/game-hub/> |
| 源码仓库 | <https://github.com/Signal-Meng/game-hub> |

线上站点由 GitHub Actions 自动部署：推 `main` 分支即触发构建并发布到 GitHub Pages，
无需手动操作、也无需本机保持开机。纯静态、无后端，任何人可直接打开。

想改代码或自己部署，见下方 [运行](#运行) 与 [对外访问](#对外访问不只在本机)。

## 运行

```bash
npm install
npm run dev           # 本地开发，默认 http://localhost:5173
npm run build         # 生产构建，输出到 dist/
npm run preview       # 预览构建产物（仅本机）
npm run build:single  # 产出单文件 dist-single/game-hub.html（双击即用）
npm run lan           # 局域网访问：同一 WiFi 下手机/平板可打开
npm run public        # 公网访问：任何人凭 URL 可打开（⚠ 会暴露本机端口）
```

> 若 `npm install` 受网络限制失败，请确认运行环境可访问 npm registry。
> 本机自带 Node 路径示例：`C:/Users/SignalB/.workbuddy/binaries/node/versions/22.22.2-3/node.exe`

## 对外访问（不只在本机）

这个应用是**纯静态 + 状态全在 localStorage**，没有后端、没有数据库。
所以「让别人访问」不需要买服务器，只要把 `dist/` 挂出去即可。四种做法按场景选：

> **只想让别人玩**，直接给 [线上站点](https://signal-meng.github.io/game-hub/) 即可 —— 见 ④。
> 下面 ① ~ ③ 是**本机自用或临时分享**时的做法。

### ① 单文件：最省事，发给谁都能用

```bash
npm run build:single     # → dist-single/game-hub.html（约 220 KB）
```

一个 HTML 文件内联了全部 JS 与 CSS。**双击即可用浏览器打开**，不需要装任何东西、不需要起服务器、**连网都不需要**（数据全在本地）。

适合：发微信 / 拷进 U 盘 / 放到任意静态空间；学生拿 U 盘拷回去自己玩。

> 已实测：`file://` 下应用正常挂载、10 款游戏可玩、`localStorage` 可写可读**且跨刷新持久**、控制台 0 报错。
>
> 实现上刻意用 **IIFE** 而非默认 ESM：`file://` 文档的 origin 是不透明源，
> 内联 `type="module"` 脚本存在被 CORS 拦下的风险，IIFE 是经典脚本、行为可预测。

### ② 局域网：教室 / 家里同一 WiFi

```bash
npm run build && npm run lan
```

脚本会打印本机所有可用地址，形如 `http://192.168.x.x:4173/`。
**手机、平板连同一个 WiFi** 直接输入即可，无需任何账号或配置。

> 首次访问可能弹 Windows 防火墙提示，选「允许专用网络」。
> 用的是 `vite preview`（生产产物）而非 `vite dev`，避免把开发模式的
> React StrictMode 双调用调试行为暴露给外部访问。

### ③ 公网：任何人、在任何网络下

```bash
npm run public
```

脚本会自动下载 [cloudflared](https://github.com/cloudflare/cloudflared/releases)
（首次约 53 MB，存到 `.tools/`，已被 gitignore），然后分配一个
`https://xxx.trycloudflare.com` 随机域名并打印出来。

**免账号、免注册、免费。** 把那个网址发给任何人，在任何网络下都能打开。

> ⚠ **安全须知**
> - 这会把本机 `4173` 端口暴露到**整个互联网**，任何拿到 URL 的人都能打开这个应用；
> - 成绩只存在各自浏览器的 localStorage 里、彼此不可见，所以不会泄露成绩数据；
> - **用完请按 Ctrl+C** 关闭隧道，别长期挂着；
> - 该命令**绝不会自动运行**，只有你显式执行才会建立隧道。
>
> 前提：这台机器能出网连到 Cloudflare。若所在网络有防火墙/代理拦截，
> 隧道可能建立失败或域名无法访问 —— 此时用 ① 或 ②。

### ④ 公网常驻：GitHub Pages（本项目当前采用）

线上站点 <https://signal-meng.github.io/game-hub/> 就是这么来的。仓库已配好
`.github/workflows/deploy-pages.yml`：**推 `main` 即自动构建并发布**，
不需要手动跑任何命令，也不需要本机保持开机。

```bash
git push origin main     # 推上去，CI 自动构建 + 部署
```

> 依赖 GitHub 仓库与 Pages 额度（**公开仓库免费**）。首次需要仓库管理员在
> Settings → Pages 把 Source 选成 **GitHub Actions**（工作流里的
> `actions/configure-pages` 已带 `enablement: true`，通常会自动完成）。
>
> `vite.config.js` 的 `base: './'` 是**子路径部署的必要条件** ——
> Pages 项目页的实际路径是 `/<仓库名>/` 而非根路径，用默认绝对路径会导致资源 404 白屏。

**为什么不用 ngrok / Vercel / Netlify**：ngrok 新隧道强制注册账号；
Vercel / Netlify 需要登录凭据才能 `push` 部署。本项目已接入 GitHub，
Pages 免额外凭据、与仓库同源、零运维，因此没有再引入第三方托管。

> 若日后要迁到 Vercel / Netlify —— `base: './'` 是相对路径，**换平台不必改配置**。

## 脱离 WorkBuddy 一键启动

不想走命令行？项目根目录已提供 **`training.bat`**：双击它即可在本机启动开发服务器并自动打开浏览器（http://localhost:5173），完全不依赖 WorkBuddy 界面。

脚本会自动补全 Node 运行时、必要时执行 `npm install`；服务器窗口请保持打开，用完按 `Ctrl+C` 关闭。

## 游戏内通用界面（难度选择 / 计时 / 排行榜 / 玩法）

每个游戏打开后，视图由 `src/components/GameView.jsx` 统一包裹，包含四块通用 UI：

- **开始前遮罩**：点开游戏先看到遮罩（游戏名 / 简介 / 玩法 / **难度选择器** / 「开始」按钮），
  **游戏本体此时完全未挂载** —— 记忆类游戏的数字串、方块序列、翻牌图案在点「开始」之前绝不渲染。
  点「开始」才进入游戏，计时器从 0 开始。难度选择会持久化（`gamehub:difficulty`），下次进入同一游戏自动预选。
- **顶部计时器**：进入游戏即从 0 开始累计本局用时（MM:SS.cc）。遮罩期间不渲染，天然为 0 起步。
- **右侧成绩摘要**（窄栏）：该游戏**声明式**的指标（种类与数量因游戏而异，见下方「计分体系」），
  每项含「历史最优 / 最近」（**跟随当前所选难度**）。
- **下方全宽排行榜**：名次 / 该游戏的各指标 / 日期，可切换「当前难度 / 全部难度」视图，
  可折叠，支持清空本游戏记录。每个难度分区最多保留 **10 条**，
  按该游戏的排序指标优先淘汰，名额不跨难度共用。仅存本机浏览器（`localStorage`，键名 `gamehub:stats:<id>`）。
- **底部玩法说明**：展示「游戏介绍」与「玩法」，文案来自注册表的 `intro` / `howto` 字段。

> **为什么排行榜不在右侧栏**：计分体系改为「每款游戏指标不同」后，列数最多可达 6 列。
> 早期把它塞在 256px 侧栏里时，每列只剩 25px —— "12.80 题/s"、"00:12.70" 这类值根本放不下，
> 而且 10 行记录只能露出 5 行、字号只有 10px。表格塞不进窄栏，故改为**全宽面板**，
> 侧栏只放 2~4 张摘要卡（宽度有限，适合卡片不适合表格）。

### 清除成绩

成绩**只存在本机浏览器**的 localStorage（键 `gamehub:stats:<gameId>`），项目文件里没有任何副本，
换电脑或换浏览器不会有历史数据。三种清除方式：

| 入口 | 作用范围 |
| --- | --- |
| 排行榜右下「清空本游戏记录」 | 仅当前游戏的全部难度记录 |
| 大厅页脚「清除全部成绩」 | 一次性删除所有游戏的 `gamehub:stats:*` |
| **网址加 `?reset=1`** | 同上，但打开即执行，无需 DevTools |

给学生的机器清历史成绩，最快的是直接访问：

```
http://localhost:5173/?reset=1        ← 开发服务器（training.bat 启动）
http://localhost:4173/?reset=1        ← npm run preview
```

清除后会立刻用 `history.replaceState` **把 `reset` 参数抹掉**，
否则刷新页面会再次触发清除 —— 用户刚玩出来的新成绩会被一次刷新悄悄抹掉。

> 「清除全部成绩」**保留** `gamehub:difficulty`（难度偏好）——
> 那是使用习惯不是成绩，删掉会让每个游戏都跳回「中等」，反而更麻烦。
>
> 确认态是内联的二次确认（不是浏览器 `confirm` 弹窗），5 秒无操作自动复位；
> `?reset=1` 则跳过确认（它是显式输入网址的主动行为）。
>
> 清空后排行榜会回到「暂无成绩，快去玩一局」。
> 计分体系升级前后的历史记录口径不同（旧的只有 accuracy/time），若想彻底重排名次，建议直接全清。
> 窄屏（< 约 640px）下列宽保底 `7rem`，横向滚动查看 —— 宁可滑动也不截断数值。

## 计分体系（每款游戏的「好成绩」不是一个东西）

原先全站只有「正确率 + 时间」两个指标，但 10 款游戏要比较的东西根本不同，
硬塞进同一套排名会得出**方向性错误**的结论。现按四个家族分派口径，
定义集中在 `src/scoring.js`，每个游戏在 `registry.js` 的 `scoring` 字段声明自己用哪一套。

| 家族 | 排序键 `score` | 展示指标 | 游戏 | 为什么这样定 |
| --- | --- | --- | --- | --- |
| **span** 记忆广度 | 本局成功复现的**最长跨度** | 记忆广度 / 正确率 —— **不显示用时** | 数字瞬时记忆、顺序记忆 Simon、空间广度 Corsi | 这类游戏**没有限时属性**，玩家想快可以乱点秒答。拿时间排名等于奖励手速而非记忆力。 |
| **tps** 吞吐量 | 正确率 × 速度系数 | **吞吐量(单位/秒)** / 综合分 / 正确率 / 用时 | 斯特鲁普、视觉搜索、反向划消 | 本质是「单位时间处理多少刺激」。正确率只反映对错、用时只反映长短，缺了最关键的吞吐量。 |
| **composite** 综合 | 正确率 × 速度系数 | 综合分 / [步数] / 正确率 / 用时 | 舒尔特表、记忆翻牌、图形再认 | 对与快都要看。原先两个数并排一摆，用户无法得出「这局算好还是差」的结论。 |
| **rate** 比率 | 持续比率（接触率） | 接触率 —— **不显示用时** | 动态追踪 | 时长由难度固定，是**限时压力**而非速度表现。原实现 `time = dur * 1000` 是纯粹的占位假值，每局用时一模一样。 |

### 综合分公式

```
score = 正确率 × clamp(par / 用时, 0, 1)
```

- `par` = 该难度的**及格用时（毫秒）**，写在 registry 的 `difficulties[key].par`；
- 用时 ≤ par → 系数 1（不额外加分，保证正确率始终是主导项）；用时 = 2×par → 0.5；用时 → ∞ → 0；
- 用**比值**而非线性扣分，是因为人对时间的感知是对数的 ——
  比 par 慢 1 秒和多 1 秒，体感差别远小于「超时」与「刚好达标」的差别；
- 用**乘法**而非加法，是保证两项都不可缺：错得再少只要慢到没边也得不了高分，
  跑得再快只要错一半也只能拿一半。加法会让「快但错」压过「慢但全对」，
  而后者对这类认知训练任务其实是更好的表现。

### 新增游戏时怎么写

```js
{
  id: 'yourgame',
  scoring: {
    family: 'composite',        // span | tps | composite | rate
    unit: '题',
    metrics: [M_SCORE, M_ACC, M_TIME],   // 第一项即排行榜排序指标
  },
  difficulties: {
    hard: { label: '困难', summary: '…', par: 34000, params: { trials: 30 } },
  },
}
```

游戏组件里：

```jsx
import { compositeScore, computeTps, hitRate } from '../../scoring.js'

const { params, par, record } = useGameSession()   // par 由 GameView 经 Context 注入
// …
record({
  score: compositeScore({ accuracy: acc, timeMs, parMs: par }),
  accuracy: acc,
  time: timeMs,
  tps: computeTps(units, timeMs),   // 仅 tps 家族需要
})
```

约定：

- **只上报该家族用到的字段**，不要一股脑全传 —— span / rate 家族传 `time` 会让
  「不计时」的承诺在数据层失效；
- 吞吐量 `units` 必须取**由难度固定**的量（题数 / 轮数 / 网格总格数），
  **绝不能用每局随机的量**（如划消的目标格数）—— 否则同样表现下 tps 会在数倍范围内乱跳，指标被随机数主导；
- 计时的起止点必须排除**强制等待时间**（如图形再认的记忆展示 `showMs`），
  否则不同难度之间用时根本不可比；
- 不要用「整秒截断」保存用时，亚秒精度是同难度内区分成绩的主要依据。


游戏内的「重新开始」会回到开始前遮罩（可换难度），旁边另有「同难度重开」直接开新局。
顶栏的难度芯片为只读，点击同样回遮罩 —— 局内不提供直接切换，避免静默作废当前局。

成绩记录逻辑：游戏组件调用 `useGameSession().record({...})` 上报
（字段按该游戏的 scoring 家族决定，见上方「计分体系」；
`par`（及格用时）与难度、sessionId 一样由 `GameView` 经 Context 注入，
因此**游戏组件的 `record()` 调用行不需要关心难度**）。
同一局内多次 `record()`（如 memorydigits / simon /corsi）会在排行榜**同一行原地演进**，
不会刷爆 10 条上限；因为是**整行替换**语义，每次都应传入本轮的**完整快照**（含历史最好值）。

## 如何新增一个游戏（可插拔扩展）

整个应用唯一的游戏来源是 `src/games/registry.js`。

1. 在 `src/games/<gameId>/` 下新建文件夹，例如 `src/games/snake/`。
2. 在该文件夹里创建**默认导出**的 React 组件。训练参数从 `useGameSession()` 取，不要写模块级常量：

   ```jsx
   import { useGameSession } from '../../hooks/useGameStats.js'

   export default function SnakeGame() {
     const { params, record, restartToGate, restartSame } = useGameSession()
     const { size, speed } = params   // 来自 registry 的 difficulties[当前难度].params
     return <div>这里写你的游戏 UI 与逻辑</div>
   }
   ```

3. 在 `src/games/registry.js` 顶部引入该组件：

   ```js
   import SnakeGame from './snake/index.jsx'
   ```

4. 在 `games` 数组里追加一条记录（**必须声明 easy / medium / hard 三档**）：

   ```js
   {
     id: 'snake',                       // 唯一标识（state 切换用）
     name: '贪吃蛇',                    // 卡片展示名称
     description: '控制小蛇吃豆子',       // 卡片简短描述
     icon: '🐍',                        // 卡片图标（emoji 即可）
     category: '专注力',                // 分组标签，大厅据此归类（可选）
     difficulties: {
       easy:   { label: '简单', summary: '慢速 · 小场地', params: { size: 10, speed: 0.2 } },
       medium: { label: '中等', summary: '标准 · 普通场地', params: { size: 16, speed: 0.3 } },
       hard:   { label: '困难', summary: '快速 · 大场地', params: { size: 20, speed: 0.45 } },
     },
     component: SnakeGame,              // 上一步导入的组件
   }
   ```

约定：`params` 必须是**扁平标量**对象（只允许 number / string / boolean）；
`summary` 手写（不从 params 反推，因为参数键名对用户无意义）；
`howto` / `intro` **不要写死具体数字**，数字统一交给 `difficulties[].summary`，否则会与用户选的难度自相矛盾；
重开按钮直接用 `<RestartBar restartToGate={restartToGate} restartSame={restartSame} />`，不要自己再写一遍。

完成！大厅会自动出现新卡片，**无需改动 App / 大厅 / 任何其它代码**。
大厅会按 `category` 自动把游戏归类到「专注力 / 记忆力」等分组下展示。

## ⚠ 写游戏组件时必须遵守：StrictMode 安全的副作用

`src/main.jsx` 启用了 `<React.StrictMode>`。React 18 在**开发模式**下会
「挂载 → 跑 cleanup → 再挂载」重放一次副作用，专门用来暴露副作用不干净的 bug。

因此游戏组件**禁止**这样写开局逻辑：

```jsx
// ❌ 错误：守卫 + 独立 cleanup = 开发模式下游戏直接卡死
const startedFor = useRef(null)
useLayoutEffect(() => {
  if (startedFor.current === sessionId) return   // 第二次挂载被挡掉
  startedFor.current = sessionId
  start()                                         // 这里注册的定时器已被 cleanup 清掉，且永不重建
}, [sessionId])

useEffect(() => () => timer.current && clearTimeout(timer.current), [])  // ← 独立的清理 effect
```

症状：开发模式下游戏永远停在初始状态（序列冻结在第一个、倒计时永不结束），
而 `npm run build` 的生产包**完全正常** —— 这种「本地坏、发布好」的差异极难靠肉眼发现。

正确写法：**注册副作用与清理副作用放在同一个 effect 里**，让 setup / cleanup 严格成对，
StrictMode 重放一次就等于重开一局，行为自洽：

```jsx
// ✅ 正确
useLayoutEffect(() => {
  aliveRef.current = true
  start()                                   // 注册 setTimeout / rAF / AudioContext…
  return () => {
    aliveRef.current = false
    clearTimeout(timer.current)             // 清理与注册写在同一个 effect 内
    timer.current = null
  }
}, [sessionId])
```

补充约定：

- **不要再写 `startedFor` 之类的幂等守卫**：`[sessionId]` 依赖本身就保证「换局才重开」，
  守卫不仅多余，还是上面那个 bug 的唯一成因。
- 所有定时器 / rAF / interval 必须在同一 effect 的 cleanup 里清理。
- 新增游戏后请在 **`npm run dev` 下**（不是 `npm run preview`）实际点一遍，
  确认开局倒计时、序列播放等会推进 —— 只有开发模式才会暴露这类问题。

## 目录结构

```
game-hub/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx                 # 入口
    ├── App.jsx                  # 大厅 + 视图切换（state 控制）
    ├── index.css                # Tailwind 指令
    ├── difficulty.js            # 难度与排行榜的共享纯模块（键/标签/排序/裁剪/派生/采样）
    ├── scoring.js               # 计分口径（四个家族的公式、指标格式化、metres 派生）
    ├── components/
    │   ├── Header.jsx           # 顶部标题栏
    │   ├── GameCard.jsx         # 大厅游戏卡片
    │   ├── GameView.jsx         # 游戏视图容器（开始前遮罩 ⇄ 游戏本体、计时器、侧栏）
    │   ├── StartGate.jsx        # 开始前不透明遮罩（含难度选择器与「开始」）
    │   ├── DifficultyPicker.jsx # 三档分段卡片难度选择器
    │   ├── DifficultyChip.jsx   # 顶栏只读难度芯片（点击回遮罩）
    │   ├── Timer.jsx            # 通用计时器
    │   ├── StatSidebar.jsx      # 成绩摘要栏（各指标 best/recent）
    │   ├── Leaderboard.jsx      # 全宽排行榜（动态列 / scope 切换 / 折叠 / 清空二次确认）
    │   ├── RestartBar.jsx       # 局内重开按钮组（重新开始 / 同难度重开）
    │   ├── ClearAllStats.jsx     # 大厅页脚「清除全部成绩」+ 导出 clearAllStats()（?reset=1 共用）
    │   └── GameFooter.jsx       # 底部玩法与介绍
    ├── hooks/
    │   ├── useLocalStorage.js   # localStorage 同步 hook（支持 revive 结构迁移）
    │   ├── useGameStats.js      # 成绩记录读写 + session 级 upsert + GameSessionContext
    │   └── useDifficultyPreference.js  # 难度偏好持久化（gamehub:difficulty）
    └── games/
        ├── registry.js          # 游戏注册表（唯一数据源，含分类与三档难度）
        ├── schulte/
        │   └── index.jsx        # 舒尔特表（专注力）
        ├── stroop/
        │   └── index.jsx        # 斯特鲁普干扰（专注力）
        ├── visualsearch/
        │   └── index.jsx        # 视觉搜索（专注力）
        ├── cancellation/
        │   └── index.jsx        # 反向划消（专注力）
        ├── tracking/
        │   └── index.jsx        # 动态追踪（专注力）
        ├── memorydigits/
        │   └── index.jsx        # 数字瞬时记忆（记忆力）
        ├── simon/
        │   └── index.jsx        # 顺序记忆 Simon（记忆力）
        ├── corsi/
        │   └── index.jsx        # 空间广度 Corsi（记忆力）
        ├── memorymatch/
        │   └── index.jsx        # 记忆翻牌（记忆力）
        └── recognition/
            └── index.jsx        # 图形再认（记忆力）
```

## 当前游戏清单（10 款 · 专注力 + 记忆力）

| 分组 | 游戏 | 训练要点 |
| --- | --- | --- |
| 专注力 | 舒尔特表 | 按顺序点数字，视觉搜索速度 |
| 专注力 | 斯特鲁普干扰 | 字义≠颜色，抗干扰反应 |
| 专注力 | 视觉搜索 | 海量干扰中找唯一目标 |
| 专注力 | 反向划消 | 密集信息中持续专注 |
| 专注力 | 动态追踪 | 视觉持续追踪移动目标 |
| 记忆力 | 数字瞬时记忆 | 短期记忆广度 |
| 记忆力 | 顺序记忆 Simon | 听觉+顺序记忆 |
| 记忆力 | 空间广度 Corsi | 空间位置记忆 |
| 记忆力 | 记忆翻牌 | 短时配对记忆 |
| 记忆力 | 图形再认 | 再认记忆 |
