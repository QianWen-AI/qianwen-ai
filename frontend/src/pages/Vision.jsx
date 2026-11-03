import { useRef, useState, useEffect, useMemo } from 'react'
import { ScanEye, UploadCloud, ImageUp, FileText, Tag, X } from 'lucide-react'
import { mockApi, getApiMode } from '../services/mockApi.js'
import {
  Card,
  Button,
  Select,
  EmptyState,
  Spinner,
  Badge,
  ModeRestrictedBanner,
} from '../components/ui.jsx'
import { useModelBenefits, categoryModels, freeSuffix, resolveDefaultModel } from '../hooks/useModelBenefits.js'

const VISION_MODELS = [
  { id: 'qwen3.7-plus', label: 'Qwen3.7 Plus（推荐）' },
  { id: 'qwen3.6-plus', label: 'Qwen3.6 Plus' },
  { id: 'qwen3-max', label: 'Qwen3 Max' },
]

export default function Vision() {
  const [model, setModel] = useState(() => resolveDefaultModel(null, 'vision', 'qwen3.7-plus'))
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const modelTouched = useRef(false)
  const { benefits } = useModelBenefits()

  useEffect(() => {
    if (!benefits) return
    if (modelTouched.current) return
    const next = resolveDefaultModel(benefits, 'vision', 'qwen3.7-plus')
    if (next) setModel(next)
  }, [benefits])

  useEffect(() => {
    function onDefaultsChanged() {
      if (!benefits || modelTouched.current) return
      const next = resolveDefaultModel(benefits, 'vision', 'qwen3.7-plus')
      if (next) setModel(next)
    }
    window.addEventListener('qwen-default-models-changed', onDefaultsChanged)
    return () => window.removeEventListener('qwen-default-models-changed', onDefaultsChanged)
  }, [benefits])

  const visionOptions = useMemo(() => {
    // 与模型中心同源同序；benefits 未就绪时用硬编码兜底
    const list = benefits
      ? categoryModels(benefits, 'vision')
      : VISION_MODELS.map((m) => ({ id: m.id, label: m.label }))
    return list.map((m) => ({
      id: m.id,
      label: `${m.label || m.id}${freeSuffix(benefits, m.id)}`,
    }))
  }, [benefits])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)
  }

  async function analyze() {
    if (!preview || loading) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await mockApi.analyzeImage(preview, fileName, { model })
      setResult(res)
      mockApi
        .recordHistory({
          type: 'vision',
          model: res.model,
          prompt: fileName,
          output: res.summary,
          meta: { tags: res.tags, ocr: res.ocr },
        })
        .catch(() => {})
    } catch (err) {
      setError(err?.message || '分析失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  function clearImage() {
    setPreview(null)
    setFileName('')
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {getApiMode() === 'builtin' && <ModeRestrictedBanner />}
      <div className="flex flex-col gap-4 lg:h-[calc(100vh-10rem)] lg:flex-row lg:gap-6">
      <Card className="flex w-full shrink-0 flex-col lg:w-[340px]">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-base font-semibold text-slate-900">上传图片</h3>
        </div>
        <div className="flex-1 space-y-4 p-5">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="待分析的图片"
                className="aspect-square w-full rounded-2xl border border-slate-200 object-cover"
              />
              <button
                onClick={clearImage}
                className="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow backdrop-blur transition-colors hover:bg-white"
                aria-label="移除图片"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="mt-2 truncate text-xs text-slate-500">{fileName}</p>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:py-14"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  点击选择图片
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  JPG / PNG / WebP，支持拖拽上传
                </p>
              </div>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            aria-label="选择图片文件"
          />
          <Select
            label="视觉模型"
            id="vision-model"
            value={model}
            onChange={(e) => {
              modelTouched.current = true
              setModel(e.target.value)
            }}
          >
            {visionOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
          <Button
            onClick={analyze}
            disabled={loading || !preview}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner /> 正在分析…
              </>
            ) : (
              <>
                <ScanEye className="h-4 w-4" aria-hidden="true" />
                开始分析
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="flex min-h-[320px] min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">分析结果</h3>
            {result && (
              <p className="mt-0.5 text-xs text-slate-400">模型：{result.model}</p>
            )}
          </div>
          {result && <Badge color="bg-emerald-50 text-emerald-600">分析完成</Badge>}
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 sm:mx-6">
            {error}
          </div>
        )}

        {!result && !loading ? (
          <EmptyState
            icon={<ImageUp className="h-6 w-6" aria-hidden="true" />}
            title="还没有分析结果"
            description="上传一张图片并点击「开始分析」，识别结果会显示在这里。"
          />
        ) : loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <div className="h-40 w-40 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-4 w-48 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                内容理解
              </h4>
              <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {result.summary}
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
                识别标签
              </h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.tags.map((tag) => (
                  <Badge key={tag} color="bg-blue-50 text-blue-600">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {result.ocr.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ScanEye className="h-4 w-4 text-primary" aria-hidden="true" />
                  OCR 文字提取
                </h4>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                  {result.ocr.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 text-sm ${
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      }`}
                    >
                      <span className="font-medium text-slate-800">
                        {item.text}
                      </span>
                      <span className="text-xs text-emerald-600">
                        置信度 {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      </div>
    </div>
  )
}
