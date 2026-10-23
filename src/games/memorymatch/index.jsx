import { useState, useRef, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { shuffleArray } from '../../difficulty.js'
import { compositeScore, hitRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'

// 图案池扩至 16（补 🥥 🥑 🌽 🥕），使 hard 档 10 对时仍有 6 个冗余
const SYMS = ['🍎','🍌','🍇','🍓','🍑','🍒','🥝','🍉','🍊','🍋','🍐','🍍','🥥','🥑','🌽','🥕']

export default function MemoryMatchGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 对数由难度决定；pairs 必须 ≤ SYMS.length
  const { pairs } = params

  const [cards, setCards] = useState([])
  const [flipped, setFlipped] = useState([])
  const [lock, setLock] = useState(false)
  const [moves, setMoves] = useState(0)
  const [matched, setMatched] = useState(0)
  const [won, setWon] = useState(false)
  const [mismatch, setMismatch] = useState(0)
  const timer = useRef(null)
  const sessionStart = useRef(Date.now())

  const start = () => {
    // 洗牌后取子集，消除「前 N 个图案」的顺序偏置
    const picks = shuffleArray(SYMS).slice(0, Math.min(pairs, SYMS.length))
    const deck = [...picks, ...picks]
      .map((s, i) => ({ id: i, sym: s, done: false }))
      .sort(() => Math.random() - 0.5)
    setCards(deck); setFlipped([]); setLock(false); setMoves(0); setMatched(0); setWon(false); setMismatch(0)
    sessionStart.current = Date.now()
  }

  // 挂载即开局。本组件只在 started 为真时挂载（遮罩期不存在），
  // 因此这个 effect 绝不会在遮罩显示期间执行 —— 这正是条件渲染的价值。
  useLayoutEffect(() => { start() }, [sessionId])

  useLayoutEffect(() => () => timer.current && clearTimeout(timer.current), [])

  const flip = (i) => {
    if (lock || won || flipped.includes(i) || cards[i]?.done) return
    const nf = [...flipped, i]
    setFlipped(nf)
    if (nf.length === 2) {
      setLock(true); setMoves((m) => m + 1)
      const [a, b] = nf
      if (cards[a].sym === cards[b].sym) {
        const nc = cards.map((c, idx) => (idx === a || idx === b ? { ...c, done: true } : c))
        setCards(nc); setFlipped([]); setLock(false)
        const nm = matched + 1
        setMatched(nm)
        if (nm === pairs) {
          setWon(true)
          // composite 家族：记忆效率（步数）折算进正确率，再与速度相乘得综合分。
          // 步数独立成列展示 —— 对翻牌来说「用了多少步」比「多少秒」更能说明记忆效率。
          const acc = hitRate(pairs, pairs + mismatch)
          const totalMs = Date.now() - sessionStart.current
          record({
            score: compositeScore({ accuracy: acc, timeMs: totalMs, parMs: par }),
            accuracy: acc,
            time: totalMs,
            moves,
          })
        }
      } else {
        setMismatch((m) => m + 1)
        timer.current = setTimeout(() => { setFlipped([]); setLock(false) }, 800)
      }
    }
  }

  // 牌面尺寸随对数收敛，避免 20 张牌在移动端溢出
  const wide = pairs > 8
  const cardClass = wide ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-14 h-14 sm:w-16 sm:h-16'

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <div className="text-slate-500 text-sm">翻出两两相同的图案。步数：<b>{moves}</b> · 已配对：{matched}/{pairs}</div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <button key={c.id} onClick={() => flip(i)}
            className={`${cardClass} rounded-xl text-2xl flex items-center justify-center transition ${c.done || flipped.includes(i) ? 'bg-white ring-2 ring-indigo-300' : 'bg-indigo-500 text-indigo-500 hover:bg-indigo-600'}`}>
            {c.done || flipped.includes(i) ? c.sym : '?'}
          </button>
        ))}
      </div>
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} />
      {won && (
        <p className="animate-scale-in text-xl font-bold text-emerald-600">全部配对完成！用了 {moves} 步</p>
      )}
    </div>
  )
}
