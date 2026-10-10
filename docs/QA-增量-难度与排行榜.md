# QA 验证报告：增量改造（难度选择 / 排行榜 / 开始前遮罩）

| 项目信息 | 内容 |
| --- | --- |
| 项目 | `game-hub`（增量改造 v1.0 → v1.1） |
| 路径 | `D:/public/软件设计/game-hub` |
| 验证依据 | `docs/PRD-增量-难度与排行榜.md`、`docs/ARCH-增量-难度与排行榜.md`（§0.1 已实现声明 + §0 硬约束 H1~H5） |
| 验证方式 | 构建验证 + 静态核查 +纯函数逻辑验证（Node 直跑）+ SSR 渲染实证（esbuild + react-dom/server）+ 移动端布局推算 |
| 验证人 | 严过关（Yan）· QA 工程师 |
| 报告日期 | 2026- |
| **总体结论** | **FAIL（1 严重 + 2 轻微，需工程师修复后复验）** |
| **路由判定** | **`ROUTE: Engineer`** |

---

## 0. 结论摘要

| 维度 | 结论 |
| --- | --- |
| 构建 | ✅ 通过，`56 modules transformed`（基线 50，新增 6），**0 error / 0 warning** |
| 阻断问题 | **0 个** |
| 严重问题 | **1 个** —— simon 序列长度在 4 步永久卡死，`hard` 档 `inc=2` 完全失效 |
| 轻微问题 | **2 个** —— cancellation hard 档窄屏横向溢出；visualsearch easy 档局内文案与「固定网格」自相矛盾 |
| 需求 1（难度选择） | ⚠️ **部分达成** —— 10 款游戏全部声明并消费三档参数（零「空挂」），但 simon 的难度轴实际不生效 |
| 需求 2（分别记录排行榜） | ✅ 达成 —— **每难度各 10 条**（2026-10-05 修订）/ session 级 upsert / 旧数据迁移 / best-recent 派生 全部验证通过。注：原「每难度保底 1 条」条款已随 Bug 修复废止 |
| 需求 3（开始前遮罩） | ✅ 达成 —— 10 款游戏遮罩期零泄露（SSR 实证），`memorymatch` 牌面确认为 `useEffect` 产物 |
| 回归（D 组） | ✅ 通过 —— 大厅分组 / 返回大厅 / 底部玩法 / 舒尔特瞬时绿红闪全部保留 |
| 硬约束 | ✅ **H1（修订版：每难度各 10 条、总 30，名额不跨难度共用）**、H2（右侧栏上下分区）、H3（遮罩内含难度选择器）、H4（重新开始回遮罩）、H5（medium=现状、旧数据归 medium；~~每难度至少留 1 条~~ 已废止）**全部满足** |
| 新增 npm 依赖 | ✅ 0 个（`dependencies` 仅 `react` / `react-dom`） |

### 测试统计

| 测试组 | 用例数 | 通过 | 失败 |
| --- | --- | --- | --- |
| B 组 · 数据层纯函数 | 59 | 58 | 1（源码 Bug） |
| C 组 · 遮罩行为（SSR） | 28 | 28 | 0 |
| A 组 · 静态核查 | 47 | 47 | 0 |
| D 组 · 回归 | 10 | 10 | 0 |
| E/F/G 组 · 排行榜 UI + 布局 + 文案 | 20 | 18 | 2（源码 Bug） |
| **合计** | **164** | **161** | **3** |

> **QA 自纠错记录**：验证过程中我最初的测试脚本出现 5 处**测试自身缺陷**（断言索引笔误、正则未处理解构重命名、SSR 不执行 `useEffect` 的误判、把 gate 合法展示的 `howto` 文案误判为泄露）。均已逐条复核定位为 QA 侧问题并修正，**不计为源码缺陷**。详见 §5。

---

## 1. 问题清单

### 🔴 P1 · 严重 · simon 序列长度在 4 步永久卡死，`hard` 档难度轴完全失效

| 项 | 内容 |
| --- | --- |
| **严重级别** | **严重**（不阻断构建，但导致需求 1 在simon 上实质失效，且游戏核心玩法「越来越长」被破坏） |
| **定位文件** | `src/games/simon/index.jsx` **L91**（调用点）<br>`src/difficulty.js` **L304-310**（`sampleUniqueExcluding` 实现） |
| **违反** | PRD §4.2「hard 用『每轮 +2』造成步数跳变，比单纯起始更长更有区分度」；ARCH §3.3 第 7 行「L74 追加 `inc` 个随机 pad」、§0.1 落地偏差 #2 |
| **路由** | `ROUTE: Engineer` |

#### 复现步骤

1. 打开任意游戏 → 进入「顺序记忆」（simon）
2. 遮罩内选择「困难」（hard）→ 点「开始」
3. 观察首轮：屏幕显示 3 步序列（`startLen=3`）→ 正确复现
4. 观察第2 轮：屏幕显示 **4 步**序列（期望 5 步 = 3+2）
5. 继续正确复现第 3、4、5… 轮 → **序列长度始终是 4，界面文案恒为「很好！已到第 3 步」**
6. 切到「简单」（easy，`startLen=2`）→ 序列轨迹 `2 → 3 → 4 → 4 → 4 → 4…`

#### 期望 vs 实际

| 难度 | 期望长度轨迹 | 实际长度轨迹 | 结论 |
| --- | --- | --- | --- |
| easy（`startLen=2, inc=1`） | 2,3,4,5,6,7… | **2,3,4,4,4,4,4** | ❌ 第4 轮起卡死 |
| medium（`startLen=3, inc=1`） | 3,4,5,6,7… | **3,4,4,4,4,4,4** | ❌ 第 2 轮起卡死 |
| hard（`startLen=3, inc=2`） | 3,5,7,9,11… | **3,4,4,4,4,4,4** | ❌ `inc=2` 从未生效，实际退化为 `inc=1` |

#### 根因分析

`src/games/simon/index.jsx` L91：
```js
const next = [...s, ...sampleUniqueExcluding(PADS.length, inc, s)]
```

`sampleUniqueExcluding`（`src/difficulty.js` L304-310）的实现是：
```js
export function sampleUniqueExcluding(n, k, exclude) {
  const want = Math.max(0, Math.floor(k) || 0)
  const banned = new Set(Array.isArray(exclude) ? exclude : [])
  return shuffleIndices(n).filter((i) => !banned.has(i)).slice(0, want)
}
```

它把**整个已有序列 `s` 的所有元素**都列入 `banned`。而 `PADS.length === 4`（L6-11，刻意保持 4 色）：

- 序列用满 4 色后，`shuffleIndices(4).filter(i => !banned.has(i))` 返回 **空数组** → `slice(0, inc)` 仍为空 → `next.length === s.length`；
- 因此序列长度**永久锁定在 4**，游戏退化为「反复复现同一个 4 步序列」；
- `hard` 档更严重：首轮 `s` 已有 3 色，仅剩 1 个候选色，`want=2` 但只能取到 1 个 → **`inc=2` 从未真正生效**，hard 与 medium 实际难度完全相同（均为 3 起步、卡在 4 步）。

**这是对ARCH §3.3「追加 `inc` 个随机 pad」的过度实现**：架构文档的本意是「避免出现同色相邻」（只需排除序列的**最后一个元素**），实现却排除全部历史元素，与 4 色池形成根本性冲突。

#### 对照验证（证明修复方向可行）

```
对照组 · 只排除 s 的最后一个 pad（避免相邻同色），序列可增长：
  10 轮长度轨迹：1,2,3,4,5,6,7,8,9,10,11 → 可无限增长 ✅

对照组 · corsi 的实现（追加允许重复位置）：
  8 轮长度轨迹：2,3,4,5,6,7,8,9,10 → 可无限增长 ✅
```

#### 修复建议（二选一，推荐方案 A）

**方案 A（推荐，最小改动，符合原设计意图）** —— 只排除序列最后一个元素，避免同色相邻，允许历史重复：

```js
// src/games/simon/index.jsx L91
const last = s.length ? s[s.length - 1] : -1
const candidates = PADS.map((_, i) => i).filter((i) => i !== last)
const next = [...s, ...shuffleArray(candidates).slice(0, inc)]
```
> 需从 `../../difficulty.js` 引入 `shuffleArray`（已存在，无需新增依赖）。此方案下 `sampleUniqueExcluding` 若无其他调用方可一并移除（`grep` 确认仅 simon 使用）。

**方案 B** —— 放宽为「有候选就取，没有就允许重复」：
```js
const add = sampleUniqueExcluding(PADS.length, inc, s)
const next = add.length ? [...s, ...add] : [...s, s[s.length - 1]]
```
> 逻辑略绕，且末步仍是重复色，不如方案 A 干净。

> **附带提示**：`corsi`（L79）当前实现 `active[Math.floor(Math.random() * active.length)]` 是「追加允许重复」，可无限增长，**无此问题**，无需改动。这也反证了 simon 的实现是偏离了 corsi 的一致做法。

---

### 🟡 P2 · 轻微 · cancellation hard 档（10×10）在 375px 窄屏横向溢出

| 项 | 内容 |
| --- | --- |
| **严重级别** | **轻微**（仅影响窄屏观感，不影响玩法与数据） |
| **定位文件** | `src/games/cancellation/index.jsx` **L55-56**（`cellClass`）、**L66**（`gridTemplateColumns`） |
| **违反** | PRD §4.1「hard 需注意格子数过多时…建议同时约束列宽自适应」；ARCH §3.3 第 4 行「**L59 格子尺寸需随规模自适应**，否则 10×10 在窄屏溢出」；ARCH T04 完成判据①「hard **不横向溢出**（375px 宽视口）」 |
| **路由** | `ROUTE: Engineer` |

#### 复现步骤

1. 浏览器视口调至 **375px** 宽（iPhone SE / 8尺寸）
2. 大厅 → 进入「反向划消」（cancellation）
3. 遮罩内选「困难」（`size=10`）→ 点「开始」
4. 观察：10 列网格向右溢出约 23px，出现横向滚动条

#### 期望 vs 实际

```
视口 375 − main px-4 (32) − 卡片 p-6 (48) − border (2) = 293px 可用宽度
  10×10  格子 w-7=28px + gap-1=4px → 需 10×28 + 9×4 = 316px  →  溢出 23px ⚠️
  8×8    格子 w-8=32px + gap-1=4px → 需 8×32  + 7×4 = 284px  →  OK
  6×6    格子 w-9=36px + gap-1=4px → 需 6×36  + 5×4 = 236px  →  OK
```

关键点：按钮使用**固定宽度** `w-7`（`index.css` 实测 `.w-7{width:1.75rem}`），而 grid 轨道为 `minmax(0,1fr)` —— **轨道可缩、按钮不可缩**，故溢出量等于按钮总宽度之和，无法靠 `minmax(0,1fr)` 自适应吸收。

#### 修复建议

改用 `w-6`（1.5rem = 24px）并压缩 gap，或直接让格子宽度随规模进一步收敛：

```jsx
// src/games/cancellation/index.jsx L55-56
const cellClass =
  size >= 10 ? 'w-6 h-6 text-sm sm:w-7 sm:h-7'
  : size >= 8 ? 'w-8 h-8 sm:w-9 sm:h-9'
  : 'w-9 h-9 sm:w-10 sm:h-10'
// L66同时收紧 gap
<div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
```
验算：`10×24 + 9×2 = 258px ≤ 293px` ✅

---

### 🟡 P3 · 轻微 · visualsearch easy 档局内文案与「固定网格」自相矛盾

| 项 | 内容 |
| --- | --- |
| **严重级别** | **轻微**（文案一致性问题） |
| **定位文件** | `src/games/visualsearch/index.jsx` **L68** |
| **违反** | ARCH §9观察项「`howto` 去数字化若不彻底，UI 会出现自相矛盾文案」的同类问题（此次发生在局内文案而非 `howto`） |
| **路由** | `ROUTE: Engineer` |

#### 复现步骤

1. 进入「视觉搜索」（visualsearch）
2. 遮罩内选「简单」→ 观察难度卡摘要：**「6 轮 · 固定小网格」**
3. 点「开始」→ 观察局内说明文字：**「共 6 轮，网格会变大。」**
4. 实际网格全程恒为 5×5，从不变化

#### 期望 vs 实际

| | 内容 |
| --- | --- |
| **期望** | easy 档说明「网格固定为 5×5」，或按`gridRand` 动态生成说明文案 |
| **实际** | 局内文案硬编码「网格会变大」，与 easy 档「固定小网格」及实际行为三方矛盾 |

> `registry.js` 的 `howto`已正确去数字化（「共若干轮，网格会逐轮变大（轮数与网格规模由难度决定）」），**问题仅在组件内这一行**。

#### 修复建议

```jsx
// src/games/visualsearch/index.jsx L68
在网格里找出唯一的 <span className="text-2xl">★</span>，尽快点击它。共 {trials} 轮，
{gridRand > 0 ? '网格会逐轮变大。' : '网格规模固定。'}
```

---

## 2. 分组验证明细

### A 组 · 构建与静态验证

| # | 验证项 | 结果 | 说明 |
| --- | --- | --- | --- |
| A0 | `vite build` 通过 | ✅ | `✓ 56 modules transformed`（基线 50 + 新增 6 = `difficulty.js` + 5 个新组件/hook），`✓ built in 11.66s`，**0 error / 0 warning** |
| A1 | 模块数符合预期 | ✅ | 56 = 预期值 |
| A2.1 | `registry.js` 无 `stats:` 死字段 | ✅ | ARCH §1.1 声称已清理，**核实为真**；全仓 `grep stats` 仅命中 `difficulty.js` 的注释说明与 `useGameStats.js` 的 `STORAGE_PREFIX` 常量，**无任何消费点** |
| A2.2 | 无 `pct` / `steps` / `msFmt` / `span` 四个废弃 formatter | ✅ | 已彻底删除 |
| A2.3 | `registry.js` 不再 import `fmtMs` | ✅ | `fmtMs` 唯一实现在 `useGameStats.js` L13，**全项目单一定义**（符合 ARCH §8 约定） |
| A3.1 | 10 条 `howto` 无写死数字 | ✅ | 用正则 `共\d+题 / \d+×\d+ / \d+秒 / \d+对 / 上限\d+ / \d+旧 / \d+干扰 / 第\d+` 全量扫描，**0 命中** |
| A3.2 | 每条 `howto` 都说明「由难度决定」 | ✅ | 10/10 |
| A4 | **10 款游戏是否真正消费难度参数（零空挂核查）** | ✅ |见下表 |
| A4b | 三档 params 互不相同 | ✅ | 10/10，「难度选择」不是假的 |
| A4c | `medium.params` 逐字等于改造前线上默认值 | ✅ | 10/10 逐值比对通过（H5 的迁移正确性前提成立） |

#### A4 · 逐游戏 params 消费核对（重点核查项）

| 游戏 | registry 声明 | 组件解构 | 未消费 | 残留字面量常量 | 判定 |
| --- | --- | --- | --- | --- | --- |
| schulte | `size, flashMs` | `size, flashMs` | — | — | ✅ |
| stroop | `trials` | `trials` | — | — | ✅ |
| visualsearch | `trials, gridBase, gridRand` | `trials, gridBase, gridRand` | — | — | ✅ |
| cancellation | `size` | `size` | — | — | ✅ |
| tracking | `dur, speed, r` | `dur, speed, r` | — | — | ✅ |
| memorydigits | `base, maxLen, showMs` | `base, maxLen, showMs` | — | — | ✅ |
| simon | `startLen, inc` | `startLen, inc` | — | — | ⚠️ 消费了但语义失效（见 P1） |
| corsi | `pool, startLen` | `pool, startLen` | — | — | ✅ |
| memorymatch | `pairs` | `pairs` | — | — | ✅ |
| recognition | `study, showMs, distract` | `study: studyWanted, showMs, distract: distractWanted` | — | — | ✅ |

>核查方法：① 解析组件 `const {...} = params` 的解构列表（**支持 `key: localName` 重命名语法**）；② 反向扫描 `const TRIALS = ` 形式的模块级字面量常量；③ 验证解构后的本地变量在文件其他地方**确实被引用**（防止「解构了但没用」的隐性空挂）。三项全部通过 → **架构文档 §0.1 声称的「无空挂」核实为真**。

#### A4c · `medium.params` 与改造前默认值逐值比对

| 游戏 | 改造前默认 | `medium.params` | 一致 |
| --- | --- | --- | --- |
| schulte | `size=5, flashMs=350` | `{size:5, flashMs:350}` | ✅ |
| stroop | `trials=20` | `{trials:20}` | ✅ |
| visualsearch | `trials=8, gridBase=5, gridRand=3` | 同 | ✅ |
| cancellation | `size=8` | `{size:8}` | ✅ |
| tracking | `dur=30, speed=0.18, r=26` | 同 | ✅ |
| memorydigits | `base=5, maxLen=10, showMs=1500` | 同 | ✅ |
| simon | `startLen=3, inc=1` | 同 | ✅ |
| corsi | `pool=6, startLen=2` | 同 | ✅ |
| memorymatch | `pairs=8` | `{pairs:8}` | ✅ |
| recognition | `study=6, showMs=4000, distract=6` | 同 | ✅ |

---

### B 组 · 数据层纯函数验证

> 运行方式：`node` 直跑 `.qa-verify/data-layer.test.mjs`（直接 import `src/difficulty.js` 的ESM 导出）

| # | 验证项 | 结果 | 实测数据 |
| --- | --- | --- | --- |
| **B1 · session 级 upsert** | | | |
| B1.1 | 同 `sessionId` 连续 **15 次** `record` 只产生 1 条 | ✅ | 长度=1（**验证了「一局内多次上报不刷爆 10 条上限」这一关键设计**） |
| B1.2 | 该条 `accuracy` 原地演进为最终值 | ✅ | 50+i → 65 |
| B1.3 | `timestamp` 保留**首次**上报值 | ✅ | `1757000000001`（使「最近一次」在一局内稳定） |
| B1.4 | 换局（新 `sessionKey`）产生第 2 行 | ✅ | 长度=2 |
| B1.5 | 换局后按排序返回 | ✅ | 80% 在前 |
| **B2 · 排序规则** | | | |
| B2.1 | `accuracy` 降序 | ✅ | 95 第一 |
| B2.2 | 同 `accuracy` 时 `time` 升序 | ✅ | 3000ms 先于 5000ms |
| B2.3 | `acc`/`time` 全同则 `timestamp` 升序 | ✅ | 100 先于 200 |
| B2.4 | `sortRecords` 不改原数组（纯函数） | ✅ | 原数组顺序不变 |
| B2.5 | 排序结果为**全序**且可复现 | ✅ | 反向输入结果一致 |
| **B3 · 每难度各 10 条（2026-10-05 修订，取代原「全局 10 条 + 保底」）** | | | |
| B3.0 | `LEADERBOARD_LIMIT === 10`（**每难度上限**，硬约束 H1 修订版） | ✅ | 10；总容量 3×10=30 |
| B3.1 | 每难度灌 **15 条** → 各裁为 **10 条**、总 30 | ✅ | 15×3 → 10/10/10，总长 30 |
| B3.2 | ~~每个难度至少保留 1 条（保底）~~ **该条款已废止** | ✅ | 旧的 `seenDifficulty` 保底分支已从 `trimRecords` 删除；现按难度分桶各保 Top-N |
| **B3.3** | **核心判据：10 条 easy（2~3s、accuracy 与 medium 打平）+ 5 条 medium（15~16s）→ medium 5 条全部存活** | ✅ | easy=10 / medium=5。**旧实现此场景 medium 会被砍到 1 条**，是本次 Bug 的直接复现场景，现已不成立 |
| B3.3b | 12 easy + 5 medium + 5 hard → easy 裁 10、medium/hard 各留 5 | ✅ | easy=10, medium=5, hard=5 |
| B3.4 | **名额不跨难度共用**：三档已满时再写入更好成绩 → 仅在本难度内淘汰 | ✅ | easy/hard 的 **id 集合与操作前逐项相同**，未受影响 |
| B3.5 | 更差记录不入榜，且不扰动其它难度 | ✅ | 三档仍 10/10/10 |
| **B3.6** | **A 难度的劣记录绝不挤掉 B 难度的优记录** | ✅ | 由 B3.3 / B3.4 双向验证 |
| B3.7 | 只有 1 个难度有记录时不浪费名额 | ✅ | medium 可保留满 10 条 |
| B3.8 | `trimRecords` 幂等 | ✅ | 二次/三次裁剪输出 id 序列完全一致 |
| B3.9 | 未知/非法难度值（如 `'extreme'`）**隔离成独立桶**，不抢占三档名额 | ✅ | 三档各 10 + extreme=3 |
| B3.10 | 缺 `difficulty` 的记录归入默认档 `medium`；脏数据（null/NaN/非法类型）不抛异常 | ✅ | `groupRecordsByDifficulty` 与 `trimRecords` 均通过 |
| **B4 · 旧数据迁移** | | | |
| B4.1~4.7 | 旧结构 `{accuracy:{best,recent}, time:{best,recent}}` → 2 条 `medium` 记录 | ✅ | `92/38120` 与 `88/45600` **零丢失**，`migrated:true`，哨兵时间戳 1/2 |
| B4.8 | **14 种异常输入均返回合法 `StatsStore` 且不抛异常** | ✅ | 覆盖 `null` / `undefined` / `[]` / `{}` / `0` / `''` / `'abc'` / `{v:1,records:[]}` / `{v:2}` / `[1,2,3]` / `{accuracy:null,time:null}` / `{accuracy:{best:0}}` / `{stats:'x'}`——**验证了 ARCH R-3 强调的「绝不抛异常，否则被 `try/catch` 静默吞掉导致旧数据被默认值覆盖」这一最大丢数据风险已规避** |
| B4.9~4.11 | 迁移后 `best`/`recent` 派生方向正确、`best` 排在 `recent` 前 | ✅ | 92%/38120ms vs 88%/45600ms |
| B4.12 | 已是 v1 但每难度含 15 条 → 读时按难度各收敛到 10 条（总 30） | ✅ | 15×3 → 10/10/10；旧的单难度 15 → 10 亦成立 |
| **B5 · time=null 兜底** | | | |
| B5.1 | 同 `accuracy` 时 `time=null` **垫底** | ✅ | `n2(90,8000)` → `n1(90,null)` |
| B5.2 | `accuracy` 更低者即使 `time` 更小也排在后面（**主键优先级正确**） | ✅ | `n3(70,1000)` 排末位 |
| B5.3 | `best time = min(全部非null)` | ✅ | 1000 |
| B5.4 | `recent` 取 `timestamp` 最大者，其 `time` 为 `null` 时正确返回 `null` | ✅ | `null` |
| B5.5 | `accuracy=null` 视为最差（`-1`） | ✅ | — |
| B5.6 | `time` 全为 `null` 时不崩溃且可排序 | ✅ | 按 timestamp 升序 |
| **B6 · best/recent 派生** | | | |
| B6.1 | `accuracy best = max`（越高越好） | ✅ | 95 |
| B6.2 | `time best = min`（**越低越好，方向正确**） | ✅ | 20000 |
| B6.3 | `recent = timestamp` 最大者 | ✅ | 80/20000 |
| B6.4 | 按难度分区**互不串扰**（D-03） | ✅ | easy 独立得 99/1000 |
| B6.5 | 无记录难度返回全 `null` | ✅ | — |
| B6.6 | **从 records 现算而非独立存储**（D-2） | ✅ | records 变化时 best 随之变化 |
| **B7 · 随机工具** | | | |
| B7.1~7.3 | `sampleUnique` 不重复 / 值域正确 / k>n 退化 | ✅ | 各300 次循环 |
| B7.4 | `sampleUniqueExcluding` 追加步不与已有 pad 重复 | ✅ | 300 次 |
| **B7.5** | **simon 4 色用满后追加步> 0** | ❌ | **见 P1（源码 Bug）** |
| B7.6 | corsi easy 起始 2 步互不重复 | ✅ | 300 次 |
| B7.7 | memorymatch hard 取 10 对，16 池冗余 6 | ✅ | — |
| B7.8 | recognition hard `study(8)+distract(10)=18 ≤ 20` | ✅ | 有 2 个余量 |
| **B8 · 数值安全护栏** | | | |
| B8.1 | corsi hard `pool=9 ≤ POS.length=9` | ✅ | — |
| B8.2 | memorymatch hard `pairs=10 ≤ SYMS.length=16` | ✅ | — |
| B8.3 | visualsearch easy `gridRand=0` → 网格恒为 5 | ✅ | `Math.floor(rand(0))=0` |
| B8.4 | visualsearch medium 网格落在 5~7 | ✅ | 200 次采样覆盖 3 个值 |
| B8.5 | visualsearch hard 网格落在 7~8 | ✅ | 200 次采样覆盖 2 个值 |

> **B8.3~8.5 附带确认**：ARCH §0.1 补充项 F 声称「修正了 `visualsearch` 原 L26 `gen(5+rand(3))` 与 L43 `gen(5+rand(4))` 不一致的既存bug」——**核实为真**。现源码统一由 `src/games/visualsearch/index.jsx` L27 `gen(gridBase + Math.floor(Math.random() * gridRand))` 单点驱动。

---

### C 组 · 遮罩行为验证（SSR 渲染实证）

> 方法：用 `esbuild` 打包测试入口 + `react-dom/server` 的 `renderToStaticMarkup` 渲染真实组件树。
> **采用自动差分法**避免误判：从游戏本体 HTML 中自动提取「仅游戏特有」的 class 名与文本片段，再断言这些特征**100% 不出现在遮罩 HTML 中**。

| # | 验证项 | 结果 | 说明 |
| --- | --- | --- | --- |
| C1 | **10 款游戏遮罩期零内容泄露** | ✅ | 遮罩态按钮数**恒为 10**，与游戏本体差异 class 全部为 0 |
| C2 | **反向对照**（证明检测有区分度） | ✅ | 单独挂载 `memorymatch` 时输出 `已配对：0/10`，与遮罩态完全不同 |
| C3 | 遮罩恰好 10 个按钮 | ✅ | 顶部返回大厅 + 3 张难度卡 + 开始 + 底部返回大厅 + 排行榜（折叠/当前/全部/清空） |
| C4 | **`memorymatch` 重点核查** | ✅ | 遮罩期不含 `grid-cols-4` 牌面网格、不含「步数：」对局状态 |
| C5 | **遮罩用条件渲染而非 CSS 隐藏** | ✅ | `GameView.jsx` L116-126 为 `{started ? <GameComponent/> : <StartGate/>}`；全文件无 `hidden` / `opacity-0` / `invisible` |
| C6 | `StartGate` 用**不透明** `bg-white`（无半透明蒙版） | ✅ | 无 `bg-slate-900/` / `bg-black/` 类|
| C7 | **`Timer` 遮罩期不渲染**（D-10） | ✅ | 遮罩 HTML 无 `⏱` 图标；单独渲染 `Timer` 初始值为 `00:00.00` → **计时器天然从 0 开始，Timer.jsx 零改动** |
| C8 | 遮罩期显示「未开始」徽标 | ✅ | `GameView.jsx` L99-101 |
| C9 | 难度偏好从 `gamehub:difficulty` 读回 | ✅ | 预置 `{schulte:'hard'}` → 侧栏显示「当前：困难」 |
| C10 | 三档摘要同时呈现 | ✅ | 3×3/5×5/6×6 闪现时长均正确显示 |
| C11 | 恰有 1 张难度卡 `aria-pressed="true"`（D-18） | ✅ | — |
| C12 | 遮罩内容完整性 | ✅ | 图标 + 游戏名 + 简介 + 玩法卡 + 难度选择器 + 开始 + 返回大厅 |

#### C4 补充说明 —— 为什么「条件渲染」是唯一可行方案（实证）

SSR 单独挂载 `memorymatch(hard)` 时输出：
```
翻出两两相同的图案。步数： 0 · 已配对：0/10 重新开始 同难度重开
```
**牌面数为 0** —— 因为 `cards` 完全由 `useEffect(() => { start() }, [sessionId])`（L35）在**挂载后**生成。这从实证角度证明：

> 若改用 CSS 隐藏（`hidden` / `opacity-0`），组件**仍然挂载** → `useEffect(start)` 照常执行 → 生成 20 张 `?` 占位牌面并启动对局计时 → **遮罩「看起来挡住了，实际已泄露」**。
> 架构文档 §4.3 / PRD D-08 对此的判断**完全正确**，当前实现正确地采用了条件渲染。

---

### D 组 · 回归验证

| # | 验证项 | 结果 | 说明 |
| --- | --- | --- | --- |
| D1 | 舒尔特瞬时绿/红闪反馈 | ✅ | 点对 → `bg-emerald-200`；点错 → `bg-rose-200`；复原走 `setTimeout(() => setFlash(null), flashMs)`，**无持久变色** |
| D1b | `flashMs` 与 registry 一致 | ✅ | easy/medium = 350ms，hard = 250ms（**hard 反馈更快，符合 PRD §4.1**） |
| D2 | 大厅分组逻辑保留 | ✅ | `App.jsx` 仍按 `game.category` 分组，保持首次出现顺序（专注力 → 记忆力） |
| D3 | 「返回大厅」入口保留 | ✅ | `GameView.jsx` L104-110 `onClick={onBack}` |
| D4 | 底部玩法介绍保留 | ✅ | `GameView.jsx` L137 `<GameFooter intro={game.intro} howto={game.howto} />` |
| D5 | 10 款游戏均提供 `restartToGate` + `restartSame` 双入口 | ✅ | 与 H4 / D-11 一致 |
| D6 | 10 款游戏均为「挂载即开局」 | ✅ | 9 款用 `useEffect(..., [sessionId])`；schulte 用等价的 `useEffect(..., [size, newGame])`（`newGame` 由 `size` 派生）。**10/10 无局内 idle「开始」按钮**（D-06达成） |
| D7 | 未新增 npm 依赖 | ✅ | `dependencies` 仅 `react` / `react-dom` |

---

### E 组 · 排行榜 UI 端到端（SSR）

| # | 验证项 | 结果 |
| --- | --- | --- |
| E1 | `scope=current` 只列当前难度记录 | ✅（实测 4 行） |
| E2 | `scope=current` 行内不显示难度 chip | ✅ |
| E3 | 头部含「当前难度 / 全部难度」切换 | ✅ |
| E4 | 底部说明含「**每个难度**最多保留 10 条，各难度成绩互不影响、分别排名」 | ✅ | 文案已随 §2.5 修订同步 |
| E5 | 「全部难度」视图渲染为 Easy/Medium/Hard **三个并列子榜**，各组名次从 1 重新开始（真实 SSR 渲染取证，名次序列 = `1..10 / 1..5 / 1..3`） | ✅ | 无跨难度扁平 `1..N` 序列 |
| E6 | 「当前难度」视图只渲染该难度、名次严格 1..N | ✅ | 渲染 HTML 名次 `[1,2,3,4,5]`，且不含其它难度的用时 |
| E5 | 有「清空本游戏记录」入口，**非 `window.confirm`** | ✅ |
| E6 | 未确认时不显示「确认清空」 | ✅ |
| E7 | 当前难度无记录 → 二级空态 + 「查看全部难度」 | ✅ |
| E8 | `records` 为空 → 「暂无成绩，快去玩一局」 | ✅ |
| E9 | `time=null` → 时间列显示 `—` | ✅ |
| E10 | `time=null` → 日期列显示真实 `MM-DD`（非「历史」） | ✅ |
| E11 | `migrated` 记录 → 日期列显示「历史」而非 `01-01` | ✅ |
| E12 | `StatSidebar` 上区 best/recent **跟随难度** | ✅（`difficulty='hard'` → 95%/91%） |
| E13 | `StatSidebar` 底部说明含「按难度分区（当前：困难）」 | ✅（行为变更已正确文案化） |
| E14 | `StatSidebar` 下区挂载排行榜（H2 上下分区同屏） | ✅ |
| E15 | `StatSidebar` 本身不持有状态 | ✅（无 `useState`） |

**端到端迁移实证**：预置 `gamehub:stats:schulte = {"accuracy":{"best":92,"recent":88},"time":{"best":38120,"recent":45600}}` 后渲染，侧栏与排行榜输出：
```
正确率 历史最优 92% 最近 88% | 时间 历史最优 00:38.12 最近 00:45.60
▾ 排行榜  名次 正确率 时间 日期  1 92% 00:38.12 历史  2 88% 00:45.60 历史
```
→ **旧数据零丢失正确归入 medium，日期列正确显示「历史」** ✅

---

### F/G 组 · 布局与文案

| # | 验证项 | 结果 |
| --- | --- | --- |
| F1 | cancellation medium 8×8 @375px 不溢出（284px ≤ 293px） | ✅ |
| F2 | **cancellation hard 10×10 @375px 不溢出** | ❌ **见 P2**（316px > 293px，溢出 23px） |
| G1 | visualsearch easy summary 「固定小网格」与 `gridRand=0` 自洽 | ✅ |
| G2 | **visualsearch easy 局内文案区分固定/渐变网格** | ❌ **见 P3** |

---

## 3. 硬约束逐条核对

| # | 硬约束 | 结果 | 证据 |
| --- | --- | --- | --- |
| H1 | 排行榜**每个难度各保留 10 条**（总上限 3×10=30），**名额不跨难度共用** | ✅ | `LEADERBOARD_LIMIT = 10`（`difficulty.js` L61）；核心回归 B3.3：10 easy + 5 medium → **medium 5 条全存活**（旧实现砍至 1 条）。⚠️ 2026-10-05 由「全局 10 条」修订而来 |
| H2 | 排行榜展示在游戏内**右侧栏**，与 best/recent 同屏（上下分区） | ✅ | `StatSidebar` L27-47 上区两张卡 + L48-50 `border-t border-slate-100 pt-4` 下区排行榜 |
| H3 | **遮罩页内含难度选择器**，点「开始」才进入游戏 | ✅ | `StartGate` L36-38 内嵌 `DifficultyPicker`；L41-49 主按钮「开始」 |
| H4 | 游戏中「重新开始」→ **回遮罩页重选难度** | ✅ | 10/10 游戏主按钮 `onClick={restartToGate}` → `GameView.jsx` L54-56 `setStarted(false)`；`DifficultyChip` 亦为 `onClick={restartToGate}` |
| H5 | `medium` = 改造前默认参数；旧数据归入 medium；~~每难度至少留 1 条~~（**该条款已于 2026-10-05 废止**，改为按难度分桶各保 Top-N） | ✅ | A4c 表 10/10 一致；B4.2 归入 medium；B3.2 已验证保底分支被移除 |
| — | tracking的 `time` 用**难度时长填充**，不为 null | ✅ | `tracking/index.jsx` L56 `record({ accuracy: score, time: dur * 1000 })` |
| — | 不新增 npm 依赖 | ✅ | `dependencies` = `{react, react-dom}` |

---

## 4. 修复优先级与建议

| 优先级 | 问题 | 严重级别 | 建议 |
| --- | --- | --- | --- |
| P0 | — | — | 无阻断问题，可正常发布流程 |
| **P1** | simon 序列卡死在 4 步，`hard` 档失效 | **严重** | 按 P1 方案 A 修复（`simon/index.jsx` L91 只排除序列最后一个元素）；修完请回归三档长度轨迹 |
| P2 | cancellation hard 10×10 窄屏溢出 23px | 轻微 | `cellClass` hard 档改 `w-6` + `gap-0.5` |
| P3 | visualsearch easy 局内文案矛盾 | 轻微 | L68 按 `gridRand > 0` 动态生成文案 |

---

## 5. QA 自纠错记录（测试代码自身的 Bug，已修正，不计入源码缺陷）

验证过程中我最初的测试脚本出现 5 处缺陷，均已复核定位为 **QA 侧问题**并修正：

| # | 我的错误断言 | 实际情况 | 判定 |
| --- | --- | --- | --- |
| 1 | B5.1/B5.2 断言索引写错（`s[1]`/`s[2]`） | 源码 `compareRecords` 行为**完全正确**：`n2 → n1 → n3`，`accuracy` 主键优先级、`time=null` 垫底均符合 ARCH §2.4 | ROUTE: QA（已修） |
| 2 | B5.3 期望 `bestTime=8000` | 忽略了 `n3` 的 `time=1000` 更小，正确答案是 **1000**，源码正确 | ROUTE: QA（已修） |
| 3 | A4recognition 报「`study`/`distract` 未消费」 | 源码用 `study: studyWanted` 重命名以避开与 `useState` 的 `study` 同名，我的正则未处理重命名语法。**源码正确** | ROUTE: QA（已修） |
| 4 | D6 报 schulte「无 `sessionId` 自动开局」 | schulte 用等价的 `[size, newGame]`（`newGame` 由 `size` 派生）。**源码正确** | ROUTE: QA（已修） |
| 5 | C 组用中文文案做泄露判据，6 款游戏误报 | 命中的是 `StartGate` **合法展示**的 `game.howto` 文本（如「读出」「划掉」）。改用**自动差分法**（仅游戏特有的 class + 文本片段）后 **10/10 零泄露** | ROUTE: QA（已修） |

> 另有一处**方法论限制**（非 Bug）：SSR 不执行 `useEffect`，故无法在 SSR 下验证「挂载后生成 20 张牌」与「遮罩期不挂载」的动态差异。本报告改用「静态代码走查 + SSR 结构差分 + 遮罩态按钮预算恒为 10」三重交叉验证达成同等结论，并在 C4 中给出实证推理。

---

## 6. 临时脚本清理确认

本次验证在 `D:/public/软件设计/game-hub/.qa-verify/` 下创建了以下临时验证脚本：

| 文件 | 用途 |
| --- | --- |
| `data-layer.test.mjs` | B 组 · 数据层纯函数验证（59 例） |
| `bug-analysis.mjs` | P1 simon 缺陷复现与影响评估 |
| `gate-render.test.jsx` + `gate-render.bundle.mjs` | C 组 · 遮罩行为 SSR 实证（28 例） |
| `static-audit.test.mjs` + `static-audit.bundle.mjs` | A/D 组 · 静态核查与回归（57 例） |
| `d6-check.mjs` + `d6.bundle.mjs` | D6 单项复核 |
| `ui-e2e.test.jsx` + `ui-e2e.bundle.mjs` | E/F/G 组 · 排行榜 UI 端到端（20 例） |

✅ **已全部删除**（`rm -rf .qa-verify`），项目根目录已恢复干净（仅余原有 `dist` / `docs` / `src` 等）。
✅ **源码零改动** —— 本次验证全程只读，未修改任何 `src/**` 文件（问题仅报告，不修复，修复由工程师负责）。

---

## 7. 最终判定

```
╔══════════════════════════════════════════════════════════════╗
║  验证结论：FAIL                                           ║
║                                                              ║
║  构建：✅ 通过（56 modules，0 error / 0 warning）             ║
║  阻断问题：0 个│
║  严重问题：1 个（P1 · simon 序列卡死在 4 步）                 ║
║  轻微问题：2 个（P2 · cancellation 溢出 / P3 · visualsearch 文案）║
║                                                              ║
║  需求 1（难度选择）：⚠️ 部分达成（simon 难度轴失效）           ║
║  需求 2（分别记录排行榜）：✅ 达成                             ║
║ 需求 3（开始前遮罩）：✅ 达成                                  ║
║  硬约束 H1~H5：✅ 全部满足                                    ║
║                                                              ║
║  ROUTE: Engineer║
║  （P1 需工程师修复；P2/P3 建议一并处理）                      ║
╚══════════════════════════════════════════════════════════════╝
```

**移交工程师的修复清单**：

| # | 文件 | 行号 | 修复内容 |
| --- | --- | --- | --- |
| P1 | `src/games/simon/index.jsx` | **L91** | `sampleUniqueExcluding(PADS.length, inc, s)` → 只排除序列**最后一个** pad，避免同色相邻但允许历史重复（参照 P1 方案 A）。修复后 `sampleUniqueExcluding` 若无其他调用方可移除 |
| P2 | `src/games/cancellation/index.jsx` | **L55-56, L66** | hard 档 `cellClass` 由 `w-7` 改 `w-6`（+ `text-sm`），grid `gap-1` 改 `gap-0.5` |
| P3 | `src/games/visualsearch/index.jsx` | **L68** | 「网格会变大」改为按 `gridRand > 0 ? '网格会逐轮变大。' : '网格规模固定。'` 动态生成 |

**回归要求**：P1 修复后必须回归 simon 三档序列长度轨迹（期望 easy `2,3,4,5,6…` / medium `3,4,5,6…` / hard `3,5,7,9…`），并确认 `vite build` 仍为 56 modules、0 warning。

---

## 8. 2026-10-05 追加：排行榜跨难度混排 Bug 修复回归

> 本节为**增量追加**，不修改上文第一轮的 FAIL 判定（那是当时的真实结论，三个问题均已修复完毕）。

### 8.1 背景与 Bug 报告

用户反馈排行榜两个问题：① 排行榜把 easy（2~3 秒）与 medium（15~16 秒）**混进同一名次序列**，跨难度不可比；② **某个难度有排行榜，换一个难度就没有排行榜**（或只剩零星 1 条）。

### 8.2 根因（已定位）

`trimRecords` 对全部难度的记录做**全局 Top-10 裁剪**，跨难度共用名额。

`compareRecords` 排序键为 `accuracy` 降序 → `time` 升序 → `timestamp` → `id`。由于**次级键 `time` 升序在不同难度间天然不可比**，而此类游戏 `accuracy` 满分集中、打平是常态，于是 easy 会系统性占满 10 个名额，把 medium/hard 挤掉；旧的 `seenDifficulty`「每难度保底第 1 名」分支只能给每个难度死保 1 条——这正是用户看到「换个难度只剩零星 1 条」的直接来源。

### 8.3 修复内容

| 文件 | 改动 |
| --- | --- |
| `src/difficulty.js` | `trimRecords` 重写为**按难度分桶、各桶独立取前 10**；删除 `seenDifficulty` 保底分支；新增导出 `groupRecordsByDifficulty(records)`；总容量 3×10=30 |
| `src/components/Leaderboard.jsx` | 抽出 `GroupBlock`，名次由**组内下标**计算；「全部难度」改为三个并列子榜；说明文案同步 |

### 8.4 回归结果：**PASS**（43 项断言全通过，0 源码 Bug）

| 组别 | 通过 | 关键证据 |
| --- | --- | --- |
| A 核心回归 | ✅ | **10 easy + 5 medium → medium 5 条全保留**（旧实现砍至 1 条）；三档满 30 后写入新记录不扰动其它难度 |
| B 语义保持 | ✅ | `upsertRecord` 保留首次时间戳（session 语义未回退）；`compareRecords`/`sortRecords` 源码逐行比对未变；`deriveBestRecent` 在 30 条下按难度正确派生且不被别的难度污染 |
| C 健壮性 | ✅ | 旧数据、11 种 `migrateStats` 异常输入、脏记录（null/NaN/未知难度）均不抛异常；非法难度隔离独立桶 |
| D UI 正确性 | ✅ | 用 esbuild + `react-dom/server` **真实 SSR 渲染**取证：「全部难度」名次序列 = `1..10 / 1..5 / 1..3`；`Leaderboard.jsx:56/61` 名次为组内下标；`components/` 下 `.map((x, i)` 仅此 1 处，**无全局名次计数器** |
| E 集成构建 | ✅ | 全 `src/` 检索无残留「全局 ≤10 条」假设；`npx vite build` **56 modules，0 error / 0 warning** |

**ROUTE: NoOne**（发现的 3 处失败均属测试脚本自身断言错误，已由 QA 自行修复，未触碰源码）。

### 8.5 已知限制

曾被全局裁剪挤掉的 medium/hard 历史成绩**无法恢复**（localStorage 中已丢失），按约定不做数据回填；修复后新记录按新规则各自累积。

### 8.6 低优先级遗留（不阻塞，当前路径不可达）

1. `trimRecords` / `groupRecordsByDifficulty` 只分桶、不回填 `r.difficulty`；当前两条写入路径（`upsertRecord`、`migrateStats`）都走 `normalizeRecord`，已由 B3.10 断言安全。
2. `Leaderboard` 自身无显示级 10 条上限，依赖 props 契约「records 已裁剪」；可加 `slice(0, LEADERBOARD_LIMIT)` 增强抗脏数据能力。
3. 缺失/非法 `difficulty` 的记录归入 **medium** 桶并占用 medium 名额；`'extreme'` 这类字符串型非法值独立成桶不占名额。

---

## 9. 追加：H2「排行榜在右侧栏」已被取代

> 本节为**增量追加**，不修改上文第一轮与第二轮的判定 —— 那些是当时的真实结论。

### 9.1 背景

计分体系从「全站固定 正确率 + 时间」改为**按游戏声明**（`registry.js` 的 `scoring`）后，
排行榜的列数随游戏变化，最多可达 **6 列**（名次 + 吞吐量 + 综合分 + 正确率 + 用时 + 日期）。

此时 H2（排行榜在 256px 侧栏内、与 best/recent 上下分区）变得**不可行**。实测（1280px 视口、斯特鲁普 6 列）：

| 项 | H2 时期实测 | 说明 |
| --- | --- | --- |
| 榜可视区 | 214 × 192 px | 侧栏 `lg:w-64` 再减去内边距 |
| 指标列宽 | **25 px / 列** | "12.80 题/s" 需要约 60px，**装不下** |
| 表头字号 | 10 px | 明显偏小 |
| 可见行数 | 5 / 10 | 另 5 行需在 192px 内滚动 |
| 行高 | 36 px | |

即：**评分改造让 H2 的前提消失了** —— H2 成立时排行榜只有 2 个指标列，25px×4 的宽度绰绰有余。

### 9.2 变更

**排行榜移出侧栏，改为游戏下方的全宽面板**；侧栏只保留「历史最优 / 最近」摘要卡。

| 项 | 改后（1280px，6 列） | 改后（375px，6 列） |
| --- | --- | --- |
| 榜面板 | 960 × 592 px | 343 × 639 px |
| 指标列宽 | **186 px / 列** | **112 px / 列** |
| 表头 / 单元格字号 | 12 px / 14 px | 12 px / 14 px |
| 行高 | 44 px | 44 px |
| 可见行数 | **10 / 10，无内滚动** | **10 / 10，无内滚动** |
| 单元格截断 | 无 | 无（列宽保底 7rem，横向滚动） |
| 页面横向溢出 | 无 | 无 |

其它调整：

- 「全部难度」视图的三���子榜由**堆叠**改为 `md:2列 / xl:3列` **并排**（堆叠会长到 1000px 以上）；
- 网格列宽改为 `minmax(7rem, 1fr)` + 外层 `overflow-x-auto`：
  宽屏均分撑满，窄屏保底 7rem 不压缩，横向滑动查看 —— **宁可滑动也不截断数值**；
- 行高 36px → 44px，表头 10px → 12px，单元格 14px，加隔行浅底与 `whitespace-nowrap`。

### 9.3 回归

| # | 验证项 | 结果 | 证据 |
| --- | --- | --- | --- |
| F1 | 1440 / 1280 / 768 / 375 四视口无单元格截断 | ✅ | 6 列与 4 列游戏各测 4 个视口 |
| F2 | 四视口页面均无横向溢出 | ✅ | `scrollWidth ≤ innerWidth` |
| F3 | 「当前难度」完整显示 10 行、无内滚动 | ✅ | 行高 44px × 10 |
| F4 | 表格已移出侧栏（`aside` 内无 `ul`） | ✅ | DOM 断言 |
| F5 | 「全部难度」三个子榜并排同一行、各自从 1 开始 | ✅ | `top=872,872,872`；名次最大 10（无扁平 1..30） |
| F6 | 折叠 / 展开 | ✅ | `ul` 数量 1 → 0 → 1 |
| F7 | 清空二次确认（取消不生效 / 确认清空 / 空态文案） | ✅ | 30 → 30 → 0 条 |
| F8 | 侧栏摘要卡仍在（4 张） | ✅ | 吞吐量 / 综合分 / 正确率 / 用时 |
| F9 | 控制台无报错 | ✅ | 0 条 |

### 9.4 对既有判定的影响

- **E14**（「`StatSidebar` 下区挂载排行榜」）→ ❌ **不再成立**，已由本节 9.2 取代。
- **H2** → **已废止**，理由见 9.1。
- 其余判定（H1、H3~H5、跨难度分桶、名次语义、清空确认、migrated 日期显示）**全部不受影响**，
  已在 9.3 重新验证关键项。