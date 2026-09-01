# Token Plan vs Standard API Key

> Sources:
> - https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md
> - https://platform.qianwenai.com/docs/token-plan/team/token-plan-team-overview.md
> - https://platform.qianwenai.com/docs/token-plan/best-practices/multimodal-generation.md
> - https://platform.qianwenai.com/home/billing/subscription/token-plan
> Updated: 2026-08-14

> [!CAUTION]
> Token Plan keys may be used only by interactive AI tools and the Skill/Agent extensions they
> invoke for the current user. Application backends, unattended batch jobs, load tests, API testing
> automation, and non-interactive workflow platforms remain prohibited.

## Two Key Types

QianWen exposes two mutually exclusive authentication systems. Mixing them produces hard-to-diagnose errors.

| Dimension | Standard Key (Pay-as-you-go) | Token Plan |
|-----------|------------------------------|------------|
| Key format | `sk-ws-xxxxx` (legacy `sk-xxxxx`) | `sk-sp-xxxxx` |
| Auth header | `Authorization: Bearer <key>` | `Authorization: Bearer <key>` (NOT `x-api-key`) |
| Supported text models | Full catalog (100+) | **9 text LLMs** (Personal) / **18 text LLMs** (Team) (see below) |
| Supported image models | Full catalog | **3 image models** (Personal) / **5** (Team), tool-integrated only (see below) |
| Supported video models | Full catalog | **3 video models**, tool-integrated only (see below) |
| Supported TTS models | Full catalog | **1 TTS model**, tool-integrated only (see below) |
| ASR | Available | **1 model in catalog** — not callable from any Skill in this repo (see below) |
| Embedding / Rerank / Translation | Available | **Not supported** |
| Usage scope | API calls from scripts, apps, and tools | Interactive AI tools and their Skill/Agent extensions |
| Billing | Per-token consumption (CNY) | **Credits**: monthly seat allowance + shared usage packages |
| Quota exhaustion | Continues (pay more or use prepaid balance) | **Hard fail — service paused** until next cycle or shared package purchased |

**Detecting key type (non-plaintext)**:

```bash
echo ${DASHSCOPE_API_KEY:0:6}
```

- Output starts with `sk-sp-` → Token Plan key (this file applies).
- Output starts with `sk-ws-` or other `sk-` prefix → Standard PAYG key (full catalog).

## Forbidden Uses (Strictly Enforced)

The following uses of an `sk-sp-` Token Plan key are **strictly prohibited** by the platform.
Server-side detection of a violation may result in:

- **Immediate subscription suspension**;
- **API Key revocation**;
- In repeated cases, **account-level review and termination**.

Prohibited scenarios include, but are not limited to:

- Application backends, micro-services, serverless functions, workers, cron jobs.
- Unattended batch jobs, bulk data-processing pipelines, offline evaluations, and load tests.
- API testing automation (Postman, Insomnia, standalone `curl`, and similar clients).
- Workflow / orchestration platforms (Dify, n8n, Coze, LangChain servers, etc.).
- Any integration where the caller is not an **interactive AI tool** operating on behalf of a human.

Token Plan keys are intended exclusively for interactive AI coding / chat tools (Cursor, Claude
Code, Qwen Code, OpenClaw, OpenCode, Codex, Kilo Code/CLI, Hermes Agent) and the Skill/Agent
extensions they invoke for the current user. Any other usage constitutes a **policy violation**.

Before each Token Plan request, select the exact modality and mode, then choose and explicitly pass
a model from the current list below. If this snapshot is stale or insufficient, read the official
Markdown sources above. Do not probe models, change modes, or automatically fall back to PAYG.

## Supported Models

### Text Models (Personal: 9 / Team: 18)

**Personal version** (9 models):

| Model                    | Context Window | Notes                                                    |
|--------------------------|---------------:|----------------------------------------------------------|
| `qwen3.8-max`            |             1M | Strongest flagship. Multimodal. Thinking mode.           |
| `qwen3.8-flash`          |             1M | Multimodal. Fast. Thinking mode.                         |
| `qwen3.7-max`            |             1M | Text-only. Strongest agentic coding, long-horizon.       |
| `qwen3.7-plus`           |             1M | Multimodal vision-language. Coding, tools, productivity. |
| `qwen3.6-flash`          |             1M | Multimodal. Fast. Vision understanding.                  |
| `glm-5.2`               |             1M | Third party (Zhipu). Long-horizon tasks.                 |
| `deepseek-v4-pro`        |             1M | Third party (DeepSeek). Thinking mode.                   |
| `deepseek-v4-pro-0813`   |             1M | Third party (DeepSeek). Latest v4-pro snapshot.          |
| `deepseek-v4-flash-0731` |             1M | Third party (DeepSeek). Lightweight MoE. Not Responses API. |

**Team version** (additional 9 models, 18 total):

| Model             | Context Window | Notes                                       |
|-------------------|---------------:|---------------------------------------------|
| `qwen3.6-plus`    |             1M | Multimodal text + image + video.            |
| `deepseek-v4-flash` |           1M | Third party (DeepSeek).                     |
| `deepseek-v3.2`   |           128K | Third party (DeepSeek).                     |
| `kimi-k2.7-code`  |           256K | Third party (Moonshot). Coding specialist.  |
| `kimi-k2.6`       |           256K | Third party (Moonshot).                     |
| `kimi-k2.5`       |           256K | Third party (Moonshot).                     |
| `glm-5.1`         |           198K | Third party (Zhipu).                        |
| `glm-5`           |           198K | Third party (Zhipu).                        |
| `MiniMax-M2.5`    |           204K | Third party (MiniMax).                      |

### Image Generation Models (Personal: 3 / Team: 5)

| Model                | Notes                                                              |
|----------------------|--------------------------------------------------------------------|
| `qwen-image-3.0-pro` | Latest flagship image model; high quality, strong text rendering    |
| `qwen-image-2.0`     | Default; general-purpose; strong Chinese text rendering (Team only) |
| `qwen-image-2.0-pro` | Higher quality, slightly slower (Team only)                        |
| `wan2.7-image`       | Multi-style; returns 4 images by default                           |
| `wan2.7-image-pro`   | Supports 4K (additional sizes: 2048×2048, 1440×2560, 2560×1440)    |

### Video Generation Models (3 total)

| Model                | Notes                                                              |
|----------------------|--------------------------------------------------------------------|
| `happyhorse-1.1-t2v` | Text-to-video. 720P/1080P, 3–15s, with audio.                      |
| `happyhorse-1.1-i2v` | Image-to-video. 720P/1080P, 3–15s, with audio.                     |
| `happyhorse-1.1-r2v` | Reference-to-video. Multi-ref, 720P/1080P, 3–15s, with audio.      |

### Audio Models (TTS: 1 implemented; realtime & ASR reserved)

| Model                          | Type     | Notes                                                  |
|--------------------------------|----------|--------------------------------------------------------|
| `qwen-audio-3.0-tts-plus`      | TTS      | Highest quality TTS. Multi-language + Chinese dialects. Billed per character (not per token). |
| `qwen-audio-3.0-realtime-plus` | Realtime | In the Token Plan catalog; realtime, not implemented by any Skill. |
| `qwen-audio-3.0-asr-flash`     | ASR      | In the Token Plan catalog; not callable from any Skill in this repo. |

Image generation, video generation, and TTS models are **not reachable from the standard text API**;
they are integrated into interactive AI tools through each tool’s Skill / Slash Command / Agent
mechanism.

## Credits Billing Mechanism

- **Unit**: Credits. Single-call cost depends on model, token usage, thinking mode, and tool calls.
- **Tiers & pricing**: See [Token Plan overview](https://platform.qianwenai.com/docs/token-plan/overview).
- **Deduction order**: seat monthly quota → shared package (nearest-expiry first) → service paused.
- **Reset**: seat quotas reset monthly; unused credits do not roll over.

Example (qwen3.6-plus single request): 8,349 input + 40,794 cached + 573 output ≈ 3.18 Credits.

## Impact on QianWen-AI/qianwen-ai Scripts

The bundled Text, Vision, Image, Video, and TTS Skills accept `sk-sp-` when an interactive AI tool
invokes them for the current user. Their shared library routes requests to the Token Plan endpoint;
the Agent is responsible for selecting and explicitly passing a documented model.

| Skill                       | Works with `sk-sp-` Token Plan key? | Notes                                                       |
|-----------------------------|:-----------------------------------:|-------------------------------------------------------------|
| qianwen-text                |                  Yes                | Uses a documented Token Plan text model                     |
| qianwen-vision              |                  Yes                | Requires a listed model that supports the vision task       |
| qianwen-image-generation    |                  Yes                | Uses a documented Token Plan image model                    |
| qianwen-video-generation    |                  Yes                | Uses a documented Token Plan video model                    |
| qianwen-audio-tts           |                  Yes                | Default model `qwen-audio-3.0-tts-plus` is TP-compatible; CosyVoice (`tts_cosyvoice.py`) remains PAYG-only |

PAYG defaults remain unchanged. Token Plan calls must not silently use those defaults or fall back
to PAYG.

## Common Errors (Key-level Diagnosis)

| Error                                            | Cause                                                                              | Resolution                                                                    |
|--------------------------------------------------|------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| `InvalidApiKey: No API-key provided`             | Key not configured, or tool used `x-api-key` header                                | Set key; switch to `Authorization: Bearer`                                    |
| `InvalidApiKey: Invalid API-key provided`        | Standard `sk-` key mismatched, subscription expired, key copied with whitespace    | Verify subscription status; reset key in console                              |
| `model 'xxx' not found or not supported`         | Model name typo / wrong case; model not in Token Plan catalog                      | Match model ID exactly; review supported list above                           |
| `Range of input length should be [1, xxx]`       | Input + history exceeds context window                                             | Start a new session, compact context, or switch to a larger-context model     |
| `API rate limit reached`                         | Seat / shared-package Credits exhausted, or shared quota rate-limited              | Check Token Plan console for usage                                            |

## Cost / Policy Risk Scenarios

1. **`sk-sp-` key used by an interactive tool's Skill**: Routes to Token Plan and bills against Credits.
2. **PAYG key when the user expects Token Plan coverage**: Calls succeed but incur pay-as-you-go charges.
3. **Token Plan model or edition mismatch**: Report the error and re-check documentation; do not probe candidates.
4. **Token Plan Credits exhausted**: Hard fail on the Token Plan service side; never automatically fall back to PAYG.

## Console & Billing

| Resource                  | URL                                                                 |
|---------------------------|---------------------------------------------------------------------|
| Token Plan Subscription   | https://platform.qianwenai.com/home/billing/subscription/token-plan |
| Token Plan Pricing        | https://platform.qianwenai.com/docs/token-plan/overview#%E5%A5%97%E9%A4%90%E4%B8%8E%E5%AE%9A%E4%BB%B7                   |
| Pay-as-you-go Billing     | https://platform.qianwenai.com/home/billing/pay-as-you-go           |
| Usage Analytics (PAYG)    | https://platform.qianwenai.com/home/analytics                       |

> [!NOTE]
> **Usage queries**: Token Plan seat & shared-package Credits balance are currently only viewable in
> the [Token Plan console](https://platform.qianwenai.com/home/billing/subscription/token-plan)
> (Subscription page → Token Plan tab). The `qianwen` CLI does not yet support `sk-sp-` Token Plan
> keys; CLI commands (`qianwen usage summary`, etc.) only work for standard `sk-` keys.

## Coexistence

Both key types can be held simultaneously by the same user:
- `sk-sp-` Token Plan key -> interactive AI tools and their Skill/Agent extensions.
- `sk-ws-` PAYG key (legacy `sk-`) -> regular API calls from scripts, apps, and tools.

These are independent. The bundled Skills choose the endpoint from the configured key and never
automatically fall back from one billing mode to the other.
