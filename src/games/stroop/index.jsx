import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { compositeScore, computeTps, hitRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

const COLORS = [
  { name: '红', key: 'red', hex: '#ef4444' },
  { name: '绿', key: 'green', hex: '#22c55e' },
  { name: '蓝', key: 'blue', hex: '#3b82f6' },
  { name: '黄', key: 'yellow', hex: '#eab308' },
]

export default function StroopGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 试次数由难度决定；颜色刻意保持 4 色（难度与颜色数正交）
  const { trials } = params

  // 初值即进行态：本组件只在 started 为真时挂载，「开始」= 直接进入 play，不存在空帧
  const [phase, setPhase] = useState('play') // play | done
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [word, setWord] = useState(null)
  const [result, setResult] = useState(null)
  const startRef = useRef(0)
  const sessionRef = useRef(0)
  const timesRef = useRef([])

  const nextTrial = useCallback(() => {
    const w = COLORS[Math.floor(Math.random() * COLORS.length)]
    const ink = COLORS[Math.floor(Math.random() * COLORS.length)]
    setWord({ text: w.name, ink: ink.hex, inkKey: ink.key })
    startRef.current = Date.now()
  }, [])

  const start = () => {
    setRound(0); setScore(0); setCorrect(0); timesRef.current = []
    setResult(null); setPhase('play'); sessionRef.current = Date.now(); nextTrial()
  }

  /**
   * 挂载即开局：一次「开始」= 一局（D-06）+ **StrictMode 安全**。
   * 用 useLayoutEffect 而非 useEffect：state 在浏览器绘制前就提交，
   * 因此首帧即是已出题的游戏画面，不会闪出一帧空白卡片（配合 phase 初值 'play'）。
   *
   * ⚠ 不得使用「startedFor.current === sessionId 就 return」的幂等守卫（详见 README）。
   * start() 本身幂等，StrictMode 重放一次即等于重开一局。
   */
  useLayoutEffect(() => {
    start()
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const choose = (key) => {
    if (phase !== 'play' || !word) return
    const rt = Date.now() - startRef.current
    timesRef.current.push(rt)
    const isCorr = key === word.inkKey
    const newCorrect = correct + (isCorr ? 1 : 0)
    const newScore = score + (isCorr ? Math.max(0, 100 - Math.floor(rt / 10)) : 0)
    const n = round + 1
    if (n >= trials) {
      setCorrect(newCorrect); setScore(newScore); setPhase('done')
      const acc = hitRate(newCorrect, trials)
      const avg = Math.round(timesRef.current.reduce((a, b) => a + b, 0) / trials)
      // tps 家族：本局总用时 + 吞吐量（题/秒），综合分 = 正确率 × 速度系数
      const totalMs = Date.now() - sessionRef.current
      record({
        score: compositeScore({ accuracy: acc, timeMs: totalMs, parMs: par }),
        accuracy: acc,
        time: totalMs,
        tps: computeTps(trials, totalMs),
      })
      setResult({ acc, avg, score: newScore, tps: computeTps(trials, totalMs) })
    } else {
      setCorrect(newCorrect); setScore(newScore); setRound(n); nextTrial()
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm text-center">
        读出<b>文字的颜色</b>（不是字义），点对应颜色按钮。共 {trials} 题。
      </p>
      {phase === 'play' && word && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-slate-400 text-sm">第 {round + 1} / {trials} 题</div>
          <div className="text-6xl font-bold select-none" style={{ color: word.ink }}>{word.text}</div>
          <div className="grid grid-cols-2 gap-3 w-full">
            {COLORS.map((c) => (
              <button key={c.key} onClick={() => choose(c.key)}
                className="py-3 rounded-xl text-white font-semibold text-lg shadow-sm hover:opacity-90"
                style={{ background: c.hex }}>{c.name}</button>
            ))}
          </div>
        </div>
      )}
      {phase === 'done' && result && (
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">正确率：<b>{result.acc}%</b></p>
          <p className="text-slate-600">吞吐量：<b>{result.tps == null ? '—' : `${result.tps} 题/秒`}</b></p>
          <p className="text-slate-600">平均反应：<b>{result.avg}ms</b></p>
          <p className="text-slate-600">得分：<b>{result.score}</b></p>
        </div>
      )}

      {/* 重开入口常驻：结算前后都能换局，不必先打完一轮（P3 一致性修复） */}
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}