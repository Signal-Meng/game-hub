import { useState, useRef, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import RestartBar from '../../components/RestartBar.jsx'
import { useSequencePlayer } from '../../hooks/useSequencePlayer.js'
import { sampleUnique, sampleUniqueExcluding } from '../../difficulty.js'
import { spanScore, hitRate } from '../../scoring.js'

// PADS 刻意保持 4 色（色数是模态识别负担，与序列记忆负荷正交，不参与难度轴）
const PADS = [
  { color: '#ef4444', freq: 329.63 },
  { color: '#22c55e', freq: 440.0 },
  { color: '#3b82f6', freq: 554.37 },
  { color: '#eab308', freq: 659.25 },
]

export default function SimonGame() {
  const { params, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 起始序列长度 / 每轮递增量由难度决定
  const { startLen, inc } = params

  const [phase, setPhase] = useState('playback') // playback | input | done
  const [lit, setLit] = useState(-1)
  const [msg, setMsg] = useState('')
  const [seqs, setSeqs] = useState(0)
  const [okSeqs, setOkSeqs] = useState(0)
  /**
   * 本局成功复现过的**最长序列步数** —— span 家族的计分主体（越高越好）。
   * 同时维护 ref：record() 需要读到「截至此刻」的最大值，
   * 而 setState 是异步的，直接读 state 会拿到上一轮的旧值。
   */
  const [bestSpan, setBestSpan] = useState(null)
  const bestSpanRef = useRef(null)
  const audioRef = useRef(null)
  const seqRef = useRef([])
  const inputRef = useRef(0)
  const { aliveRef, later, clearTimers } = useSequencePlayer()

  /**
   * 构造本局的成绩快照（record 是整行替换语义，每次必须给全）。
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

  const resumeAudio = () => {
    const ac = audioRef.current
    if (ac && ac.state === 'suspended' && typeof ac.resume === 'function') {
      const p = ac.resume()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
  }

  /**
   * 懒创建并「唤醒」AudioContext。
   * ⚠ 挂载即开局（D-06）后本函数由 effect 调用，**不在用户手势栈内**，新建的
   * AudioContext 初始为 suspended：不显式 resume() 则 o.start() 不出声，整个游戏
   * 永久静音（后续 tap 里的 ensureAudio 也救不活 —— 上下文已存在，只会被跳过）。
   * 页面在 StartGate 点「开始」时已产生 sticky user activation，resume() 可成功。
   */
  const ensureAudio = () => {
    if (!audioRef.current) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext
        audioRef.current = Ctor ? new Ctor() : null
      } catch { audioRef.current = null }
    }
    resumeAudio()
  }
  const beep = (freq) => {
    const ac = audioRef.current; if (!ac) return
    // 兜底：suspended 状态下振荡器不发声，先尝试唤醒再播放
    resumeAudio()
    const o = ac.createOscillator(), g = ac.createGain()
    o.frequency.value = freq; o.type = 'sine'
    g.gain.setValueAtTime(0.2, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.3)
  }

  const playSeq = (s) => {
    setPhase('playback')
    let i = 0
    const step = () => {
      if (i >= s.length) { setPhase('input'); inputRef.current = 0; return }
      const idx = s[i]
      setLit(idx); beep(PADS[idx].freq)
      later(() => { setLit(-1); i++; later(step, 250) }, 450)
    }
    step()
  }

  const startGame = () => {
    ensureAudio()
    setSeqs(0); setOkSeqs(0)
    bestSpanRef.current = null; setBestSpan(null)
    // 起始序列取互不重复的色（现状恒 1 步，是本次改造相对现状的最大行为提升点）
    const first = sampleUnique(PADS.length, startLen)
    seqRef.current = first; setMsg('')
    playSeq(first)
  }

  /**
   * 挂载即开局（D-06）+ **StrictMode 安全**。
   *
   * ⚠ 这里**不能**再用「startedFor.current === sessionId 就 return」的幂等守卫：
   * React 18 StrictMode 在开发模式下会「挂载 → 跑 cleanup → 再挂载」。
   * 守卫会让第二次挂载直接 return，而第一次的定时器已被 cleanup 清掉，
   * 于是 playSeq 递归链永远续不上 → 序列冻结在第一格、phase 卡在 'playback'。
   *
   * 正确写法：**置位 aliveRef、注册 cleanup、开局三件事放在同一个 effect 里**，
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
    // startGame 每局只应执行一次，故刻意不列 startGame（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const tap = (idx) => {
    // R-4 兜底：tap 一定是用户手势，在此补一次 ensureAudio 保证第二轮起有声
    ensureAudio()
    if (phase !== 'input') return
    setLit(idx); beep(PADS[idx].freq)
    later(() => setLit(-1), 200)
    const s = seqRef.current
    if (idx !== s[inputRef.current]) {
      const newSeqs = seqs + 1
      setSeqs(newSeqs)
      setPhase('done')
      setMsg(`错误！你记住了 ${s.length - 1} 步`)
      // ⚠ span 家族：只记最长成功步数，**不上报 time**（序列记忆不比手速）
      record(thisSessionRecord(s.length - 1, newSeqs, okSeqs))
      return
    }
    const ni = inputRef.current + 1
    if (ni >= s.length) {
      // 每轮追加 inc 个随机 pad（ARCH §3.3）。
      // ⚠ 只排除序列「最后一个」pad，而不是全部历史元素：
      //   排除全部历史会让候选池随序列变长而耗尽（4 色用满后返回空数组），
      //   导致追加步为 0、序列长度永久卡死，且 inc=2 退化为 inc=1。
      //   只排除末位既保证「不与前一步同色」，又保证每轮恒定 +inc（候选恒有 3 个 ≥ inc）。
      const last = s.length ? s[s.length - 1] : -1
      const next = [...s, ...sampleUniqueExcluding(PADS.length, inc, [last])]
      seqRef.current = next
      const newSeqs = seqs + 1
      const newOk = okSeqs + 1
      setSeqs(newSeqs); setOkSeqs(newOk)
      // 本轮成功复现了 s.length 步，这就是本局达成的跨度
      record(thisSessionRecord(s.length, newSeqs, newOk))
      setMsg(`很好！已到第 ${next.length - 1} 步`)
      later(() => playSeq(next), 600)
    } else {
      inputRef.current = ni
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm">看灯光顺序与听音调，再按顺序点出来。本局最长步数与正确率见右侧成绩面板。</p>
      <div className="text-sm text-slate-500">
        本局最长：<b className="text-amber-600">{bestSpan ?? '—'}</b> 步
        <span className="ml-3 text-xs text-slate-400">（序列记忆不计用时，只比能记多长）</span>
      </div>
      <div className="grid grid-cols-2 gap-3" style={{ width: 240 }}>
        {PADS.map((p, i) => (
          <button key={i} onClick={() => tap(i)}
            className="h-28 rounded-2xl transition-opacity"
            style={{ background: p.color, opacity: lit === i ? 1 : 0.45 }} />
        ))}
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
