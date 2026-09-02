export function Card({ children, className = '', ...rest }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function ModeRestrictedBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-sm leading-relaxed text-amber-800">
        内置模型模式暂不支持此功能，请配置自定义 API-Key 后使用（前往「认证与设置」页切换自定义模型并填写您的 Key）。
      </p>
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, color = 'bg-slate-100 text-slate-600' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...rest
}) {
  const styles = {
    primary:
      'bg-primary text-white hover:bg-primary-strong shadow-sm shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none',
    secondary:
      'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50',
    ghost: 'text-slate-600 hover:bg-slate-100 disabled:opacity-50',
    accent:
      'bg-accent text-white hover:bg-orange-600 shadow-sm shadow-orange-200 disabled:bg-slate-300 disabled:shadow-none',
  }
  return (
    <button
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Input({
  label,
  hint,
  className = '',
  id,
  disabled,
  ...rest
}) {
  return (
    <label className="block" htmlFor={id}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <input
        id={id}
        disabled={disabled}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
        {...rest}
      />
      {hint && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Textarea({
  label,
  hint,
  className = '',
  id,
  ...rest
}) {
  return (
    <label className="block" htmlFor={id}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <textarea
        id={id}
        className={`w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none ${className}`}
        {...rest}
      />
      {hint && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Select({ label, children, id, className = '', disabled, ...rest }) {
  return (
    <label className="block" htmlFor={id}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <select
        id={id}
        disabled={disabled}
        className={`w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
        checked ? 'bg-primary' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5.5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return (
    <svg
      className={`h-5 w-5 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="正在生成">
      <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
      <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
      <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
    </div>
  )
}
