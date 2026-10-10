/**
 * 难度与排行榜的共享纯模块（single source of truth）。
 *
 * 本文件**不依赖 React、不依赖 registry、不依赖任何游戏组件**，可以被任意层安全 import，
 * 因此不会产生循环依赖。它承担两类职责：
 *
 * 1. 难度相关的常量与元数据（键、中文标签、标签样式、默认档、存储键、上限）。
 * 2. 成绩记录（ScoreRecord）的排序 / 裁剪 / 派生 / 迁移，以及若干随机采样工具。
 *
 * ============================================================
 * 跨文件共享约定（改动前请先读这里）
 * ------------------------------------------------------------
 * - 难度键固定为 'easy' | 'medium' | 'hard'，数组顺序即 UI 展示顺序。
 * - 难度中文标签固定为 简单 / 中等 / 困难；registry 的 difficulties[key].label
 *   必须与之保持一致（不一致时以 registry 为准，本文件仅作兜底）。
 * - 默认难度为 medium（= 改造前的线上默认值），旧数据也归入 medium，
 *   保证迁移后任何游戏都不会出现「空档」。
 * - 计分口径不随难度变化：accuracy 为 0~100 整数（越高越好），
 *   time 为毫秒（越低越好），允许为 null。
 * - **排行榜按难度分区**：`trimRecords` 对每个难度**独立保留 Top-N**，
 *   名额不跨难度共用；因此 records 总长度上限为 LEADERBOARD_LIMIT × 难度数。
 *   跨难度**不可比**，UI 严禁把不同难度塞进同一个 1..N 名次序列。
 * - registry 的 difficulties[key].params 必须是**扁平标量对象**
 *   （只允许 number | string | boolean），禁止嵌套与函数，保证可序列化。
 * ============================================================
 */

/**
 * @typedef {'easy'|'medium'|'hard'} Difficulty
 */

/**
 * 一条成绩 = 用户的一次「局」（session）。
 *
 * ⚠ 字段是**多口径**的：不同计分家族（见 scoring.js）只用其中一部分，
 *   具体展示哪些字段由 registry 的 `scoring.metrics` 决定。
 *
 *   - span 家族（记忆广度类）：score = span，**不使用 time**
 *   - rate 家族（比率类）：    score = 比率，**不使用 time**
 *   - tps 家族（吞吐量类）：   score = 正确率 × 速度系数，另有 tps
 *   - composite 家族（综合）： score = 正确率 × 速度系数
 *
 * @typedef {Object} ScoreRecord
 * @property {string}    id          主键 `${gameId}:${difficulty}:${sessionKey}`，用于 session 级 upsert
 * @property {Difficulty} difficulty  所属难度分区
 * @property {number|null} score     **排序主键**，越高越好。口径随计分家族而异，见上。
 * @property {number|null} accuracy  正确率 0~100 整数（越高越好）；缺失为 null
 * @property {number|null} time      本局**真实**用时毫秒（越低越好）；不计时的家族为 null
 * @property {number|null} span      记忆广度（位 / 步）；仅 span 家族使用
 * @property {number|null} tps       吞吐量（单位/秒）；仅 tps 家族使用
 * @property {number|null} moves     步数（如翻牌）；仅个别综合类使用
 * @property {number}    timestamp   Date.now()；迁移来的历史记录用 1 / 2 哨兵值（视为最旧）
 * @property {boolean}  [migrated]   true = 由旧 best/recent 结构合成
 */

/**
 * localStorage 键 `gamehub:stats:<gameId>` 的值。
 * @typedef {Object} StatsStore
 * @property {1}              v        结构版本号，便于将来再迁移
 * @property {ScoreRecord[]}  records  已排序 + 已按难度分组裁剪，
 *                                     总长度 ≤ LEADERBOARD_LIMIT × 难度数（默认 3×10 = 30）
 */

/**
 * best/recent 派生视图（**不落盘**，每次从 records 现算）。
 * @typedef {Object} MetricPair
 * @property {number|null} best
 * @property {number|null} recent
 */

/** 难度键，顺序即展示顺序。 */
export const DIFFICULTY_KEYS = ['easy', 'medium', 'hard']

/** 默认难度：等于改造前的线上参数，也是旧数据的归属难度。 */
export const DEFAULT_DIFFICULTY = 'medium'

/** 单个难度分区最多保留的成绩条数（每个游戏 = LEADERBOARD_LIMIT × 参与过的难度数）。 */
export const LEADERBOARD_LIMIT = 10

/** 难度偏好的 localStorage 键（内容形如 `{ schulte: 'hard' }`）。 */
export const DIFFICULTY_STORAGE_KEY = 'gamehub:difficulty'

/** 难度元数据：中文标签 + 标签 chip 样式（Leaderboard 与 Picker 共用）。 */
export const DIFFICULTY_META = {
  easy: { label: '简单', chipClass: 'bg-slate-100 text-slate-600' },
  medium: { label: '中等', chipClass: 'bg-indigo-50 text-indigo-700' },
  hard: { label: '困难', chipClass: 'bg-amber-50 text-amber-700' },
}

/** registry 缺失 difficulties 时的兜底选项（保证 UI 不崩）。 */
const FALLBACK_OPTION = { label: '中等', summary: '默认参数', params: {} }

/**
 * 判断是否为合法的难度键。
 * @param {*} value 待校验值
 * @returns {boolean}
 */
export function isDifficulty(value) {
  return typeof value === 'string' && DIFFICULTY_KEYS.indexOf(value) >= 0
}

/**
 * 取难度的中文标签，非法值回落到默认档标签。
 * @param {Difficulty} difficulty
 * @returns {string}
 */
export function difficultyLabel(difficulty) {
  const meta = DIFFICULTY_META[isDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY]
  return meta ? meta.label : DIFFICULTY_META[DEFAULT_DIFFICULTY].label
}

/**
 * 取难度 chip 的 className，非法值回落到默认档样式。
 * @param {Difficulty} difficulty
 * @returns {string}
 */
export function difficultyChipClass(difficulty) {
  const meta = DIFFICULTY_META[isDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY]
  return meta ? meta.chipClass : DIFFICULTY_META[DEFAULT_DIFFICULTY].chipClass
}

/**
 * 取某个游戏在指定难度下的档位配置。
 * registry 未声明 difficulties、或难度键非法时，返回兜底选项（params 为空对象）。
 *
 * @param {{ difficulties?: Object }} game registry 条目
 * @param {Difficulty} difficulty
 * @returns {{ label: string, summary: string, params: Object, par: number|null }}
 *   `par` = 该难度的**及格用时（毫秒）**，供 scoring.js 的速度系数折算绝对时间。
 *   它与 params 分开：params 是「训练强度」，par 是「评分基准」，两者都会随难度变，
 *   但语义完全不同，混在一起会让游戏组件误把评分参数当训练参数消费。
 */
export function getOption(game, difficulty) {
  const key = isDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY
  const option = game && game.difficulties ? game.difficulties[key] : null
  if (!option) return FALLBACK_OPTION
  return {
    label: option.label || difficultyLabel(key),
    summary: option.summary || '默认参数',
    params: option.params || {},
    par: typeof option.par === 'number' && isFinite(option.par) ? option.par : null,
  }
}

/**
 * 取某个游戏在指定难度下的训练参数（游戏组件的统一取值入口）。
 * @param {{ difficulties?: Object }} game
 * @param {Difficulty} difficulty
 * @returns {Object} 扁平标量参数对象
 */
export function getParams(game, difficulty) {
  return getOption(game, difficulty).params
}

/**
 * 取某个游戏在指定难度下的「及格用时」。未声明时返回 null（速度系数恒为 1）。
 * @param {{ difficulties?: Object }} game
 * @param {Difficulty} difficulty
 * @returns {number|null}
 */
export function getPar(game, difficulty) {
  return getOption(game, difficulty).par
}

/**
 * 取记录的**排序值**。
 *
 * 排序主键是 `score`（口径随计分家族而异，见 scoring.js），
 * 而不是原来的 accuracy —— 因为 accuracy 对「记忆广度类」是错的：
 * 一串 8 位全对、另一串 4 位全错，两者 accuracy 都是 100%，但显然前者更强。
 *
 * **向后兼容**：早期记录没有 `score` 字段（当时的主键就是 accuracy），
 * 此时回落用 accuracy，保证历史成绩的相对名次不因本次改动而错乱。
 *
 * @param {ScoreRecord} r
 * @returns {number} 越小越差；-Infinity 表示该记录没有任何可用分数
 */
export function rankValue(r) {
  if (!r || typeof r !== 'object') return -Infinity
  if (r.score != null && isFinite(r.score)) return r.score
  if (r.accuracy != null && isFinite(r.accuracy)) return r.accuracy
  return -Infinity
}

/**
 * 成绩记录全序比较器：**score 降序 → time 升序 → timestamp 升序 → id 字典序**。
 *
 * 次级键仍保留 time 升序，用于 score 打平时给出确定且符合直觉的次序
 * （同样好成绩时，更快的排前面）。null 的处理约定：time 视为垫底。
 *
 * @param {ScoreRecord} a
 * @param {ScoreRecord} b
 * @returns {number}
 */
export function compareRecords(a, b) {
  const as = rankValue(a)
  const bs = rankValue(b)
  if (as !== bs) return bs - as

  const at = a.time == null ? Number.POSITIVE_INFINITY : a.time
  const bt = b.time == null ? Number.POSITIVE_INFINITY : b.time
  if (at !== bt) return at - bt

  const ax = a.timestamp == null ? 0 : a.timestamp
  const bx = b.timestamp == null ? 0 : b.timestamp
  if (ax !== bx) return ax - bx

  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

/**
 * 排序（返回新数组，不改原数组）。
 * @param {ScoreRecord[]} list
 * @returns {ScoreRecord[]}
 */
export function sortRecords(list) {
  return (Array.isArray(list) ? list.slice() : []).sort(compareRecords)
}

/**
 * 裁剪到上限：**按难度分组，每组独立保留 Top-N**，名额不跨难度共用。
 *
 * 为什么必须分组裁剪（跨难度不可比）：
 * 排序键为 score 降序 → time 升序，而不同难度的成绩分布天然差一个量级
 * （easy 常见分 90~100、hard 常见 20~50；时长更是差几倍到几十倍）。
 * 一旦做全局 Top-N，easy 的记录会在 score 打平时靠 time 系统性压过 medium / hard，
 * 把后者的历史成绩全部挤出榜单，表现就是「玩满几局 easy 后，medium / hard 的排行榜空了」。
 *
 * 输出顺序：先按 DIFFICULTY_KEYS 的顺序分组，组内用 compareRecords 排序。
 * 因此「过滤出某个难度 → 按数组下标显示名次」天然得到正确的 1..N 组内排名。
 *
 * 幂等性：对同一输入重复调用结果不变（每组独立取前 N，排序稳定）。
 *
 * @param {ScoreRecord[]} records
 * @param {number} [limit] 每个难度分区保留的条数
 * @returns {ScoreRecord[]} 新数组，长度 ≤ limit × 出现的难度数
 */
export function trimRecords(records, limit = LEADERBOARD_LIMIT) {
  const list = Array.isArray(records) ? records : []
  const max = Math.max(0, Math.floor(limit) || 0)
  if (list.length === 0) return []

  // ① 按难度分桶；未知 / 非法难度值各自成桶，避免与已知难度互相挤占
  const buckets = new Map()
  for (const key of DIFFICULTY_KEYS) buckets.set(key, [])
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    const key = typeof r.difficulty === 'string' ? r.difficulty : DEFAULT_DIFFICULTY
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(r)
  }

  // ② 组内排序 + 独立取前 N；已知难度按 DIFFICULTY_KEYS 顺序先出，其余按出现顺序追加
  const orderedKeys = DIFFICULTY_KEYS.concat(
    Array.from(buckets.keys()).filter((k) => DIFFICULTY_KEYS.indexOf(k) < 0),
  )
  const out = []
  for (const key of orderedKeys) {
    const group = buckets.get(key)
    if (!group || group.length === 0) continue
    const sorted = group.sort(compareRecords)
    for (let i = 0; i < sorted.length && i < max; i++) out.push(sorted[i])
  }
  return out
}

/**
 * 把记录按难度分组（排行榜「全部难度」视图的数据准备层）。
 *
 * 只返回**非空**分组，顺序同 DIFFICULTY_KEYS（未知难度排在末尾），
 * 组内已用 compareRecords 排序 —— 调用方直接取下标 +1 即为组内名次，
 * 切勿再跨组做一个扁平的 1..N 排名。
 *
 * @param {ScoreRecord[]} records
 * @returns {{ difficulty: string, records: ScoreRecord[] }[]}
 */
export function groupRecordsByDifficulty(records) {
  const list = Array.isArray(records) ? records : []
  const buckets = new Map()
  for (const key of DIFFICULTY_KEYS) buckets.set(key, [])
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    const key = typeof r.difficulty === 'string' ? r.difficulty : DEFAULT_DIFFICULTY
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(r)
  }
  const orderedKeys = DIFFICULTY_KEYS.concat(
    Array.from(buckets.keys()).filter((k) => DIFFICULTY_KEYS.indexOf(k) < 0),
  )
  const out = []
  for (const key of orderedKeys) {
    const group = buckets.get(key)
    if (!group || group.length === 0) continue
    out.push({ difficulty: key, records: group.slice().sort(compareRecords) })
  }
  return out
}

/**
 * 由记录数组派生 best / recent 视图（跟随指定难度）。
 *
 * 为什么派生而非冗余存储：单一事实来源，裁剪后 best 不会指向已被淘汰的记录；
 * 每个难度上限只有 10 条，派生成本可忽略；迁移也只需转换一次结构。
 *
 * 指标是**按游戏配置**的（见 scoring.js 的 MetricDef），因此这里不再硬编码
 * accuracy / time，而是遍历调用方给定的 metricDefs，并按各自的 higherIsBetter
 * 决定 best 取 max 还是 min —— 否则「记忆广度」这类越高越好的指标会被
 * 按「越低越好」求最小值，得出完全错误的「历史最优」。
 *
 * @param {ScoreRecord[]} records
 * @param {Difficulty} difficulty
 * @param {Array<{key: string, higherIsBetter: boolean}>} [metricDefs]
 *        缺省时回退到旧口径 [accuracy(越高越好), time(越低越好)]，保证老调用方不崩。
 * @returns {Object<string, MetricPair>} 形如 `{ span: {best, recent}, accuracy: {...} }`
 */
export function deriveBestRecent(records, difficulty, metricDefs) {
  const list = (Array.isArray(records) ? records : []).filter(
    (r) => r && r.difficulty === difficulty,
  )
  const defs =
    Array.isArray(metricDefs) && metricDefs.length
      ? metricDefs
      : [
          { key: 'accuracy', higherIsBetter: true },
          { key: 'time', higherIsBetter: false },
        ]

  // 最近一次 = timestamp 最大的一条
  let recent = null
  for (const r of list) {
    const ts = r.timestamp == null ? 0 : r.timestamp
    const cur = recent ? (recent.timestamp == null ? 0 : recent.timestamp) : null
    if (recent === null || ts > cur) recent = r
  }

  const out = {}
  for (const def of defs) {
    if (!def || !def.key) continue
    let best = null
    for (const r of list) {
      const v = r[def.key]
      if (v == null || !isFinite(v)) continue
      if (best === null) best = v
      else best = def.higherIsBetter ? Math.max(best, v) : Math.min(best, v)
    }
    out[def.key] = { best, recent: recent ? recent[def.key] ?? null : null }
  }
  return out
}

/**
 * 名次 medal 样式：前三名高亮，其余弱化。
 * @param {number} rank 从 1 起算的名次
 * @returns {string} className
 */
export function medalClass(rank) {
  return rank <= 3 ? 'text-indigo-600 font-bold' : 'text-slate-400'
}

/**
 * 返回 [0, n) 的洗牌副本。
 * @param {number} n
 * @returns {number[]}
 */
export function shuffleIndices(n) {
  const total = Math.max(0, Math.floor(n) || 0)
  const out = new Array(total)
  for (let i = 0; i < total; i++) out[i] = i
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/**
 * 返回数组的洗牌副本（Fisher–Yates）。
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffleArray(arr) {
  const a = (Array.isArray(arr) ? arr.slice() : [])
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/**
 * 从 [0, n) 中不重复地取 k 个（洗牌后取前 k 项）。k > n 时退化为全取。
 * @param {number} n 候选总数
 * @param {number} k 需要取的数量
 * @returns {number[]}
 */
export function sampleUnique(n, k) {
  const want = Math.max(0, Math.floor(k) || 0)
  return shuffleIndices(n).slice(0, want)
}

/**
 * 从 [0, n) 中不重复地取 k 个，并排除 exclude 中已有的下标。
 * 用于「序列追加时不能与已有元素重复」的场景（如 simon 追加步）。
 *
 * @param {number} n 候选总数
 * @param {number} k 需要取的数量
 * @param {number[]} [exclude] 需要排除的下标
 * @returns {number[]}
 */
export function sampleUniqueExcluding(n, k, exclude) {
  const want = Math.max(0, Math.floor(k) || 0)
  const banned = new Set(Array.isArray(exclude) ? exclude : [])
  return shuffleIndices(n)
    .filter((i) => !banned.has(i))
    .slice(0, want)
}

/**
 * 把任意（可能来自旧版本 / 手改）的记录规整为合法 ScoreRecord。
 *
 * @param {*} raw 单条记录
 * @param {number} [index] 保底 id 的序号
 * @returns {ScoreRecord}
 */
export function normalizeRecord(raw, index = 0) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const difficulty = isDifficulty(src.difficulty) ? src.difficulty : DEFAULT_DIFFICULTY
  const toNum = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
  const timestamp =
    typeof src.timestamp === 'number' && isFinite(src.timestamp) ? src.timestamp : 0
  const id =
    typeof src.id === 'string' && src.id
      ? src.id
      : `legacy:${difficulty}:${index}:${timestamp}`
  const accuracy = toNum(src.accuracy)
  // 旧记录没有 score 字段，回落到 accuracy —— 这样它在 compareRecords 里的位置
  // 与升级前完全一致，历史成绩的名次不会因为口径切换而错乱。
  const score = toNum(src.score) != null ? toNum(src.score) : accuracy
  return {
    id,
    difficulty,
    score,
    accuracy,
    time: toNum(src.time),
    span: toNum(src.span),
    tps: toNum(src.tps),
    moves: toNum(src.moves),
    timestamp,
    migrated: src.migrated === true,
  }
}

/**
 * 把任意历史形状规整为 StatsStore。纯函数，**对未知输入绝不抛异常**。
 *
 * 已知的有损之处：旧结构把 best / recent 按指标各自独立存储，两个数字可能来自不同的局，
 * 迁移只能做到「best 拼 best、recent 拼 recent」的最佳近似，无法还原真实的那一局。
 * 这是**一次性、有损、语义近似**的迁移；timestamp 用哨兵 1 / 2 使 recent 稳定排在 best 之后。
 *
 * @param {*} raw localStorage 中读出的原始值
 * @returns {StatsStore}
 */
export function migrateStats(raw) {
  const empty = { v: 1, records: [] }
  if (raw == null) return empty

  // 已经是新结构：仍然做一次规整 + 裁剪，保证读到脏数据也能收敛到合法上限
  if (raw.v === 1 && Array.isArray(raw.records)) {
    return { v: 1, records: trimRecords(raw.records.map(normalizeRecord)) }
  }
  // 兜底：已是数组
  if (Array.isArray(raw)) {
    return { v: 1, records: trimRecords(raw.map(normalizeRecord)) }
  }

  // 旧形状 { accuracy:{best,recent}, time:{best,recent} }
  if (typeof raw !== 'object') return empty
  const b = raw.accuracy && typeof raw.accuracy === 'object' ? raw.accuracy : {}
  const t = raw.time && typeof raw.time === 'object' ? raw.time : {}
  const toNum = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
  const out = []
  if (b.best != null || t.best != null) {
    out.push({
      id: 'legacy:best',
      difficulty: DEFAULT_DIFFICULTY,
      accuracy: toNum(b.best),
      time: toNum(t.best),
      timestamp: 1,
      migrated: true,
    })
  }
  if (b.recent != null || t.recent != null) {
    out.push({
      id: 'legacy:recent',
      difficulty: DEFAULT_DIFFICULTY,
      accuracy: toNum(b.recent),
      time: toNum(t.recent),
      timestamp: 2,
      migrated: true,
    })
  }
  return { v: 1, records: out }
}

/**
 * session 级 upsert：同一 id 原地更新（保留首次时间戳），新 id 追加，然后按难度分组裁剪。
 *
 * 这是「一次开始 = 一局」的关键：一局内多次 record() 只会在同一行上演进，
 * 不会把排行榜用同一局的中间态刷爆。
 *
 * 裁剪是**按难度分区**的（trimRecords）：新记录只在它所属难度内部竞争名额，
 * 绝不会挤掉其它难度的历史成绩。
 *
 * @param {ScoreRecord[]} records 现有记录
 * @param {ScoreRecord} incoming 新记录
 * @param {number} [limit] 每个难度分区的保留条数
 * @returns {ScoreRecord[]}
 */
export function upsertRecord(records, incoming, limit = LEADERBOARD_LIMIT) {
  const list = (Array.isArray(records) ? records.slice() : []).map(normalizeRecord)
  const item = normalizeRecord(incoming, list.length)

  let found = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === item.id) {
      found = i
      break
    }
  }

  if (found >= 0) {
    // 保留首次时间戳，使「最近一次」在一局内保持稳定
    list[found] = {
      ...item,
      timestamp: list[found].timestamp,
      migrated: list[found].migrated,
    }
  } else {
    list.push(item)
  }
  return trimRecords(list, limit)
}