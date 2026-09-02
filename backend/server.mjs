import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, '../frontend/dist')
const ENV_FILE = path.resolve(__dirname, '../.env')
const PORT = Number(process.env.PORT || 8787)

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    const key = m[1]
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv(ENV_FILE)

const API_KEY = process.env.DASHSCOPE_API_KEY || process.env.QIANWEN_API_KEY || ''
const BASE = (process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com').replace(/\/$/, '')

// 内置模式模型中心查看密码（默认 014925，可用 MODEL_PASSWORD 覆盖）；未验证时模型关键信息模糊展示
const MODEL_PASSWORD = process.env.MODEL_PASSWORD || '014925'
const verifiedTokens = new Set()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const rel = urlPath === '/' ? '/index.html' : urlPath
  let file = path.normalize(path.join(DIST, rel))
  if (!file.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html')
  }
  const ext = path.extname(file)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return null
  }
}

function bearerKey(req) {
  const header = req.headers.authorization || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

// 自定义模型优先用请求头 Key；内置模型 fallback 到服务端 .env Key
function resolveApiKey(req) {
  return bearerKey(req) || API_KEY
}

// 内置模型模式配额：每 IP 每天 对话 10 次 / 图片 2 次；自定义模型（带 header Key）不受限
const BUILTIN_QUOTA = { chat: 10, image: 2 }
const quota = new Map()

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function ipOf(req) {
  const fwd = req.headers['x-forwarded-for']
  const fwdIp = typeof fwd === 'string' ? fwd.split(',')[0].trim() : ''
  return fwdIp || req.socket.remoteAddress || 'unknown'
}

function quotaRec(req) {
  const ip = ipOf(req)
  let rec = quota.get(ip)
  if (!rec || rec.date !== todayStr()) {
    rec = { date: todayStr(), chat: 0, image: 0 }
    quota.set(ip, rec)
  }
  return rec
}

function isBuiltinMode(req) {
  return !bearerKey(req) && Boolean(API_KEY)
}

// 内置模式返回 { allowed, limit, used }；自定义/Mock 模式返回 null（不限制）
function quotaStatus(req, kind) {
  if (!isBuiltinMode(req)) return null
  const rec = quotaRec(req)
  const limit = BUILTIN_QUOTA[kind]
  return { allowed: rec[kind] < limit, limit, used: rec[kind] }
}

function quotaInc(req, kind) {
  if (!isBuiltinMode(req)) return
  quotaRec(req)[kind] += 1
}

function sendQuotaError(res, kind) {
  sendJson(res, 403, {
    error:
      kind === 'chat'
        ? '内置模型每日免费对话次数（10 次/IP）已用完'
        : '内置模型每日免费图片生成次数（2 次/IP）已用完',
    hint: '请在设置页切换「自定义模型」并配置您的 API-Key 后继续使用',
  })
}

function sendModeRestricted(res) {
  sendJson(res, 403, {
    error: '内置模型模式仅支持文本对话与图像生成',
    hint: '请配置自定义 API-Key 后使用（设置页切换「自定义模型」并填写您的 DashScope API-Key）',
  })
}

async function proxyUpstream(res, upstreamPath, body, apiKey, opts = {}) {
  if (!apiKey) {
    sendJson(res, 401, {
      error: 'API Key 未配置',
      hint: '内置模式需在服务端 .env 配置 Key，或切换自定义模型在设置页填入 Key',
    })
    return
  }
  try {
    const upstream = await fetch(`${BASE}${upstreamPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (upstream.ok && typeof opts.onSuccess === 'function') {
      try {
        opts.onSuccess()
      } catch {
        // ignore
      }
    }
    const text = await upstream.text()
    res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(text)
  } catch (err) {
    sendJson(res, 502, { error: '上游请求失败', detail: String(err.message || err) })
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function proxyAsyncImage(res, payload, apiKey, opts = {}) {
  return proxyAsyncTask(
    res,
    '/api/v1/services/aigc/text2image/image-synthesis',
    payload,
    undefined,
    apiKey,
    opts,
  )
}

async function proxyAsyncTask(res, endpoint, payload, mapResult, apiKey, opts = {}) {
  if (!apiKey) {
    sendJson(res, 401, {
      error: 'API Key 未配置',
      hint: '内置模式需在服务端 .env 配置 Key，或切换自定义模型在设置页填入 Key',
    })
    return
  }
  try {
    const submit = await fetch(`${BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(payload),
    })
    const submitData = await submit.json()
    const taskId = submitData.output?.task_id
    if (!taskId) {
      res.writeHead(submit.status, {
        'Content-Type': 'application/json; charset=utf-8',
      })
      res.end(JSON.stringify(submitData))
      return
    }
    for (let i = 0; i < 60; i++) {
      await sleep(1500)
      const poll = await fetch(`${BASE}/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const pollData = await poll.json()
      const status = pollData.output?.task_status
      if (status === 'SUCCEEDED') {
        if (typeof opts.onSuccess === 'function') {
          try {
            opts.onSuccess()
          } catch {
            // ignore
          }
        }
        sendJson(res, 200, mapResult ? mapResult(pollData, taskId) : pollData)
        return
      }
      if (status === 'FAILED') {
        sendJson(res, 502, pollData)
        return
      }
    }
    sendJson(res, 504, { error: '任务超时，请稍后重试' })
  } catch (err) {
    sendJson(res, 502, {
      error: '上游请求失败',
      detail: String(err.message || err),
    })
  }
}

function runCli(args) {
  try {
    const stdout = execFileSync('qianwen', args, {
      encoding: 'utf8',
      timeout: 30000,
    })
    return { ok: true, stdout }
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, reason: 'cli_missing' }
    return { ok: false, reason: 'cli_error', detail: String(err.stderr || err.message || err) }
  }
}

// ---- 免费模型额度检查：每日本地时间 04:00 自动刷新，更新推荐模型 ----
const BENEFITS_FILE = path.resolve(__dirname, 'data/benefits.json')
const BENEFITS_CACHE_TTL = 6 * 60 * 60 * 1000
let modelBenefits = null
let benefitsCheckedAt = 0

function loadBenefitsCache() {
  try {
    if (fs.existsSync(BENEFITS_FILE)) {
      modelBenefits = JSON.parse(fs.readFileSync(BENEFITS_FILE, 'utf8'))
      benefitsCheckedAt = Date.now()
    }
  } catch {
    modelBenefits = null
  }
}
loadBenefitsCache()

// 计算模型所属能力分类（一个模型可属多类）
function capabilitiesOf(modality = {}) {
  const out = modality.output || []
  const inp = modality.input || []
  const caps = []
  if (out.includes('video')) caps.push('video')
  if (out.includes('image')) caps.push('image')
  if (out.includes('audio')) caps.push('audio')
  // 语音识别 / 语音对话（输入或输出含音频）归入语音类
  if (out.includes('text') && (inp.includes('audio') || out.includes('audio'))) {
    caps.push('audio')
  }
  // 视觉理解：图像/视频输入 + 文本输出
  if (out.includes('text') && (inp.includes('image') || inp.includes('video'))) {
    caps.push('vision')
  }
  // 纯文本对话（输入不含音频）
  if (out.includes('text') && !inp.includes('audio')) caps.push('text')
  return caps.length ? caps : ['text']
}

const CATEGORY_LABEL = {
  text: '文本对话',
  image: '图像生成',
  video: '视频生成',
  audio: '语音合成',
  vision: '视觉理解',
}

function isFreeValid(m) {
  return m.status === 'valid' && m.resetDate && m.resetDate > new Date().toISOString()
}

// models list 未收录的模型按名称/单位推断能力分类
function inferCaps(id, unit) {
  const s = id.toLowerCase()
  if (unit === 'images') return ['image']
  if (/(wan|happyhorse|pixverse|vidu|kling|emoji|video)/.test(s)) return ['video']
  if (/(sambert|cosyvoice|fun-cosyvoice|tts|asr|paraformer|sensevoice|fun-asr|fun-music|voice)/.test(s))
    return ['audio']
  if (/(image|wanx|aitryon|wordart)/.test(s)) return ['image']
  return ['text']
}

// 默认模型排除规则：语音类默认仅从纯语音合成(TTS)选，排除识别/翻译/音乐/对话；视觉类排除实时翻译/语音对话
const DEFAULT_EXCLUDE = {
  audio: /(paraformer|sensevoice|fun-asr|asr|livetranslate|realtime|fun-music|music)/i,
  vision: /(livetranslate|realtime)/i,
}

// 每类默认模型：免费额度 valid 中按到期时间升序（快过期优先）
function computeDefaults(list) {
  const defaults = {}
  for (const key of Object.keys(CATEGORY_LABEL)) {
    const ex = DEFAULT_EXCLUDE[key]
    const valid = list
      .filter((m) => m.caps.includes(key) && isFreeValid(m) && (!ex || !ex.test(m.id)))
      .sort((a, b) => new Date(a.resetDate) - new Date(b.resetDate))
    defaults[key] = valid[0]?.id || null
  }
  return defaults
}

// 校验 API Key 有效性（调官方模型列表接口，401 即无效）
async function validateApiKey(key) {
  try {
    const res = await fetch(`${BASE}/api/v1/models?page_size=1`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.status === 401) {
      return { ok: false, hint: 'API Key 无效或已过期，请在设置页检查后重试' }
    }
    return { ok: true }
  } catch {
    return { ok: false, hint: '无法连接官方服务，请稍后重试' }
  }
}

function refreshModelBenefits() {
  // 数据源与官方平台 benefits 页面一致：usage free-tier（免费额度+已消耗+剩余比例+到期时间）
  const ftRun = runCli(['usage', 'free-tier', '--format', 'json'])
  if (!ftRun.ok) return { ok: false, reason: ftRun.reason }
  try {
    const ftParsed = JSON.parse(ftRun.stdout)
    const ftList = ftParsed.free_tier || []
    // 用 models list 补齐各模型的能力分类（modality/context/pricing）
    let modMap = {}
    const modRun = runCli(['models', 'list', '--all', '--verbose', '--format', 'json'])
    if (modRun.ok) {
      try {
        const modParsed = JSON.parse(modRun.stdout)
        modMap = Object.fromEntries(
          (modParsed.models || []).map((m) => [
            m.id,
            {
              caps: capabilitiesOf(m.modality),
              context: m.context?.context_window
                ? `${Math.round(m.context.context_window / 1000)}K`
                : '',
              pricing: m.pricing?.summary?.unit || '',
            },
          ]),
        )
      } catch {
        // 分类补齐失败不阻塞
      }
    }
    const list = ftList.map((f) => {
      const q = f.quota || {}
      const info = modMap[f.model_id] || {}
      return {
        id: f.model_id,
        caps: info.caps || inferCaps(f.model_id, q.unit),
        canTry: true,
        unit: q.unit || '',
        status: q.status || '',
        remaining: q.remaining ?? null,
        total: q.total ?? null,
        usedPct: q.used_pct ?? null,
        consumed:
          q.total != null && q.remaining != null ? Math.max(0, q.total - q.remaining) : null,
        resetDate: q.resetDate || null,
        context: info.context || '',
        pricing: info.pricing || '',
      }
    })
    // 与官方 benefits 页面保持一致：展示有免费额度的模型（valid）；排除不匹配五类的向量模型
    const SKIP = /embedding|rerank/i
    const usable = list.filter((m) => m.status === 'valid' && !SKIP.test(m.id))
    const categories = {}
    for (const key of Object.keys(CATEGORY_LABEL)) {
      categories[key] = {
        label: CATEGORY_LABEL[key],
        models: usable.filter((m) => m.caps.includes(key)),
      }
    }
    modelBenefits = {
      updatedAt: new Date().toISOString(),
      source: 'qianwen_cli_usage_free_tier',
      models: usable,
      categories,
      defaults: computeDefaults(usable),
    }
    benefitsCheckedAt = Date.now()
    try {
      fs.mkdirSync(path.dirname(BENEFITS_FILE), { recursive: true })
      fs.writeFileSync(BENEFITS_FILE, JSON.stringify(modelBenefits, null, 2))
    } catch {
      // 缓存写入失败不阻塞
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'parse_error' }
  }
}

// 未鉴权时模糊模型关键信息：额度/消耗/到期/状态/计费均打码，仅保留模型标识与能力
function maskBenefits(b) {
  const mask = (m) => ({
    ...m,
    masked: true,
    status: '',
    unit: '',
    remaining: null,
    total: null,
    usedPct: null,
    consumed: null,
    resetDate: null,
    pricing: '',
  })
  return {
    ...b,
    masked: true,
    models: b.models.map(mask),
    categories: Object.fromEntries(
      Object.entries(b.categories).map(([key, val]) => [
        key,
        { label: val.label, models: val.models.map(mask) },
      ]),
    ),
  }
}

function scheduleBenefitsCheck() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(4, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  setTimeout(() => {
    refreshModelBenefits()
    scheduleBenefitsCheck()
  }, next - now)
}

// ---- 历史记录：所有功能调用记录云端缓存（backend/data/history.json） ----
const HISTORY_FILE = path.resolve(__dirname, 'data/history.json')
const HISTORY_MAX = 500

// 异步视频任务：提交后立即返回 task_id，前端轮询状态；成功时同步写入历史记录（去重）
const videoTasks = new Map()
const videoRecorded = new Set()

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const arr = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
      return Array.isArray(arr) ? arr : []
    }
  } catch {
    // 损坏则视为空
  }
  return []
}

function saveHistory(list) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true })
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2))
  } catch (err) {
    console.error('历史记录写入失败:', err.message)
  }
}

function addHistoryRecord(rec) {
  const list = loadHistory()
  const item = {
    id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: rec.type,
    model: rec.model || '',
    prompt: String(rec.prompt || '').slice(0, 2000),
    output: String(rec.output || '').slice(0, 5000),
    meta: rec.meta && typeof rec.meta === 'object' ? rec.meta : {},
    createdAt: new Date().toISOString(),
  }
  list.unshift(item)
  saveHistory(list.slice(0, HISTORY_MAX))
  return item
}

let loginCompleteRunning = false
function startLoginComplete() {
  if (loginCompleteRunning) return
  loginCompleteRunning = true
  const child = spawn(
    'qianwen',
    ['auth', 'login', '--complete', '--format', 'json'],
    { stdio: 'ignore', detached: true },
  )
  child.on('exit', () => {
    loginCompleteRunning = false
  })
  child.unref()
}

let loginWatcher = null
let pendingLoginUrl = null
let pendingLoginAt = 0
const PENDING_LOGIN_TTL = 4 * 60 * 1000

function resetPendingLogin() {
  pendingLoginUrl = null
  pendingLoginAt = 0
  if (loginWatcher) {
    clearInterval(loginWatcher)
    loginWatcher = null
  }
}

function ensureLoginPoll() {
  if (loginWatcher) return
  loginWatcher = setInterval(() => {
    const st = runCli(['auth', 'status', '--format', 'json'])
    let authenticated = false
    try {
      authenticated = JSON.parse(st.stdout).authenticated === true
    } catch {
      // ignore
    }
    if (authenticated) {
      resetPendingLogin()
    }
  }, 5000)
}

function ensureCliLogin() {
  const auth = runCli(['auth', 'status', '--format', 'json'])
  if (!auth.ok) {
    return {
      ok: false,
      reason: auth.reason,
      hint: 'qianwen CLI 未安装，请在服务器执行 npm install -g @qianwenai/qianwen-cli',
    }
  }
  let authenticated = false
  try {
    authenticated = JSON.parse(auth.stdout).authenticated === true
  } catch {
    // ignore
  }
  if (authenticated) {
    resetPendingLogin()
    return { ok: true }
  }
  // 复用未过期的授权链接，避免重复 init-only 覆盖设备码导致已授权失效
  if (!pendingLoginUrl || Date.now() - pendingLoginAt > PENDING_LOGIN_TTL) {
    let verificationUrl = ''
    const init = runCli(['auth', 'login', '--init-only', '--format', 'json'])
    try {
      const events = JSON.parse(init.stdout).events || []
      const deviceCode = events.find((e) => e.event === 'device_code')
      verificationUrl = deviceCode?.verification_url || ''
    } catch {
      // ignore
    }
    pendingLoginUrl = verificationUrl
    pendingLoginAt = Date.now()
  }
  startLoginComplete()
  ensureLoginPoll()
  return { ok: false, reason: 'needs_login', verificationUrl: pendingLoginUrl }
}

async function getUsage(res, period = 'month') {
  const login = ensureCliLogin()
  if (!login.ok) {
    sendJson(res, 200, {
      available: false,
      reason: login.reason,
      verificationUrl: login.verificationUrl,
      hint: login.hint,
    })
    return
  }
  const summary = runCli(['usage', 'summary', '--period', period, '--format', 'json'])
  if (!summary.ok) {
    sendJson(res, 200, { available: false, reason: summary.reason })
    return
  }
  let parsed = null
  try {
    parsed = JSON.parse(summary.stdout)
  } catch {
    // ignore
  }
  sendJson(res, 200, { available: true, summary: parsed })
}

function getUsageLogs(res, period = '24h', pageSize = '20') {
  const login = ensureCliLogin()
  if (!login.ok) {
    sendJson(res, 200, {
      available: false,
      reason: login.reason,
      verificationUrl: login.verificationUrl,
      hint: login.hint,
    })
    return
  }
  const logs = runCli([
    'usage',
    'logs',
    '--period',
    period,
    '--page',
    '1',
    '--page-size',
    pageSize,
    '--format',
    'json',
  ])
  let parsed = null
  try {
    parsed = JSON.parse(logs.stdout)
  } catch {
    // ignore
  }
  sendJson(res, 200, { available: true, items: parsed?.items || [] })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')

  if (url.pathname === '/api/health') {
    const builtin = isBuiltinMode(req)
    const rec = builtin ? quotaRec(req) : null
    sendJson(res, 200, {
      ok: true,
      keyProvided: Boolean(bearerKey(req)),
      serverKeyConfigured: Boolean(API_KEY),
      builtinQuota: rec
        ? {
            chat: {
              limit: BUILTIN_QUOTA.chat,
              remaining: Math.max(0, BUILTIN_QUOTA.chat - rec.chat),
            },
            image: {
              limit: BUILTIN_QUOTA.image,
              remaining: Math.max(0, BUILTIN_QUOTA.image - rec.image),
            },
          }
        : null,
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/chat') {
    const q = quotaStatus(req, 'chat')
    if (q && !q.allowed) return sendQuotaError(res, 'chat')
    const body = await readBody(req)
    if (!body) return sendJson(res, 400, { error: '请求体不是合法 JSON' })
    const { messages, model, temperature } = body
    const payload = { model: model || 'qwen3.7-plus', messages }
    if (typeof temperature === 'number') payload.temperature = temperature
    return proxyUpstream(res, '/compatible-mode/v1/chat/completions', payload, resolveApiKey(req), {
      onSuccess: () => quotaInc(req, 'chat'),
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/image') {
    const q = quotaStatus(req, 'image')
    if (q && !q.allowed) return sendQuotaError(res, 'image')
    const body = await readBody(req)
    if (!body) return sendJson(res, 400, { error: '请求体不是合法 JSON' })
    const model = body.model || 'wan2.6-t2i'
    const onSuccess = () => quotaInc(req, 'image')
    // qwen-image-3.0 系列走多模态生成接口（size 格式为 <width>*<height>）
    if (model.startsWith('qwen-image-3.0')) {
      const payload = {
        model,
        input: {
          messages: [{ role: 'user', content: [{ text: body.prompt }] }],
        },
        parameters: {
          size: body.size || '1024*1024',
          n: body.count || 1,
        },
      }
      if (body.negative_prompt) {
        payload.parameters.negative_prompt = body.negative_prompt
      }
      return proxyUpstream(
        res,
        '/api/v1/services/aigc/multimodal-generation/generation',
        payload,
        resolveApiKey(req),
        { onSuccess },
      )
    }
    if (model.startsWith('wan') || model.startsWith('qwen-image-2.0')) {
      const payload = {
        model,
        input: {
          messages: [{ role: 'user', content: [{ text: body.prompt }] }],
        },
        parameters: {
          size: body.size || '1280*1280',
          n: body.count || 1,
        },
      }
      if (body.negative_prompt) {
        payload.parameters.negative_prompt = body.negative_prompt
      }
      return proxyUpstream(
        res,
        '/api/v1/services/aigc/multimodal-generation/generation',
        payload,
        resolveApiKey(req),
        { onSuccess },
      )
    }
    return proxyAsyncImage(
      res,
      {
        model,
        input: { prompt: body.prompt },
        parameters: { size: body.size || '1328*1328', n: 1 },
      },
      resolveApiKey(req),
      { onSuccess },
    )
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/vision') {
    if (isBuiltinMode(req)) return sendModeRestricted(res)
    const body = await readBody(req)
    if (!body) return sendJson(res, 400, { error: '请求体不是合法 JSON' })
    const content = []
    if (body.image) {
      content.push({ type: 'image_url', image_url: { url: body.image } })
    }
    content.push({ type: 'text', text: body.prompt || '请分析这张图片' })
    const payload = {
      model: body.model || 'qwen3.7-plus',
      messages: [{ role: 'user', content }],
    }
    return proxyUpstream(res, '/compatible-mode/v1/chat/completions', payload, resolveApiKey(req))
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/video') {
    if (isBuiltinMode(req)) return sendModeRestricted(res)
    const body = await readBody(req)
    if (!body) return sendJson(res, 400, { error: '请求体不是合法 JSON' })
    const model = body.model || 'wan2.6-t2v'
    const prompt = body.prompt || ''
    const duration = body.duration || 5
    if (!prompt.trim()) return sendJson(res, 400, { error: '提示词不能为空' })
    const apiKey = resolveApiKey(req)
    if (!apiKey) {
      sendJson(res, 401, {
        error: 'API Key 未配置',
        hint: '内置模式需在服务端 .env 配置 Key，或切换自定义模型在设置页填入 Key',
      })
      return
    }
    const payload = {
      model,
      input: { prompt },
      parameters: { duration },
    }
    if (body.size) payload.parameters.size = body.size
    try {
      const submit = await fetch(`${BASE}/api/v1/services/aigc/video-generation/video-synthesis`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify(payload),
      })
      const submitData = await submit.json()
      const taskId = submitData.output?.task_id
      if (!taskId) {
        return sendJson(res, submit.status >= 400 ? submit.status : 502, {
          error: submitData.code || submitData.message || '视频任务提交失败',
          output: submitData.output,
        })
      }
      videoTasks.set(taskId, { model, duration, prompt })
      return sendJson(res, 200, {
        task_id: taskId,
        model,
        duration,
        status: 'PENDING',
      })
    } catch (err) {
      return sendJson(res, 502, {
        error: '视频任务提交失败',
        detail: String(err.message || err),
      })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/v1/video/task/')) {
    const taskId = decodeURIComponent(url.pathname.slice('/api/v1/video/task/'.length))
    const apiKey = resolveApiKey(req)
    if (!apiKey) {
      return sendJson(res, 401, { error: 'API Key 未配置' })
    }
    const meta = videoTasks.get(taskId) || { model: '', duration: 5, prompt: '' }
    try {
      const poll = await fetch(`${BASE}/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const pollData = await poll.json()
      const status = pollData.output?.task_status || 'PENDING'
      if (status === 'SUCCEEDED' && !videoRecorded.has(taskId)) {
        videoRecorded.add(taskId)
        try {
          addHistoryRecord({
            type: 'video',
            model: meta.model,
            prompt: meta.prompt,
            output: pollData.output?.video_url || '',
            meta: { duration: meta.duration, task_id: taskId },
          })
        } catch {
          // 历史记录失败不影响结果返回
        }
      }
      return sendJson(res, 200, {
        status,
        model: meta.model,
        duration: meta.duration,
        prompt: meta.prompt,
        video_url: status === 'SUCCEEDED' ? pollData.output?.video_url || '' : '',
        error: status === 'FAILED' ? pollData.output?.message || pollData.message || '视频生成失败' : '',
      })
    } catch (err) {
      return sendJson(res, 502, {
        error: '任务状态查询失败',
        detail: String(err.message || err),
      })
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/v1/video/download/')) {
    const taskId = decodeURIComponent(url.pathname.slice('/api/v1/video/download/'.length))
    const apiKey = resolveApiKey(req)
    if (!apiKey) {
      return sendJson(res, 401, { error: 'API Key 未配置' })
    }
    try {
      const poll = await fetch(`${BASE}/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const pollData = await poll.json()
      const videoUrl = pollData.output?.video_url || ''
      if (pollData.output?.task_status !== 'SUCCEEDED' || !videoUrl) {
        return sendJson(res, 404, { error: '视频尚未生成完成' })
      }
      const up = await fetch(videoUrl)
      if (!up.ok) {
        return sendJson(res, 502, { error: '视频文件获取失败' })
      }
      const buf = Buffer.from(await up.arrayBuffer())
      res.writeHead(200, {
        'Content-Type': up.headers.get('content-type') || 'video/mp4',
        'Content-Length': buf.length,
        'Content-Disposition': `attachment; filename="qwen-video-${taskId.slice(0, 8)}.mp4"`,
      })
      res.end(buf)
      return
    } catch (err) {
      return sendJson(res, 502, {
        error: '视频下载失败',
        detail: String(err.message || err),
      })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/audio') {
    if (isBuiltinMode(req)) return sendModeRestricted(res)
    const body = await readBody(req)
    if (!body) return sendJson(res, 400, { error: '请求体不是合法 JSON' })
    const voice = body.voice || 'Cherry'
    const payload = {
      model: body.model || 'qwen3-tts-flash',
      input: { text: body.text, voice },
    }
    if (!resolveApiKey(req)) {
      sendJson(res, 401, {
        error: 'API Key 未配置',
        hint: '内置模式需在服务端 .env 配置 Key，或切换自定义模型在设置页填入 Key',
      })
      return
    }
    try {
      const upstream = await fetch(
        `${BASE}/api/v1/services/aigc/multimodal-generation/generation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resolveApiKey(req)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )
      const data = await upstream.json()
      const audio = data.output?.audio || {}
      const audioUrl = audio.url || ''
      if (upstream.status >= 400 || !audioUrl) {
        sendJson(res, upstream.status >= 400 ? upstream.status : 502, {
          error: data.code || data.message || '语音合成失败',
          output: data.output,
        })
        return
      }
      const secs = Math.max(
        1,
        Math.round(((body.text?.length || 0) * 0.28) / (body.speed || 1)),
      )
      sendJson(res, 200, {
        voice,
        audioUrl,
        sampleRate: audio.sample_rate || 24000,
        duration: `${secs} 秒`,
      })
    } catch (err) {
      sendJson(res, 502, {
        error: '上游请求失败',
        detail: String(err.message || err),
      })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/v1/models/verify') {
    const body = await readBody(req)
    const password = String(body?.password || '')
    if (password && password === MODEL_PASSWORD) {
      const token = crypto.randomBytes(16).toString('hex')
      verifiedTokens.add(token)
      return sendJson(res, 200, { ok: true, token })
    }
    return sendJson(res, 200, { ok: false })
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/models/benefits') {
    const customKey = bearerKey(req)
    if (customKey) {
      // 自定义模型模式：按该 Key 实时校验并刷新（免费额度明细官方无按 Key 的公开接口，
      // 数据来自服务端 CLI 账号；同一账号下即为该 Key 的额度）
      const check = await validateApiKey(customKey)
      if (!check.ok) {
        return sendJson(res, 200, { available: false, reason: 'key_invalid', hint: check.hint })
      }
      const r = refreshModelBenefits()
      if (!r.ok && !modelBenefits) {
        return sendJson(res, 200, { available: false, reason: r.reason })
      }
    } else if (!modelBenefits || Date.now() - benefitsCheckedAt > BENEFITS_CACHE_TTL) {
      const r = refreshModelBenefits()
      if (!r.ok && !modelBenefits) {
        return sendJson(res, 200, { available: false, reason: r.reason })
      }
    }
    if (!customKey) {
      // 内置模型模式：未通过密码验证时返回模糊数据
      const authed = verifiedTokens.has(String(req.headers['x-model-token'] || ''))
      if (!authed) {
        return sendJson(res, 200, { available: true, ...maskBenefits(modelBenefits) })
      }
    }
    return sendJson(res, 200, { available: true, ...modelBenefits })
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/usage') {
    if (isBuiltinMode(req)) return sendModeRestricted(res)
    const period = url.searchParams.get('period') || 'month'
    return getUsage(res, period)
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/usage/logs') {
    if (isBuiltinMode(req)) return sendModeRestricted(res)
    const period = url.searchParams.get('period') || '24h'
    const pageSize = url.searchParams.get('pageSize') || '20'
    return getUsageLogs(res, period, pageSize)
  }

  // ---- 历史记录接口（云端缓存） ----
  if (req.method === 'POST' && url.pathname === '/api/v1/history') {
    const body = await readBody(req)
    if (!body || !body.type) return sendJson(res, 400, { error: '缺少 type 字段' })
    const item = addHistoryRecord(body)
    return sendJson(res, 200, { ok: true, id: item.id })
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/history') {
    let list = loadHistory()
    const type = url.searchParams.get('type')
    if (type) list = list.filter((r) => r.type === type)
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500)
    return sendJson(res, 200, { items: list.slice(0, limit) })
  }

  if (req.method === 'DELETE' && url.pathname === '/api/v1/history') {
    const id = url.searchParams.get('id')
    if (id) {
      saveHistory(loadHistory().filter((r) => r.id !== id))
      return sendJson(res, 200, { ok: true })
    }
    saveHistory([])
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'GET') {
    return serveStatic(req, res)
  }

  sendJson(res, 404, { error: 'Not Found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`QianWen backend listening on http://0.0.0.0:${PORT}`)
  console.log(`API key: builtin(${API_KEY ? 'configured' : 'not set'}) / custom via Authorization header`)
  console.log(`Static dir: ${DIST}`)
  const first = refreshModelBenefits()
  console.log(
    `免费模型额度检查：${first.ok ? '刷新成功（' + (modelBenefits.models || []).length + ' 个模型）' : '暂不可用（' + first.reason + '），04:00 自动重试'}`,
  )
  scheduleBenefitsCheck()
  console.log('已排定每日 04:00 免费模型额度自动检查')
})
