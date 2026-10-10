/**
 * 游戏底部说明区：展示「游戏介绍」与「玩法」，由 registry 的 intro / howto 字段提供。
 *
 * @param {{ intro?: string, howto?: string }} props
 */
export default function GameFooter({ intro, howto }) {
  if (!intro && !howto) return null
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-500">游戏介绍与玩法</h3>
      {intro && (
        <p className="text-sm leading-relaxed text-slate-600">{intro}</p>
      )}
      {howto && (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <b className="text-slate-700">玩法：</b>
          {howto}
        </p>
      )}
    </div>
  )
}
