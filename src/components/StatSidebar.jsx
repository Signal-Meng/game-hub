import { useMemo } from 'react'
import { deriveBestRecent, difficultyLabel } from '../difficulty.js'

/**
 * 成绩侧边栏：**只**展示各项指标的「历史最优 / 最近」摘要。
 *
 * ⚠ 排行榜已移出侧栏，改为游戏下方的全宽面板（见 GameView / Leaderboard）：
 *   计分体系改为「每款游戏指标不同」后，排行榜列数最多可达 6 列，
 *   在 256px 侧栏里每列只剩 25px，装不下「12.80 题/s」这类值，也露不出 10 行记录。
 *   侧栏宽度有限，适合放 2~4 张摘要卡，不适合放表格。
 *
 * 本组件内部**不持有任何状态**，全部由 GameView 下传。
 *
 * ⚠ 指标随游戏而异：记忆广度类只有「记忆广度 / 正确率」，比率类只有「接触率」，
 *   吞吐量类多一列 TPS（见 registry 的 scoring.metrics）。
 *   best 取 max 还是 min 由每个指标的 higherIsBetter 决定 ——
 *   否则「记忆广度」会被按「越低越好」求最小值，得出完全错误的「历史最优」。
 *
 * @param {Object} props
 * @param {import('../scoring.js').MetricDef[]} props.metrics 该游戏的指标定义
 * @param {import('../difficulty.js').ScoreRecord[]} props.records 已排序裁剪的成绩记录
 * @param {import('../difficulty.js').Difficulty} props.difficulty 当前难度
 */
export default function StatSidebar({ metrics, records, difficulty }) {
  const list = useMemo(
    () => (Array.isArray(metrics) && metrics.length ? metrics : []),
    [metrics],
  )
  const derived = useMemo(
    () => deriveBestRecent(records, difficulty, list),
    [records, difficulty, list],
  )

  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-64">
      <h3 className="mb-3 text-sm font-semibold text-slate-500">成绩记录</h3>
      <div className="space-y-3">
        {list.map((m) => {
          const d = derived[m.key] || { best: null, recent: null }
          return (
            <div key={m.key} className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">{m.label}</div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-400">历史最优</span>
                <span className="font-bold text-slate-700">{m.format(d.best)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-sm">
                <span className="text-slate-400">最近</span>
                <span className="font-bold text-slate-700">{m.format(d.recent)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        按「难度」分区（当前：{difficultyLabel(difficulty)}），各难度成绩互不可比、分别排名。完整排行榜见下方。仅存本机浏览器，换电脑或清缓存会重置。
      </p>
    </aside>
  )
}