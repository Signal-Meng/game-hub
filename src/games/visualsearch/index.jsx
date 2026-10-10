import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { compositeScore, computeTps, hitRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

export default function VisualSearchGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 两条正交难度轴：轮数 + 网格规模（gridBase + gridRand 随机项数）
  const { trials, gridBase, gridRand } = params

  const [phase, setPhase] = useState('play') // play | done
  const [trial, setTrial] = useState(0)
  const [grid, setGrid] = useState([])
  const [size, setSize] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [times, setTimes] = useState([])
  const [lastAvg, setLastAvg] = useState(null)
  const [tps, setTps] = useState(null)
  const startRef = useRef(0)
  const sessionRef = useRef(0)

  const gen = useCallback((n) => {
    const total = n * n
    const arr = Array.from({ length: total }, () => false)
    arr[Math.floor(Math.random() * total)] = true
    setGrid(arr); setSize(n)
  }, [])

  /** 生成下一轮网格：规模统一由 gridBase + rand(gridRand) 决定（gridRand=0 即固定） */
  const genNext = useCallback(() => {
    gen(gridBase + Math.floor(Math.random() * gridRand))
  }, [gen, gridBase, gridRand])

  const start = () => {
    setTrial(0); setMistakes(0); setTimes([]); setLastAvg(null); setTps(null)
    sessionRef.current = Date.now()
    genNext()
    setPhase('play'); startRef.current = Date.now()
  }

  /**
   * 挂载即开局（D-06）+ **StrictMode 安全**。
   * ⚠ 不得使用「startedFor.current === sessionId 就 return」的幂等守卫，
   *   详见 README「StrictMode 安全的副作用」。start() 本身幂等，无需守卫。
   */
  useLayoutEffect(() => {
    start()
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const click = (i) => {
    if (phase !== 'play') return
    if (grid[i]) {
      const rt = Date.now() - startRef.current
      const nt = [...times, rt]; setTimes(nt)
      const n = trial + 1
      if (n >= trials) {
        const avg = Math.round(nt.reduce((a, b) => a + b, 0) / trials)
        setLastAvg(avg)
        // tps 家族：上报**总用时**（原先记的是单轮平均，导致跨轮数难度不可比），
        // 另算吞吐量（轮/秒）与综合分。
        const totalMs = Date.now() - sessionRef.current
        const acc = hitRate(trials - mistakes, trials)
        const myTps = computeTps(trials, totalMs)
        setTps(myTps)
        record({
          score: compositeScore({ accuracy: acc, timeMs: totalMs, parMs: par }),
          accuracy: acc,
          time: totalMs,
          tps: myTps,
        })
        setPhase('done')
      } else {
        setTrial(n)
        genNext()
        startRef.current = Date.now()
      }
    } else {
      setMistakes((m) => m + 1)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm text-center">
        在网格里找出唯一的 <span className="text-2xl">★</span>，尽快点击它。共 {trials} 轮，
        {gridRand > 0 ? '网格会逐轮变大。' : '网格规模固定。'}
      </p>
      {phase === 'play' && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-slate-400 text-sm">第 {trial + 1} / {trials} 轮 · 误点 {mistakes}</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}>
            {grid.map((isT, i) => (
              <button key={i} onClick={() => click(i)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-md flex items-center justify-center text-lg select-none bg-slate-100 hover:bg-slate-200">
                {isT ? '★' : '•'}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">吞吐量：<b>{tps == null ? '—' : `${tps} 轮/秒`}</b></p>
          <p className="text-slate-600">平均搜索时间：<b>{lastAvg != null ? lastAvg : '—'}ms</b>（越短越好）</p>
          <p className="text-slate-600">误点次数：<b>{mistakes}</b></p>
        </div>
      )}

      {/* 重开入口常驻：结算前后都能换局，不必先打完一轮（P3 一致性修复） */}
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}