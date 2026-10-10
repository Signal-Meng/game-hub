import { useState, useCallback, useEffect } from 'react'
import Header from './components/Header.jsx'
import GameCard from './components/GameCard.jsx'
import GameView from './components/GameView.jsx'
import ClearAllStats, { clearAllStats } from './components/ClearAllStats.jsx'
import { games } from './games/registry.js'

/**
 * Game Hub 主应用。
 *
 * 通过 `selectedGameId` 这一 state 在大厅（卡片网格）与游戏视图之间切换，
 * 不需要路由库、也不需要刷新页面。要扩展游戏，只需修改 registry（见 README）。
 */
export default function App() {
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [resetNotice, setResetNotice] = useState(null)

  const handleSelectGame = useCallback((id) => setSelectedGameId(id), [])
  const handleBackToHub = useCallback(() => setSelectedGameId(null), [])

  /**
   * `?reset=1` 快捷清除：打开 `…/?reset=1` 即清空全部成绩并提示，无需 DevTools。
   *
   * 用途：给学生用之前先把机器上的历史成绩清干净。
   * 执行后立刻用 history.replaceState 抹掉参数 —— 否则刷新页面会**再次触发清除**，
   * 用户刚玩出的新成绩会被一次刷新悄悄抹掉。
   */
  useEffect(() => {
    let params
    try {
      params = new URLSearchParams(window.location.search)
    } catch (e) {
      return undefined
    }
    if (params.get('reset') !== '1') return undefined

    const n = clearAllStats()
    try {
      params.delete('reset')
      const qs = params.toString()
      window.history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
      )
    } catch (e) {
      /* replaceState 在某些沙箱 iframe 下可能不可用，忽略 */
    }
    setResetNotice(n)
    const id = setTimeout(() => setResetNotice(null), 4000)
    return () => clearTimeout(id)
  }, [])

  const selectedGame =
    games.find((game) => game.id === selectedGameId) || null

  // 按 category 分组（保持首次出现顺序：专注力 → 记忆力）
  const groups = []
  const groupIndex = new Map()
  games.forEach((game) => {
    const key = game.category || '其他'
    if (!groupIndex.has(key)) {
      groupIndex.set(key, groups.length)
      groups.push({ title: key, items: [] })
    }
    groups[groupIndex.get(key)].items.push(game)
  })

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <Header />
      {resetNotice != null && (
        <div
          role="status"
          className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-700"
        >
          {resetNotice > 0
            ? `已清除 ${resetNotice} 项历史成绩（难度偏好保留）。`
            : '当前没有任何历史成绩，无需清除。'}
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {selectedGame ? (
          <GameView game={selectedGame} onBack={handleBackToHub} />
        ) : (
          <section>
            <h2 className="mb-6 text-xl font-semibold text-slate-700">
              选择一款游戏
            </h2>
            {groups.map((group) => (
              <div key={group.title} className="mb-8">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-700">
                  <span className="inline-block h-5 w-1.5 rounded-full bg-indigo-500" />
                  {group.title}
                  <span className="text-sm font-normal text-slate-400">
                    {group.items.length} 款
                  </span>
                </h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((game) => (
                    <GameCard key={game.id} game={game} onSelect={handleSelectGame} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <div>Game Hub · 本地小游戏合集</div>
        {/* 成绩只存在本机 localStorage，没有服务端副本；
            想一次性清空所有游戏的记录，不必进 10 款游戏各点一次 */}
        <div className="mt-1.5">
          <ClearAllStats />
        </div>
      </footer>
    </div>
  )
}
