import { useEffect, useRef, useState } from 'react'

/**
 * 通用计时器：从挂载起持续累计本局用时（MM:SS.cc）。
 * 由 GameView 统一渲染，保证「所有游戏都带计时」。
 */
export default function Timer() {
  const [ms, setMs] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    startRef.current = Date.now()
    let raf
    const tick = () => {
      setMs(Date.now() - startRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return (
    <span className="ml-1 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm text-slate-600">
      ⏱ {String(Math.floor(s / 60)).padStart(2, '0')}:
      {String(s % 60).padStart(2, '0')}.{String(cs).padStart(2, '0')}
    </span>
  )
}
