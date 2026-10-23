import { useState, useRef, useLayoutEffect, useMemo } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import RestartBar from '../../components/RestartBar.jsx'
import { useSequencePlayer } from '../../hooks/useSequencePlayer.js'
import { sampleUnique, shuffleIndices } from '../../difficulty.js'
import { spanScore, hitRate } from '../../scoring.js'

const POS = [
  { x: 12, y: 15 }, { x: 50, y: 10 }, { x: 86, y: 18 },
  { x: 20, y: 50 }, { x: 55, y: 48 }, { x: 88, y: 52 },
  { x: 14, y: 84 }, { x: 52, y: 86 }, { x: 85, y: 80 },
]

export default function CorsiGame() {
  const { params, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 激活方块数量 / 起始序列长度由难度决定；pool 必须 ≤ POS.length
  const { pool, startLen } = params

  const [phase, setPhase] = useState('playback') // playback | input | done
  const [lit, setLit] = useState(-1)
  const [msg, setMsg] = useState('')
  const [seqs, setSeqs] = useState(0)
  const [okSeqs, setOkSeqs] = useState(0)
  /** 本局成功复现过的最长步数（span 家族计分主体）。state 用于展示，ref 用于 record 读取。 */
  const [bestSpan, setBestSpan] = useState(null)
  const bestSpanRef = useRef(null)
  const seqRef = useRef([])
  const inputRef = useRef(0)
  const { aliveRef, later, clearTimers } = useSequencePlayer()

  /**
   * 构造本局成绩快照（record 是整行替换语义，每次必须给全）。
   * @param {number} span 本轮达成的步数
   * @param {number} totalSeqs 已进行的轮次
   * @param {number} okCount 成功轮数
   */
  const thisSessionRecord = (span, totalSeqs, okCount) => {
    const best = bestSpanRef.current == null ? span : Math.max(bestSpanRef.current, span)
    if (bestSpanRef.current == null || span > bestSpanRef.current) {
      bestSpanRef.current = span
      setBestSpan(span)
    }
    return {
      score: spanScore(best),
      span: best,
      accuracy: hitRate(okCount, totalSeqs),
    }
  }

  /**
   * 激活的方块下标子集：**局内固定（记住位置就能赢）、局间随机（避免背点）**。
   * 未激活位置不渲染 —— 渲染成灰色不可点会让 easy 档的「干扰项」语义含混。
   */
  const active = useMemo(
    () => shuffleIndices(POS.length).slice(0, Math.min(pool, POS.length)),
    [sessionId, pool],
  )

  const playSeq = (s) => {
    setPhase('playback')
    let i = 0
    const step = () => {
      if (i >= s.length) { setPhase('input'); inputRef.current = 0; return }
      const idx = s[i]
      setLit(idx)
      later(() => { setLit(-1); i++; later(step, 250) }, 500)
    }
    step()
  }

  const startGame = () => {
    setSeqs(0); setOkSeqs(0)
    bestSpanRef.current = null; setBestSpan(null)
    // 起始序列取激活子集中互不重复的位置（现状恒 1 步且无法产出不重复的 2 步序列）
    const first = sampleUnique(active.length, startLen).map((i) => active[i])
    seqRef.current = first; setMsg('')
    playSeq(first)
  }

  /**
   * 挂载即开局（D-06）+ **StrictMode 安全**。
   *
   * ⚠ 这里**不能**再用「startedFor.current === sessionId 就 return」的幂等守卫：
   * React 18 StrictMode 在开发模式下会「挂载 → 跑 cleanup → 再挂载」，
   * 守卫会让第二次挂载直接 return，而第一次注册的定时器已被 cleanup 清掉，
   * 于是 playSeq 的递归链永远续不上 → 方块亮起后冻结、phase 卡在 'playback'。
   *
   * 正确写法：**aliveRef 置位、cleanup、开局三件事放在同一个 effect 里**，
   * 使 setup 与 cleanup 严格成对 —— StrictMode 重放一次就等于重开一局，行为自洽。
   * `[sessionId]` 本身已保证「换局才重开」，守卫本就是多余的。
   */
  useLayoutEffect(() => {
    aliveRef.current = true
    startGame()
    return () => {
      aliveRef.current = false
      clearTimers()
    }
    // startGame 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const tap = (idx) => {
    if (phase !== 'input') return
    setLit(idx)
    later(() => setLit(-1), 200)
    const s = seqRef.current
    if (idx !== s[inputRef.current]) {
      const newSeqs = seqs + 1
      setSeqs(newSeqs)
      setPhase('done'); setMsg(`错误！你记住了 ${s.length - 1} 步`)
      // ⚠ span 家族：只记最长成功步数，**不上报 time**（空间记忆不比手速）
      record(thisSessionRecord(s.length - 1, newSeqs, okSeqs))
      return
    }
    const ni = inputRef.current + 1
    if (ni >= s.length) {
      // 追加一个随机的激活位置（序列允许重复位置，只有起始序列要求互不相同）
      const next = [...s, active[Math.floor(Math.random() * active.length)]]
      seqRef.current = next
      const newSeqs = seqs + 1
      const newOk = okSeqs + 1
      setSeqs(newSeqs); setOkSeqs(newOk)
      record(thisSessionRecord(s.length, newSeqs, newOk))
      setMsg(`很好！已到第 ${next.length - 1} 步`)
      later(() => playSeq(next), 600)
    } else { inputRef.current = ni }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm">记住方块亮起的<b>顺序</b>，再依次点出来。本局最长步数与正确率见右侧成绩面板。</p>
      <div className="text-sm text-slate-500">
        本局最长：<b className="text-amber-600">{bestSpan ?? '—'}</b> 步
        <span className="ml-3 text-xs text-slate-400">（空间记忆不计用时，只比能记多长）</span>
      </div>
      <div className="relative bg-slate-100 rounded-2xl" style={{ width: 320, height: 260 }}>
        {active.map((i) => {
          const p = POS[i]
          return (
            <button key={i} onClick={() => tap(i)}
              className="absolute w-12 h-12 rounded-xl transition-opacity"
              style={{ left: `calc(${p.x}% - 24px)`, top: `calc(${p.y}% - 24px)`, background: lit === i ? '#6366f1' : '#94a3b8', opacity: lit === i ? 1 : 0.85 }} />
          )
        })}
      </div>
      {phase === 'done' && (
        <div className="animate-scale-in text-center">
          <p className="text-xl font-bold text-rose-500">{msg}</p>
        </div>
      )}
      {phase === 'playback' && <p className="text-slate-400 text-sm">看顺序…</p>}
      {phase === 'input' && <p className="text-slate-400 text-sm">轮到你了</p>}

      {/* 重开入口常驻：结算前后都能换局，不必先打完一轮（P3 一致性修复） */}
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-2" />
    </div>
  )
}
