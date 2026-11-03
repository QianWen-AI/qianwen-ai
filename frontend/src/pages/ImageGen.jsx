import { useMemo, useState, useEffect, useRef } from 'react'
import { Wand2, Download, RefreshCw, Image as ImageIcon } from 'lucide-react'
import { mockApi } from '../services/mockApi.js'
import {
  Card,
  Button,
  Textarea,
  Input,
  Select,
  EmptyState,
  Spinner,
  Badge,
} from '../components/ui.jsx'
import { useModelBenefits, categoryModels, freeSuffix, resolveDefaultModel } from '../hooks/useModelBenefits.js'

const IMAGE_MODELS = [
  { id: 'wan2.6-t2i', label: 'Wan2.6 T2I（推荐）' },
  { id: 'wan2.7-image-pro', label: 'Wan2.7 Image Pro（4K）' },
  { id: 'wan2.7-image', label: 'Wan2.7 Image' },
  { id: 'wan2.2-t2i-flash', label: 'Wan2.2 T2I Flash（快速）' },
  { id: 'qwen-image-plus', label: 'Qwen Image Plus' },
]

const SIZES = [
  { id: '1024*1024', label: '1:1 方图 1024×1024' },
  { id: '1280*960', label: '4:3 横图 1280×960' },
  { id: '960*1280', label: '3:4 竖图 960×1280' },
  { id: '1280*720', label: '16:9 横图 1280×720' },
  { id: '720*1280', label: '9:16 竖图 720×1280' },
]

const EXAMPLES = [
  '一只安静的橘猫坐在窗台边，午后阳光，水彩插画',
  '未来城市天际线，霓虹灯光，赛博朋克风格',
  '山间清晨的云雾与湖泊，极简水彩渐变',
  '一杯拉花拿铁与木桌上的笔记本，摄影风格',
]

export default function ImageGen() {
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [model, setModel] = useState(() => resolveDefaultModel(null, 'image', 'wan2.6-t2i'))
  const [size, setSize] = useState('1024*1024')
  const [count, setCount] = useState(2)
  const [seed, setSeed] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const modelTouched = useRef(false)
  const { benefits } = useModelBenefits()

  useEffect(() => {
    if (!benefits) return
    if (modelTouched.current) return
    const next = resolveDefaultModel(benefits, 'image', 'wan2.6-t2i')
    if (next) setModel(next)
  }, [benefits])

  useEffect(() => {
    function onDefaultsChanged() {
      if (!benefits || modelTouched.current) return
      const next = resolveDefaultModel(benefits, 'image', 'wan2.6-t2i')
      if (next) setModel(next)
    }
    window.addEventListener('qwen-default-models-changed', onDefaultsChanged)
    return () => window.removeEventListener('qwen-default-models-changed', onDefaultsChanged)
  }, [benefits])

  const imageOptions = useMemo(() => {
    // 与模型中心同源同序；benefits 未就绪时用硬编码兜底
    const list = benefits
      ? categoryModels(benefits, 'image')
      : IMAGE_MODELS.map((m) => ({ id: m.id, label: m.label }))
    return list.map((m) => ({
      id: m.id,
      label: `${m.label || m.id}${freeSuffix(benefits, m.id)}`,
    }))
  }, [benefits])

  async function generate() {
    const p = prompt.trim()
    if (!p || loading) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await mockApi.generateImage(p, {
        model,
        count,
        size,
        seed: seed ? Number(seed) : undefined,
      })
      setResult(res)
      mockApi
        .recordHistory({
          type: 'image',
          model: res.model,
          prompt: p,
          output: res.images.map((img) => img.url).join('\n'),
          meta: { size: res.size, count: res.images.length },
        })
        .catch(() => {})
    } catch (err) {
      setError(err?.message || '生成失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-10rem)] lg:flex-row lg:gap-6">
      <Card className="flex w-full shrink-0 flex-col lg:w-[320px] lg:overflow-y-auto">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-base font-semibold text-slate-900">生成配置</h3>
        </div>
        <div className="flex-1 space-y-4 p-5">
          <Textarea
            label="提示词 Prompt"
            id="img-prompt"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想生成的画面…"
            hint={`${prompt.length} / 2000 字符`}
          />
          <Input
            label="负面提示词"
            id="img-negative"
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="不希望出现的内容（可选）"
          />
          <Select
            label="模型"
            id="img-model"
            value={model}
            onChange={(e) => {
              modelTouched.current = true
              setModel(e.target.value)
            }}
          >
            {imageOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select label="尺寸" id="img-size" value={size} onChange={(e) => setSize(e.target.value)}>
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="数量"
              id="img-count"
              type="number"
              min={1}
              max={4}
              value={count}
              onChange={(e) => setCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))}
            />
            <Input
              label="Seed"
              id="img-seed"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="留空随机"
            />
          </div>
          <Button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner /> 正在生成…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                生成图像
              </>
            )}
          </Button>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">试试这些灵感</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-primary/40 hover:bg-blue-50/50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex min-h-[320px] min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">生成结果</h3>
            {result && (
              <p className="mt-0.5 text-xs text-slate-400">
                {result.model} · {result.size}
              </p>
            )}
          </div>
          {result && (
            <Badge color="bg-emerald-50 text-emerald-600">
              {result.images.length} 张已生成
            </Badge>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 sm:mx-6">
            {error}
          </div>
        )}

        {!result && !loading ? (
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" aria-hidden="true" />}
            title="还没有生成结果"
            description="在左侧输入提示词并点击「生成图像」，结果会显示在这里。"
          />
        ) : loading ? (
          <div className="grid flex-1 content-start gap-4 p-4 sm:grid-cols-2 lg:overflow-y-auto lg:p-6">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid flex-1 content-start gap-4 p-4 sm:grid-cols-2 lg:overflow-y-auto lg:p-6">
            {result.images.map((img, i) => (
              <figure
                key={i}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-50">
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute right-3 bottom-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow backdrop-blur transition-colors hover:bg-white"
                      onClick={() => window.open(img.url, '_blank')}
                      aria-label="下载图片"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={generate}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow backdrop-blur transition-colors hover:bg-white"
                      aria-label="重新生成"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <figcaption className="flex items-center justify-between px-3 py-2">
                  <span className="truncate text-xs text-slate-500">
                    Seed {img.seed}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {i + 1}/{result.images.length}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
