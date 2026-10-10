import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage.js'
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_STORAGE_KEY,
  isDifficulty,
} from '../difficulty.js'

/**
 * 难度偏好持久化：读写 `gamehub:difficulty`（形如 `{ schulte: 'hard' }`）。
 *
 * 语义要点：
 * - 读取时非法/缺失一律回落到 `medium`（= 现状默认值），保证旧用户与新用户都不断档。
 * - 本 hook **只管持久化**；「切换难度必须回开始前遮罩」的业务语义由 GameView 实现，
 *   因为那是视图层状态，不该污染存储层。
 *
 * @param {string} gameId 游戏唯一标识
 * @returns {[import('../difficulty.js').Difficulty, (d: import('../difficulty.js').Difficulty) => void]}
 */
export function useDifficultyPreference(gameId) {
  const [map, setMap] = useLocalStorage(DIFFICULTY_STORAGE_KEY, {})

  const stored = map && typeof map === 'object' ? map[gameId] : null
  const difficulty = isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY

  const setDifficulty = useCallback(
    (d) => {
      if (!isDifficulty(d)) return
      setMap((prev) => {
        const base = prev && typeof prev === 'object' ? prev : {}
        if (base[gameId] === d) return base
        return { ...base, [gameId]: d }
      })
    },
    [gameId, setMap],
  )

  return [difficulty, setDifficulty]
}