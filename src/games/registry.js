/**
 * 游戏注册表 —— 整个应用唯一的游戏来源（single source of truth）。
 *
 * 每个条目形如：
 *   {
 *     id:          'schulte',             // 唯一标识，用于 state 切换
 *     name:        '舒尔特表',            // 卡片展示名称
 *     description: '按顺序点击数字...',     // 卡片简短描述
 *     icon:        '🔢',                 // emoji 或内联 SVG（建议 emoji）
 *     category:    '专注力',              // 分组标签（大厅据此归类展示）
 *     difficulties: {                     // 三档难度（全游戏统一入口）
 *       easy:   { label: '简单', summary: '3×3 · 约 1 分钟', params: { size: 3 } },
 *       medium: { label: '中等', summary: '5×5 · 约 3 分钟', params: { size: 5 } },
 *       hard:   { label: '困难', summary: '6×6 · 约 6 分钟', params: { size: 6 } },
 *     },
 *     intro:       '一句话介绍',           // 底部"游戏介绍"
 *     howto:       '玩法说明',             // 底部"玩法" / 遮罩玩法卡片
 *     component:   SchulteGame,         // 默认导出的 React 组件
 *   }
 *
 * ============================================================
 * 如何新增一个游戏（可插拔扩展）
 * ------------------------------------------------------------
 * 1) 在 src/games/<gameId>/ 下新建文件夹，例如 src/games/snake/。
 * 2) 在该文件夹里创建默认导出的 React 组件，例如 src/games/snake/index.jsx：
 *        import { useGameSession } from '../../hooks/useGameStats.js'
 *        export default function SnakeGame() {
 *          const { params, record } = useGameSession()
 *          const { size } = params
 *          return <div>...</div>
 *        }
 * 3) 在本文件顶部 import 该组件：
 *        import SnakeGame from './snake/index.jsx'
 * 4) 在下方数组里追加一条（**必须声明 easy/medium/hard 三档 difficulties**）：
 *        {
 *          id: 'snake', name: '贪吃蛇', description: '...', icon: '🐍',
 *          category: '专注力',
 *          difficulties: {
 *            easy:   { label: '简单', summary: '慢速 · 小场地', params: { size: 10, speed: 0.2 } },
 *            medium: { label: '中等', summary: '标准 · 普通场地', params: { size: 16, speed: 0.3 } },
 *            hard:   { label: '困难', summary: '快速 · 大场地', params: { size: 20, speed: 0.45 } },
 *          },
 *          intro: '...', howto: '...',
 *          component: SnakeGame,
 *        }
 *    完成，无需改动 App / 大厅 / 路由等任何其它代码。
 *
 * 约定（务必遵守，否则会出现「定义了 difficulties 但游戏没消费」的空挂）：
 * - difficulties 的三个键固定为 easy / medium / hard，params 必须是**扁平标量**对象
 *   （只允许 number | string | boolean，禁止嵌套与函数），保证可序列化。
 * - label 固定为 简单 / 中等 / 困难；summary 需**手写**（不从 params 反推，
 *   因为 params 的键名对用户无意义），建议写成「关键参数 · 时长预估」。
 * - medium.params 必须等于游戏改造前的默认值，它是旧数据迁移正确性的前提。
 * - 组件内**不得**再把训练参数写成模块级常量，一律从
 *   `const { params } = useGameSession()` 解构。
 * - **StrictMode 安全（务必遵守）**：main.jsx 开启了 React.StrictMode，开发模式下副作用会被
 *   「挂载 → cleanup → 再挂载」重放一次。禁止用「startedFor.current === sessionId 就 return」
 *   的幂等守卫配合**独立的** cleanup effect —— 那会让第一次注册的定时器被清掉、第二次挂载
 *   又被守卫挡掉，表现为序列冻结在第一个 / 倒计时永不触发。
 *   ⚠ 该类 bug **只在 dev 出现，生产构建完全正常**，肉眼与生产验证都发现不了。
 *   正确写法：注册副作用与清理副作用写在**同一个 effect** 内，依赖只写 `[sessionId]`；
 *   `[sessionId]` 本身已保证「换局才重开」，幂等守卫本就多余。
 * - 局内重开统一用 `<RestartBar restartToGate={restartToGate} restartSame={restartSame} />`，
 *   「重新开始（回遮罩换难度）」与「同难度重开」两个入口必须成对出现，不要各自手写。
 * - howto / intro 文案**不要写死具体数字**（如「共 20 题」「8×8」），
 *   数字统一交给 difficulties[].summary，否则会与用户选择的难度自相矛盾。
 * - 游戏结束时调用 `useGameSession().record({ accuracy, time })` 上报成绩；
 *   难度与 sessionKey 由 GameView 经 Context 注入，无需自己传。
 * ============================================================
 *
 * @typedef {Object} DifficultyOption
 * @property {string} label   简单 / 中等 / 困难
 * @property {string} summary 参数摘要（手写，展示用）
 * @property {number} [par]   **及格用时（毫秒）**：评分用的时间基准，
 *                            由 scoring.js 折算成速度系数。只有限时类游戏需要。
 * @property {Object} params  扁平标量参数对象（游戏消费用）
 *
 * @typedef {Object} ScoringSpec
 * @property {'span'|'tps'|'composite'|'rate'} family 计分家族，决定口径（见 scoring.js）
 * @property {string} unit  计数单位（题 / 轮 / 格 / 位 / 步），用于吞吐量与跨度格式化
 * @property {Array<import('../scoring.js').MetricDef>} metrics 该游戏展示的指标列，
 *                            顺序即 UI 列顺序；**第一项是排序指标**
 *
 * @typedef {Object} GameEntry
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {import('react').ReactNode} icon
 * @property {string} [category]
 * @property {Record<'easy'|'medium'|'hard', DifficultyOption>} difficulties
 * @property {ScoringSpec} [scoring] 计分口径声明；缺失时 UI 回退到「正确率 + 时间」
 * @property {string} [intro]
 * @property {string} [howto]
 * @property {import('react').ComponentType} component
 */

import SchulteGame from './schulte/index.jsx'
import MemoryDigitsGame from './memorydigits/index.jsx'
import StroopGame from './stroop/index.jsx'
import VisualSearchGame from './visualsearch/index.jsx'
import CancellationGame from './cancellation/index.jsx'
import TrackingGame from './tracking/index.jsx'
import SimonGame from './simon/index.jsx'
import CorsiGame from './corsi/index.jsx'
import MemoryMatchGame from './memorymatch/index.jsx'
import RecognitionGame from './recognition/index.jsx'
import {
  metric,
  fmtMs,
  fmtPct,
  fmtScore,
  fmtTps,
  fmtWithUnit,
} from '../scoring.js'

// ────────────────────────────────────────────────────────────
// 常用指标定义（各游戏按需组合，避免 10 个条目重复写 format）
// ⚠ metrics[0] 即排行榜的**排序指标**，也是侧栏第一张卡，应放最能代表该游戏水平的项。
// ────────────────────────────────────────────────────────────
const M_SCORE = metric('score', '综合分', true, fmtScore)
const M_ACC = metric('accuracy', '正确率', true, fmtPct)
const M_TIME = metric('time', '用时', false, fmtMs)

/** @type {GameEntry[]} */
export const games = [
  // ---------------- 专注力 ----------------
  {
    id: 'schulte',
    name: '舒尔特表',
    description: '按顺序点击数字，训练注意力与视觉搜索速度。',
    icon: '🔢',
    category: '专注力',
    difficulties: {
      easy: { label: '简单', summary: '3×3 · 闪现 0.35s', par: 20000, params: { size: 3, flashMs: 350 } },
      medium: { label: '中等', summary: '5×5 · 闪现 0.35s', par: 65000, params: { size: 5, flashMs: 350 } },
      hard: { label: '困难', summary: '6×6 · 闪现 0.25s', par: 120000, params: { size: 6, flashMs: 250 } },
    },
    scoring: {
      family: 'composite',
      unit: '格',
      // 舒尔特表是「限定规模、限时找数」：对与快都必须，缺一不可 → 综合分
      metrics: [M_SCORE, M_ACC, M_TIME],
    },
    intro:
      '舒尔特表（Schulte Table）是经典的注意力与视觉搜索训练工具，通过快速按顺序寻找数字，提升阅读速度与专注稳定性。',
    howto:
      '在网格中按 1→2→3… 的顺序依次点击数字，直到全部完成；开始前选择难度，网格规模与反馈闪现时长会随难度变化。用时越短、错点越少越好。',
    component: SchulteGame,
  },
  {
    id: 'stroop',
    name: '斯特鲁普干扰',
    description: '字义与颜色冲突，点出文字真正的颜色，抗干扰反应。',
    icon: '🌈',
    category: '专注力',
    difficulties: {
      easy: { label: '简单', summary: '10 题 · 4 色', par: 12000, params: { trials: 10 } },
      medium: { label: '中等', summary: '20 题 · 4 色', par: 23000, params: { trials: 20 } },
      hard: { label: '困难', summary: '30 题 · 4 色', par: 34000, params: { trials: 30 } },
    },
    scoring: {
      family: 'tps',
      unit: '题',
      // 斯特鲁普考的是「单位时间处理多少干扰刺激」→ 吞吐量是本游戏的主指标
      metrics: [metric('tps', '吞吐量', true, fmtTps('题')), M_SCORE, M_ACC, M_TIME],
    },
    intro:
      '斯特鲁普效应（Stroop Effect）揭示：当字义与颜色冲突时，大脑会被字义自动干扰，这是测抗干扰能力的经典范式。',
    howto:
      '读出文字的“颜色”（不是字义），点击对应的颜色按钮。题量由难度决定，颜色按钮恒为四种。系统统计正确率、平均反应时与得分。',
    component: StroopGame,
  },
  {
    id: 'visualsearch',
    name: '视觉搜索',
    description: '在人群中找出唯一的星星，练就又快又准的搜索力。',
    icon: '🔍',
    category: '专注力',
    difficulties: {
      easy: { label: '简单', summary: '6 轮 · 固定小网格', par: 28000, params: { trials: 6, gridBase: 5, gridRand: 0 } },
      medium: { label: '中等', summary: '8 轮 · 网格逐轮变大', par: 45000, params: { trials: 8, gridBase: 5, gridRand: 3 } },
      hard: { label: '困难', summary: '12 轮 · 大网格', par: 80000, params: { trials: 12, gridBase: 7, gridRand: 2 } },
    },
    scoring: {
      family: 'tps',
      unit: '轮',
      // 视觉搜索本质是吞吐量任务：每轮都要在干扰项中定位唯一目标
      metrics: [metric('tps', '吞吐量', true, fmtTps('轮')), M_SCORE, M_ACC, M_TIME],
    },
    intro:
      '视觉搜索训练在大量干扰项中快速定位目标，是提升“在信息洪流中找重点”能力的好方法。',
    howto:
      '在网格里尽快找出唯一的 ★ 并点击它，共若干轮，网格会逐轮变大（轮数与网格规模由难度决定）。记录平均搜索时间（越短越好）。',
    component: VisualSearchGame,
  },
  {
    id: 'cancellation',
    name: '反向划消',
    description: '在密集数字里划掉指定目标，考验持续专注与细心。',
    icon: '✏️',
    category: '专注力',
    difficulties: {
      easy: { label: '简单', summary: '6×6 · 36 格', par: 50000, params: { size: 6 } },
      medium: { label: '中等', summary: '8×8 · 64 格', par: 90000, params: { size: 8 } },
      hard: { label: '困难', summary: '10×10 · 100 格', par: 150000, params: { size: 10 } },
    },
    scoring: {
      family: 'tps',
      unit: '格',
      // 划消是吞吐量任务：单位时间划掉的正确格数越多越好
      metrics: [metric('tps', '吞吐量', true, fmtTps('格')), M_SCORE, M_ACC, M_TIME],
    },
    intro:
      '划消测验（Cancellation Task）常用于评估持续注意力与处理速度，需要在密集信息中保持专注。',
    howto:
      '在密集数字网格中，点击划掉所有等于“目标数字”的格子，完成后点“检查”。网格规模由难度决定，系统统计准确率与用时。',
    component: CancellationGame,
  },
  {
    id: 'tracking',
    name: '动态追踪',
    description: '盯住乱窜的红点别让它溜走，训练视觉持续追踪。',
    icon: '🎯',
    category: '专注力',
    difficulties: {
      easy: { label: '简单', summary: '20 秒 · 大目标慢速', params: { dur: 20, speed: 0.12, r: 32 } },
      medium: { label: '中等', summary: '30 秒 · 标准', params: { dur: 30, speed: 0.18, r: 26 } },
      hard: { label: '困难', summary: '45 秒 · 小目标高速', params: { dur: 45, speed: 0.26, r: 20 } },
    },
    scoring: {
      family: 'rate',
      unit: '%',
      // ⚠ 追踪时长由难度固定，是「限时压力」而非「速度」，
      // 因此**不计时、不排名用时** —— 原实现的 `time = dur*1000` 是纯粹的占位假值。
      metrics: [metric('score', '接触率', true, fmtPct)],
    },
    intro:
      '动态视觉追踪训练眼睛对移动目标的持续锁定能力，对阅读扫视与运动反应都有帮助。',
    howto:
      '保持鼠标/手指压在弹跳移动的红点上，坚持指定时长（由难度决定）。系统统计接触时长占比（接触率越高越好）。',
    component: TrackingGame,
  },

  // ---------------- 记忆力 ----------------
  {
    id: 'memorydigits',
    name: '数字瞬时记忆',
    description: '短暂呈现一串数字，凭记忆复述，训练短期记忆广度。',
    icon: '🧠',
    category: '记忆力',
    difficulties: {
      easy: { label: '简单', summary: '4 位起 · 上限 8 · 2.5s', params: { base: 4, maxLen: 8, showMs: 2500 } },
      medium: { label: '中等', summary: '5 位起 · 上限 10 · 1.5s', params: { base: 5, maxLen: 10, showMs: 1500 } },
      hard: { label: '困难', summary: '6 位起 · 上限 12 · 0.8s', params: { base: 6, maxLen: 12, showMs: 800 } },
    },
    scoring: {
      family: 'span',
      unit: '位',
      // ⚠ 记忆广度类：排行榜**不显示用时**。
      //   这类游戏没有「限时」属性 —— 玩家想快可以乱点秒答，
      //   拿累计会话时长排名只会奖励手速而非记忆力，是方向性错误。
      metrics: [metric('span', '记忆广度', true, fmtWithUnit('位')), M_ACC],
    },
    intro:
      '数字瞬时记忆考验你的短期记忆广度——大脑能同时“抓住”多少信息。',
    howto:
      '短暂呈现一串数字后隐藏，凭记忆把整串数字复述出来。答对则长度 +1，答错回落到起始长度（起始长度、上限与显示时长均由难度决定）。',
    component: MemoryDigitsGame,
  },
  {
    id: 'simon',
    name: '顺序记忆',
    description: '看亮灯顺序、听音调，原样复现，练听觉+顺序记忆。',
    icon: '🎵',
    category: '记忆力',
    difficulties: {
      easy: { label: '简单', summary: '2 步起 · 每轮 +1', params: { startLen: 2, inc: 1 } },
      medium: { label: '中等', summary: '3 步起 · 每轮 +1', params: { startLen: 3, inc: 1 } },
      hard: { label: '困难', summary: '3 步起 · 每轮 +2', params: { startLen: 3, inc: 2 } },
    },
    scoring: {
      family: 'span',
      unit: '步',
      // 同上：序列记忆比的是「能复现多长的序列」，不计时
      metrics: [metric('span', '最长步数', true, fmtWithUnit('步')), M_ACC],
    },
    intro:
      'Simon 是经典的顺序记忆游戏，结合听觉（音调）与视觉（亮灯）双重编码，锻炼工作记忆。',
    howto:
      '记住亮灯顺序与对应音调，随后按顺序点击复现。每答对一轮序列按难度递增（起始步数与递增幅度由难度决定），记你一次能记住的最长步数。',
    component: SimonGame,
  },
  {
    id: 'corsi',
    name: '空间广度',
    description: '经典 Corsi 方块，记住点亮的先后位置并复现。',
    icon: '🟦',
    category: '记忆力',
    difficulties: {
      easy: { label: '简单', summary: '4 块 · 2 步起', params: { pool: 4, startLen: 2 } },
      medium: { label: '中等', summary: '6 块 · 2 步起', params: { pool: 6, startLen: 2 } },
      hard: { label: '困难', summary: '9 块 · 1 步起', params: { pool: 9, startLen: 1 } },
    },
    scoring: {
      family: 'span',
      unit: '步',
      // 空间广度同理：不计时，只看序列长度
      metrics: [metric('span', '最长步数', true, fmtWithUnit('步')), M_ACC],
    },
    intro:
      'Corsi 积木测验是测量“空间广度”的经典范式，考察你对位置顺序的短时记忆。',
    howto:
      '记住方块依次亮起的顺序，再按相同顺序点击复现。可用方块数量与起始步数由难度决定。每成功一轮 +1 步，挑战你的最长空间序列。',
    component: CorsiGame,
  },
  {
    id: 'memorymatch',
    name: '记忆翻牌',
    description: '翻开 emoji 配对，靠短时记忆找出所有成对卡片。',
    icon: '🃏',
    category: '记忆力',
    difficulties: {
      easy: { label: '简单', summary: '4 对 · 8 张牌', par: 35000, params: { pairs: 4 } },
      medium: { label: '中等', summary: '8 对 · 16 张牌', par: 80000, params: { pairs: 8 } },
      hard: { label: '困难', summary: '10 对 · 20 张牌', par: 120000, params: { pairs: 10 } },
    },
    scoring: {
      family: 'composite',
      unit: '步',
      // 翻牌同时看「记忆效率（步数）」与「速度」，故为综合类，并额外展示步数
      metrics: [M_SCORE, metric('moves', '步数', false, fmtWithUnit('步')), M_ACC, M_TIME],
    },
    intro:
      '翻牌配对是训练短时视觉记忆的经典小游戏，靠记住已翻开的图案位置来高效配对。',
    howto:
      '翻开两张卡片，相同则配对成功，不同则盖回。用最少的步数把全部图案配对（对数与图案由难度决定）。',
    component: MemoryMatchGame,
  },
  {
    id: 'recognition',
    name: '图形再认',
    description: '看一眼记图形，再从混合组中认出见过的那几个。',
    icon: '👁️',
    category: '记忆力',
    difficulties: {
      easy: { label: '简单', summary: '记 4 个 · 6 秒 · 4 干扰', par: 12000, params: { study: 4, showMs: 6000, distract: 4 } },
      medium: { label: '中等', summary: '记 6 个 · 4 秒 · 6 干扰', par: 16000, params: { study: 6, showMs: 4000, distract: 6 } },
      hard: { label: '困难', summary: '记 8 个 · 2.5 秒 · 10 干扰', par: 22000, params: { study: 8, showMs: 2500, distract: 10 } },
    },
    scoring: {
      family: 'composite',
      unit: '个',
      // ⚠ 计时只取「进入再认阶段 → 提交」这一段。
      //   原实现把 showMs（强制记忆时长）也算进了 time，
      //   导致不同 showMs 的难度之间用时完全不可比（困难档白白多背 3.5 秒罚时）。
      metrics: [M_SCORE, M_ACC, M_TIME],
    },
    intro:
      '再认记忆（Recognition）比“回忆”容易，但仍是记忆研究的核心——从混合项中认出见过的东西。',
    howto:
      '先看一组图形数秒并记住，随后从旧图形与干扰图形组成的混合组中挑出你见过的（记忆项数、呈现时长与干扰项数由难度决定）。',
    component: RecognitionGame,
  },
]

export default games