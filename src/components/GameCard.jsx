import { memo } from 'react'

/**
 * 大厅中的游戏卡片（GameCard）。
 *
 * 展示图标、名称、描述，点击后通知父组件（App）选中该游戏，
 * 从而切换到对应游戏视图。
 *
 * @param {{ game: import('../games/registry.js').GameEntry, onSelect: (id: string) => void }} props
 */
function GameCard({ game, onSelect }) {
  const handleClick = () => onSelect(game.id)

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
        {game.icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{game.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        {game.description}
      </p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
        开始游戏
        <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
      </span>
    </button>
  )
}

export default memo(GameCard)
