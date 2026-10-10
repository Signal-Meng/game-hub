import { difficultyChipClass, difficultyLabel } from '../difficulty.js'

/**
 * 顶栏只读难度芯片。
 *
 * 局内**不提供直接切换下拉**：静默作废当前局对记忆类游戏尤其令人困惑，
 * 因此点击芯片 = 回到开始前遮罩改难度。
 *
 * @param {Object} props
 * @param {import('../difficulty.js').Difficulty} props.difficulty 当前难度
 * @param {() => void} [props.onClick] 点击回调（GameView 传入 restartToGate）
 */
export default function DifficultyChip({ difficulty, onClick }) {
  const label = difficultyLabel(difficulty)
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击返回开始页更换难度"
      className={`ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${difficultyChipClass(
        difficulty,
      )}`}
    >
      难度：{label}
      <span className="text-[10px] leading-none" aria-hidden="true">
        ▾
      </span>
    </button>
  )
}