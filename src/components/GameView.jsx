import { useCallback, useMemo, useState } from 'react'
import { GameSessionContext, useGameStats } from '../hooks/useGameStats.js'
import { useDifficultyPreference } from '../hooks/useDifficultyPreference.js'
import { getParams, getPar } from '../difficulty.js'
import Timer from './Timer.jsx'
import StatSidebar from './StatSidebar.jsx'
import Leaderboard from './Leaderboard.jsx'
import GameFooter from './GameFooter.jsx'
import StartGate from './StartGate.jsx'
import DifficultyChip from './DifficultyChip.jsx'

/**
 * 游戏视图容器（GameView）。
 *
 * 职责：
 *  - 持有 `started` / `sessionKey` 状态，决定渲染「开始前遮罩」还是「游戏本体」；
 *  - 难度状态来自 `useDifficultyPreference`（持久化到 gamehub:difficulty）；
 *  - 组装 GameSession 通过 GameSessionContext 下发（难度参数、成绩上报、重开语义）；
 *  - 成绩记录数组与清空能力下传给右侧栏（best/recent 卡 + 排行榜）。
 *
 * 关键实现约束：
 * 1. **游戏组件未挂载而非隐藏**。`started === false` 时渲染 <StartGate/>，
 *    游戏组件不存在于 React 树中，因此 memorymatch 的 useEffect(start) 等
 *    「挂载即开局」逻辑不会执行，记忆类内容不会泄露（D-08 的硬保证）。
 * 2. `<Timer/>` 只在 started 时渲染，计时天然从 0 起步（Timer.jsx 零改动）。
 * 3. `<GameComponent key={sessionKey} />` —— 每点一次「开始」换 key，让 React 卸载旧局、
 *    清掉所有 state/ref/interval/raf/timeout。局内不提供绕过遮罩的重开入口，
 *    任何重开都必须先回遮罩，保证「遮罩消失即开局、随即计时」。
 *
 * @param {{ game: import('../games/registry.js').GameEntry, onBack: () => void }} props
 */
export default function GameView({ game, onBack }) {
  const GameComponent = game.component
  const [pref, setPref] = useDifficultyPreference(game.id)
  const [started, setStarted] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  const { metrics, records, record, clear } = useGameStats(game)

  /** 切换难度 = 写偏好 + 强制回遮罩，绝不允许局内静默改参数（D-02 / D-05）。 */
  const setDifficulty = useCallback(
    (d) => {
      setPref(d)
      setStarted(false)
    },
    [setPref],
  )

  /** 点「开始」：开新 session 并显示游戏本体。 */
  const handleStart = useCallback(() => {
    setSessionKey((k) => k + 1)
    setStarted(true)
  }, [])

  /** 回遮罩重新选难度（H4）。 */
  const restartToGate = useCallback(() => {
    setStarted(false)
  }, [])

  /**
   * 同难度直接重开（D-11）：**不经过遮罩**，只让 sessionKey+1，started 保持 true。
   *
   * 实现要点：`<GameComponent key={sessionKey} />` 与 `<Timer key={sessionKey} />`
   * 随 sessionKey 变化整体重挂载，旧局的 state / ref / interval / raf / timeout
   * 由 React 在卸载时统一清理，因此每个游戏无需各自实现 reset。
   * 「同难度重开」与「回遮罩」的唯一区别就是 started 保持 true。
   */
  const restartSame = useCallback(() => {
    setSessionKey((k) => k + 1)
  }, [])

  const params = useMemo(() => getParams(game, pref), [game, pref])
  // 及格用时（毫秒）：评分用的时间基准，随难度变。游戏用它折算综合分，
  // 不必自己硬编码「多快算快」。
  const par = useMemo(() => getPar(game, pref), [game, pref])

  // record 闭包捕获当前难度与 sessionKey → 游戏组件的 record() 调用行零改动
  const sessionRecord = useCallback(
    (vals) => record(vals, { sessionKey, difficulty: pref }),
    [record, sessionKey, pref],
  )

  const sessionValue = useMemo(
    () => ({
      difficulty: pref,
      params,
      par,
      sessionId: `${game.id}:${pref}:${sessionKey}`,
      record: sessionRecord,
      setDifficulty,
      restartToGate,
      restartSame,
    }),
    [pref, params, par, game.id, sessionKey, sessionRecord, setDifficulty, restartToGate, restartSame],
  )

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl">
            {game.icon}
          </span>
          <h2 className="text-xl font-semibold text-slate-900">{game.name}</h2>
          {started ? (
            <>
              <DifficultyChip difficulty={pref} onClick={restartToGate} />
              {/* key=sessionKey：每局开始时计时器随游戏一起归零重挂 */}
              <Timer key={sessionKey} />
            </>
          ) : (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-400">
              未开始
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          ← 返回大厅
        </button>
      </div>

      <GameSessionContext.Provider value={sessionValue}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {started ? (
              <GameComponent key={sessionKey} />
            ) : (
              <StartGate
                game={game}
                difficulty={pref}
                onSelectDifficulty={setDifficulty}
                onStart={handleStart}
                onBack={onBack}
              />
            )}
          </div>
          {/* 侧栏只放「历史最优 / 最近」摘要 —— 宽度有限，放不下表格 */}
          <StatSidebar metrics={metrics} records={records} difficulty={pref} />
        </div>

        {/* 排行榜独占一行全宽：列数随游戏变化（最多 6 列），
            挤在 256px 侧栏里每列只剩 25px，装不下也看不完 */}
        <Leaderboard
          records={records}
          difficulty={pref}
          metrics={metrics}
          onClear={clear}
        />
      </GameSessionContext.Provider>

      <GameFooter intro={game.intro} howto={game.howto} />
    </section>
  )
}