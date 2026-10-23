import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { compositeScore, computeTps, hitRate } from '../../scoring.js'
import { shuffleArray } from '../../difficulty.js'
import RestartBar from '../../components/RestartBar.jsx'

const COLORS = [
  { name: '红', key: 'red', hex: '#ef4444' },
  { name: '绿', key: 'green', hex: '#22c55e' },
  { name: '蓝', key: 'blue', hex: '#3b82f6' },
  { name: '黄', key: 'yellow', hex: '#eab308' },
]

export default function StroopGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  const { trials } = params

  const [phase, setPhase] = useState('play')
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [word, setWord] = useState(null)
  const [buttons, setButtons] = useState([])
  const [result, setResult] = useState(null)
  const startRef = useRef(0)
  const sessionRef = useRef(0)
  const timesRef = useRef([])
  const congruentTimesRef = useRef([])
  const incongruentTimesRef = useRef([])

  /**
   * 生成下一题。
   *
   * 斯特鲁普效应的核心测量：字义与墨色冲突时反应变慢（Stroop interference）。
   * 约 30% 的题为一致试验（congruent：字义 = 墨色），其余为不一致试验。
   * 没有一致试验作为对照，用户可以学到「永远忽略字义」策略，从而消除干扰。
   */
  const nextTrial = useCallback(() => {
    const isCongruent = Math.random() < 0.3
    const w = COLORS[Math.floor(Math.random() * COLORS.length)]
    const ink = isCongruent ? w : COLORS[Math.floor(Math.random() * COLORS.length)]
    setWord({ text: w.name, ink: ink.hex, inkKey: ink.key, isCongruent: w.key === ink.key })
    setButtons(shuffleArray(COLORS))
    startRef.current = Date.now()
  }, [])

  const start = () => {
    setRound(0); setCorrect(0)
    timesRef.current = []
    congruentTimesRef.current = []
    incongruentTimesRef.current = []
    setResult(null); setPhase('play'); sessionRef.current = Date.now(); nextTrial()
  }

  useLayoutEffect(() => {
    start()
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const choose = (key) => {
    if (phase !== 'play' || !word) return
    const rt = Date.now() - startRef.current
    timesRef.current.push(rt)
    if (word.isCongruent) congruentTimesRef.current.push(rt)
    else incongruentTimesRef.current.push(rt)
    const isCorr = key === word.inkKey
    const newCorrect = correct + (isCorr ? 1 : 0)
    const n = round + 1
    if (n >= trials) {
      setCorrect(newCorrect); setPhase('done')
      const acc = hitRate(newCorrect, trials)
      const totalMs = Date.now() - sessionRef.current
      record({
        score: compositeScore({ accuracy: acc, timeMs: totalMs, parMs: par }),
        accuracy: acc,
        time: totalMs,
        tps: computeTps(trials, totalMs),
      })
      const avgOf = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)
      const conAvg = avgOf(congruentTimesRef.current)
      const incAvg = avgOf(incongruentTimesRef.current)
      setResult({
        acc,
        avg: Math.round(timesRef.current.reduce((a, b) => a + b, 0) / trials),
        tps: computeTps(trials, totalMs),
        conAvg,
        incAvg,
        interference: conAvg != null && incAvg != null ? incAvg - conAvg : null,
      })
    } else {
      setRound(n); setCorrect(newCorrect); nextTrial()
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
            {buttons.map((c) => (
              <button key={c.key} onClick={() => choose(c.key)}
                className="py-3 rounded-xl text-slate-700 font-semibold text-lg shadow-sm hover:bg-slate-100 bg-slate-50 border border-slate-200 transition">
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'done' && result && (
        <div className="animate-scale-in text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">正确率：<b>{result.acc}%</b></p>
          <p className="text-slate-600">吞吐量：<b>{result.tps == null ? '—' : `${result.tps} 题/秒`}</b></p>
          <p className="text-slate-600">平均反应：<b>{result.avg}ms</b></p>
          {result.conAvg != null && result.incAvg != null && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">一致试验（字义=墨色）平均：<b>{result.conAvg}ms</b></p>
              <p className="text-slate-500">不一致试验（字义≠墨色）平均：<b>{result.incAvg}ms</b></p>
              <p className="mt-1 text-indigo-600 font-medium">
                斯特鲁普干扰量：<b>{result.interference}ms</b>（不一致 − 一致）
              </p>
            </div>
          )}
          <p className="text-slate-600 mt-2">得分：<b>{result.score ?? '—'}</b></p>
        </div>
      )}

      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}
