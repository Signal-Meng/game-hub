import { useRef, useCallback } from 'react'

/**
 * 登记式递归 setTimeout 序列播放器。
 *
 * simon（音调+颜色）与 corsi（空间位置）共享同一套模式：
 *   递归 setTimeout 驱动「亮 → 灭 → 下一步」的 playback 循环，
 *   所有 timer 登记到 Set，组件卸载时一次性清理，防止对已卸载组件 setState。
 *
 * 用法：
 *   const { aliveRef, later, clearTimers } = useSequencePlayer()
 *   // startGame 里用 later(fn, delay) 替代 setTimeout(fn, delay)
 *   // useLayoutEffect cleanup 里调 clearTimers()
 */
export function useSequencePlayer() {
  const timersRef = useRef(new Set())
  const aliveRef = useRef(false)

  /** 组件卸载后不再续期递归链 */
  const later = useCallback((fn, ms) => {
    if (!aliveRef.current) return
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      if (aliveRef.current) fn()
    }, ms)
    timersRef.current.add(id)
  }, [])

  /** 卸载时一次性清理所有登记的 timer */
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }, [])

  return { aliveRef, later, clearTimers }
}
