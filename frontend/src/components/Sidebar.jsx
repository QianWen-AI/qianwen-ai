import {
  LayoutDashboard,
  MessageSquareText,
  Image,
  Clapperboard,
  AudioLines,
  ScanEye,
  Cpu,
  ChartColumn,
  Settings,
  Sparkles,
  History as HistoryIcon,
} from 'lucide-react'
import { NAV_ITEMS } from '../data/skills'

const ICONS = {
  LayoutDashboard,
  MessageSquareText,
  Image,
  Clapperboard,
  AudioLines,
  ScanEye,
  Cpu,
  ChartColumn,
  History: HistoryIcon,
  Settings,
}

export default function Sidebar({ active, onChange }) {
  return (
    <aside className="hidden h-full w-[264px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg shadow-blue-200">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">QianWen AI Console</p>
          <p className="text-xs text-slate-400">千问 AI 能力操作台</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item, i) => {
          if (item.section) {
            return (
              <p
                key={i}
                className="px-3 pb-1.5 pt-4 text-xs font-semibold tracking-wide text-slate-400 uppercase"
              >
                {item.section}
              </p>
            )
          }
          const Icon = ICONS[item.icon]
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
                isActive
                  ? 'bg-primary/8 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${isActive ? 'text-primary' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white">
            云
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-800">演示账号</p>
            <p className="text-xs text-slate-400">Mock 模式 · 接口已预留</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
