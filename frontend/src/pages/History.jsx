import { useEffect, useState } from 'react'
import {
  MessageSquareText,
  Image,
  Clapperboard,
  AudioLines,
  ScanEye,
  Trash2,
  Trash,
  ChevronDown,
  ChevronUp,
  Clock3,
  Cpu,
  RefreshCw,
  Inbox,
  ExternalLink,
} from 'lucide-react'
import { Card, Badge, Spinner } from '../components/ui.jsx'
import { mockApi } from '../services/mockApi.js'

const TYPE_META = {
  text: { label: '文本对话', icon: MessageSquareText, color: 'text-blue-600 bg-blue-50' },
  image: { label: '图像生成', icon: Image, color: 'text-violet-600 bg-violet-50' },
  video: { label: '视频生成', icon: Clapperboard, color: 'text-pink-600 bg-pink-50' },
  audio: { label: '语音合成', icon: AudioLines, color: 'text-orange-600 bg-orange-50' },
  vision: { label: '视觉理解', icon: ScanEye, color: 'text-emerald-600 bg-emerald-50' },
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default function History() {
  const [filter, setFilter] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await mockApi.getHistory({ type: filter || undefined, limit: 200 })
      setItems(data.items || [])
    } catch (err) {
      setError(err?.message || '加载历史记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  async function handleDelete(id) {
    try {
      await mockApi.deleteHistory(id)
      setItems((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err?.message || '删除失败')
    }
  }

  async function handleClear() {
    if (!window.confirm('确定清空全部历史记录吗？此操作不可恢复。')) return
    try {
      await mockApi.clearHistory()
      setItems([])
    } catch (err) {
      setError(err?.message || '清空失败')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">历史记录</h3>
            <p className="mt-1 text-sm text-slate-500">
              所有功能的调用记录已自动缓存至云端（服务端持久化，最多保留 500 条）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              刷新
            </button>
            {items.length > 0 && (
              <button
                onClick={handleClear}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
              >
                <Trash className="h-4 w-4" aria-hidden="true" />
                清空全部
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[{ key: '', label: '全部' }, ...Object.entries(TYPE_META).map(([key, v]) => ({ key, label: v.label }))].map(
            (t) => (
              <button
                key={t.key || 'all'}
                onClick={() => setFilter(t.key)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  filter === t.key
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ),
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Inbox className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">暂无历史记录</h3>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">
            在任意功能页完成一次调用后，记录会自动保存到这里，方便随时回看。
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const meta = TYPE_META[r.type] || TYPE_META.text
            const Icon = meta.icon
            const isOpen = expanded === r.id
            const images = r.output ? r.output.split('\n').filter(Boolean) : []
            return (
              <Card key={r.id} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="flex w-full cursor-pointer items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.color}`}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
                      <Badge color="bg-slate-100 text-slate-500">
                        <Cpu className="h-3 w-3" aria-hidden="true" />
                        {r.model || '—'}
                      </Badge>
                      <Badge color="bg-slate-100 text-slate-500">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {new Date(r.createdAt).toLocaleString('zh-CN')}
                      </Badge>
                    </div>
                    <p className="mt-1.5 truncate text-sm text-slate-600">
                      <span className="font-medium text-slate-500">输入：</span>
                      {truncate(r.prompt, 120) || '—'}
                    </p>
                    {r.type === 'image' && images.length > 0 && (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={images[0]}
                          alt="生成结果缩略图"
                          loading="lazy"
                          className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                        />
                        <span className="text-xs text-slate-400">
                          {images.length} 张生成结果
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(r.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          handleDelete(r.id)
                        }
                      }}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                      aria-label="删除该记录"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-500">输入：</span>
                      {r.prompt || '—'}
                    </p>
                    <div className="mt-3">
                      <span className="text-sm font-medium text-slate-500">输出：</span>
                      {r.type === 'image' && images.length > 0 ? (
                        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {images.map((url, i) => (
                            <a
                              key={url + i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative overflow-hidden rounded-xl border border-slate-200"
                            >
                              <img
                                src={url}
                                alt={`生成结果 ${i + 1}`}
                                loading="lazy"
                                className="aspect-square w-full object-cover"
                              />
                              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                新窗口查看
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : r.type === 'video' && r.output ? (
                        <div className="mt-2">
                          <video
                            src={r.output}
                            controls
                            poster={r.meta?.poster || undefined}
                            className="max-h-72 w-full rounded-xl border border-slate-200 bg-black"
                          />
                        </div>
                      ) : r.type === 'audio' && r.output ? (
                        <div className="mt-2">
                          <audio src={r.output} controls className="w-full" />
                          {r.meta?.duration && (
                            <p className="mt-1.5 text-xs text-slate-400">
                              音色 {r.meta.voice || '—'} · 时长 {r.meta.duration}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
                          {r.output || '—'}
                        </p>
                      )}
                    </div>
                    {r.meta && Object.keys(r.meta).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-50 pt-3">
                        {Object.entries(r.meta)
                          .filter(([, v]) => v != null && v !== '')
                          .map(([k, v]) => (
                            <Badge key={k} color="bg-slate-50 text-slate-500">
                              {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
