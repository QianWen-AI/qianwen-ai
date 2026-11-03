import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, Info, CircuitBoard, RefreshCw } from 'lucide-react'
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Input,
} from '../components/ui.jsx'
import { getApiMode, setApiMode, getApiKey, setApiKey, mockApi } from '../services/mockApi.js'

function StateRow({ label, desc, value, color }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
      </div>
      <Badge color={color}>{value}</Badge>
    </div>
  )
}

function ModeSwitch({ mode, onChange }) {
  const options = [
    { id: 'builtin', label: '内置模型' },
    { id: 'custom', label: '自定义模型' },
    { id: 'mock', label: 'Mock 演示' },
  ]
  return (
    <div className="flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="接口模式">
      {options.map((opt) => (
        <button
          key={opt.id}
          role="tab"
          aria-selected={mode === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
            mode === opt.id
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Settings() {
  const [mode, setMode] = useState(getApiMode())
  const [health, setHealth] = useState(null)
  const [checking, setChecking] = useState(false)
  const [keyInput, setKeyInput] = useState(getApiKey())
  const [saved, setSaved] = useState(false)

  async function check() {
    setChecking(true)
    const result = await mockApi.getHealth()
    setHealth(result)
    setChecking(false)
  }

  function handleModeChange(next) {
    setMode(next)
    setApiMode(next)
  }

  function handleSaveKey() {
    const key = keyInput.trim()
    setApiKey(key)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (key) check()
  }

  const modeDesc = {
    builtin: {
      desc: '使用服务端 .env 中的 DASHSCOPE_API_KEY，每 IP 每日免费体验：对话 10 次、图片 2 次。',
      badge:
        health &&
        (health.serverKeyConfigured ? (
          <Badge color="bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            服务端已配置
          </Badge>
        ) : (
          <Badge color="bg-amber-50 text-amber-600">
            <KeyRound className="h-3 w-3" aria-hidden="true" />
            服务端未配置 Key
          </Badge>
        )),
    },
    custom: {
      desc: '使用浏览器中保存的 Key，随请求 Authorization 头临时转发，服务器不记录。',
      badge:
        health &&
        (health.keyProvided ? (
          <Badge color="bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            浏览器已配置
          </Badge>
        ) : (
          <Badge color="bg-amber-50 text-amber-600">
            <KeyRound className="h-3 w-3" aria-hidden="true" />
            未配置 Key
          </Badge>
        )),
    },
    mock: {
      desc: '全部功能返回内置演示数据，不发起任何网络请求。',
      badge: (
        <Badge color="bg-slate-100 text-slate-500">
          <CircuitBoard className="h-3 w-3" aria-hidden="true" />
          Mock 演示
        </Badge>
      ),
    },
  }[mode]

  useEffect(() => {
    check()
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader
          title="API Key 配置"
          subtitle="认证状态与接口模式（qianwen-ops-auth）"
          action={health ? modeDesc.badge : <Badge color="bg-slate-100 text-slate-500">检测中…</Badge>}
        />
        <div className="space-y-5 p-6">
          <div className="rounded-2xl bg-slate-50 p-4">
            <StateRow
              label="认证方式"
              desc={
                mode === 'builtin'
                  ? '服务端从 .env 读取 DASHSCOPE_API_KEY'
                  : mode === 'custom'
                    ? 'Key 仅保存在浏览器 localStorage，随请求头临时传给无状态后端代理'
                    : '不发起任何网络请求'
              }
              value={mode === 'builtin' ? '服务端配置' : mode === 'custom' ? '前端配置' : 'Mock'}
              color={
                mode === 'mock'
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-blue-50 text-blue-600'
              }
            />
            <StateRow
              label="密钥类型"
              desc="仅支持标准 sk- 开头的按量付费密钥"
              value="标准密钥"
              color="bg-slate-100 text-slate-600"
            />
            <StateRow
              label="健康检查"
              desc="检测后端代理与 DashScope 的连通性"
              value={health ? (health.ok ? '正常' : '异常') : '…'}
              color={
                health
                  ? health.ok
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                  : 'bg-slate-100 text-slate-500'
              }
            />
            {mode === 'builtin' && health?.builtinQuota && (
              <StateRow
                label="今日免费额度"
                desc="内置模型模式每日配额（每 IP）"
                value={`对话 ${health.builtinQuota.chat.remaining}/${health.builtinQuota.chat.limit} · 图片 ${health.builtinQuota.image.remaining}/${health.builtinQuota.image.limit}`}
                color="bg-blue-50 text-blue-600"
              />
            )}
            {mode === 'builtin' && (
              <StateRow
                label="可用能力"
                desc="视觉理解、视频生成、语音合成、用量账单需自定义 API-Key"
                value="对话 · 图像"
                color="bg-slate-100 text-slate-600"
              />
            )}
          </div>

          <div>
            <p className="mb-1.5 block text-sm font-medium text-slate-700">
              接口模式
            </p>
            <ModeSwitch mode={mode} onChange={handleModeChange} />
            <p className="mt-1.5 text-xs text-slate-400">{modeDesc.desc}</p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label={
                  mode === 'custom'
                    ? 'DashScope API Key（浏览器保存）'
                    : 'DashScope API Key'
                }
                id="api-key"
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                disabled={mode !== 'custom'}
                placeholder={
                  mode === 'builtin'
                    ? '内置模式：由服务端 .env 提供，无需填写'
                    : mode === 'mock'
                      ? 'Mock 模式：无需 Key'
                      : '输入 sk- 开头的 DashScope API Key'
                }
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleSaveKey}
              disabled={mode !== 'custom' || !keyInput.trim()}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {saved ? '已保存' : '保存 Key'}
            </Button>
            <Button variant="secondary" onClick={check} disabled={checking}>
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              重新检测
            </Button>
          </div>
          <p className="-mt-3 text-xs text-slate-400">
            {mode === 'builtin'
              ? '内置模型模式读取服务端 .env 的 DASHSCOPE_API_KEY，前端无需配置；如未配置请到服务器环境变量中添加后重启服务。'
              : mode === 'custom'
                ? 'Key 仅存于浏览器（localStorage），后端代理不记录、不持久化；请求时通过 Authorization 头临时携带。注意 localStorage 存在 XSS 风险，勿在不信任环境使用。'
                : 'Mock 演示模式返回内置模拟数据，无需配置 Key。'}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="接入说明"
          subtitle="真实接口的接入范围与配置方式"
          action={
            <Badge color="bg-slate-100 text-slate-500">
              <CircuitBoard className="h-3 w-3" aria-hidden="true" />
              API Ready
            </Badge>
          }
        />
        <div className="space-y-4 p-6">
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              1
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              内置模型：服务端读取{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                .env
              </code>{' '}
              中的{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                DASHSCOPE_API_KEY
              </code>
              ，仅开放文本对话（每日 10 次/IP）与图像生成（每日 2 次/IP），其他能力请配置自定义 API-Key 后使用。
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              2
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              自定义模型：在设置页输入{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                sk- 开头
              </code>{' '}
              的 DashScope API Key 并点击「保存 Key」，Key 仅存于浏览器
              localStorage，随 Authorization 头临时转发，服务器不记录、不持久化。
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              3
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Mock 演示：全部功能返回内置模拟数据，不发起任何网络请求，适合演示与开发调试。三种模式切换后全站功能（对话、图像、视觉、视频、语音、总览、用量）自动跟随更新。
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="关于" />
        <div className="flex items-start gap-4 p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-white">
            <Info className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">
              QianWen AI Console v0.2.0
            </p>
            <p className="mt-1">
              面向 QianWen AI Skills 的可视化操作台，能力来自开源项目
              <span className="font-medium text-slate-800"> QianWen-AI/qianwen-ai</span>
              。
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
