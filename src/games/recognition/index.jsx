import { useState, useRef, useLayoutEffect } from 'react'
import { useGameSession } from '../../hooks/useGameStats.js'
import { compositeScore, penaltyRate } from '../../scoring.js'
import RestartBar from '../../components/RestartBar.jsx'
import { shuffleArray } from '../../difficulty.js'

// 图形池扩至 20（补 🍅 🥔），使 hard 档 study(8)+distract(10)=18 有 2 个余量
const POOL = ['🍎','🍌','🍇','🍓','🍑','🍒','🥝','🍉','🍊','🍋','🍐','🍍','🥥','🥑','🌽','🥕','🌶️','🍆','🍅','🥔']

export default function RecognitionGame() {
  const { params, par, record, sessionId, restartToGate, restartSame } = useGameSession()
  // 学习量 / 呈现时长 / 干扰量三轴同向由难度决定
  const { study: studyWanted, showMs, distract: distractWanted } = params

  const [phase, setPhase] = useState('study') // study | test | done
  const [study, setStudy] = useState([])
  const [test, setTest] = useState([])
  const [picked, setPicked] = useState(() => new Set())
  const [result, setResult] = useState(null)
  const timer = useRef(null)
  /** 进入「再认」阶段的时刻 —— 成绩计时从这里起算，不含强制记忆时间。 */
  const testStart = useRef(null)

  const start = () => {
    const pool = shuffleArray(POOL)
    // Math.min 护栏：study + distract 必须 ≤ POOL.length，否则干扰项会为空
    const studyCount = Math.min(studyWanted, POOL.length)
    const distractCount = Math.min(distractWanted, POOL.length - studyCount)
    const s = pool.slice(0, studyCount)
    const d = pool.slice(studyCount, studyCount + distractCount)
    setStudy(s); setTest(shuffleArray([...s, ...d])); setPicked(new Set()); setResult(null)
    testStart.current = null
    setPhase('study')
    // 倒计时结束时才打点：从这一刻起计的才是「作答时间」
    timer.current = setTimeout(() => {
      testStart.current = Date.now()
      setPhase('test')
    }, showMs)
  }

  /**
   * 挂载即开局（D-06）+ **StrictMode 安全**。
   *
   * ⚠ 这里**不能**再用「startedFor.current === sessionId 就 return」的幂等守卫：
   * React 18 StrictMode 在开发模式下会「挂载 → 跑 cleanup → 再挂载」。
   * 原来的写法把 clearTimeout 放在一个**独立的** `useEffect(..., [])` 里，
   * 于是 StrictMode 重放时：第一次 start() 注册的倒计时被 cleanup 清掉，
   * 第二次挂载又被守卫挡掉 → **倒计时永不触发，图形永远停在记忆阶段**。
   *
   * 正确写法：把「注册定时器」与「清理定时器」放进**同一个 effect**，
   * setup / cleanup 严格成对，重放一次就等于重开一局。
   */
  useLayoutEffect(() => {
    start()
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
    // start 每局只应执行一次，故刻意不列进依赖（它每次渲染都是新引用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const toggle = (i) => {
    if (phase !== 'test') return
    setPicked((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i); else n.add(i)
      return n
    })
  }

  const submit = () => {
    let hits = 0, fa = 0
    picked.forEach((i) => { if (study.includes(test[i])) hits++; else fa++ })
    const miss = study.length - hits
    const acc = penaltyRate(hits, fa, study.length)
    // ⚠ 计时只取「进入再认阶段 → 提交」这一段。
    //   原实现从 studyStart 起算，把 showMs（强制记忆时长）也算了进去，
    //   导致不同 showMs 的难度之间用时完全不可比 ——
    //   hard 档白白多背 3.5 秒罚时，用户越玩困难档分越低，纯属计量口径错误。
    const timeMs = testStart.current ? Date.now() - testStart.current : null
    record({
      score: compositeScore({ accuracy: acc, timeMs, parMs: par }),
      accuracy: acc,
      time: timeMs,
    })
    setResult({ hits, miss, fa, acc }); setPhase('done')
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <p className="text-slate-500 text-sm text-center">
        先看一组图形 {(showMs / 1000).toFixed(1).replace(/\.0$/, '')} 秒，记住它们；随后从混合图形中<b>挑出你见过的</b>。
      </p>
      {phase === 'study' && (
        <div className="text-center">
          <p className="text-slate-500 text-sm mb-3">记住这些（{Math.ceil(showMs / 1000)} 秒后消失）</p>
          <div className="grid grid-cols-3 gap-3">
            {study.map((s, i) => <div key={i} className="w-16 h-16 rounded-xl bg-white ring-1 ring-slate-200 flex items-center justify-center text-3xl">{s}</div>)}
          </div>
        </div>
      )}
      {phase === 'test' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-slate-500 text-sm">点出你<b>刚才见过</b>的图形（已选 {picked.size}）</p>
          <div className="grid grid-cols-4 gap-2">
            {test.map((s, i) => (
              <button key={i} onClick={() => toggle(i)}
                className={`w-14 h-14 rounded-xl text-2xl flex items-center justify-center ${picked.has(i) ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50'}`}>{s}</button>
            ))}
          </div>
          <button onClick={submit} className="mt-1 px-6 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">提交</button>
        </div>
      )}
      {phase === 'done' && result && (
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">完成！</p>
          <p className="mt-2 text-slate-600">认对：<b>{result.hits}/{study.length}</b> · 漏认：{result.miss} · 误认：{result.fa}</p>
          <p className="text-slate-600">准确率：<b>{result.acc}%</b></p>
        </div>
      )}

      {/* 重开入口常驻：结算前后都能换局，不必先打完一轮（P3 一致性修复） */}
      <RestartBar restartToGate={restartToGate} restartSame={restartSame} className="mt-4" />
    </div>
  )
}