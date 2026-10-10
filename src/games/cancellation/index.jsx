import { useState, useRef, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { compositeScore, computeTps, penaltyRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

export default function CancellationGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 棋盘规模由难度决定（6×6 / 8×8 / 10×10）
  const { size } = params

  const [phase, setPhase] = useState('play') // play | done
  const [cells, setCells] = useState([])
  const [target, setTarget] = useState(0)
  const [picked, setPicked] = useState(() => new Set())
  const [result, setResult] = useState(null)
  const startRef = useRef(0)

  const start = () => {
    const t = 1 + Math.floor(Math.random() * 9)
    const arr = Array.from({ length: size * size }, () => 1 + Math.floor(Math.random() * 9))
    // 护栏：保证棋盘上至少有几个目标格。
    // 纯随机会出现「一格目标都没有」的局（6×6 下概率约 1.3%），
    // 那种局既无任务可做，又会让正确率除以 0 → NaN，写进排行榜就是一整行「—」。
    let present = arr.reduce((n, v) => (v === t ? n + 1 : n), 0)
    const need = Math.min(4, arr.length)
    let guard = 0
    while (present < need && guard++ < arr.length * 4) {
      const i = Math.floor(Math.random() * arr.length)
      if (arr[i] !== t) { arr[i] = t; present++ }
    }
    setTarget(t); setCells(arr); setPicked(new Set()); setResult(null)
    setPhase('play'); startRef.current = Date.now()
  }
  useLayoutEffect(() => {
    start()
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const toggle = (i) => {
    if (phase !== 'play') return
    setPicked((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i); else n.add(i)
      return n
    })
  }

  const submit = () => {
    const total = cells.filter((v) => v === target).length
    let hits = 0, fa = 0
    picked.forEach((i) => {
      if (cells[i] === target) hits++; else fa++
    })
    const misses = total - hits
    // 扣分式正确率：漏划要扣、误划也要扣；用 penaltyRate 统一口径
    const acc = penaltyRate(hits, fa, total)
    // ⚠ 原实现 `Math.round(ms/1000)*1000` 把亚秒精度全抹掉了 ——
    //   一局 12.4 秒与 12.6 秒会被记成同一个 12 秒，在同难度内完全无法区分。
    const timeMs = Date.now() - startRef.current
    // tps 家族：吞吐量以「扫描过的格子数」为单位，**不能用目标格数**。
    //   目标格数每局随机（同样表现下 tps 会在 2~13 间乱跳），会让指标被随机数主导；
    //   而网格总格数由难度固定，跨局跨难度都可比，才反映真实的处理速度。
    const scanned = cells.length
    const myTps = computeTps(scanned, timeMs)
    record({
      score: compositeScore({ accuracy: acc, timeMs, parMs: par }),
      accuracy: acc,
      time: timeMs,
      tps: myTps,
    })
    setResult({ total, hits, misses, fa, acc, time: Math.round(timeMs / 1000), tps: myTps, scanned })
    setPhase('done')
  }

  // 格子尺寸随规模自适应，避免 10×10 在窄屏横向溢出。
  // 验算（375px 视口可用宽 293px = 375 − main px-4×2 − 卡片 p-6×2 − border×2）：
  //   6×6  w-9(36) + gap-1(4) → 6×36 + 5×4 = 236px ✅
  //   8×8  w-8(32) + gap-1(4) → 8×32 + 7×4 = 284px ✅
  //  10×10 w-6(24) + gap-0.5(2) → 10×24 + 9×2 = 258px ✅（原 w-7+gap-1 需 316px，溢出 23px）
  const dense = size >= 10
  const cellClass = dense
    ? 'w-6 h-6 text-sm sm:w-7 sm:h-7'
    : size >= 8
      ? 'w-8 h-8 text-base sm:w-9 sm:h-9'
      : 'w-9 h-9 text-base sm:w-10 sm:h-10'
  const gapClass = dense ? 'gap-0.5' : 'gap-1'

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm text-center">
        规则：<b>划掉（点击）所有显示该数字</b>的格子，完成后点“检查”。
      </p>
      {phase === 'play' && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-slate-500 text-sm">请划掉所有：<b className="text-2xl text-indigo-600 mx-1">{target}</b>（已选 {picked.size}）</div>
          <div className={`grid ${gapClass}`} style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}>
            {cells.map((v, i) => (
              <button key={i} onClick={() => toggle(i)}
                className={`${cellClass} rounded font-medium select-none ${picked.has(i) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={submit} className="mt-2 px-6 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">检查</button>
        </div>
      )}
      {phase === 'done' && result && (
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">正确划掉：<b>{result.hits}/{result.total}</b> · 漏划：{result.misses} · 误划：{result.fa}</p>
          <p className="text-slate-600">准确率：<b>{result.acc}%</b> · 用时：{result.time}s</p>
          <p className="text-slate-600">吞吐量：<b>{result.tps == null ? '—' : `${result.tps} 格/秒`}</b>（按 {result.scanned} 格扫描）</p>
        </div>
      )}

      {/* 重开入口常驻：结算前后都能换局，不必先打完一轮（P3 一致性修复） */}
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}