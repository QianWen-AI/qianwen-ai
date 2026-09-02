import { useRef, useState } from 'react'
import { AudioLines, Play, Square, Download } from 'lucide-react'
import { mockApi, getApiMode } from '../services/mockApi.js'
import {
  Card,
  Button,
  Textarea,
  Select,
  EmptyState,
  Spinner,
  Badge,
  ModeRestrictedBanner,
} from '../components/ui.jsx'

const VOICES = [
  { id: 'Cherry', label: 'Cherry · 温暖女声（推荐）' },
  { id: 'Ethan', label: 'Ethan · 沉稳男声' },
  { id: 'Serena', label: 'Serena · 知性女声' },
]

const SAMPLES = [
  '好的故事，往往从一个恰到好处的停顿开始。',
  '欢迎收听今天的晨间播报，先来看看天气与要闻。',
  '科技向善，我们一直在探索人工智能的更多可能。',
  '读书，是在别人的世界里，遇见更好的自己。',
]

function playTone(durationSec = 3, speed = 1) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.0001, now)

  const notes = [
    [523.25, 0, 0.5],
    [659.25, 0.5, 0.5],
    [783.99, 1.0, 0.5],
    [1046.5, 1.5, 0.9],
  ]
  notes.forEach(([freq, start, dur]) => {
    const osc = ctx.createOscillator()
    const noteGain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(noteGain)
    noteGain.connect(gain)
    noteGain.gain.setValueAtTime(0.0001, now + start)
    noteGain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.05)
    noteGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + start + dur,
    )
    osc.start(now + start)
    osc.stop(now + start + dur + 0.05)
  })
  const stopAt = now + Math.min(durationSec, 4) / speed + 0.2
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
  return { ctx, stopAt }
}

export default function AudioTTS() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('Cherry')
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [playing, setPlaying] = useState(false)
  const ctxRef = useRef(null)
  const audioRef = useRef(null)

  async function synthesize() {
    const t = text.trim()
    if (!t || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await mockApi.synthesizeSpeech(t, { voice, speed })
      setResult(res)
      mockApi
        .recordHistory({
          type: 'audio',
          model: 'qwen3-tts-flash',
          prompt: t,
          output: res.audioUrl || '',
          meta: { voice: res.voice, duration: res.duration },
        })
        .catch(() => {})
    } finally {
      setLoading(false)
    }
  }

  function stop() {
    audioRef.current?.pause()
    audioRef.current = null
    ctxRef.current?.ctx.close()
    ctxRef.current = null
    setPlaying(false)
  }

  function togglePlay() {
    if (playing) {
      stop()
      return
    }
    if (result?.audioUrl) {
      const audio = new Audio(result.audioUrl)
      audioRef.current = audio
      audio.onended = () => setPlaying(false)
      audio.onerror = () => setPlaying(false)
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
      return
    }
    const tone = playTone(result?.duration ? 4 : 3, speed)
    ctxRef.current = tone
    setPlaying(true)
    setTimeout(stop, (tone.stopAt - tone.ctx.currentTime) * 1000 + 300)
  }

  return (
    <div className="space-y-4">
      {getApiMode() === 'builtin' && <ModeRestrictedBanner />}
      <div className="flex flex-col gap-4 lg:h-[calc(100vh-10rem)] lg:flex-row lg:gap-6">
      <Card className="flex w-full shrink-0 flex-col lg:w-[320px] lg:overflow-y-auto">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-base font-semibold text-slate-900">合成配置</h3>
        </div>
        <div className="flex-1 space-y-4 p-5">
          <Textarea
            label="合成文本"
            id="tts-text"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入需要转为语音的文字…"
            hint={`${text.length} / 5000 字符`}
          />
          <Select label="音色" id="tts-voice" value={voice} onChange={(e) => setVoice(e.target.value)}>
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select label="语速" id="tts-speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={0.75}>0.75× 慢速</option>
            <option value={1}>1× 标准</option>
            <option value={1.25}>1.25× 较快</option>
            <option value={1.5}>1.5× 快速</option>
          </Select>
          <Button onClick={synthesize} disabled={loading || !text.trim()} className="w-full">
            {loading ? (
              <>
                <Spinner /> 正在合成…
              </>
            ) : (
              <>
                <AudioLines className="h-4 w-4" aria-hidden="true" />
                开始合成
              </>
            )}
          </Button>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">试试这些文本</p>
            <div className="space-y-2">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setText(s)}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-primary/40 hover:bg-blue-50/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex min-h-[320px] min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">合成结果</h3>
            {result && (
              <p className="mt-0.5 text-xs text-slate-400">
                {result.voice} · {result.duration} · {result.sampleRate}
              </p>
            )}
          </div>
          {result && <Badge color="bg-emerald-50 text-emerald-600">合成完成</Badge>}
        </div>

        {!result && !loading ? (
          <EmptyState
            icon={<AudioLines className="h-6 w-6" aria-hidden="true" />}
            title="还没有合成语音"
            description="在左侧输入文本并点击「开始合成」，试听结果会显示在这里。"
          />
        ) : loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <div className="h-24 w-full max-w-xl animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
            <div className="flex w-full max-w-2xl flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
              <button
                onClick={togglePlay}
                className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-200 transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                aria-label={playing ? '停止播放' : '播放'}
              >
                {playing ? (
                  <Square className="h-5 w-5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {result.voice} · {result.duration}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {text}
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-full shrink-0 sm:w-auto"
                onClick={() => (result?.audioUrl ? window.open(result.audioUrl, '_blank') : stop())}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                下载
              </Button>
            </div>
            {!result?.audioUrl && (
              <p className="text-xs text-slate-400">
                当前为演示音效，接入真实 TTS API 后将输出完整合成音频。
              </p>
            )}
          </div>
        )}
      </Card>
      </div>
    </div>
  )
}
