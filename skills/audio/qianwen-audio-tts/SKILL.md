---
name: qianwen-audio-tts
description: "Synthesize speech from text with Qwen TTS models. TRIGGER when: user wants to convert text to speech, create voiceovers, generate audio narration, read text aloud, build TTS applications, mentions speech synthesis/voice generation/audio output from text, or explicitly invokes this skill by name (e.g. use qianwen-audio-tts). DO NOT TRIGGER when: user wants speech recognition/ASR, text generation without audio, non-Qwen audio tasks."
compatibility: "Requires Python 3.9+ and curl. Cursor: auto-loaded. Claude Code: read this skill's SKILL.md before first use."
---

# Qwen Audio TTS (Text-to-Speech)

Synthesize natural speech from text using Qwen TTS models.
This skill is part of **QianWen-AI/qianwen-ai**.

## Skill directory

Use this skill's internal files to execute and learn. Load reference files on demand when the default path fails or you need details.

| Location | Purpose |
|----------|---------|
| `scripts/tts.py` | Qwen TTS (HTTP API) — qwen3-tts-*, qwen-audio-3.0-tts-* |
| `scripts/tts_cosyvoice.py` | CosyVoice (WebSocket / HTTP NRT) — requires `dashscope` SDK |
| `references/cosyvoice-guide.md` | CosyVoice setup, voices, examples, errors |
| `references/execution-guide.md` | Fallback: curl (standard, instruct, streaming), code generation |
| `references/prompt-guide.md` | Text formatting for speech, instructions templates, voice selection |
| `references/api-guide.md` | API supplement |
| `references/sources.md` | Official documentation URLs |

## Security

**NEVER output any API key or credential in plaintext.** Always use variable references (`$DASHSCOPE_API_KEY` in shell, `os.environ["DASHSCOPE_API_KEY"]` in Python). Any check or detection of credentials must be **non-plaintext**: report only status (e.g. "set" / "not set", "valid" / "invalid"), never the value. Never display contents of `.env` or config files that may contain secrets.

**When the API key is not configured, NEVER ask the user to provide it directly.** Instead, help create a `.env` file with a placeholder (`DASHSCOPE_API_KEY=sk-your-key-here`) and instruct the user to replace it with their actual key from the [QianWen Console](https://platform.qianwenai.com/home/api-keys). Only write the actual key value if the user explicitly requests it.

## Key Compatibility

Both PAYG (`sk-ws-...`; legacy `sk-...`) and Token Plan (`sk-sp-...`) keys are supported. Detect
the API key type without exposing the Key:

```bash
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from qianwen_lib import detect_api_key_type
print(detect_api_key_type('scripts/qianwen_lib.py'))
"
```

| Output | Meaning |
|--------|---------|
| `token-plan` | Token Plan key — use only models from the Token Plan list below. |
| `payg` | Pay-as-you-go key — full model catalog available. |
| `not-set` | No key configured. |

For Token Plan, use an exact model from qianwen-model-selector with `scripts/tts.py`, or
consult `qianwen-ops-auth/references/tokenplan.md`. If unavailable, use:
- Personal: https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md
- Team: https://platform.qianwenai.com/docs/token-plan/team/token-plan-team-overview.md

### Pre-Execution: Key-Based Model Decision

Before calling any TTS script, determine the key type by its prefix (non-plaintext check via
`scripts/qianwen_lib.py`). Then select model and script accordingly:

| Key Prefix | Type | Script | Model | Notes |
|------------|------|--------|-------|-------|
| `sk-sp-...` | Token Plan | `scripts/tts.py` | Default `qwen-audio-3.0-tts-plus` | Default model is TP-compatible; voice `longanlingxin` applies automatically |
| `sk-ws-...` / `sk-...` | PAYG | `scripts/tts.py` | Default `qwen-audio-3.0-tts-plus` (NRT) | High-quality, voice `longanlingxin`, output mp3 |
| `sk-ws-...` / `sk-...` | PAYG | `scripts/tts.py` | `--model qwen-audio-3.0-tts-flash` | Lower-cost alternative (PAYG-only), voice `longanhuan_v3.6` |
| `sk-ws-...` / `sk-...` | PAYG | `scripts/tts.py` | `qwen3-tts-*` / `qwen-audio-3.0-tts-*` | Full model range available |
| `sk-ws-...` / `sk-...` | PAYG | `scripts/tts_cosyvoice.py` | `cosyvoice-*` | Requires `dashscope` SDK |

The `scripts/tts_cosyvoice.py` script supports PAYG keys only and rejects Token Plan (`sk-sp-...`)
keys.

Token Plan supports only specific models — use exactly a model from the references above; do not
guess or probe model availability. For PAYG, continue below.

## Model Selection

### Qwen TTS (HTTP API) — use `scripts/tts.py`

| Model | Use Case | Notes |
|-------|----------|-------|
| `qwen3-tts-flash` | Fast, multi-language | Cost-effective; specify `--model qwen3-tts-flash` explicitly |
| `qwen3-tts-instruct-flash` | Instruction-guided style control | Tone/emotion via instructions |

### Qwen-Audio-TTS (HTTP NRT API) — use `scripts/tts.py`

| Model | Use Case | Notes |
|-------|----------|-------|
| `qwen-audio-3.0-tts-plus` | **Default** — high-quality professional scenarios | TP + PAYG; instruction control, voice cloning, voice `longanlingxin` |
| `qwen-audio-3.0-tts-flash` | Low-latency real-time interaction | PAYG-only; NRT endpoint, voice `longanhuan_v3.6`; specify `--model` explicitly |

### CosyVoice (WebSocket / HTTP NRT API) — use `scripts/tts_cosyvoice.py`

| Model | Use Case | Voice Support | Notes |
|-------|----------|---------------|-------|
| `cosyvoice-v3-flash` | High quality, fast | Supports system voices (80+ built-in) | **Default** |
| `cosyvoice-v3-plus` | Highest quality | Supports system voices (80+ built-in) | — |
| `cosyvoice-v3.5-flash` | High-performance, instruction control, 11 langs | Custom voices only (requires Voice Cloning or Voice Design) | See pricing references |
| `cosyvoice-v3.5-plus` | Ultra-expressive, instruction control, 11 langs | Custom voices only (requires Voice Cloning or Voice Design) | See pricing references |

> **Note**: CosyVoice requires `dashscope` SDK. See [cosyvoice-guide.md](references/cosyvoice-guide.md). Qwen-Audio-TTS uses `tts.py` (stdlib only, no SDK needed).

1. **User specified a model** → use the appropriate script:
   - `qwen3-tts-*` / `qwen-audio-3.0-tts-*` → `scripts/tts.py`
   - `cosyvoice-*` → `scripts/tts_cosyvoice.py`
2. **Consult the qianwen-model-selector skill** when model choice depends on capability, scenario, or pricing.
3. **No signal, clear task** → `qwen-audio-3.0-tts-plus` via `tts.py` (default; NRT endpoint, voice `longanlingxin`, output mp3).

> **⚠️ Important**: The model list above is a **point-in-time snapshot** and may be outdated. Model availability
> changes frequently. **Always check the [official model list](https://www.qianwenai.com/models)
> for the authoritative, up-to-date catalog before making model decisions.**

> **Model details**: For more information about a specific model, direct the user to its detail page: `https://www.qianwenai.com/models/<model-name>` (replace `<model-name>` with the exact model ID, e.g. `qwen3-tts-flash` → https://www.qianwenai.com/models/qwen3-tts-flash). NEVER modify or guess the model name in the URL.

> **Dynamic model queries**: If the **qianwen-model-selector** skill or **QianWen CLI** (`qianwen models info <model>`) is available, use it for real-time model data. CLI requires authentication — see the **qianwen-usage** skill for login flow.

## Available Voices

| Voice | Description | Script | Available for |
|-------|-------------|--------|---------------|
| Cherry, Ethan, Serena | Qwen TTS system voices | `tts.py` | qwen3-tts-* |
| longanyang, longanhuan, longhuhu_v3 | CosyVoice system voices | `tts_cosyvoice.py` | cosyvoice-v3-flash, cosyvoice-v3-plus only |
| longanlingxin, longanlufeng | Qwen-Audio-TTS Plus system voices | `tts.py` | qwen-audio-3.0-tts-plus |
| longanhuan_v3.6, longjielidou_v3.6, loongeva_v3.6, loongjohn | Qwen-Audio-TTS Flash system voices | `tts.py` | qwen-audio-3.0-tts-flash |

> **Full lists**: [api-guide.md](references/api-guide.md#system-voice-list) (Qwen TTS) · [cosyvoice-guide.md](references/cosyvoice-guide.md) (CosyVoice) · [Qwen-Audio-TTS voice list](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/qwen-audio-tts/voice-list)

> **⚠️ Qwen-Audio-TTS voice compatibility**: Voices are **NOT interchangeable** across `qwen-audio-3.0-tts-plus` and `qwen-audio-3.0-tts-flash`. Each model has its own voice set:
> - `qwen-audio-3.0-tts-plus` default: `longanlingxin`
> - `qwen-audio-3.0-tts-flash` default: `longanhuan_v3.6`
>
> If you need a non-default voice, specify `--voice <id>` and consult the official voice list:
> [NRT HTTP API](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/cosyvoice-nrt/http-api.md) · [Qwen-Audio-TTS voices](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/qwen-audio-tts/voice-list.md)

> **⚠️ v3.5 models**: `cosyvoice-v3.5-flash` and `cosyvoice-v3.5-plus` do **NOT** support any system voices listed above. You must create a custom voice via Voice Cloning or Voice Design.

### Custom Voices (Required for v3.5)

cosyvoice-v3.5 models require a custom voice ID. To create one:
1. Visit [Voice Cloning](https://platform.qianwenai.com/docs/developer-guides/speech/voice-cloning)
2. Upload a 10-20s clean speech sample
3. Obtain the custom voice ID
4. Pass via `--voice <id>` or `"voice": "<id>"` in request JSON

## Execution

> **⚠️ Multiple artifacts**: When generating multiple files in a single session, you MUST append a numeric suffix to each filename (e.g. `out_1.wav`, `out_2.wav`) to prevent overwrites.

### Qwen TTS (HTTP API) — `tts.py`

#### Prerequisites

- **API Key**: Use the non-plaintext detector in **Key Compatibility**; do not replace it with a
  variable-presence check. If no Key is found, use qianwen-ops-auth when available or guide the user
  to configure `DASHSCOPE_API_KEY`/`QIANWEN_API_KEY` in `.env`. Skills may be installed independently.
- Python 3.9+ (stdlib only, **no pip install needed**)

#### Environment Check

Before first execution, verify Python is available:

```bash
python3 --version  # must be 3.9+
```

If `python3` is not found, try `python --version` or `py -3 --version`. If Python is unavailable or below 3.9, skip to **Path 2 (curl)** in [execution-guide.md](references/execution-guide.md).

#### Default: Run Script

**Script path**: Scripts are in the `scripts/` subdirectory **of this skill's directory** (the directory containing this SKILL.md). **You MUST first locate this skill's installation directory, then ALWAYS use the full absolute path to execute scripts.** Do NOT assume scripts are in the current working directory. Do NOT use `cd` to switch directories before execution.

**Execution note:** Run all scripts in the **foreground** — wait for stdout; do not background.

**Discovery:** Run `python3 <this-skill-dir>/scripts/tts.py --help` first to see all available arguments.

```bash
python3 <this-skill-dir>/scripts/tts.py \
  --request '{"text":"Hello, this is a test.","voice":"Cherry"}' \
  --output output/qianwen-audio-tts/ \
  --print-response
```

| Argument | Description |
|----------|-------------|
| `--request '{...}'` | JSON request body |
| `--file path.json` | Load request from file |
| `--output path` | Save audio and response JSON to directory, or specify an audio file path (e.g. `speech.mp3`); use distinct filenames across calls to avoid overwriting |
| `--print-response` | Print response to stdout |
| `--model ID` | Override model |
| `--voice NAME` | Override voice |
| `--format` | Audio format for Qwen-Audio-TTS NRT models (`mp3` default, `wav`, `pcm`) |
| `--sample-rate` | Sample rate in Hz for Qwen-Audio-TTS NRT models (default: 24000) |

> **Model priority**: `--model` CLI flag > `"model"` field in `--request` JSON > built-in default.

#### Verify Result

- Exit code `0` + output contains valid JSON with `output.audio` field → **success**
- Non-zero exit, HTTP error, empty response, or error JSON → **fail**
- **Post-execution check**: Verify the output audio file exists and has non-zero size (`ls -la <output_dir>`)
- **MANDATORY — stderr signal check**: After confirming the result, scan the command's stderr output for `[ACTION_REQUIRED]` or `[UPDATE_AVAILABLE]`. If either signal is present, you **MUST** follow the instructions in [Update Check](#update-check-mandatory-post-execution) below before responding to the user.

#### On Failure

If the script fails, match the error output against the diagnostic table below to determine the resolution. If no match, read [execution-guide.md](references/execution-guide.md) for alternative paths: curl commands (Path 2 — standard, instruct, streaming), code generation (Path 3), and autonomous resolution (Path 5).

**If Python is not available at all** → skip directly to Path 2 (curl) in [execution-guide.md](references/execution-guide.md).

---

### CosyVoice — `tts_cosyvoice.py`

CosyVoice requires `dashscope` SDK. Quick start:

```bash
pip install dashscope>=1.25.17
python3 <this-skill-dir>/scripts/tts_cosyvoice.py --text "Hello"
```

> **Full guide**: [cosyvoice-guide.md](references/cosyvoice-guide.md) (setup, voices, examples, errors)

| Error Pattern | Diagnosis | Resolution |
|---------------|-----------|------------|
| `command not found: python3` | Python not on PATH | Try `python` or `py -3`; install Python 3.9+ if missing |
| `Python 3.9+ required` | Script version check failed | Upgrade Python to 3.9+ |
| `SyntaxError` near type hints | Python < 3.9 | Upgrade Python to 3.9+ |
| `QIANWEN_API_KEY/DASHSCOPE_API_KEY not found` | Missing API key | Obtain key from [QianWen Console](https://platform.qianwenai.com/home/api-keys); add to `.env`: `echo 'DASHSCOPE_API_KEY=sk-...' >> .env`; or run **qianwen-ops-auth** if available |
| `HTTP 401` | Invalid or mismatched key | Run **qianwen-ops-auth** (non-plaintext check only); verify key is valid |
| `SSL: CERTIFICATE_VERIFY_FAILED` | SSL cert issue (proxy/corporate) | macOS: run `Install Certificates.command`; else set `SSL_CERT_FILE` env var |
| `URLError` / `ConnectionError` | Network unreachable | Check internet; set `HTTPS_PROXY` if behind proxy |
| `HTTP 429` | Rate limited | Wait and retry with backoff |
| `HTTP 5xx` | Server error | Retry with backoff |
| `PermissionError` | Can't write output | Use `--output` to specify writable directory |

## Quick Reference

### Request Fields (Qwen3-TTS HTTP API — `tts.py`)

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | **Required** — text to synthesize (max 600 chars) |
| `voice` | string | **Required** — voice ID (e.g. `Cherry`, `Ethan`) |
| `model` | string | Model ID (default: `qwen-audio-3.0-tts-plus`) |
| `language_type` | string | `Auto`, `Chinese`, `English`, `Japanese`, `Korean`, `French`, `German`, etc. |
| `instructions` | string | Tone/style instructions — `qwen3-tts-instruct-flash` only, max 1,600 tokens, Chinese & English only |
| `optimize_instructions` | bool | When true, the system semantically enhances `instructions` for better naturalness. Requires `instructions` to be set. Default: false |
| `stream` | bool | Enable streaming (Base64 chunks) |

### Request Fields (CosyVoice NRT API — `tts_cosyvoice.py`)

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | **Required** — text to synthesize (max 20,000 chars per call) |
| `voice` | string | **Required** — voice ID (model-specific, see voice lists) |
| `model` | string | Model ID (default: `cosyvoice-v3-flash`) |
| `instruction` | string | Free-style instruction for speech control — supported by `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-flash` |
| `language_hints` | list | Target language hint: `zh`, `en`, `fr`, `de`, `ja`, `ko`, `ru`, `pt`, `th`, `id`, `vi`, etc. |
| `format` | string | Audio format: `mp3` (default), `wav`, `pcm`, `opus` |
| `sample_rate` | int | Sample rate (Hz): 8000, 16000, 22050 (default), 24000, 44100, 48000 |

### Response Fields

| Field | Description |
|-------|-------------|
| `audio_url` | URL of generated audio (valid 24h) |
| `audio_format` | Format (e.g. wav) |
| `sample_rate` | Sample rate (e.g. 24000) |
| `usage` | Character usage |

## Important Notes

- **text**: Max 600 characters per request (Qwen3-TTS). Max 20,000 characters (CosyVoice/Qwen-Audio-TTS NRT).
- **instructions** (Qwen3-TTS): Only works with `qwen3-tts-instruct-flash`. Max 1,600 tokens. Chinese & English only.
- **instruction** (CosyVoice): Supported by `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-flash`. (Qwen-Audio-TTS also supports `instruction` via `tts.py`.) Use natural language to control dialect, emotion, pace, or character.
- **language_type** (Qwen3-TTS): `Auto` for mixed language; specify for better pronunciation.
- **language_hints** (CosyVoice/Qwen-Audio-TTS): Specify target language code (`zh`, `en`, etc.) for improved synthesis quality.
- **audio_url**: Valid for 24 hours — download promptly.
- **Real-time/streaming TTS**: For WebSocket-based real-time TTS (CosyVoice, qwen3-tts-flash-realtime), a WebSocket client is required. This skill covers the HTTP-based non-real-time API. For real-time streaming use cases, refer to the official docs in [sources.md](references/sources.md).

## Cross-Skill Chaining

When passing generated audio to another skill (e.g., video-gen audio overlay):
- **Pass `audio_url` directly** — scripts detect URL prefixes and pass through without re-upload
- Use `audio_file` only for local playback or non-API operations

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `401 Unauthorized` | Invalid or missing API key | Run **qianwen-ops-auth** if available; else prompt user to set key (non-plaintext check only) |
| `400` | Invalid parameters (missing text/voice) | Validate request body |
| `429` / `5xx` | Rate limit or server error | Retry with backoff |

> **Usage & billing**: Use the **qianwen-usage** skill to check usage, free tier quota, and billing directly. Alternatively, the user can visit the QianWen console:
> [Usage Analytics](https://platform.qianwenai.com/home/analytics) |
> [Pay-as-you-go Billing](https://platform.qianwenai.com/home/billing/pay-as-you-go) |
> [Token Plan Subscription](https://platform.qianwenai.com/home/billing/subscription/token-plan)
>
> **NEVER fabricate, guess, or construct usage/billing/console URLs.** Only provide the exact links listed in this skill. If a URL is not listed here, do not invent one.

## Output Location

Prefer the **current working directory**. Default subdirectory: `./output/qianwen-audio-tts/`.

**Write prohibition**: NEVER write output files into this skill's installation directory or any `skills/` hierarchy. All generated content must go to `output/` under the current working directory or a user-specified path.

## Update Check (MANDATORY Post-Execution)

After script execution, check stderr for action signals. The script automatically detects update status and emits structured signals. You MUST act on them. This section also applies when the user explicitly asks to check for updates.

### Signal: `[ACTION_REQUIRED] qianwen-update-check skill is not installed`

When stderr contains this signal, you MUST present the following options to the user and **wait for their response before proceeding**. Do NOT silently skip this.

> The update-check skill is not installed. It keeps you informed about new QianWen-AI/qianwen-ai features and bug fixes.
>
> 1) **Install now** — I'll run the install command for you
> 2) **Skip for now** — do nothing this time
> 3) **Never remind me** — permanently suppress this prompt

After the user responds:
- User chooses **1** → run: `npx skills add QianWen-AI/qianwen-ai --skill qianwen-update-check -y`, then run: `python3 <this-skill-scripts-dir>/gossamer.py --dismiss`
- User chooses **2** → run: `python3 <this-skill-scripts-dir>/gossamer.py --dismiss`, then continue normally
- User chooses **3** → run: `python3 <this-skill-scripts-dir>/gossamer.py --never-install`, then continue normally

### Signal: `[UPDATE_AVAILABLE]`

When stderr contains this signal, you MUST append a brief update notice to your response, including the version info and the update command shown in the stderr output.

### No signal in stderr

If stderr contains neither `[ACTION_REQUIRED]` nor `[UPDATE_AVAILABLE]`, no action is needed — the skill is installed and up to date (or cached within 24h).

### Explicit user request

When the user explicitly asks to check for updates (e.g. "check for updates", "check version"):
1. Look for `qianwen-update-check/SKILL.md` in sibling skill directories.
2. If found — run: `python3 <qianwen-update-check-dir>/scripts/check_update.py --print-response` and report the result.
3. If not found — present the install options above.

## References

- [execution-guide.md](references/execution-guide.md) — Fallback paths (curl standard/instruct/streaming, code generation, autonomous)
- [api-guide.md](references/api-guide.md) — API supplementary guide
- [sources.md](references/sources.md) — Official documentation URLs
