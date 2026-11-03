import { Search, Bell, CircleCheck, Sparkles } from 'lucide-react'
import { PAGE_TITLES } from '../data/skills.js'

export default function Topbar({ page }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:h-16 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-500 text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold text-slate-900">
            QianWen AI Console
          </span>
        </div>
        <h1 className="hidden text-lg font-bold text-slate-900 lg:block">
          {PAGE_TITLES[page] || '控制台总览'}
        </h1>
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 sm:inline-flex">
          <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
          服务正常
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden lg:block">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none"
            placeholder="搜索能力、模型或文档…"
            aria-label="搜索"
          />
        </div>
        <button
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          aria-label="通知"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />
        </button>
      </div>
    </header>
  )
}
