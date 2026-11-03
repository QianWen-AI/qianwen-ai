import { useEffect, useState } from 'react'
import { ChartColumn, Coins, Wallet, Percent, KeyRound } from 'lucide-react'
import {
  mockApi,
  formatTokens,
  mapUsageSummary,
  getApiMode,
} from '../services/mockApi.js'
import { Card, CardHeader, Badge, Spinner } from '../components/ui.jsx'

function TrendChart({ data }) {
  const max = Math.max(...data)
  const labels = ['1日', '8日', '16日', '24日', '31日']
  return (
    <div className="mt-4">
      <div className="flex h-44 items-end justify-between gap-1.5">
        {data.map((v, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
              {(v / 1000).toFixed(1)}k
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-primary/70 to-primary-light transition-all duration-300 group-hover:from-primary group-hover:to-cyan-400"
              style={{ height: `${(v / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  )
}

function Donut({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  let acc = 0
  const segments = parts.map((p) => {
    const start = acc
    acc += p.value
    return { ...p, start }
  })
  const COLORS = ['#2563EB', '#3B82F6', '#06B6D4', '#8B5CF6', '#CBD5E1']
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" className="h-36 w-36 -rotate-90">
        <circle cx="21" cy="21" r="15.9" fill="none" strokeWidth="7" />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth="7"
            strokeDasharray={`${(seg.value / total) * 100} ${100 - (seg.value / total) * 100}`}
            strokeDashoffset={`${-(seg.start / total) * 100}`}
          />
        ))}
      </svg>
      <ul className="flex-1 space-y-2">
        {parts.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 truncate text-slate-600">{p.name}</span>
            <span className="font-semibold text-slate-800">
              {Math.round((p.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Usage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    if (getApiMode() === 'builtin') {
      setData({ builtinOnly: true })
      return () => {
        alive = false
      }
    }
    mockApi.getUsage().then((res) => {
      if (!alive) return
      if (res.available === false) {
        setData({ real: true, unavailable: true, reason: res.reason, verificationUrl: res.verificationUrl, hint: res.hint })
      } else if (res.available === true) {
        setData(mapUsageSummary(res.summary))
      } else {
        setData(res)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  if (data.builtinOnly) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-primary">
          <KeyRound className="h-7 w-7" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">内置模型模式不支持用量账单</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          内置模型模式仅开放文本对话与图像生成的免费体验额度，用量账单暂不支持查看。
        </p>
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          请配置自定义 API-Key 后使用
        </p>
      </Card>
    )
  }

  if (data.unavailable) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-primary">
          <Wallet className="h-7 w-7" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          {data.reason === 'needs_login' ? '需要登录 QianWen CLI' : '用量数据不可用'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {data.reason === 'needs_login'
            ? '用量账单通过 QianWen CLI 查询，需要先在浏览器中完成设备授权。'
            : data.hint || '请检查服务器上的 QianWen CLI 状态。'}
        </p>
        {data.verificationUrl && (
          <a
            href={data.verificationUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            前往授权
          </a>
        )}
        {data.reason === 'needs_login' && (
          <p className="mt-4 text-xs text-slate-400">
            授权完成后刷新本页面即可看到用量数据（后台会自动检测登录状态）。
          </p>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <ChartColumn className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">本月总 Token</p>
            <p className="text-xl font-bold text-slate-900">{data.totalTokens}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">本月消费</p>
            <p className="text-xl font-bold text-slate-900">{data.spend}</p>
            <p className="text-xs text-slate-400">预算 {data.budget}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Percent className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">免费额度</p>
            <p className="text-xl font-bold text-slate-900">
              已用 {data.quota.used}%
            </p>
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                style={{ width: `${data.quota.used}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={data.tokenTrend.length ? 'Token 消耗趋势' : '免费额度'}
            subtitle={
              data.tokenTrend.length
                ? '最近 12 天的日均消耗（单位：万 Token）'
                : '各模型本月剩余免费额度'
            }
            action={<Badge color="bg-blue-50 text-blue-600">{data.month}</Badge>}
          />
          <div className="px-6 pb-6">
            {data.tokenTrend.length ? (
              <TrendChart data={data.tokenTrend} />
            ) : (
              <ul className="space-y-3">
                {data.freeTier.length ? (
                  data.freeTier.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {f.model_id}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          剩余 {formatTokens(f.remaining)} /{' '}
                          {formatTokens(f.total)} {f.unit}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        {f.used_pct}%
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="py-8 text-center text-sm text-slate-400">
                    暂无免费额度数据
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="模型占比" subtitle="按消费金额占比" />
          <div className="px-6 pb-6">
            <Donut parts={data.modelBreakdown} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="最近账单"
          subtitle="按日聚合的模型消费明细"
          action={
            <Badge color="bg-slate-100 text-slate-500">
              <Coins className="h-3 w-3" aria-hidden="true" />
              计费周期：自然月
            </Badge>
          }
        />
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">模型</th>
                <th className="px-4 py-3 font-medium">用量</th>
                <th className="px-4 py-3 text-right font-medium">费用</th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 text-slate-500">{b.date}</td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                    {b.model}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {b.tokens ?? b.images}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {b.cost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
