import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { compositeScore, computeTps, hitRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

// 目标符号池：每轮随机选一个作为本轮目标，用户不能只记「找 ★」
const TARGETS = ['★', '●', '▲', '◆', '■']

// 干扰符号池：按难度分层，level 越高干扰项与各类目标越相似
//   level 0（easy）：与所有目标差异极大，一眼可辨
//   level 1（medium）：轮廓相同但填充不同（空心 vs 实心）
//   level 2（hard）：同为实心五角/四角星等，字形高度重叠
const DISTRACTOR_POOLS = [
  // easy：完全不同类别的符号
  {
    '★': ['●', '■', '▲', '♦'],
    '●': ['★', '■', '▲', '♦'],
    '▲': ['★', '●', '■', '♦'],
    '◆': ['★', '●', '■', '▲'],
    '■': ['★', '●', '▲', '♦'],
  },
  // medium：同形状空心/轮廓版本（需要区分填充状态）
  {
    '★': ['☆', '✩', '⭐', '✭'],
    '●': ['○', '◯', '◍', '◌'],
    '▲': ['△', '▵', '▴', '▿'],
    '◆': ['◇', '◈', '⋄', '⬥'],
    '■': ['□', '▢', '▣', '▤'],
  },
  // hard：同为实心且形状高度相似（五角星 vs 四角星 vs 六角星等）
  {
    '★': ['✦', '✱', '✲', '✳', '❋', '✹'],
    '●': ['◉', '⬤', '❂', '✦', '⬟', '⬢'],
    '▲': ['△', '◭', '⏃', '◬', '⏂', '◮'],
    '◆': ['❖', '⬧', '⬩', '✦', '⟡', '◈'],
    '■': ['▩', '▧', '▨', '◫', '⬒', '⬓'],
  },
]

export default function VisualSearchGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  const { trials, gridBase, gridRand, distractorLevel } = params

  const [phase, setPhase] = useState('play')
  const [trial, setTrial] = useState(0)
  const [grid, setGrid] = useState([])
  const [size, setSize] = useState(0)
  const [target, setTarget] = useState('★')
  const [mistakes, setMistakes] = useState(0)
  const [times, setTimes] = useState([])
  const [lastAvg, setLastAvg] = useState(null)
  const [tps, setTps] = useState(null)
  const startRef = useRef(0)
  const sessionRef = useRef(0)

  const gen = useCallback((n) => {
    const total = n * n
    const lvl = Math.min(distractorLevel, DISTRACTOR_POOLS.length - 1)
    // 每轮随机选目标符号（不总是 ★），干扰项从对应池中取
    const t = TARGETS[Math.floor(Math.random() * TARGETS.length)]
    const pool = DISTRACTOR_POOLS[lvl][t] || DISTRACTOR_POOLS[lvl]['★']
    const arr = Array.from({ length: total }, () => pool[Math.floor(Math.random() * pool.length)])
    const idx = Math.floor(Math.random() * total)
    arr[idx] = t
    setTarget(t)
    setGrid(arr); setSize(n)
  }, [distractorLevel])

  const genNext = useCallback(() => {
    gen(gridBase + Math.floor(Math.random() * gridRand))
  }, [gen, gridBase, gridRand])

  const start = () => {
    setTrial(0); setMistakes(0); setTimes([]); setLastAvg(null); setTps(null)
    sessionRef.current = Date.now()
    genNext()
    setPhase('play'); startRef.current = Date.now()
  }

  useLayoutEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const click = (i) => {
    if (phase !== 'play') return
    if (grid[i] === target) {
      const rt = Date.now() - startRef.current
      const nt = [...times, rt]; setTimes(nt)
      const n = trial + 1
      if (n >= trials) {
        const avg = Math.round(nt.reduce((a, b) => a + b, 0) / trials)
        setLastAvg(avg)
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
        在网格里找出唯一的 <span className="text-2xl">{target}</span>，尽快点击它。共 {trials} 轮，
        {gridRand > 0 ? '网格会逐轮变大。' : '网格规模固定。'}
      </p>
      {phase === 'play' && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-slate-400 text-sm">第 {trial + 1} / {trials} 轮 · 误点 {mistakes}</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}>
            {grid.map((sym, i) => (
              <button key={i} onClick={() => click(i)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-md flex items-center justify-center text-lg select-none bg-slate-100 hover:bg-slate-200">
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div className="animate-scale-in text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">吞吐量：<b>{tps == null ? '—' : `${tps} 轮/秒`}</b></p>
          <p className="text-slate-600">平均搜索时间：<b>{lastAvg != null ? lastAvg : '—'}ms</b>（越短越好）</p>
          <p className="text-slate-600">误点次数：<b>{mistakes}</b></p>
        </div>
      )}

      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}
