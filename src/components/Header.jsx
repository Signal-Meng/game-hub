/**
 * 顶部标题栏（Header）。
 * 显示产品标题与一句副标题，保持简洁扁平、浅色主题。
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            本地小游戏 <span className="text-slate-300">/</span>{' '}
            <span className="text-indigo-600">Game Hub</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            一个浏览器内的小游戏启动器 · 随时切换，即开即玩
          </p>
        </div>
        <span className="hidden text-3xl sm:block" aria-hidden="true">
          🎮
        </span>
      </div>
    </header>
  )
}
