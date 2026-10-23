import { useEffect, useMemo, useState } from 'react'
import { fmtMs } from '../hooks/useGameStats.js'
import {
  LEADERBOARD_LIMIT,
  difficultyChipClass,
  difficultyLabel,
  groupRecordsByDifficulty,
  medalClass,
  sortRecords,
} from '../difficulty.js'

/**
 * 日期格式化：MM-DD（全项目只此一处）。
 * 迁移来的历史记录（migrated 标记或哨兵时间戳）以及非法时间戳统一显示「历史」。
 *
 * @param {number|undefined} ts
 * @param {boolean} [migrated]
 * @returns {string}
 */
function fmtDate(ts, migrated) {
  if (migrated || typeof ts !== 'number' || !isFinite(ts) || ts < 1e12) return '历史'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '历史'
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

/** 兜底指标集：未传 metrics 时使用，保证组件可独立渲染不崩。 */
const FALLBACK_METRICS = [
  { key: 'accuracy', label: '正确率', format: (v) => (v == null ? '—' : `${v}%`) },
  { key: 'time', label: '用时', format: fmtMs },
]

/**
 * 一个难度分区的子榜（组内独立排名 1..N）。
 *
 * 名次**只在组内计算**：不同难度的成绩不可比，严禁合并成一个扁平名次序列。
 *
 * 列是**动态**的：由 metrics 决定列数与表头 —— 记忆广度类不会出现「用时」列，
 * 吞吐量类会多出 TPS 列，最多可达 6 列（名次 + 4 指标 + 日期）。
 *
 * ⚠ 网格列宽用内联 gridTemplateColumns 而非固定的 Tailwind 原子类：
 *   列数随游戏变化，原子类做不到。
 *
 * ⚠ 每列用 `minmax(7rem, 1fr)`：宽屏时均分撑满，窄屏时**保底 7rem 不再压缩**。
 *   若用 `minmax(0, 1fr)`，375px 手机上 6 列会被压到每列 29px，
 *   "12.80 题/s"、"00:12.70" 这类值会被裁掉。保底宽度改由外层 `overflow-x-auto`
 *   横向滚动来消化 —— 窄屏表格横向滑动是通用惯例，比截断数值可接受得多。
 *
 * @param {Object} props
 * @param {{ difficulty: string, records: import('../difficulty.js').ScoreRecord[] }} props.group 分组数据
 * @param {boolean} props.showHeader 是否显示难度标题行（「全部难度」视图用）
 * @param {import('../scoring.js').MetricDef[]} props.metrics 该游戏的指标定义
 * @param {boolean} props.compact 「全部难度」并排布局时用更紧凑的字号
 */
function GroupBlock({ group, showHeader, metrics, compact }) {
  const cols = metrics.length ? metrics : FALLBACK_METRICS
  // 名次固定 1 列，日期固定 1 列，中间按 metrics 动态分配（每列保底 7rem）
  const gridCols = `2.75rem repeat(${cols.length}, minmax(7rem, 1fr)) 4rem`
  const headCls = compact ? 'text-[11px]' : 'text-xs'
  const cellCls = compact ? 'text-[13px]' : 'text-sm'

  return (
    <div className="min-w-0">
      {showHeader && (
        <div className="mb-2 flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${difficultyChipClass(group.difficulty)}`}>
            {difficultyLabel(group.difficulty)}
          </span>
          <span className="text-xs text-slate-400">前 {group.records.length} 名</span>
        </div>
      )}
      {/* 横向滚动容器：窄屏下保住列宽，代价是可左右滑动 */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-max">
          <div
            className={`grid gap-x-3 border-b border-slate-200 pb-2 font-medium text-slate-400 ${headCls}`}
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="text-center">名次</span>
            {cols.map((c) => <span key={c.key}>{c.label}</span>)}
            <span className="text-right">日期</span>
          </div>
          <ul>
            {group.records.map((r, i) => (
              <li
                key={r.id}
                className={`grid items-center gap-x-3 rounded-lg px-1 transition hover:bg-slate-50 ${cellCls} ${
                  i % 2 ? 'bg-slate-50/40' : ''
                } ${compact ? 'h-9' : 'h-11'}`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className={`text-center ${medalClass(i + 1)}`}>{i + 1}</span>
                {cols.map((c) => (
                  <span
                    key={c.key}
                    className={`whitespace-nowrap ${
                      c.key === 'time'
                        ? 'font-mono text-slate-600'
                        : 'font-medium text-slate-700'
                    }`}
                  >
                    {c.format(r[c.key])}
                  </span>
                ))}
                <span className="whitespace-nowrap text-right text-xs text-slate-400">
                  {fmtDate(r.timestamp, r.migrated)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * 排行榜面板（游戏视图内的**全宽**区块，位于游戏本体与成绩侧栏下方）。
 *
 * 本组件是侧栏中**唯一持有 useState** 的部分：`scope`（当前/全部难度）、
 * `open`（折叠）、`confirming`（清空二次确认）。
 *
 * ⚠ 为什么从侧栏挪到这里：
 *   计分体系改为「每款游戏指标不同」后，列数最多可达 6 列。
 *   在 256px 宽的侧栏里每列只剩 25px —— "12.80 题/s" 这类值根本放不下，
 *   且 10 行记录只能露出 5 行。表格塞不进窄栏，故改为全宽面板。
 *
 * ⚠ 排名语义（跨难度不可比）：
 * - 「当前难度」= 默认视图，只显示该难度的独立 TOP10，名次 1..N 在本难度内计算；
 * - 「全部难度」= 按难度分组展示多个子榜，每个子榜各自从 1 开始排名，
 *   宽屏下三者**并排**而非堆叠（堆叠会长到 1000px 以上）。
 * 两种视图都不会把不同难度的记录塞进同一个扁平名次序列。
 *
 * @param {Object} props
 * @param {import('../difficulty.js').ScoreRecord[]} props.records 已按难度分组裁剪的记录
 * @param {import('../difficulty.js').Difficulty} props.difficulty 「当前难度」视图的基准
 * @param {import('../scoring.js').MetricDef[]} [props.metrics] 该游戏的指标定义（决定列）
 * @param {() => void} props.onClear 清空本游戏全部记录
 */
export default function Leaderboard({ records, difficulty, metrics, onClear }) {
  const [scope, setScope] = useState('current') // 'current' | 'all'
  const [open, setOpen] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const cols = useMemo(
    () => (Array.isArray(metrics) && metrics.length ? metrics : FALLBACK_METRICS),
    [metrics],
  )

  // 二次确认 5s 未操作自动复位，防止误触后界面卡在确认态
  useEffect(() => {
    if (!confirming) return undefined
    const id = setTimeout(() => setConfirming(false), 5000)
    return () => clearTimeout(id)
  }, [confirming])

  const all = Array.isArray(records) ? records : []

  /**
   * 待渲染的分组序列：
   * - 'current'：单个分组（可能为空 → 走空态），不显示难度标题；
   * - 'all'    ：所有非空分组，显示难度标题。
   */
  const groups = useMemo(() => {
    if (scope === 'current') {
      return [
        {
          difficulty,
          records: sortRecords(all.filter((r) => r && r.difficulty === difficulty)),
        },
      ]
    }
    return groupRecordsByDifficulty(all)
  }, [scope, difficulty, all])

  const total = all.length
  const shown = groups.reduce((n, g) => n + g.records.length, 0)
  const emptyCurrent = shown === 0

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-expanded={open}
        >
          <span className="text-xs leading-none" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          排行榜
          {total > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              {total} 条
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setScope('current')}
            className={
              scope === 'current'
                ? 'rounded-lg bg-indigo-50 px-2 py-1 font-medium text-indigo-700'
                : 'rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }
          >
            当前难度
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={
              scope === 'all'
                ? 'rounded-lg bg-indigo-50 px-2 py-1 font-medium text-indigo-700'
                : 'rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }
          >
            全部难度
          </button>
        </div>
      </div>

      {open && (
        <>
          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <span className="text-4xl opacity-20" aria-hidden="true">🏆</span>
              <p className="text-sm text-slate-400">暂无成绩</p>
              <p className="text-xs text-slate-300">完成一局后，成绩将出现在这里</p>
            </div>
          ) : emptyCurrent ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">
                当前难度（{difficultyLabel(difficulty)}）暂无成绩
              </p>
              <button
                type="button"
                onClick={() => setScope('all')}
                className="mt-1 text-xs text-indigo-600 hover:underline"
              >
                查看全部难度
              </button>
            </div>
          ) : scope === 'all' ? (
            /* 宽屏并排三个子榜：堆叠会长到 1000px 以上，把「全部难度」视图压得很长 */
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {groups
                .filter((g) => g.records.length > 0)
                .map((g) => (
                  <GroupBlock
                    key={g.difficulty}
                    group={g}
                    showHeader
                    metrics={cols}
                    compact
                  />
                ))}
            </div>
          ) : (
            <GroupBlock group={groups[0]} showHeader={false} metrics={cols} />
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs leading-relaxed text-slate-400">
              每个难度最多保留 {LEADERBOARD_LIMIT} 条，各难度成绩互不影响、分别排名（组内按「{cols[0].label}」优先淘汰）。仅存本机浏览器。
            </p>
            <div className="text-xs">
              {confirming ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-600">确认清空本游戏全部成绩？</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClear()
                      setConfirming(false)
                    }}
                    className="font-medium text-rose-600 hover:underline"
                  >
                    确认清空
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  清空本游戏记录
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
