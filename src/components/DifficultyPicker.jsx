import { DIFFICULTY_KEYS, getOption } from '../difficulty.js'

/**
 * 三档分段卡片难度选择器（开始前遮罩内的主入口）。
 *
 * 可访问性：三个选项都是原生 `<button>`，参与 Tab 序，
 * 并通过 `aria-pressed` 暴露选中态（D-18）。
 *
 * @param {Object} props
 * @param {import('../games/registry.js').GameEntry} props.game     游戏条目（提供 difficulties）
 * @param {import('../difficulty.js').Difficulty} props.value      当前选中的难度
 * @param {(d: import('../difficulty.js').Difficulty) => void} props.onChange 选中回调
 */
export default function DifficultyPicker({ game, value, onChange }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">选择难度</span>
        <span className="text-xs text-slate-400">难度决定本局训练强度</span>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="选择难度">
        {DIFFICULTY_KEYS.map((key) => {
          const option = getOption(game, key)
          const selected = value === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(key)}
              className={`relative rounded-xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                selected
                  ? 'border-indigo-600 bg-indigo-50/50 text-slate-700 ring-2 ring-indigo-100'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300'
              }`}
            >
              {selected && (
                <span className="absolute right-1.5 top-1 text-xs text-indigo-600" aria-hidden="true">
                  ✓
                </span>
              )}
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-1 block text-xs leading-snug text-slate-500">
                {option.summary}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}