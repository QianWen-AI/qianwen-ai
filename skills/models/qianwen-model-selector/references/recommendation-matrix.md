# Recommendation Matrix — qianwen-model-selector

Detailed model recommendation tables. SKILL.md keeps only the canonical `Default` table; this file
provides the in-depth selection logic for cross-skill resolution and per-domain comparison.

> **Reminder**: For latest model availability and pricing, always prefer CLI (`qianwen models list/info/search`).
> See [cli-usage.md](cli-usage.md) for when CLI is required vs. when these snapshot tables are acceptable.

## Cross-Skill Model Resolution

> **Precondition**: Before evaluating dimensions below, determine the user's key type using
> [SKILL.md § Detecting Key Type](../SKILL.md#detecting-key-type). If the key is
> Token Plan (`sk-sp-`), restrict the candidate set to the
> [Token Plan Models](#token-plan-models) section below — do not offer PAYG-only models.

When an execution skill needs to choose a model without user interaction, evaluate across three dimensions:
**Requirement → Scenario → Pricing**. If the user explicitly specified a model, use it as given — but still
verify availability via CLI; if restricted, warn the user and suggest an alternative.

### Dimension 1 · Requirement (select)

Match task capability to the right model. Use when the user's need points to a specialized model, or when
the task is ambiguous and you need to compare capabilities.

| Signal                         | Keywords                                          | Model                                                        |
|--------------------------------|---------------------------------------------------|--------------------------------------------------------------|
| Reasoning                      | "think step by step", "reason", "analyze"         | qwq-plus (text) · qvq-max (vision)                           |
| Coding                         | "write code", "implement", "debug"                | qwen3-coder-plus                                             |
| OCR / document                 | "extract text", "OCR", "scan"                     | qwen3.5-ocr (default) · qwen-vl-ocr                          |
| Long context                   | "long document", "large file"                     | qwen3.7-plus (1M context)                                    |
| Multimodal (text+image+video)  | "analyze image", "understand video" + text        | qwen3.7-plus (preferred multimodal)                          |
| Voice interaction / omni       | "voice chat", "speak", "listen"                   | qwen3.5-omni-plus                                            |
| Built-in tools                 | "search the web", "run code", "use tools"         | qwen3.8-max (web search, code interpreter)                   |
| Image editing / style transfer | "edit image", "style transfer", "reference image" | qwen-image-3.0-pro (preferred) · wan2.5-i2i-preview          |
| Image-to-image fusion          | "place object", "combine images", "fuse images"   | qwen-image-3.0-pro · wan2.5-i2i-preview                      |
| Open-source / lowest cost T2I  | "open-source", "free model", "z-image"            | z-image-turbo                                                |
| Video editing                  | "edit video", "modify video", "video repaint"     | wan2.7-videoedit · happyhorse-1.0-video-edit                 |
| Style TTS                      | "emotion", "tone", "pace"                         | qwen3-tts-instruct-flash                                     |
| Ambiguous                      | task doesn't clearly map to one model             | compare Recommendation Matrix; ask user to clarify if needed |

### Dimension 2 · Scenario (tune)

Adjust model tier based on how the model will be used.

| Pattern                 | Signals                                 | Guidance                                                                |
|-------------------------|-----------------------------------------|-------------------------------------------------------------------------|
| Interactive / real-time | "chat", "real-time", "interactive"      | Prefer flash/turbo variants; enable streaming                           |
| Batch / offline         | "batch", "offline", "background"        | Quality model + Batch API (50% off)                                     |
| One-off trial           | "try", "test", "experiment"             | Quality model; use `qianwen usage free-tier` to check remaining quota   |
| High-volume production  | "production", "at scale", "high volume" | Cost-optimize: flash/turbo + context cache                              |
| Repeated context        | "template", "same prompt", "repeated"   | Enable context caching for input token discount                         |

### Dimension 3 · Pricing (optimize)

Given the candidates from dimensions 1–2, compare costs and apply modifiers.

- **Latest pricing**: When precise figures are needed, run `qianwen models info <model> --format json` —
  it returns structured pricing tiers (input/output per 1M tokens, tiered breakpoints). Snapshot
  ([pricing.md](pricing.md)) is for structural overview only.
- **Free quota**: Some models offer a limited free quota after activation. Quotas may be consumed, expired,
  or changed. **Never assume remaining free quota** — always present the paid unit price. Use
  `qianwen usage free-tier --format json` to check remaining quota.
- **Batch API**: 50% off both input and output tokens for non-realtime workloads.
- **Context cache**: Input token discount for repeated/templated contexts.
- **Tiered pricing**: Some models charge more per token as input length increases — check pricing tables
  for breakpoints.
- When cost is the user's primary concern, explicitly recommend the cheapest viable model and cite the price
  (with mandatory disclaimer — see [pricing-disclaimer.md](pricing-disclaimer.md)).

## Recommendation Matrix by Domain

### Text Models

| Use Case                | Recommended      | Why                                                                  |
|-------------------------|------------------|----------------------------------------------------------------------|
| Best overall            | qwen3.8-max      | Strongest flagship. 2.4T MoE. Multimodal. 1M context. Thinking on by default. |
| Flagship (balanced)     | qwen3.7-plus     | **Recommended default.** Multimodal vision-language. Enhanced Agent, coding, GUI perception. 1M context. |
| Flagship (text-only)    | qwen3.7-max      | Strongest text reasoning & agentic coding. Long-horizon execution.   |
| Multimodal (prev-gen)   | qwen3.6-plus     | Text + image + video. 1M context. Thinking on by default. Strong coding & recognition. |
| Strongest reasoning     | qwen3-max        | Built-in tools (web search, code interpreter). Hybrid thinking.      |
| Pure CoT reasoning      | qwq-plus         | Always-on chain-of-thought, math/code specialist                     |
| Fast / interactive      | qwen3.7-flash    | Fastest Qwen3.7. Multimodal. Enhanced Agent. Tiered pricing.         |
| Cheapest                | qwen-turbo       | Lowest per-token cost                                                |
| Best value (mid-tier)   | qwen3.7-plus     | Strong multimodal, balanced performance-cost ratio                    |
| Coding                  | qwen3-coder-plus | Best code model, 1M context                                          |
| Coding (balanced)       | qwen3-coder-next | Top recommendation, balances quality/speed/cost, agentic + tools     |
| Role-play (general)     | qwen-plus-character | Character restoration, empathetic dialog                          |

### Vision Models

| Use Case                       | Recommended    | Why                                                                                                                            |
|--------------------------------|----------------|--------------------------------------------------------------------------------------------------------------------------------|
| Flagship model                 | qwen3.8-max    | **Preferred.** Strongest flagship. Multimodal (text, image, video). 1M context. Up to 2h video. Object localization (2D/3D), document/webpage parsing. Function Calling + built-in tools (web search, code interpreter). Structured output. Thinking on by default. |
| Fast analysis                  | qwen3.8-flash  | Quick image understanding. Thinking mode supported.                                                                            |
| Visual reasoning (math/charts) | qvq-max        | Always-on CoT for visual reasoning                                                                                             |
| OCR specialist                 | qwen3.5-ocr    | Latest recommended OCR. PDF parsing, multi-turn, enhanced card/ID recognition. Also: qwen-vl-ocr (legacy).                    |
| Unified text+vision            | qwen3.7-plus   | Best when both text quality and vision matter. Enhanced Agent & GUI perception. 1M context. |

### Image Models

| Use Case                                  | Recommended        | Why                                                              |
|-------------------------------------------|--------------------|------------------------------------------------------------------|
| Highest quality (4K)                      | wan2.7-image-pro   | Up to 4K, multi-function, thinking mode                          |
| Multi-function (2K)                       | wan2.7-image       | Faster variant of pro, 2K max                                    |
| Quality text-to-image                     | qwen-image-3.0-pro | Latest flagship; high quality, strong text rendering            |
| Image **editing** (refs required)         | qwen-image-3.0-pro | Style transfer, subject consistency, multi-image editing         |
| Image-to-image fusion                     | wan2.5-i2i-preview | Multi-image fusion (1–3 refs), async-only                        |
| Interleaved text-image output (tutorials) | qwen-image-3.0-pro | Mixed text+image generation                                      |
| Fast iteration                            | z-image-turbo      | Lightweight open-source T2I, fast generation                     |
| Flexible resolution                       | wan2.5-t2i-preview | Custom aspect ratios                                             |
| Open-source SOTA T2I                      | z-image-turbo      | Open-source; sync-only; no `n` / no refs; lightweight payload    |

### Video Models

| Use Case                         | Recommended                | Why                                                            |
|----------------------------------|----------------------------|----------------------------------------------------------------|
| Default (with audio)             | happyhorse-1.1-t2v / i2v   | **Latest default.** 720P/1080P, 3–15s, with audio             |
| Wan family (with audio)          | wan2.7-t2v / i2v           | 720P/1080P, auto-dubbing                                       |
| Latest generation (Wan 3.0)      | wan3.0-video / -prime      | Wan 3.0 unified video; `-prime` for highest quality            |
| Reference-to-video (Wan)         | wan2.7-r2v                 | Up to 5 image/video refs, audio voice reference, 720P/1080P    |
| Text-to-video (HappyHorse)       | happyhorse-1.1-t2v         | **Latest HappyHorse 1.1.** 720P/1080P, 3–15s, with audio       |
| Image-to-video (HappyHorse)      | happyhorse-1.1-i2v         | HappyHorse 1.1 i2v, 720P/1080P, 3–15s, with audio              |
| Reference-to-video (HappyHorse)  | happyhorse-1.1-r2v         | Multi-ref images, 720P/1080P, 3–15s, with audio                 |
| Quick video creation             | wan2.6-i2v-flash           | Fast, multi-shot narrative                                     |
| High quality                     | wan2.6-i2v                 | Best visual quality                                            |
| With audio (legacy)              | wan2.5-i2v-preview         | Auto-dubbing support                                           |
| First+last frame                 | wan2.2-kf2v-flash          | 5s, silent                                                     |
| Video editing (legacy VACE)      | wanx2.1-vace-plus           | Repainting, extension                                          |
| Video editing (Wan)              | wan2.7-videoedit           | New `videoedit` mode, `media[]` protocol, no `function` field  |
| Video editing (HappyHorse)       | happyhorse-1.0-video-edit  | HappyHorse video editing, same `media[]` protocol              |

### Audio Models

| Use Case              | Recommended                | Why                                                           |
|-----------------------|----------------------------|---------------------------------------------------------------|
| **Highest quality**   | `qwen-audio-3.0-tts-plus`  | Latest flagship TTS. Multi-language + dialects, instruction control, fine-grained tags |
| High expressiveness   | `cosyvoice-v3.5-plus`      | Ultra-high expressiveness, 11 languages, free-style instruction, voice clone |
| High quality + speed  | `cosyvoice-v3.5-flash`     | High-performance, 11 languages, reduced latency, voice clone  |
| Standard TTS          | `qwen3-tts-flash`          | Fast, reliable, multi-language, cost-effective                |
| Controlled style      | `qwen3-tts-instruct-flash` | Instruction-guided voice style (tone/emotion)                 |
| Realtime interaction  | `qwen-audio-3.0-tts-flash` | Low-latency realtime TTS, multi-language + dialects           |
| ASR (real-time)       | `qwen3-asr-flash`          | Real-time speech recognition                                  |

### Omni Models

| Use Case            | Recommended               | Why                                                                                   |
|---------------------|---------------------------|---------------------------------------------------------------------------------------|
| Voice + vision chat | qwen3.5-omni-plus         | Text/image/audio/video input, text + audio output. Latest flagship omni. Thinking supported. |
| Voice + vision (fast) | qwen3.5-omni-flash      | Faster latest omni. Text/image/audio/video input, text + audio output.                |
| Real-time voice     | qwen3-omni-flash-realtime | Streaming audio input + built-in VAD. 49 voices.                                      |

## Token Plan Models

> **This is the exclusive candidate set for Token Plan (`sk-sp-`) keys.** When the key type detection finds a
> Token Plan key, cross-skill resolution and interactive advisory MUST filter recommendations to
> this section only. Do not offer PAYG-only models to Token Plan users.
>
> Canonical source: `qianwen-ops-auth/references/tokenplan.md`

Token Plan keys (`sk-sp-...`) are supported when an interactive AI tool invokes this Skill for the
current user. Read `qianwen-ops-auth/references/tokenplan.md` when installed; otherwise read the
official [Personal](https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md),
[Team](https://platform.qianwenai.com/docs/token-plan/team/token-plan-team-overview.md), and [multimodal](https://platform.qianwenai.com/docs/token-plan/best-practices/multimodal-generation.md)
Markdown. Select and pass an exact model; do not probe or automatically fall back to PAYG.

### Text Models (Personal: 9 / Team: 18)

**Personal version**:

| Model           | Context | Thinking         | Notes                                                      |
|-----------------|--------:|------------------|------------------------------------------------------------|
| `qwen3.8-max`   |      1M | Yes (default on) | Strongest flagship. Multimodal. Night 50% off promo.       |
| `qwen3.8-flash`  |      1M | Yes (default on) | Multimodal. Fast. Thinking mode.                           |
| `qwen3.7-max`   |      1M | Yes (default on) | Text-only. Strongest agentic coding, long-horizon.          |
| `qwen3.7-plus`  |      1M | Yes (default on) | **Recommended default.** Multimodal vision-language. Enhanced Agent, coding, GUI perception. |
| `qwen3.6-flash` |      1M | Yes (default on) | Multimodal. Fast. Vision understanding.                    |
| `glm-5.2`       |      1M | Yes              | Third party (Zhipu). Long-horizon tasks.                   |
| `deepseek-v4-pro` |      1M | Yes              | Third party (DeepSeek).                                    |
| `deepseek-v4-pro-0813` |   1M | Yes          | Third party (DeepSeek). Latest v4-pro snapshot.            |
| `deepseek-v4-flash-0731` | 1M | Yes          | Third party (DeepSeek). Lightweight MoE. Not Responses API. |

**Team version** (additional models beyond personal, 18 total):

| Model           | Context | Notes                                                      |
|-----------------|--------:|------------------------------------------------------------|
| `qwen3.6-plus`  |      1M | Multimodal text + image + video.                           |
| `deepseek-v4-flash` |   1M | Third party (DeepSeek).                                   |
| `deepseek-v3.2` |   131K | Third party (DeepSeek).                                    |
| `kimi-k2.7-code` |  262K | Third party (Moonshot). Coding specialist.                 |
| `kimi-k2.6`    |    262K | Third party (Moonshot).                                    |
| `kimi-k2.5`    |    262K | Third party (Moonshot).                                    |
| `glm-5.1`      |    202K | Third party (Zhipu).                                       |
| `glm-5`        |    202K | Third party (Zhipu).                                       |
| `MiniMax-M2.5`  |   204K | Third party (MiniMax).                                     |

### Image Generation Models

> [!NOTE]
> Token Plan image models are not available through the OpenAI-compatible `/chat/completions` API.
> In an interactive AI tool, invoke them through the qianwen-image-generation Skill, which calls
> the image-generation API. Do not use Token Plan keys in application backends, unattended
> automation, batch jobs, or API testing tools.

| Model                | Notes                                                              |
|----------------------|--------------------------------------------------------------------|
| `qwen-image-3.0-pro` | Latest flagship image model; high quality, strong text rendering    |
| `qwen-image-2.0`     | Default; general-purpose; strong Chinese text rendering (Team only) |
| `qwen-image-2.0-pro` | Higher quality, slightly slower (Team only)                        |
| `wan2.7-image`       | Multi-style; returns 4 images by default                           |
| `wan2.7-image-pro`   | Supports 4K; additional sizes 2048×2048, 1440×2560, 2560×1440      |

Available sizes: `1024*1024` (default), `720*1280`, `1280*720`. `wan2.7-image-pro` adds 4K options above.

### Video Generation Models

| Model                | Notes                                                              |
|----------------------|--------------------------------------------------------------------|
| `happyhorse-1.1-t2v` | Text-to-video. 720P/1080P, 3–15s, with audio.                      |
| `happyhorse-1.1-i2v` | Image-to-video. 720P/1080P, 3–15s, with audio.                     |
| `happyhorse-1.1-r2v` | Reference-to-video. Multi-ref, 720P/1080P, 3–15s, with audio.      |

### TTS Models

| Model                      | Notes                                                  |
|----------------------------|--------------------------------------------------------|
| `qwen-audio-3.0-tts-plus` | Highest quality TTS. Multi-language + Chinese dialects.  |

`qwen-audio-3.0-realtime-plus` is in the Token Plan catalog but is not implemented by this Skill.

### Excluded Modalities

Token Plan does **not** include general vision models (qwen3-vl-*, qwen3.5-ocr, qwen-vl-ocr, qvq-max),
embeddings, rerank, translation, ASR, or pay-as-you-go TTS models (cosyvoice, qwen3-tts-flash).
Users needing those must explicitly choose a standard pay-as-you-go key and make a separate request.

When recommending models, note if the user's chosen model falls outside the lists above and they are
using a Token Plan key (`sk-sp-...`). Explain the limitation; do not silently replace the model.

If `qianwen-ops-auth` is installed, see its `references/tokenplan.md` for Credits billing details,
full error code reference, and the platform's usage policy.

### Billing (Credits)

- **Unit**: Credits (not per-token CNY).
- **Tiers & pricing**: See [Token Plan overview](https://platform.qianwenai.com/docs/token-plan/overview).
- **Deduction order**: seat quota → shared package (nearest-expiry first) → service paused.
- **Usage queries**: [Token Plan Subscription console](https://platform.qianwenai.com/home/billing/subscription/token-plan) (CLI does not yet support `sk-sp-` keys).

## Thinking Mode

Several models support hybrid thinking/non-thinking modes:

| Model                               | Thinking Default | Notes                                                                                         |
|-------------------------------------|------------------|-----------------------------------------------------------------------------------------------|
| qwen3.8-max                         | **On**           | Strongest flagship. Thinking enabled by default. Use `enable_thinking: false` to disable.  |
| qwen3.8-flash                       | **On**           | Fast Qwen3.8. Multimodal. Thinking enabled by default. Use `enable_thinking: false` to disable. |
| qwen3.7-max                         | **On**           | Text-only flagship. Thinking enabled by default. Use `enable_thinking: false` to disable.  |
| qwen3.7-plus                        | **On**           | Multimodal. Thinking enabled by default. Use `enable_thinking: false` to disable.          |
| qwen3.7-flash                       | **On**           | Multimodal. Thinking enabled by default.                                                   |
| qwen3.6-plus                        | **On**           | Multimodal. Thinking enabled by default. Use `enable_thinking: false` to disable. |
| qwen3.5-plus                        | **On**           | Thinking enabled by default. Use `enable_thinking: false` to disable.                         |
| qwen3.5-flash                       | **On**           | Thinking enabled by default.                                                                  |
| qwen3-max                           | Off              | Use `enable_thinking: true` for complex reasoning. Built-in tools available in thinking mode. |
| qwen-plus / qwen-flash / qwen-turbo | Off              | Hybrid; enable for deeper reasoning at higher output cost.                                    |
| qwen3-vl-plus / qwen3-vl-flash      | Off              | Vision + thinking for complex visual analysis.                                                |
| qwen3-omni-flash                    | Off              | Thinking supported; audio output not available in thinking mode.                              |
| qwq-plus / qvq-max                  | Always on        | Pure reasoning models; CoT always active.                                                     |

**Guidance**: Do not enable thinking by default for simple or conversational tasks — it increases latency and
output token cost. Enable only when the user explicitly asks for deep reasoning or the task requires
multi-step analysis.

## Available Models (snapshot)

> **⚠️ Snapshot warning**: This list is point-in-time and may be outdated. **Prefer**
> `qianwen models list --all --format json` for the up-to-date catalog. See [model-list.md](model-list.md)
> for the structured offline reference.

- **Text (commercial)**: qwen3.8-max, qwen3.8-flash, qwen3.7-max, qwen3.7-plus, qwen3.7-flash, qwen3.6-max-preview, qwen3.6-plus, qwen3.6-flash, qwen3-max, qwen3.5-plus, qwen3.5-flash, qwen-turbo, qwq-plus, qwen3-coder-next/plus/flash, qwen-plus-character, qwen-flash-character
- **Text (open-source)**: qwen3.8-27b, qwen3.8-2.4t-a95b, qwen3.6-27b, qwen3.5-27b
- **Text (third-party)**: deepseek-v4-flash, deepseek-v4-flash-0731, glm-5.2, glm-5.1, kimi-k3, kimi-k2.6, MiniMax-M2.5
- **Vision**: qwen3.6-plus (multimodal), qwen3.7-plus (multimodal), qwen3-vl-plus, qwen3-vl-flash, qvq-max, qwen3.5-ocr, qwen-vl-ocr, qwen-vl-max, qwen-vl-plus
- **Omni**: qwen3.5-omni-plus, qwen3.5-omni-flash, qwen3-omni-flash (+ realtime), qwen-omni-turbo (+ realtime)
- **Image generation (text-to-image)**: wan2.7-image-pro, wan2.7-image, wan2.6-t2i, wan2.5-t2i-preview, wan2.2-t2i-flash, z-image-turbo
- **Image editing (requires reference images)**: qwen-image-3.0-pro, qwen-image-3.0, wan2.6-image, wan2.5-i2i-preview, qwen-image-2.0-pro, qwen-image-2.0-pro-2026-06-22
- **Video generation**: wan2.7-t2v/i2v/videoedit, wan2.7-r2v, wan3.0-video/-prime, wan2.6 series, wan2.5/2.2 series, vace, happyhorse-1.1-t2v/i2v/r2v, happyhorse-1.0-t2v/i2v/r2v/video-edit
- **TTS**: qwen-audio-3.0-tts-plus/flash, cosyvoice-v3.5-plus/flash, cosyvoice-v3-plus/flash, qwen3-tts-flash, qwen3-tts-instruct-flash
- **ASR**: qwen3-asr-flash, fun-asr
- **Embedding/Rerank**: text-embedding-v4, qwen3-rerank
- **Translation**: qwen-mt-plus/flash/lite/turbo
