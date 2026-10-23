import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage.js'
import {
  DEFAULT_DIFFICULTY,
  isDifficulty,
  migrateStats,
  upsertRecord,
} from '../difficulty.js'
import { getMetrics, fmtMs as fmtMsScoring } from '../scoring.js'

/** 成绩存储键前缀：`gamehub:stats:<gameId>`。
 *  导出供「清除全部成绩」组件按前缀批量删除（见 components/ClearAllStats.jsx）。 */
export const STATS_PREFIX = 'gamehub:stats:'

/**
 * 计时/毫秒格式化：MM:SS.cc。
 * 唯一实现已收敛到 scoring.js（与计分口径同处一地），此处仅做兼容转发。
 */
export { fmtMsScoring as fmtMs }

/**
 * @deprecated 指标已改为**按游戏声明**（见 registry 的 `scoring.metrics`）。
 * 本常量只作为不认识 registry 的旧调用方的兜底，勿在新代码中使用。
 * @see getMetrics
 */
export const METRICS = [
  { key: 'accuracy', label: '正确率', higherIsBetter: true, format: (v) => (v == null ? '—' : `${v}%`) },
  { key: 'time', label: '时间', higherIsBetter: false, format: fmtMsScoring },
]

/**
 * @typedef {Object} GameSession
 * @property {import('../difficulty.js').Difficulty} difficulty 当前难度
 * @property {Object} params                          registry difficulties[difficulty].params
 * @property {number|null} par                       registry difficulties[difficulty].par，及格用时（毫秒），供计算综合分
 * @property {string} sessionId                       `${gameId}:${difficulty}:${sessionKey}`
 * @property {(vals: {accuracy?: number, time?: number}) => void} record 上报本局成绩（session 级 upsert）
 * @property {(d: import('../difficulty.js').Difficulty) => void} setDifficulty 写偏好 + 回遮罩
 * @property {() => void} restartToGate                回遮罩（重开统一入口，可换难度）
 * @property {() => void} restartSame                 同难度直接重开（不进遮罩，sessionKey+1）
 */

/** 空 session：GameView 未包裹时的安全兜底，保证游戏组件不会崩。 */
const NOOP_SESSION = {
  difficulty: DEFAULT_DIFFICULTY,
  params: {},
  par: null,
  sessionId: '',
  record: () => {},
  setDifficulty: () => {},
  restartToGate: () => {},
  restartSame: () => {},
}

/**
 * 游戏会话 Context —— 由 GameView 持有并下发。
 * 游戏组件只需 `const { params, record, restartToGate } = useGameSession()`，
 * 不必关心难度持久化、sessionId 生成与存储结构。
 */
export const GameSessionContext = createContext(NOOP_SESSION)

/**
 * 游戏视图层使用：读写某游戏的成绩记录数组（StatsStore），
 * 并提供 session 级 upsert 的 record 函数与清空能力。
 *
 * 旧数据结构（{ accuracy:{best,recent}, time:{best,recent} }）在
 * useLocalStorage 的 revive 阶段完成迁移，无需在此处处理兼容。
 *
 * 指标列表来自 registry 的 `scoring.metrics` —— **不同游戏展示不同指标**：
 * 记忆广度类不展示用时，比率类只有接触率，吞吐量类额外有 TPS。
 *
 * @param {{id: string, scoring?: Object}|string} game 游戏条目，或退回旧的 gameId 字符串
 * @returns {{
 *   metrics: import('../scoring.js').MetricDef[],
 *   records: import('../difficulty.js').ScoreRecord[],
 *   record: (vals: {score?: number, accuracy?: number, time?: number, span?: number, tps?: number, moves?: number},
 *            ctx?: {sessionKey?: number|string, difficulty?: string}) => void,
 *   clear: () => void,
 * }}
 */
export function useGameStats(game) {
  // 兼容旧的 string 入参：此时指标回退到「正确率 + 时间」
  const gameId = typeof game === 'string' ? game : game && game.id
  const metrics = useMemo(
    () => (typeof game === 'string' ? undefined : getMetrics(game)),
    [game],
  )
  const [store, setStore] = useLocalStorage(STATS_PREFIX + gameId, { v: 1, records: [] }, migrateStats)

  const records = useMemo(
    () => (store && Array.isArray(store.records) ? store.records : []),
    [store],
  )

  /**
   * 上报一次成绩（同一 sessionId 多次调用 = 同一行原地演进）。
   *
   * 语义为**整行替换**：一次调用必须给全该游戏本轮的全部指标
   * （score / accuracy / time / span / tps / moves 中其需要的那些），
   * 未给出的字段会落成 null。因此局内多次 record() 的游戏
   * （memorydigits / simon / corsi）每次都应传入**当前最好**的完整快照。
   *
   * @param {Object} vals 指标值
   * @param {{sessionKey?: number|string, difficulty?: string}} [ctx] 由 GameView 经 Context 注入，
   *        游戏组件通常不需要传；显式传入可覆盖（便于将来复用）
   */
  const record = useCallback(
    (vals = {}, ctx = {}) => {
      const difficulty = isDifficulty(ctx.difficulty) ? ctx.difficulty : DEFAULT_DIFFICULTY
      const sessionKey =
        ctx.sessionKey == null || ctx.sessionKey === '' ? 0 : ctx.sessionKey
      setStore((prev) => {
        const prevRecords = prev && Array.isArray(prev.records) ? prev.records : []
        return {
          v: 1,
          records: upsertRecord(
            prevRecords,
            {
              id: `${gameId}:${difficulty}:${sessionKey}`,
              difficulty,
              score: vals.score == null ? null : vals.score,
              accuracy: vals.accuracy == null ? null : vals.accuracy,
              time: vals.time == null ? null : vals.time,
              span: vals.span == null ? null : vals.span,
              tps: vals.tps == null ? null : vals.tps,
              moves: vals.moves == null ? null : vals.moves,
              timestamp: Date.now(),
            },
          ),
        }
      })
    },
    [gameId, setStore],
  )

  const clear = useCallback(() => {
    setStore({ v: 1, records: [] })
  }, [setStore])

  return { metrics, records, record, clear }
}

/**
 * 游戏组件统一取值入口。
 * @returns {GameSession}
 */
export function useGameSession() {
  return useContext(GameSessionContext)
}
