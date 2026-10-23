import { useEffect, useCallback } from 'react'
import DifficultyPicker from './DifficultyPicker.jsx'

/**
 * 开始前遮罩（StartGate）。
 *
 * **渲染时机由 GameView 控制**：未点「开始」时用它替换游戏组件，
 * 因此遮罩显示期间游戏组件完全未挂载（不会泄露题目与记忆内容）。
 *
 * 遮罩样式硬约束：`bg-white` **完全不透明**，禁止半透明蒙版（会让下层内容透出）。
 *
 * @param {Object} props
 * @param {import('../games/registry.js').GameEntry} props.game 游戏条目
 * @param {import('../difficulty.js').Difficulty} props.difficulty 当前选中难度
 * @param {(d: import('../difficulty.js').Difficulty) => void} props.onSelectDifficulty 选中即写偏好（仍在遮罩内，不开局）
 * @param {() => void} props.onStart 点「开始」：置 started=true 并 sessionKey+1
 * @param {() => void} props.onBack 「返回大厅」
 */
export default function StartGate({ game, difficulty, onSelectDifficulty, onStart, onBack }) {
  const handleKeyDown = useCallback(
    (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && difficulty && onStart) {
        e.preventDefault()
        onStart()
      }
    },
    [difficulty, onStart],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-2xl bg-white p-2">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
              {game.icon}
            </span>
            <h3 className="text-xl font-bold text-slate-800">{game.name}</h3>
            <p className="text-sm text-slate-500">{game.description}</p>
          </div>

          <div className="w-full rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            <span className="mb-1 block text-xs font-semibold text-slate-500">玩法</span>
            {game.howto}
          </div>

          <div className="w-full">
            <DifficultyPicker game={game} value={difficulty} onChange={onSelectDifficulty} />
          </div>

          <div className="w-full">
            <button
              type="button"
              onClick={onStart}
              disabled={!difficulty}
              className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {difficulty ? '开始' : '请先选择难度'}
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            返回大厅
          </button>
        </div>
      </div>
    </div>
  )
}
