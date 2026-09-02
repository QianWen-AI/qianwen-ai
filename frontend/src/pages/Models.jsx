import { useState } from 'react'
import {
  MessagesSquare,
  Image,
  Clapperboard,
  AudioLines,
  ScanEye,
  Cpu,
  Lock,
  CheckCircle2,
  Clock3,
  Gauge,
  RefreshCw,
  KeyRound,
  ArrowRight,
  EyeOff,
  ShieldCheck,
} from 'lucide-react'
import { Card, Badge, Select, Spinner, Button, Input } from '../components/ui.jsx'
import { getApiMode, getDefaultModels, setDefaultModels, mockApi } from '../services/mockApi.js'
import { MODELS } from '../data/models.js'
import {
  useModelBenefits,
  categoryModels,
  isFreeValid,
  daysUntil,
  pickRecommended,
  resolveDefaultModel,
  formatFreeTier,
} from '../hooks/useModelBenefits.js'

const CATS = [
  { key: 'text', label: '文本对话', icon: MessagesSquare },
  { key: 'image', label: '图像生成', icon: Image },
  { key: 'video', label: '视频生成', icon: Clapperboard },
  { key: 'audio', label: '语音合成', icon: AudioLines },
  { key: 'vision', label: '视觉理解', icon: ScanEye },
]

const AUDIO_FALLBACK = {
  id: 'qwen3-tts-flash',
  caps: ['audio'],
  canTry: false,
  status: '',
  remaining: null,
  total: null,
  usedPct: null,
  resetDate: null,
  context: '',
  pricing: '',
}

function quotaBadge(ft) {
  if (!ft) {
    return (
      <Badge color="bg-slate-100 text-slate-500">
        <Gauge className="h-3 w-3" aria-hidden="true" />
        无免费额度
      </Badge>
    )
  }
  if (ft.status === 'masked') {
    return (
      <Badge color="bg-slate-100 text-slate-500">
        <EyeOff className="h-3 w-3" aria-hidden="true" />
        信息已隐藏
      </Badge>
    )
  }
  if (ft.status === 'expired') {
    return (
      <Badge color="bg-rose-50 text-rose-600">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        已过期
      </Badge>
    )
  }
  return (
    <Badge color="bg-emerald-50 text-emerald-600">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      免费额度
    </Badge>
  )
}

function unitLabel(u) {
  if (u === 'characters') return '字符'
  if (u === 'images') return '张'
  if (u === 'seconds') return '秒'
  return u || ''
}

function fmtNum(n) {
  if (n == null) return '—'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')} 亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')} 万`
  return n.toLocaleString()
}

function ModelCard({ m, isDefault }) {
  const ft = formatFreeTier(m)
  const unit = ft ? unitLabel(ft.unit) : ''
  return (
    <Card
      className={`p-4 transition-shadow duration-200 ${
        isDefault ? 'border-primary/50 ring-1 ring-primary/30' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-slate-900">{m.id}</p>
        {isDefault && (
          <Badge color="bg-primary/10 text-primary">
            <Cpu className="h-3 w-3" aria-hidden="true" />
            当前默认
          </Badge>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {quotaBadge(ft)}
        {m.pricing && <span className="text-[11px] text-slate-400">{m.pricing}</span>}
        {m.context && <span className="text-[11px] text-slate-400">上下文 {m.context}</span>}
      </div>
      {ft && ft.status === 'valid' && (
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">免费额度</span>
            <span className="font-semibold text-slate-700">
              {fmtNum(ft.total)}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">已消耗</span>
            <span className="font-semibold text-slate-700">
              {ft.consumed != null ? `${fmtNum(ft.consumed)}${unit ? ' ' + unit : ''}` : '—'}（{ft.usedPct}%）
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">剩余额度</span>
            <span className="font-semibold text-slate-700">
              {ft.remaining != null ? `${fmtNum(ft.remaining)}${unit ? ' ' + unit : ''}` : '—'}
              <span className="font-normal text-slate-400">（剩余 {100 - ft.usedPct}%）</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">到期时间</span>
            <span className="font-semibold text-slate-700">
              {new Date(ft.resetDate).toLocaleDateString('zh-CN')}
              {ft.daysLeft != null && ft.daysLeft > 0 ? `（${ft.daysLeft} 天后）` : ''}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${ft.usedPct > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-400 to-cyan-500'}`}
              style={{ width: `${Math.min(100, ft.usedPct)}%` }}
            />
          </div>
        </div>
      )}
      {ft && ft.status === 'masked' && (
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          {['免费额度', '已消耗', '剩余额度', '到期时间'].map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-slate-500">{k}</span>
              <span className="font-semibold tracking-widest text-slate-400">****</span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-slate-400">输入密码后展示完整信息</p>
        </div>
      )}
      {ft && ft.status === 'expired' && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
          免费额度已于 {new Date(ft.resetDate).toLocaleDateString('zh-CN')} 过期
        </p>
      )}
    </Card>
  )
}

function ModelPasswordModal({ open, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!open) return null
  async function submit(e) {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError('')
    try {
      const ok = await mockApi.verifyModelPassword(password)
      if (ok) {
        onSuccess()
        onClose()
      } else {
        setError('密码错误，请重试')
      }
    } catch {
      setError('验证失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">输入查看密码</h3>
            <p className="text-xs text-slate-400">内置模型模式下查看完整模型信息需验证</p>
          </div>
        </div>
        <form className="mt-4" onSubmit={submit}>
          <Input
            id="model-password"
            type="password"
            placeholder="请输入查看密码"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={busy || !password}>
              {busy ? '验证中…' : '确认'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Models({ onNavigate }) {
  const [defaults, setDefaults] = useState(getDefaultModels())
  const [pwOpen, setPwOpen] = useState(false)
  const { benefits, error, mode, hasKey, refresh, loading } = useModelBenefits()
  const isMock = mode === 'mock'
  const custom = mode === 'custom'
  const masked = benefits?.masked === true

  function handleDefaultChange(cat, id) {
    const next = { ...defaults, [cat]: id }
    setDefaults(next)
    setDefaultModels(next)
  }

  if (isMock) {
    return <MockModels />
  }

  if (custom && !hasKey) {
    return (
      <Card className="p-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            <KeyRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">请先配置 API Key</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            自定义模型模式下，模型列表与免费额度将基于您的 API-Key 实时查询。请先在设置页填入
            Key 后刷新查看。
          </p>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('settings')}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            前往设置页配置 Key
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">模型中心</h3>
            <p className="mt-1 text-sm text-slate-500">
              {custom
                ? '自定义模型模式：可手动调整每类功能的默认模型'
                : '内置模型模式：默认模型由系统自动锁定（同类免费额度快过期优先）'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {custom ? (
              <Badge color="bg-blue-50 text-blue-600">自定义模式 · 可手动调整</Badge>
            ) : (
              <Badge color="bg-emerald-50 text-emerald-600">
                <Lock className="h-3 w-3" aria-hidden="true" />
                内置模式 · 系统自动锁定
              </Badge>
            )}
            {benefits && (
              <Badge color="bg-slate-100 text-slate-500">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                更新于 {new Date(benefits.updatedAt).toLocaleString('zh-CN')}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {masked && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <EyeOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>模型关键信息已加密隐藏，输入查看密码后展示完整额度与到期信息</span>
          </div>
          <Button type="button" onClick={() => setPwOpen(true)}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            输入密码
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-2xl bg-white shadow-sm">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-slate-700">正在加载模型列表…</p>
          <p className="text-xs text-slate-400">正在同步各模型免费额度与到期时间</p>
        </div>
      ) : !benefits ? (
        error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-white shadow-sm">
            <p className="text-sm font-medium text-slate-700">模型信息加载失败</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        )
      ) : (
        CATS.map((cat) => {
          const Icon = cat.icon
          // 展示该分类全部可用模型（免费额度有效或按量计费，已排除过期），与功能页共用同一排序
          const availableModels = categoryModels(benefits, cat.key)
          const isAudioEmpty = cat.key === 'audio' && availableModels.length === 0
          const optionModels = isAudioEmpty ? [AUDIO_FALLBACK] : availableModels
          const optionIds = new Set(optionModels.map((m) => m.id))
          // 默认模型：手动设置（分类中存在）→ 自动推荐（快过期优先）→ 列表首个 → fallback
          const current =
            resolveDefaultModel(benefits, cat.key, cat.key === 'audio' ? AUDIO_FALLBACK.id : '') ||
            ''
          const auto = pickRecommended(benefits, cat.key)
          const autoId = auto?.id || ''
          return (
            <section key={cat.key}>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{cat.label}</h4>
                      <p className="text-xs text-slate-400">
                        {availableModels.length} 个可用模型 · 系统自动识别额度与到期时间
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">默认模型</span>
                    <Select
                      id={`default-${cat.key}`}
                      value={current}
                      disabled={!custom || isAudioEmpty}
                      onChange={(e) => handleDefaultChange(cat.key, e.target.value)}
                      className="w-56"
                    >
                      {optionModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                          {isFreeValid(m)
                            ? `（${daysUntil(m.resetDate)} 天后到期）`
                            : m.masked
                              ? '（信息已隐藏）'
                              : '（按量计费）'}
                        </option>
                      ))}
                    </Select>
                    {custom && defaults[cat.key] && optionIds.has(defaults[cat.key]) && (
                      <Badge color="bg-emerald-50 text-emerald-600">已手动设置</Badge>
                    )}
                  </div>
                </div>
                {!custom && auto && (
                  <div className="flex items-center gap-2 border-b border-slate-50 bg-blue-50/50 px-6 py-2.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    系统已自动锁定默认模型：{' '}
                    <span className="font-semibold text-slate-700">{autoId}</span>
                    （同类免费额度最早于 {daysUntil(auto.resetDate)} 天后到期，快过期优先）
                  </div>
                )}
                {isAudioEmpty ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-600">
                      暂无可用的语音模型
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      语音合成默认使用 qwen3-tts-flash（无平台免费额度，按量计费）。
                      可在设置页切换至自定义模型并配置 Key 后调用。
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 p-6 lg:grid-cols-2 xl:grid-cols-3">
                    {availableModels.map((m) => (
                      <ModelCard key={m.id} m={m} isDefault={m.id === current} />
                    ))}
                  </div>
                )}
              </Card>
            </section>
          )
        })
      )}
      <ModelPasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onSuccess={refresh}
      />
    </div>
  )
}

function MockModels() {
  const [filter, setFilter] = useState('')
  const keyword = filter.trim().toLowerCase()
  const COST_LABEL = {
    low: { text: '低成本', cls: 'bg-emerald-50 text-emerald-600' },
    medium: { text: '中等', cls: 'bg-blue-50 text-blue-600' },
    high: { text: '高阶', cls: 'bg-violet-50 text-violet-600' },
  }
  const CATEGORY_ORDER = ['旗舰', '推荐默认', '轻量', '代码', '推理', '翻译', '图像']
  function bar(value, max = 5) {
    return (
      <div className="flex gap-0.5" role="img" aria-label={`${value}/${max}`}>
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full ${i < value ? 'bg-primary' : 'bg-slate-200'}`}
          />
        ))}
      </div>
    )
  }
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: MODELS.filter(
      (m) =>
        m.category === cat &&
        (!keyword ||
          m.id.toLowerCase().includes(keyword) ||
          m.useCase.toLowerCase().includes(keyword)),
    ),
  })).filter((g) => g.items.length > 0)
  const others = MODELS.filter((m) => !CATEGORY_ORDER.includes(m.category))
  if (others.length) grouped.push({ cat: '其他', items: others })

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">模型目录</h3>
            <p className="mt-1 text-sm text-slate-500">
              Mock 演示模式：展示内置演示模型数据，切到内置/自定义模式可查看真实免费额度
            </p>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none lg:w-72"
            placeholder="搜索模型 ID 或用例…"
            aria-label="搜索模型"
          />
        </div>
      </Card>
      {grouped.map(({ cat, items }) => (
        <section key={cat}>
          <h3 className="mb-3 text-sm font-semibold text-slate-500">{cat}</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((model) => {
              const cost = COST_LABEL[model.cost]
              return (
                <Card key={model.id} className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" aria-hidden="true" />
                        <p className="font-mono text-sm font-semibold text-slate-900">{model.id}</p>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-500">{model.useCase}</p>
                    </div>
                    <Badge color={cost.cls}>{cost.text}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-500">上下文</span>
                    <span className="text-xs font-semibold text-slate-700">{model.context}</span>
                    <span className="text-xs text-slate-500">速度</span>
                    {bar(model.speed)}
                    <span className="text-xs text-slate-500">质量</span>
                    {bar(model.quality)}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
