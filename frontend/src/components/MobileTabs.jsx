import { NAV_ITEMS } from '../data/skills.js'

export default function MobileTabs({ active, onChange }) {
  const tabs = NAV_ITEMS.filter((item) => !item.section)
  return (
    <nav
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
      aria-label="主导航"
    >
      {tabs.map((item) => {
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
              isActive
                ? 'bg-primary text-white shadow-sm shadow-blue-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
