const MODE_KEY = 'qwen_console_api_mode'
const API_KEY_KEY = 'qwen_console_api_key'
const MODEL_TOKEN_KEY = 'qwen_model_token'

export function getApiMode() {
  const mode = localStorage.getItem(MODE_KEY) || 'builtin'
  return mode === 'real' ? 'builtin' : mode
}

export function setApiMode(mode) {
  localStorage.setItem(MODE_KEY, mode)
}

export function isRealMode() {
  return getApiMode() !== 'mock'
}

export function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || ''
}

export function setApiKey(key) {
  localStorage.setItem(API_KEY_KEY, key)
}

export function getModelToken() {
  return sessionStorage.getItem(MODEL_TOKEN_KEY) || ''
}

export function setModelToken(token) {
  if (token) sessionStorage.setItem(MODEL_TOKEN_KEY, token)
  else sessionStorage.removeItem(MODEL_TOKEN_KEY)
}

const DEFAULT_MODELS_KEY = 'qwen_console_default_models'

export function getDefaultModels() {
  try {
    return JSON.parse(localStorage.getItem(DEFAULT_MODELS_KEY)) || {}
  } catch {
    return {}
  }
}

export function setDefaultModels(map) {
  localStorage.setItem(DEFAULT_MODELS_KEY, JSON.stringify(map))
  window.dispatchEvent(new CustomEvent('qwen-default-models-changed', { detail: map }))
}

// 仅自定义模型模式将 Key 写入请求头；内置模式由服务端 .env 提供
function authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (getApiMode() === 'custom') {
    const key = getApiKey()
    if (key) headers.Authorization = `Bearer ${key}`
  }
  return headers
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function toError(res) {
  try {
    const data = await res.json()
    const base = data.error || data.message || `请求失败（${res.status}）`
    const err = new Error(data.hint ? `${base}（${data.hint}）` : base)
    err.status = res.status
    err.hint = data.hint || ''
    return err
  } catch {
    return new Error(`请求失败（HTTP ${res.status}）`)
  }
}

async function realChat(userMessage, { model = 'qwen3.7-plus' } = {}) {
  const res = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw await toError(res)
  const data = await res.json()
  return {
    model: data.model || model,
    text: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  }
}

async function realImage(prompt, { model = 'wan2.6-t2i', count = 1, size = '1024*1024', negative_prompt } = {}) {
  const res = await fetch('/api/v1/image', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      prompt,
      count,
      size,
      negative_prompt,
    }),
  })
  if (!res.ok) throw await toError(res)
  const data = await res.json()
  const results =
    data.output?.results ||
    (data.output?.choices?.[0]?.message?.content || [])
      .filter((c) => c.image)
      .map((c) => ({ url: c.image }))
  return {
    model: data.model || model,
    size,
    images: results.map((r) => ({
      url: r.url,
      seed: r.seed ?? Math.floor(Math.random() * 1e9),
      prompt,
    })),
  }
}

async function realVision(image, prompt, { model = 'qwen3.7-plus' } = {}) {
  const res = await fetch('/api/v1/vision', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model, image, prompt }),
  })
  if (!res.ok) throw await toError(res)
  const data = await res.json()
  return {
    model: data.model || model,
    summary: data.choices?.[0]?.message?.content || '',
    tags: [],
    ocr: [],
  }
}

async function getHealth() {
  try {
    const headers = {}
    if (getApiMode() === 'custom' && getApiKey()) {
      headers.Authorization = `Bearer ${getApiKey()}`
    }
    const res = await fetch('/api/health', { headers })
    if (!res.ok) return { ok: false, keyProvided: false, serverKeyConfigured: false }
    return await res.json()
  } catch {
    return { ok: false, keyProvided: false, serverKeyConfigured: false }
  }
}

async function getModelBenefits() {
  try {
    const headers = {}
    if (getApiMode() === 'custom' && getApiKey()) {
      headers.Authorization = `Bearer ${getApiKey()}`
    } else if (getApiMode() !== 'mock') {
      const t = getModelToken()
      if (t) headers['X-Model-Token'] = t
    }
    const res = await fetch('/api/v1/models/benefits', { headers })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.available && data.reason === 'key_invalid') {
      throw new Error(data.hint || 'API Key 无效，请检查后重试')
    }
    return data.available ? data : null
  } catch {
    return null
  }
}

async function verifyModelPassword(password) {
  const res = await fetch('/api/v1/models/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const data = await res.json()
  if (data.ok && data.token) setModelToken(data.token)
  return Boolean(data.ok)
}

async function realVideo(prompt, { model = 'wan2.6-t2v', duration = 5 } = {}) {
  const res = await fetch('/api/v1/video', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model, prompt, duration, size: '1280*720' }),
  })
  if (!res.ok) throw await toError(res)
  const data = await res.json()
  if (!data.task_id) throw new Error(data.error || '视频任务提交失败')
  return {
    taskId: data.task_id,
    model: data.model || model,
    duration: data.duration || duration,
    status: data.status || 'PENDING',
  }
}

async function getVideoTask(taskId) {
  const res = await fetch(`/api/v1/video/task/${taskId}`, { headers: authHeaders() })
  if (!res.ok) throw await toError(res)
  return await res.json()
}

async function downloadVideo(taskId) {
  const res = await fetch(`/api/v1/video/download/${taskId}`, { headers: authHeaders() })
  if (!res.ok) throw await toError(res)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `qwen-video-${String(taskId).slice(0, 8)}.mp4`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function realAudio(text, { voice = 'Cherry', speed = 1.0 } = {}) {
  const res = await fetch('/api/v1/audio', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text, voice, speed }),
  })
  if (!res.ok) throw await toError(res)
  const data = await res.json()
  return {
    voice: data.voice || voice,
    speed,
    duration: data.duration,
    sampleRate: `${data.sampleRate || 24000} Hz`,
    audioUrl: data.audioUrl || '',
  }
}

async function getUsageReal() {
  const res = await fetch('/api/v1/usage?period=month')
  if (!res.ok) throw await toError(res)
  return await res.json()
}

async function getUsageLogsReal() {
  const res = await fetch('/api/v1/usage/logs?period=24h&pageSize=20')
  if (!res.ok) throw await toError(res)
  const data = await res.json()
  return data.available ? data.items : []
}

export function formatTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

export function mapUsageSummary(summary) {
  const payg = summary.pay_as_you_go || {}
  const models = payg.models || []
  const totalTokens = models.reduce(
    (s, m) => s + (m.usage?.tokens_total || 0),
    0,
  )
  const spend = payg.total?.cost ?? 0
  const currency = payg.total?.currency || 'CNY'
  const symbol = currency === 'USD' ? '$' : '¥'
  const modelBreakdown = models.map((m) => ({
    name: m.model_id,
    value: m.cost || 0,
  }))
  const totalCost = modelBreakdown.reduce((s, m) => s + m.value, 0)
  const bills = models.map((m) => ({
    date: (summary.period?.from || '').slice(5),
    model: m.model_id,
    tokens: m.usage?.tokens_total
      ? formatTokens(m.usage.tokens_total)
      : undefined,
    cost: `${symbol}${(m.cost || 0).toFixed(2)}`,
  }))
  const freeTier = (summary.free_tier || []).map((f) => ({
    model_id: f.model_id,
    remaining: f.quota?.remaining ?? 0,
    total: f.quota?.total ?? 0,
    unit: f.quota?.unit || 'tokens',
    used_pct: f.quota?.used_pct ?? 0,
  }))
  const quotaUsed = freeTier[0]?.used_pct ?? summary.token_plan?.usedPct ?? 0
  return {
    real: true,
    totalTokens: formatTokens(totalTokens),
    spend: `${symbol}${spend.toFixed(2)}`,
    budget: summary.token_plan?.planName || 'Token 计划',
    quota: { used: quotaUsed, free: 100 - quotaUsed },
    freeTier,
    tokenPlan: summary.token_plan,
    modelBreakdown,
    totalCost,
    bills,
    tokenTrend: [],
    month: summary.period
      ? `${summary.period.from} ~ ${summary.period.to}`
      : '本月',
  }
}

const TEXT_REPLIES = [
  '好的，我来帮你处理。基于当前需求，最合适的方案是从目标拆解开始：先明确可量化的结果，再倒推关键动作，最后设定检查点。这样每一步都有依据，迭代时也能快速定位偏差。',
  '这个问题可以从两个维度看。短期先解决最影响体验的环节，长期则要建立自动化的兜底机制。我的建议是先做一轮小范围验证，用真实数据确认方向，再决定是否全面铺开。',
  '收到。我整理了三个要点：第一，数据口径要统一，否则对比没有意义；第二，结果需要可复现，建议保留完整的参数与随机种子；第三，输出格式直接决定下游消费成本，尽量结构化。',
  '理解你的目标。我建议采用这样的执行路径：先确认边界条件，再设计最小可行方案，随后用样例数据跑通全链路，最后逐步放宽约束做压力测试。过程中保持日志完整，便于回溯。',
  '这是一个值得展开的话题。核心矛盾在于资源的有限性与期望的复杂度，所以优先级排序比执行本身更重要。我建议按「影响面 × 紧急度」二维矩阵来决策，并预留 20% 的缓冲时间应对不确定性。',
]

const IMAGE_PROMPTS = [
  {
    prompt: '一只安静的橘猫坐在窗台边，午后阳光洒落，水彩插画风格',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80',
  },
  {
    prompt: '未来城市天际线，霓虹灯光，赛博朋克风格',
    url: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&q=80',
  },
  {
    prompt: '山间清晨的云雾与湖泊，水彩渐变，极简风格',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  },
  {
    prompt: '一杯拉花拿铁与木桌上的笔记本，摄影风格',
    url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  },
]

export const mockApi = {
  async chat(userMessage, options = {}) {
    if (isRealMode()) return realChat(userMessage, options)
    await delay(900 + Math.random() * 600)
    return {
      model: options.model || 'qwen3.7-plus',
      text: pick(TEXT_REPLIES),
      usage: {
        prompt_tokens: Math.round(userMessage.length * 1.3),
        completion_tokens: 180 + Math.round(Math.random() * 120),
      },
    }
  },

  async generateImage(prompt, options = {}) {
    if (isRealMode()) return realImage(prompt, options)
    const { count = 1 } = options
    await delay(1400 + Math.random() * 800)
    return {
      model: options.model || 'wan2.6-t2i',
      size: options.size || '1K',
      images: Array.from({ length: count }, () => ({
        url: pick(IMAGE_PROMPTS).url,
        seed: Math.floor(Math.random() * 1e9),
        prompt,
      })),
    }
  },

  async generateVideo(prompt, { model = 'wan2.6-t2v', duration = 5 } = {}) {
    if (isRealMode()) return realVideo(prompt, { model, duration })
    await delay(1200)
    return {
      taskId: `mock-${Date.now().toString(36)}`,
      model,
      duration,
      status: 'PENDING',
    }
  },

  async getVideoTask(taskId) {
    if (isRealMode()) return getVideoTask(taskId)
    await delay(1500)
    return {
      status: 'SUCCEEDED',
      model: '',
      duration: 5,
      video_url:
        'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      poster: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&q=80',
    }
  },

  async downloadVideo(taskId) {
    if (isRealMode()) return downloadVideo(taskId)
  },

  async synthesizeSpeech(text, { voice = 'Cherry', speed = 1.0 } = {}) {
    if (isRealMode()) return realAudio(text, { voice, speed })
    await delay(1000 + Math.random() * 500)
    return {
      voice,
      speed,
      duration: Math.round((text.length * 0.28) / speed) + ' 秒',
      sampleRate: '24000 Hz',
    }
  },

  async analyzeImage(image, fileName, { model = 'qwen3.7-plus' } = {}) {
    if (isRealMode()) return realVision(image, fileName, { model })
    await delay(1200 + Math.random() * 600)
    return {
      model,
      summary:
        '这是一张清晰的生活场景照片。画面主体突出，构图符合三分法则，光线柔和自然。图中的主要元素包括前景主体、背景层次与高光细节，整体氛围温暖。',
      tags: ['场景识别', '光线分析', '主体检测', '构图评估'],
      ocr: [
        { text: 'QIANWEN AI CONSOLE', confidence: 0.98 },
        { text: 'Create · Generate · Analyze', confidence: 0.95 },
      ],
    }
  },

  getHealth,

  async getUsage() {
    if (isRealMode()) return getUsageReal()
    await delay(600)
    return {
      month: '本月',
      totalTokens: '128.6M',
      tokenTrend: [32, 41, 38, 55, 47, 62, 58, 71, 66, 82, 78, 92],
      modelBreakdown: [
        { name: 'qwen3.7-plus', value: 46 },
        { name: 'qwen3.8-max', value: 22 },
        { name: 'qwen3.7-flash', value: 18 },
        { name: 'wan2.6-t2i', value: 9 },
        { name: '其他', value: 5 },
      ],
      quota: { used: 78, free: 22 },
      spend: '¥ 86.42',
      budget: '¥ 200.00',
      bills: [
        { date: '08-12', model: 'qwen3.7-plus', tokens: '4.2M', cost: '¥ 6.30' },
        { date: '08-11', model: 'qwen3.8-max', tokens: '1.8M', cost: '¥ 5.76' },
        { date: '08-10', model: 'wan2.6-t2i', images: '32 张', cost: '¥ 3.20' },
        { date: '08-09', model: 'qwen3.7-flash', tokens: '12.6M', cost: '¥ 2.52' },
        { date: '08-08', model: 'qwen-image-2.0-pro', images: '8 张', cost: '¥ 4.80' },
      ],
    }
  },

  async getUsageLogs() {
    if (isRealMode()) return getUsageLogsReal()
    await delay(400)
    return [
      { time: '14:32', type: '文本', detail: 'qwen3.7-plus · 代码审查建议', status: '成功' },
      { time: '13:58', type: '图像', detail: 'wan2.6-t2i · 生成 4 张海报', status: '成功' },
      { time: '11:20', type: '语音', detail: 'qwen-tts · 播报稿合成', status: '成功' },
      { time: '09:47', type: '视觉', detail: 'qwen3.6-plus · 截图 OCR 提取', status: '成功' },
      { time: '昨天 18:05', type: '视频', detail: 'wan2.1-t2i · 产品展示短片', status: '排队中' },
    ]
  },

  async getModelBenefits() {
    if (isRealMode()) return getModelBenefits()
    return null
  },

  async verifyModelPassword(password) {
    return verifyModelPassword(password)
  },

  // 历史记录：云端缓存，所有模式统一上报与查询
  async recordHistory(record) {
    const res = await fetch('/api/v1/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (!res.ok) throw await toError(res)
    return res.json()
  },

  async getHistory(params = {}) {
    const q = new URLSearchParams()
    if (params.type) q.set('type', params.type)
    if (params.limit) q.set('limit', String(params.limit))
    const res = await fetch(`/api/v1/history?${q.toString()}`)
    if (!res.ok) throw await toError(res)
    return res.json()
  },

  async deleteHistory(id) {
    const res = await fetch(`/api/v1/history?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw await toError(res)
    return res.json()
  },

  async clearHistory() {
    const res = await fetch('/api/v1/history', { method: 'DELETE' })
    if (!res.ok) throw await toError(res)
    return res.json()
  },
}
