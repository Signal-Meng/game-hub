import { useState, useEffect, useRef, useCallback } from 'react'
import { fmtMs, useGameSession } from '../../hooks/useGameStats.js'
import { DIFFICULTY_KEYS, difficultyLabel, shuffleArray } from '../../difficulty.js'
import { compositeScore, hitRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

function shuffle(arr) {
  return shuffleArray(arr)
}

export default function SchulteGame() {
  const { params, par, difficulty, setDifficulty, record, restartToGate, restartSame } = useGameSession()
  // 训练参数全部来自难度（registry），不再有模块级常量
  const { size, flashMs } = params

  const [cells, setCells] = useState([])
  const [next, setNext] = useState(1)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [done, setDone] = useState(false)
  const [flash, setFlash] = useState(null) // { i, ok }
  const timerRef = useRef(null)
  const flashTimer = useRef(null)
  const startRef = useRef(0)

  const total = size * size

  const newGame = useCallback(
    (n = size) => {
      const nums = shuffle(Array.from({ length: n * n }, (_, i) => i + 1))
      setCells(nums)
      setNext(1)
      setMistakes(0)
      setDone(false)
      setRunning(false)
      setElapsed(0)
      setFlash(null)
      if (timerRef.current) clearInterval(timerRef.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [size],
  )

  useEffect(() => {
    newGame(size)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [size, newGame])

  const tick = () => setElapsed(Date.now() - startRef.current)

  const showFlash = (i, ok) => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ i, ok })
    flashTimer.current = setTimeout(() => setFlash(null), flashMs)
  }

  const handleClick = (val, i) => {
    if (done) return
    if (!running) {
      setRunning(true)
      startRef.current = Date.now()
      timerRef.current = setInterval(tick, 50)
    }
    if (val === next) {
      showFlash(i, true)
      const n = next + 1
      setNext(n)
      if (n > total) {
        setRunning(false)
        if (timerRef.current) clearInterval(timerRef.current)
        setDone(true)
        const final = Date.now() - startRef.current
        setElapsed(final)
        // composite 家族：对与快都要看，综合分 = 正确率 × 速度系数（par 来自 registry）
        const acc = hitRate(total - mistakes, total)
        record({
          score: compositeScore({ accuracy: acc, timeMs: final, parMs: par }),
          accuracy: acc,
          time: final,
        })
      }
    } else {
      showFlash(i, false)
      setMistakes((m) => m + 1)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 难度切换器：点击即回开始前遮罩，绝不静默修改当前局参数（D-02 / D-05） */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className="text-sm text-slate-500">难度：</span>
        {DIFFICULTY_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setDifficulty(k)}
            className={`px-3 py-1 rounded-lg text-sm border transition ${
              difficulty === k
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
            }`}
          >
            {difficultyLabel(k)}
          </button>
        ))}
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {cells.map((val, i) => {
          const found = val < next
          const isFlash = flash && flash.i === i
          return (
            <button
              key={i}
              onClick={() => handleClick(val, i)}
              disabled={found}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl text-lg font-semibold transition select-none ring-1 ${
                isFlash
                  ? flash.ok
                    ? 'bg-emerald-200 text-slate-700 ring-emerald-300'
                    : 'bg-rose-200 text-slate-700 ring-rose-300'
                  : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 ring-slate-200'
              }`}
            >
              {val}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center text-sm text-slate-500">
        <span>用时：{fmtMs(elapsed)}</span>
        <span>错误：{mistakes}</span>
      </div>
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} />
    </div>
  )
}