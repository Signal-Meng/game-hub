import { useCallback, useEffect, useRef, useState } from 'react'
import { games } from '../games/registry.js'
import { STATS_PREFIX } from '../hooks/useGameStats.js'

/**
 * 删除全部游戏的成绩记录（`gamehub:stats:*`）。
 *
 * 纯副作用函数，供「页脚按钮」与「?reset=1 URL 快捷方式」共用同一份实现。
 * 保留 `gamehub:difficulty`（难度偏好）——那是使用习惯不是成绩。
 *
 * @returns {number} 实际删除的键数量
 */
export function clearAllStats() {
  let removed = 0
  try {
    const doomed = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(STATS_PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => {
      localStorage.removeItem(k)
      removed++
    })
  } catch (e) {
    // 隐私模式 / 配额限制下 localStorage 可能不可写
  }
  return removed
}

/**
 * 「清除全部成绩」：一次性删除**所有游戏**的历史成绩记录。
 *
 * 为什么需要它：每个游戏原本只能在自己的排行榜里「清空本游戏记录」，
 * 想把 10 款游戏的成绩全清掉，只能进 10 次游戏各点一次 —— 很容易漏，
 * 而残留的旧成绩又会和新计分口径（score / span / tps）混在同一个难度分区里，
 * 让排行榜的名次不可比。
 *
 * 组件挂在大厅页脚：此处没有任何游戏视图在运行，清除后重新进入游戏即读到空状态，
 * 无需额外的状态同步。
 */
export default function ClearAllStats() {
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState(false)
  const timerRef = useRef(null)

  // 二次确认 5s 未操作自动复位，与 Leaderboard 的清空确认保持一致
  useEffect(() => {
    if (!armed) return undefined
    const id = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(id)
  }, [armed])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const onConfirm = useCallback(() => {
    clearAllStats()
    setDone(true)
    setArmed(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDone(false), 3000)
  }, [])

  if (done) {
    return (
      <p className="text-xs text-emerald-600">
        已清除全部 {games.length} 款游戏的成绩记录。
      </p>
    )
  }

  if (armed) {
    return (
      <span className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="text-amber-600">
          确认清除全部 {games.length} 款游戏的成绩？此操作不可撤销。
        </span>
        <button
          type="button"
          onClick={onConfirm}
          className="font-medium text-rose-600 hover:underline"
        >
          确认清除
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          取消
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
    >
      清除全部成绩
    </button>
  )
}