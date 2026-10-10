/**
 * 计分口径模块 —— 全局唯一的「什么算好成绩」定义（single source of truth）。
 *
 * 本文件**不依赖 React、不依赖 registry、不依赖 localStorage**，可被任意层安全 import。
 *
 * ============================================================
 * 为什么需要它：原先全站只有 accuracy(正确率) + time(时间) 两个指标，
 * 但 10 款游戏的「好成绩」根本不是一回事：
 *
 *   - **记忆广度类**（数字瞬时记忆 / Simon / Corsi）
 *     比的是「记住多长的序列」。这类游戏没有限时属性 ——
 *     玩家想快可以疯狂乱点，把 time 拿来排名只会奖励「手速」而非「记忆力」，
 *     属于**方向性错误**。故排行榜不显示时间，只按最长跨度排名。
 *
 *   - **吞吐量类**（斯特鲁普 / 视觉搜索 / 反向划消）
 *     本质是「单位时间内处理多少刺激」。正确率只反映对错，
 *     时间只反映长短，缺了最关键的**吞吐量（单位/秒）**。
 *
 *   - **综合类**（舒尔特 / 记忆翻牌 / 图形再认）
 *     对与快都要看。原先把 accuracy 和 time 并排一摆，
 *     用户无法得出「这一局到底算好还是差」的结论 —— 缺综合分。
 *
 *   - **比率类**（动态追踪）
 *     训练的是「持续接触率」，时长由难度固定（无限时压力），
 *     把 time 拿来排名等于把固定常量当成绩。原实现的
 *     `time = dur * 1000` 就是纯粹的占位假值。
 *
 * 因此按 family 分派不同口径，并统一产出：
 *   - **score**：全局排序键（恒为「越高越好」），排行榜只按它排；
 *   - **metrics**：该游戏在侧栏 / 排行榜**实际展示**的指标列（各不相同）。
 * ============================================================
 *
 * @typedef {'span'|'tps'|'composite'|'rate'} ScoringFamily
 *
 * @typedef {Object} MetricDef
 * @property {string} key            对应 ScoreRecord 上的字段名
 * @property {string} label           中文标签
 * @property {boolean} higherIsBetter 方向：true=越高越好（用于派生 best/recent）
 * @property {(v: number|null) => string} format 展示格式化
 */

/** 难度键，顺序即展示顺序（与 difficulty.js 保持一致，此处仅为文档可读性）。 */

/** 各计分家族的元数据。 */
export const SCORING_FAMILIES = {
  /** 记忆广度类：排序键 = 达成的最长跨度，不计时间。 */
  span: { label: '记忆广度', timed: false },
  /** 吞吐量类：排序键 = 正确率 × 速度系数，另展示 TPS。 */
  tps: { label: '吞吐量', timed: true },
  /** 综合类：正确率 × 速度系数，正确率与时间都要。 */
  composite: { label: '综合', timed: true },
  /** 比率类：排序键 = 持续比率（如接触率），不计时间。 */
  rate: { label: '比率', timed: false },
}

/** 把数值夹到 [lo, hi]。 */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * 速度系数：用一个「该难度的及格用时 par」把绝对时间折算成 0~1 的相对表现。
 *
 *   time ≤ par        → 1.0（够快了，不额外加分，保证正确率始终是主导项）
 *   time = 2 × par    → 0.5
 *   time = 4 × par    → 0.25
 *   time → ∞          → 0（超时不得分）
 *
 * 用「比值」而非线性扣分，是因为人对时间的感知是对数的：
 * 比 par 慢 1 秒和多 1 秒，体感差别远小于「超时」与「刚好达标」的差别。
 *
 * @param {number|null} timeMs 本局真实用时（毫秒）
 * @param {number|null} parMs  该难度及格用时（毫秒，来自 registry difficulties[].par）
 * @returns {number} 0 ~ 1
 */
export function speedFactor(timeMs, parMs) {
  if (timeMs == null || !isFinite(timeMs) || timeMs <= 0) return 0
  if (parMs == null || !isFinite(parMs) || parMs <= 0) return 1
  if (timeMs <= parMs) return 1
  return clamp(parMs / timeMs, 0, 1)
}

/**
 * 限时综合分（tps / composite 两个家族共用）。
 *
 * score = 正确率 × 速度系数
 *
 * 「正确率 × 速度」而非「正确率 + 速度」是刻意的：
 * 乘法保证两项都不可缺 —— 错得再少只要慢到没边也得不了高分，
 * 跑得再快只要错一半也只能拿一半；加法则会让「快但错」压过「慢但全对」，
 * 而后者对这类认知训练任务其实是更好的表现。
 *
 * @param {Object} args
 * @param {number|null} args.accuracy 正确率 0~100
 * @param {number|null} args.timeMs  本局真实用时（毫秒）
 * @param {number|null} args.parMs   及格用时（毫秒）
 * @returns {number|null} 0~100 的综合分
 */
export function compositeScore({ accuracy, timeMs, parMs }) {
  if (accuracy == null || !isFinite(accuracy)) return null
  return Math.round(clamp(accuracy, 0, 100) * speedFactor(timeMs, parMs))
}

/**
 * 记忆广度分：排序键直接取最长跨度。
 * 不做任何时间折算 —— 见文件头「为什么需要它」中对 span 家族的说明。
 *
 * @param {number|null} span 最长跨度（位 / 步）
 * @returns {number|null}
 */
export function spanScore(span) {
  if (span == null || !isFinite(span)) return null
  return Math.max(0, Math.round(span))
}

/**
 * 比率分：直接取百分比比率（动态追踪的接触率）。
 * @param {number|null} rate 0~100
 * @returns {number|null}
 */
export function rateScore(rate) {
  if (rate == null || !isFinite(rate)) return null
  return Math.round(clamp(rate, 0, 100))
}

/**
 * 吞吐量：单位数 / 秒。保留 2 位小数以便同难度内区分细微差异。
 * @param {number} units 完成的刺激单位数（题 / 轮 / 格）
 * @param {number} timeMs 本局真实用时（毫秒）
 * @returns {number|null} 单位/秒
 */
export function computeTps(units, timeMs) {
  if (!units || units <= 0) return null
  if (!timeMs || timeMs <= 0 || !isFinite(timeMs)) return null
  return Math.round((units / (timeMs / 1000)) * 100) / 100
}

/**
 * 命中率式正确率（答对数 / 总数）。
 * @param {number} hits
 * @param {number} total
 * @returns {number|null}
 */
export function hitRate(hits, total) {
  if (!total || total <= 0) return null
  return Math.round((hits / total) * 100)
}

/**
 * 扣分式正确率（答对 − 误操作）/ 总数。用于「划消 / 再认」这类
 * 漏一个要扣、错划一个也要扣的任务。
 * @param {number} hits
 * @param {number} falseOps
 * @param {number} total
 * @returns {number|null}
 */
export function penaltyRate(hits, falseOps, total) {
  if (!total || total <= 0) return null
  return Math.round(((hits - falseOps) / total) * 100)
}

// ────────────────────────── 指标定义工厂 ──────────────────────────

/**
 * 构造一个指标定义。
 * @param {string} key
 * @param {string} label
 * @param {boolean} higherIsBetter
 * @param {(v: number|null) => string} format
 * @returns {MetricDef}
 */
export function metric(key, label, higherIsBetter, format) {
  return { key, label, higherIsBetter, format }
}

/** 计时/毫秒格式化：MM:SS.cc（全项目唯一实现）。 */
export function fmtMs(ms) {
  if (ms == null || !isFinite(ms)) return '—'
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/** 百分比格式。 */
export function fmtPct(v) {
  return v == null || !isFinite(v) ? '—' : `${Math.round(v)}%`
}

/** 综合分格式。 */
export function fmtScore(v) {
  return v == null || !isFinite(v) ? '—' : `${Math.round(v)}`
}

/**
 * 带单位的格式工厂：`(v) => \`${v} ${unit}\``。
 * @param {string} unit
 * @returns {(v: number|null) => string}
 */
export function fmtWithUnit(unit) {
  return (v) => (v == null || !isFinite(v) ? '—' : `${v} ${unit}`)
}

/**
 * 吞吐量格式工厂：`(v) => \`${v.toFixed(2)} ${unit}/s\``。
 * @param {string} unit
 * @returns {(v: number|null) => string}
 */
export function fmtTps(unit) {
  return (v) => (v == null || !isFinite(v) ? '—' : `${v.toFixed(2)} ${unit}/s`)
}

/**
 * 从 registry 的 scoring 声明派生该游戏应展示的指标列表。
 * 兜底：未声明 scoring 的老游戏退回到「正确率 + 时间」，保证 UI 不崩。
 *
 * @param {Object} game registry 条目
 * @returns {MetricDef[]}
 */
export function getMetrics(game) {
  const declared = game && game.scoring && Array.isArray(game.scoring.metrics)
    ? game.scoring.metrics
    : null
  if (declared && declared.length) return declared
  return [
    metric('accuracy', '正确率', true, fmtPct),
    metric('time', '时间', false, fmtMs),
  ]
}

/**
 * 取该游戏的排序指标 key（展示第一列用）。兜底为 'score'。
 * @param {Object} game
 * @returns {string}
 */
export function getRankKey(game) {
  const m = getMetrics(game)
  return m.length ? m[0].key : 'score'
}
