/**
 * 局内重开按钮组（D-11 / H4）。
 *
 * 两个入口语义不同，必须成对出现：
 * - **重新开始**（`restartToGate`）→ 回开始前遮罩，**可以换难度**；
 * - **同难度重开**（`restartSame`）→ 跳过遮罩，按当前难度直接开新局。
 *
 * 二者都来自 `useGameSession()`，由 GameView 经 Context 注入，
 * 本组件不持有任何状态。
 *
 * 抽出共享组件而不是在 10 款游戏里各写一遍，是为了保证：
 * ① 10 款游戏的入口、文案、样式、顺序完全一致；
 * ② 新增游戏时不会出现「只做了重新开始、漏了同难度重开」的空挂。
 *
 * @param {Object} props
 * @param {() => void} props.restartToGate 回遮罩（可换难度）
 * @param {() => void} props.restartSame  同难度直接重开
 * @param {string} [props.className]     追加到外层容器的 className（控制上下间距）
 */
export default function RestartBar({ restartToGate, restartSame, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={restartToGate}
        className="inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2 font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        重新开始
      </button>
      <button
        type="button"
        onClick={restartSame}
        title="不重新选难度，按当前难度直接开新局"
        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-2 font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        同难度重开
      </button>
    </div>
  )
}
