import { useRef, useState, useEffect } from 'react'
import { Send, Sparkles, User, RotateCcw, Cpu } from 'lucide-react'
import { mockApi, getApiMode } from '../services/mockApi.js'
import { Card, Select, Badge, Toggle, TypingIndicator } from '../components/ui.jsx'
import { useModelBenefits, categoryModels, freeSuffix, resolveDefaultModel } from '../hooks/useModelBenefits.js'

const CHAT_MODELS = [
  'qwen3.8-max',
  'qwen3.7-plus',
  'qwen3.7-flash',
  'qwen3-coder-next',
  'qwen-mt-plus',
]

const SUGGESTIONS = [
  '帮我写一段产品发布的宣传文案',
  '解释一下什么是大模型思维链',
  '给这段代码做代码审查并给出建议',
  '用通俗语言解释微服务架构',
]

function typewriter(setText, fullText, onDone) {
  let i = 0
  const step = 24
  const timer = setInterval(() => {
    i = Math.min(i + step, fullText.length)
    setText(fullText.slice(0, i))
    if (i >= fullText.length) {
      clearInterval(timer)
      onDone()
    }
  }, 30)
  return () => clearInterval(timer)
}

export default function TextChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(() => resolveDefaultModel(null, 'text', 'qwen3.7-plus'))
  const [thinking, setThinking] = useState(true)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)
  const modelTouched = useRef(false)
  const { benefits } = useModelBenefits()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!benefits) return
    if (modelTouched.current) return
    const next = resolveDefaultModel(benefits, 'text', 'qwen3.7-plus')
    if (next) setModel(next)
  }, [benefits])

  useEffect(() => {
    function onDefaultsChanged() {
      if (!benefits || modelTouched.current) return
      const next = resolveDefaultModel(benefits, 'text', 'qwen3.7-plus')
      if (next) setModel(next)
    }
    window.addEventListener('qwen-default-models-changed', onDefaultsChanged)
    return () => window.removeEventListener('qwen-default-models-changed', onDefaultsChanged)
  }, [benefits])

  const chatOptions = (() => {
    // 与模型中心同源同序；benefits 未就绪时用硬编码兜底
    if (!benefits) return CHAT_MODELS
    return categoryModels(benefits, 'text').map((m) => m.id)
  })()

  function handleModelChange(e) {
    modelTouched.current = true
    setModel(e.target.value)
  }

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    const userMessage = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setBusy(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '', pending: true }])

    try {
      const res = await mockApi.chat(content, { model })
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, pending: false, stream: true } : m,
        ),
      )
      typewriter(
        (piece) =>
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: piece } : m,
            ),
          ),
        res.text,
        () => {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, stream: false, usage: res.usage, model: res.model }
                : m,
            ),
          )
          mockApi
            .recordHistory({
              type: 'text',
              model: res.model || model,
              prompt: content,
              output: res.text,
              meta: { usage: res.usage },
            })
            .catch(() => {})
        },
      )
    } catch (err) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, pending: false, content: err?.message || '请求失败，请稍后重试。' }
            : m,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setMessages([])
    setInput('')
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-10rem)] lg:flex-row lg:gap-6">
      <Card className="order-2 flex w-full shrink-0 flex-col lg:order-1 lg:w-[260px]">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">会话配置</h3>
            <button
              onClick={reset}
              className="cursor-pointer text-slate-400 transition-colors hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
              aria-label="新建会话"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <Select label="模型" id="chat-model" value={model} onChange={handleModelChange}>
            {chatOptions.map((m) => (
              <option key={m} value={m}>
                {m}
                {freeSuffix(benefits, m)}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">深度思考</p>
              <p className="text-xs text-slate-400">模型默认开启</p>
            </div>
            <Toggle checked={thinking} onChange={setThinking} label="深度思考" />
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              当前模式
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              接口处于{' '}
              {getApiMode() === 'mock'
                ? 'Mock 演示'
                : getApiMode() === 'custom'
                  ? '自定义模型'
                  : '内置模型'}{' '}
              模式，可在「认证与设置」页切换。
            </p>
          </div>
        </div>
      </Card>

      <Card className="order-1 flex min-h-[60vh] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg shadow-blue-200">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              你好，我是 QianWen 助手
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              选择左侧模型与参数，输入问题开始对话
            </p>
            <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-xl border border-slate-200 p-4 text-left text-sm text-slate-700 transition-all duration-200 hover:border-primary/40 hover:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    m.role === 'user'
                      ? 'bg-slate-200 text-slate-600'
                      : 'bg-gradient-to-br from-primary to-cyan-500 text-white'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {m.role === 'user' ? (
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-800">
                      {m.content}
                    </div>
                  ) : m.pending ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <TypingIndicator />
                      <span className="text-xs">正在调用 {model}…</span>
                    </div>
                  ) : (
                    <div>
                      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-blue-50/70 px-4 py-3 text-sm leading-relaxed text-slate-800">
                        {m.content}
                      </div>
                      {m.usage && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge color="bg-slate-100 text-slate-500">{m.model}</Badge>
                          <Badge color="bg-slate-100 text-slate-500">
                            输入 {m.usage.prompt_tokens} · 输出{' '}
                            {m.usage.completion_tokens}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={2}
              className="max-h-40 flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
              aria-label="输入消息"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-blue-200 transition-all duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              aria-label="发送"
            >
              <Send className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            AI 生成内容仅供参考，请对重要信息进行核验。
          </p>
        </div>
      </Card>
    </div>
  )
}
