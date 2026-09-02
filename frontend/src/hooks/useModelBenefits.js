import { useCallback, useEffect, useState } from 'react'
import { mockApi, getApiMode, getApiKey, getDefaultModels } from '../services/mockApi.js'

export function useModelBenefits() {
  const mode = getApiMode()
  const hasKey = Boolean(getApiKey())
  const [benefits, setBenefits] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  useEffect(() => {
    let alive = true
    setBenefits(null)
    setError(null)
    setLoading(true)
    if (mode === 'mock') {
      setLoading(false)
      return () => {
        alive = false
      }
    }
    // 自定义模式未配置 Key：不请求，由页面引导先配置
    if (mode === 'custom' && !hasKey) {
      setLoading(false)
      return () => {
        alive = false
      }
    }
    mockApi
      .getModelBenefits()
      .then((d) => {
        if (alive) setBenefits(d)
      })
      .catch((e) => {
        if (alive) setError(e?.message || '模型信息加载失败')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [mode, hasKey, nonce])
  return { benefits, error, mode, hasKey, refresh, loading }
}

export function catModels(benefits, category) {
  return benefits?.categories?.[category]?.models || []
}

export function daysUntil(resetDate) {
  if (!resetDate) return null
  const ms = new Date(resetDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export function isFreeValid(m) {
  return m && m.status === 'valid' && m.resetDate && m.resetDate > new Date().toISOString()
}

// 默认模型排除规则：语音类默认仅从纯语音合成(TTS)选，排除识别/翻译/音乐/对话；视觉类排除实时翻译/语音对话
const DEFAULT_EXCLUDE = {
  audio: /(paraformer|sensevoice|fun-asr|asr|livetranslate|realtime|fun-music|music)/i,
  vision: /(livetranslate|realtime)/i,
}

// 同类模型中快过期的优先（resetDate 升序第一个）
export function pickRecommended(benefits, category) {
  const ex = DEFAULT_EXCLUDE[category]
  const list = catModels(benefits, category)
    .filter((m) => isFreeValid(m) && (!ex || !ex.test(m.id)))
    .sort((a, b) => new Date(a.resetDate) - new Date(b.resetDate))
  return list[0] || null
}

export function modelInfo(benefits, id) {
  const cats = benefits?.categories || {}
  for (const key of Object.keys(cats)) {
    const hit = cats[key].models.find((m) => m.id === id)
    if (hit) return hit
  }
  return null
}

// 分类模型列表（与模型中心同源同序）：免费额度有效优先，同类按到期时间升序
export function categoryModels(benefits, category) {
  return catModels(benefits, category).slice().sort((a, b) => {
    const av = isFreeValid(a) ? 0 : 1
    const bv = isFreeValid(b) ? 0 : 1
    if (av !== bv) return av - bv
    if (isFreeValid(a) && isFreeValid(b)) {
      return new Date(a.resetDate) - new Date(b.resetDate)
    }
    return 0
  })
}

export function freeSuffix(benefits, id) {
  const m = modelInfo(benefits, id)
  if (!isFreeValid(m)) return ''
  const d = daysUntil(m.resetDate)
  return d != null && d > 0 ? ` · 免费额度 ${d} 天后到期` : ''
}

// 功能页默认模型（与模型中心选中逻辑同源）：手动配置（分类中存在即生效）→ 系统自动推荐 → 列表首个 → fallback
export function resolveDefaultModel(benefits, category, fallback) {
  const manual = getDefaultModels()[category]
  if (!benefits) return manual || fallback
  if (manual && modelInfo(benefits, manual)) return manual
  const auto = pickRecommended(benefits, category)?.id
  if (auto) return auto
  return categoryModels(benefits, category)[0]?.id || fallback
}

export function formatFreeTier(m) {
  if (!m) return null
  if (m.masked) {
    return { label: '免费额度', status: 'masked' }
  }
  if (isFreeValid(m)) {
    const d = daysUntil(m.resetDate)
    const pct = m.usedPct != null ? m.usedPct : 0
    return {
      label: '免费额度',
      status: 'valid',
      unit: m.unit,
      remaining: m.remaining,
      consumed: m.consumed,
      total: m.total,
      usedPct: pct,
      daysLeft: d,
      resetDate: m.resetDate,
    }
  }
  if (m.status === 'expire') {
    return {
      label: '免费额度',
      status: 'expired',
      unit: m.unit,
      consumed: m.consumed,
      usedPct: m.usedPct != null ? m.usedPct : 100,
      resetDate: m.resetDate,
    }
  }
  return null
}
