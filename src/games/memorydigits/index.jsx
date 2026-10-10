import { useState, useLayoutEffect, useRef, useCallback } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { DIFFICULTY_KEYS, difficultyLabel } from '../../difficulty.js'
import { spanScore, hitRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

function genSeq(len) {
  const arr = []
  for (let i = 0; i < len; i++) arr.push(Math.floor(Math.random() * 10))
  return arr
}

export default function MemoryDigitsGame() {
  const {
    params,
    difficulty,
    setDifficulty,
    record,
    sessionId,
    restartToGate,
    restartSame,
  } = useGameSession()
  // 起始长度 / 长度上限 / 呈现时长均由难度决定
  const { base, maxLen, showMs } = params

  // 初值即'show'：本组件只在 started 为真时挂载，首帧即进入数字展示阶段。
  // 注意与「下一轮」区分：首局自动开始，后续每轮仍由玩家点「下一轮」触发 nextRound()。
  const [phase, setPhase] = useState('show') // show | input | result
  const [length, setLength] = useState(base)
  const [seq, setSeq] = useState([])
  const [showSeq, setShowSeq] = useState('')
  const [input, setInput] = useState('')
  const [lastCorrect, setLastCorrect] = useState(false)
  const [round, setRound] = useState(0)
  const [correctRounds, setCorrectRounds] = useState(0)
  const [streak, setStreak] = useState(0)
  /** 本局成功复述过的**最长位数** —— span 家族的计分主体（越高越好）。
   *  初值 null 表示「还没答对过任何一轮」，此时排行榜应显示 — 而不是 0 位。 */
  const [bestSpan, setBestSpan] = useState(null)
  const hideTimer = useRef(null)

  const start = useCallback(() => {
    const s = genSeq(length)
    setSeq(s)
    setShowSeq(s.join(' '))
    setInput('')
    setPhase('show')
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      setShowSeq('')
      setPhase('input')
    }, showMs)
  }, [length, showMs])

  /**
   * 挂载即开局（D-06）+ **StrictMode 安全**。
   *
   * ⚠ 这里**不能**再用「startedFor.current === sessionId 就 return」的幂等守卫：
   * React 18 StrictMode 在开发模式下会「挂载 → 跑 cleanup → 再挂载」。
   * 原来的写法把 clearTimeout 放在一个**独立的** `useEffect(..., [])` 里，
   * 于是 StrictMode 重放时：第一次 start() 注册的隐藏定时器被 cleanup 清掉，
   * 第二次挂载又被守卫挡掉 → **数字永不隐藏、输入框永不出现**。
   *
   * 正确写法：把「注册定时器」与「清理定时器」放进**同一个 effect**，
   * setup / cleanup 严格成对，重放一次就等于重开一局。
   *
   * 依赖刻意只写 [sessionId]：start 依赖 length，而 length 会随答对答错变化，
   * 若列入依赖会导致每轮长度变化都重开一局。开局时机只由 sessionId 决定。
   */
  useLayoutEffect(() => {
    start()
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const submit = () => {
    const guess = input
      .replace(/\D+/g, '')
      .split('')
      .map(Number)
    const correct =
      guess.length === seq.length && guess.every((d, i) => d === seq[i])
    setLastCorrect(correct)
    const newRound = round + 1
    const newCorrect = correct ? correctRounds + 1 : correctRounds
    setRound(newRound)
    setCorrectRounds(newCorrect)
    if (correct) {
      setStreak((st) => st + 1)
      setLength(Math.min(length + 1, maxLen))
    } else {
      setStreak(0)
      setLength(base)
    }
    // ⚠ 记忆广度类计分：只记「成功复述过的最长位数」，**不上报 time**。
    //   这类游戏没有限时属性，用跨轮累加的会话时长排名只会奖励手速而非记忆力。
    //   答对本轮即证明能记住 length 位，故本轮达成的跨度就是 length。
    const span = bestSpan != null && bestSpan > length ? bestSpan : length
    if (correct && span > (bestSpan ?? 0)) setBestSpan(span)
    record({
      score: spanScore(span),
      span,
      accuracy: hitRate(newCorrect, newRound),
    })
    setPhase('result')
  }

  const nextRound = () => start()

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-md mx-auto">
      {/* 难度切换器：原「显示时长」按钮组改为切难度，点击即回遮罩（D-02 / D-05） */}
      <div className="flex items-center gap-2 flex-wrap justify-center text-sm">
        <span className="text-slate-500">难度：</span>
        {DIFFICULTY_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setDifficulty(k)}
            className={`px-2.5 py-1 rounded-lg border transition ${
              difficulty === k
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
            }`}
          >
            {difficultyLabel(k)}
          </button>
        ))}
        <span className="text-xs text-slate-400">当前显示时长 {(showMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
        <span>当前长度：<b className="text-indigo-600">{length}</b></span>
        <span>连对：<b className="text-emerald-600">{streak}</b></span>
        {/* 本局已达成的记忆广度 —— 这才是本游戏要排行榜记的东西 */}
        <span>本局广度：<b className="text-amber-600">{bestSpan ?? '—'}</b> 位</span>
      </div>

      <div className="w-full h-40 rounded-2xl bg-slate-50 ring-1 ring-slate-200 flex items-center justify-center text-center px-4">
        {phase === 'show' && (
          <p className="text-4xl font-bold tracking-widest text-slate-800 select-none">
            {showSeq}
          </p>
        )}
        {phase === 'input' && (
          <div className="w-full">
            <input
              autoFocus
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={`请输入 ${seq.length} 位数字`}
              className="w-full text-center text-2xl tracking-widest px-4 py-3 rounded-xl border-2 border-indigo-300 focus:border-indigo-500 outline-none"
            />
          </div>
        )}
        {phase === 'result' && (
          <div className="text-center">
            <p className={`text-2xl font-bold ${lastCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
              {lastCorrect ? '✅ 正确！' : '❌ 答错了'}
            </p>
            <p className="text-slate-500 mt-1">
              正确答案：<b className="tracking-widest">{seq.join(' ')}</b>
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase === 'input' && (
          <button
            onClick={submit}
            disabled={input.replace(/\D+/g, '').length === 0}
            className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            提交
          </button>
        )}
        {phase === 'result' && (
          <button
            onClick={nextRound}
            className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            下一轮
          </button>
        )}
        </div>

      <RestartBar restartToGate={restartToGate} restartSame={restartSame} />

      {round > 0 && (
        <p className="text-xs text-slate-400">已完成 {round} 轮</p>
      )}
    </div>
  )
}