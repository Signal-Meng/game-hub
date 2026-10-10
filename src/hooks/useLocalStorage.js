import { useState, useEffect } from 'react'

/**
 * 与 localStorage 同步的状态 hook（用于成绩、难度偏好等持久化）。
 *
 * @template T
 * @param {string} key 存储键名
 * @param {T} initialValue 默认值（读取失败时回退）
 * @param {(raw: *) => T} [revive] 可选的结构规整/迁移函数，在 lazy 初始化阶段执行。
 *        用于「读到旧结构时顺手升级为新结构，首次写入即完成迁移」。
 *        既有 2 参调用完全兼容。
 * @returns {[T, (value: T | ((prev: T) => T)) => void]}
 */
export function useLocalStorage(key, initialValue, revive) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return initialValue
      const parsed = JSON.parse(raw)
      if (typeof revive === 'function') return revive(parsed)
      return parsed
    } catch (e) {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      // 忽略写入失败（如隐私模式禁用存储、配额超限）
    }
  }, [key, value])

  return [value, setValue]
}