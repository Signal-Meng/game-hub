import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { rateScore } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

// 画布**高度**是固定布局常量（不属于难度轴）；**宽度必须自适应** ——
// 早期版本把 W 硬编码为 380，在 375px 视口下右侧被裁掉 3px。
// 现改为：容器 max-w-[380px] + w-full，实际可用宽度用 ResizeObserver 实测，
// 运动学与命中判定全部改用实测宽度，保证窄屏不溢出、桌面端维持原有 380px。
const H = 280
const MAX_W = 380
const MIN_W = 160

export default function TrackingGame() {
  const { params, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 时长/速度/半径三条轴由 params 决定
  const { dur, speed, r } = params

  const [phase, setPhase] = useState('play') // play | done
  const [remain, setRemain] = useState(dur)
  const [result, setResult] = useState(null)
  const [boxW, setBoxW] = useState(MAX_W)
  const areaRef = useRef(null)
  const pos = useRef({ x: MAX_W / 2, y: H / 2 })
  const vel = useRef({ x: speed, y: speed })
  const pointer = useRef(null)
  const onMs = useRef(0)
  const totalMs = useRef(0)
  const lastTs = useRef(0)
  const rafRef = useRef(0)
  const endRef = useRef(0)
  const dotRef = useRef(null)

  /**
   * 实测容器宽度：容器是 w-full + max-w-[380px]，因此窄屏自动收窄、宽屏维持 380。
   * 仅在测量值真正变化时才 setState，避免 ResizeObserver 回调造成额外重渲染。
   */
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return undefined
    const measure = () => {
      const w = Math.max(MIN_W, Math.min(MAX_W, Math.floor(el.clientWidth)))
      setBoxW((prev) => (prev === w ? prev : w))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 运动循环：边界反弹与命中判定都使用当前难度的半径 r 与实测宽度 boxW
  useEffect(() => {
    if (phase !== 'play') return
    // 宽度收窄时把红点夹回场内，避免残留在画布外看不见
    pos.current.x = Math.min(Math.max(pos.current.x, r), Math.max(r, boxW - r))
    const loop = (ts) => {
      const dt = lastTs.current ? ts - lastTs.current : 16
      lastTs.current = ts
      const p = pos.current, v = vel.current
      p.x += v.x * dt; p.y += v.y * dt
      if (p.x < r) { p.x = r; v.x = Math.abs(v.x) }
      if (p.x > boxW - r) { p.x = boxW - r; v.x = -Math.abs(v.x) }
      if (p.y < r) { p.y = r; v.y = Math.abs(v.y) }
      if (p.y > H - r) { p.y = H - r; v.y = -Math.abs(v.y) }
      const pt = pointer.current
      if (pt && Math.hypot(pt.x - p.x, pt.y - p.y) < r) onMs.current += dt
      totalMs.current += dt
      if (dotRef.current) dotRef.current.style.transform = `translate(${p.x - r}px, ${p.y - r}px)`
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, r, boxW])

  useEffect(() => {
    if (phase !== 'play') return
    endRef.current = Date.now() + dur * 1000
    const iv = setInterval(() => {
      const rLeft = Math.max(0, Math.round((endRef.current - Date.now()) / 1000))
      setRemain(rLeft)
      if (rLeft <= 0) {
        clearInterval(iv)
        const score = totalMs.current ? Math.round((onMs.current / totalMs.current) * 100) : 0
        // ⚠ rate 家族：只上报接触率，**不上报 time**。
        //   本局时长由难度固定（dur），是「限时压力」而非「速度表现」——
        //   原实现的 `time = dur * 1000` 是纯粹的占位假值，拿它排名等于
        //   「把一个固定常量当成绩」：每局用时一模一样，排行榜毫无信息量。
        record({ score: rateScore(score), accuracy: score })
        setResult({ score }); setPhase('done')
      }
    }, 200)
    return () => clearInterval(iv)
  }, [phase, dur, record])

  const start = () => {
    pos.current = { x: boxW / 2, y: H / 2 }
    const ang = Math.random() * Math.PI * 2
    vel.current = { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed }
    pointer.current = null; onMs.current = 0; totalMs.current = 0; lastTs.current = 0
    setRemain(dur); setResult(null); setPhase('play')
  }

  /**
   * 挂载即开局（D-06）+ **StrictMode 安全**。
   *
   * 这里原本也有「startedFor.current === sessionId 就 return」的幂等守卫。
   * 本组件当时侥幸没炸，是因为 rAF / interval 由 `useEffect([phase, …])` 驱动、
   * StrictMode 重放时它们会自行重新启动 —— 但这属于「碰巧对」而非「写得对」，
   * 与另外四款游戏同一套隐患。现统一去掉守卫：start() 本身幂等
   *（setPhase('play') 是同值更新，React 直接 bail out），重放一次等于重开一局。
   */
  useLayoutEffect(() => {
    start()
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const onLeave = () => { pointer.current = null }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm text-center">
        把鼠标/手指<b>一直压在移动的红点上</b>，坚持 {dur} 秒。接触时间占比越高越好。
      </p>
      {phase === 'play' && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-slate-500 text-sm">剩余 {remain}s</div>
          <div onPointerMove={onMove} onPointerLeave={onLeave}
            ref={areaRef}
            className="relative w-full max-w-[380px] bg-slate-100 rounded-2xl overflow-hidden touch-none"
            style={{ height: H }}>
            <div ref={dotRef} className="absolute rounded-full bg-rose-500 will-change-transform"
              style={{ width: r * 2, height: r * 2, left: 0, top: 0 }} />
          </div>
          <p className="text-slate-400 text-xs">移动鼠标/手指，让光标一直压在红点上</p>
        </div>
      )}
      {phase === 'done' && result && (
        <div className="animate-scale-in text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">本次追踪接触率：<b>{result.score}%</b></p>
        </div>
      )}

      {/* 重开入口常驻：结算前后都能换局，不必先打完一轮（P3 一致性修复） */}
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}
