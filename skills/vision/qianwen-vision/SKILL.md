---
name: qianwen-vision
description: "Understand images and videos with Qwen vision models. TRIGGER when: user wants to analyze, describe, or extract information from images or videos, OCR text extraction, chart/table reading, visual reasoning, multi-image comparison, screenshot understanding, video comprehension, or explicitly invokes this skill by name (e.g. use qianwen-vision). DO NOT TRIGGER when: user wants to generate/create images (use qianwen-image-generation), generate videos (use qianwen-video-generation), text-only tasks without visual input, or non-Qwen vision tasks."
compatibility: "Requires Python 3.9+ and curl. Cursor: auto-loaded. Claude Code: read this skill's SKILL.md before first use."
---

# Qwen Vision (Image & Video Understanding)

Analyze images and videos using Qwen VL and QVQ models.
This skill is part of **QianWen-AI/qianwen-ai**.

## Skill directory

Use this skill's internal files to execute and learn. Load reference files on demand when the default path fails or you need details.

| Location | Purpose |
|----------|---------|
| `scripts/analyze.py` | Image/video understanding, multi-image, thinking mode |
| `scripts/reason.py` | Visual reasoning (QVQ, chain-of-thought, streaming) |
| `scripts/ocr.py` | OCR text extraction |
| `scripts/vision_lib.py` | Shared helpers (base64, upload, streaming) |
| `references/execution-guide.md` | Fallback: curl, code generation |
| `references/curl-examples.md` | Curl for base64, multi-image, video, OCR |
| `references/visual-reasoning.md` | QVQ and thinking mode details |
| `references/prompt-guide.md` | Query prompt templates by task, thinking mode decision |
| `references/ocr.md` | OCR parameters and examples |
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

For Token Plan, use an exact model from qianwen-model-selector, or consult
`qianwen-ops-auth/references/tokenplan.md`. If unavailable, use:
- Personal: https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md
- Team: https://platform.qianwenai.com/docs/token-plan/team/token-plan-team-overview.md

Token Plan users: use a model with vision capability — `qwen3.8-max`, `qwen3.8-flash`,
`qwen3.7-plus`, `qwen3.6-flash` (personal + team), or `qwen3.6-plus`, `kimi-k2.7-code`,
`kimi-k2.6`, `kimi-k2.5` (team only). Other models in Token Plan do not support image/video
understanding.

Token Plan supports only specific models — use exactly a model from the references above; do not
guess or probe model availability. For PAYG, continue below.

> **Token Plan users**: The `ocr` default `qwen3.5-ocr` and `reason` default `qvq-max` are NOT on Token Plan.
> - **OCR**: specify `--model qwen3.8-flash` (low-cost general OCR) or `qwen3.8-max` (best quality). Specialized ID-card/coordinate/formula extraction may be slightly less accurate than the dedicated OCR model.
> - **Visual reasoning**: specify `--model qwen3.8-max` (visual reasoning + thinking) or `qwen3.8-flash` (lightweight).

## Model Selection

| Model | Use Case |
|-------|----------|
| **qwen3.8-max** | Strongest flagship — 2.4T params, MoE. Top-tier multimodal (text+image+video). Thinking on by default. 1M context. Higher cost. |
| **qwen3.8-flash** | Fast flagship multimodal — same-gen as qwen3.8-max, optimized for speed and cost-efficiency. Multimodal (text+image+video). Thinking on by default. 1M context. |
| **qwen3.7-flash** | High-perf multimodal flash — surpasses qwen3.6-flash across all dimensions. Enhanced universal recognition, Search Agent & CI Agent. Vibe coding optimized. Thinking on by default. 1M context. Best cost-efficiency for vision tasks. |
| **qwen3.7-plus** | **Preferred** — next-gen balanced model, surpasses qwen3.6-plus in multimodal understanding, Agent execution & coding, GUI perception. 1M context. Thinking on by default. |
| **qwen3.6-plus** | Previous-gen balanced — multimodal (text+image+video). Thinking on by default. Strong coding & universal recognition. |
| **qwen3.5-plus** | Unified multimodal (text+image+video). Thinking on by default. |
| **qwen3.5-flash** | Fast multimodal — cheaper, faster. Thinking on by default. |
| **qwen3-vl-plus** | High-precision — object localization (2D/3D), document/webpage parsing. |
| **qwen3-vl-flash** | Fast vision — lower latency, 33 languages. |
| **qvq-max** | Visual reasoning — chain-of-thought for math, charts. **Streaming only.** |
| **qwen3.5-ocr** | OCR — latest recommended OCR model. PDF parsing, multi-turn, enhanced ID/card recognition. |
| **qwen-vl-ocr** | OCR — text extraction, table parsing, document scanning. Legacy; use `--model qwen-vl-ocr` to select explicitly. |
| **qwen-vl-max** | Qwen2.5-VL — best-performing in 2.5 series. |
| **qwen-vl-plus** | Qwen2.5-VL — faster, good balance of performance and cost, 11 languages. |

1. **User specified a model** → use directly.
2. **Consult the qianwen-model-selector skill** when model choice depends on requirement, scenario, or pricing.
3. **No signal, clear task** → `qwen3.7-plus`. Use `qwen3.7-flash` for cost-efficient high-performance vision. Use `qwen3.8-max` for the most complex reasoning. Use `qwen3-vl-plus` for precise localization or 3D detection.

> **⚠️ Important**: The model list above is a **point-in-time snapshot** and may be outdated. Model availability
> changes frequently. **Always check the [official model list](https://www.qianwenai.com/models)
> for the authoritative, up-to-date catalog before making model decisions.**

> **Model details**: For more information about a specific model, direct the user to its detail page: `https://www.qianwenai.com/models/<model-name>` (replace `<model-name>` with the exact model ID, e.g. `qwen3.6-plus` → https://www.qianwenai.com/models/qwen3.6-plus). NEVER modify or guess the model name in the URL.

> **Dynamic model queries**: If the **qianwen-model-selector** skill or **QianWen CLI** (`qianwen models info <model>`) is available, use it for real-time model data. CLI requires authentication — see the **qianwen-usage** skill for login flow.

## Execution

### Prerequisites

- **API Key**: Use the non-plaintext detector in **Key Compatibility**; do not replace it with a
  variable-presence check. If no Key is found, use qianwen-ops-auth when available or guide the user
  to configure `DASHSCOPE_API_KEY`/`QIANWEN_API_KEY` in `.env`. Skills may be installed independently.
- Python 3.9+ (stdlib only, **no pip install needed**)

### Environment Check

Before first execution, verify Python is available:

```bash
python3 --version  # must be 3.9+
```

If `python3` is not found, try `python --version` or `py -3 --version`. If Python is unavailable or below 3.9, skip to **Path 2 (curl)** in [execution-guide.md](references/execution-guide.md).

### Default: Run Script

**Script path**: Scripts are in the `scripts/` subdirectory **of this skill's directory** (the directory containing this SKILL.md). **You MUST first locate this skill's installation directory, then ALWAYS use the full absolute path to execute scripts.** Do NOT assume scripts are in the current working directory. Do NOT use `cd` to switch directories before execution. Shared infrastructure lives in `scripts/vision_lib.py`.

**Execution note:** Run all scripts in the **foreground** — wait for stdout; do not background.

**Discovery:** Run `python3 <this-skill-dir>/scripts/analyze.py --help` (or `reason.py`, `ocr.py`) first to see all available arguments.

| Script | Purpose | Default Model |
|--------|---------|---------------|
| `scripts/analyze.py` | Image understanding, multi-image, video, thinking mode, high-res | `qwen3.7-plus` |
| `scripts/reason.py` | Visual reasoning with chain-of-thought, video reasoning (always streaming) | `qvq-max` |
| `scripts/ocr.py` | OCR text extraction from documents, receipts, tables | `qwen3.5-ocr` |

**Input type fields** (use exactly one in `--request` JSON):

| Field | Use for | Example |
|-------|---------|--------|
| `"image"` | Single image (URL or local path) | `"image": "photo.jpg"` |
| `"images"` | Multi-image comparison (array) | `"images": ["a.jpg", "b.jpg"]` |
| `"video"` | Video file (URL or local path) | `"video": "clip.mp4"` |
| `"video_frames"` | Video as frame array | `"video_frames": ["f1.jpg", "f2.jpg"]` |

> **⚠️ Common mistake**: Do NOT use `"image"` for video files — use `"video"` instead.

```bash
# Image analysis
python3 <this-skill-dir>/scripts/analyze.py \
  --request '{"prompt":"What is in this image?","image":"https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"}' \
  --output output/qianwen-vision/result.json --print-response

# Video analysis (local file — add --upload-files for files >= 7 MB)
python3 <this-skill-dir>/scripts/analyze.py \
  --request '{"prompt":"Describe what happens in this video","video":"clip.mp4"}' \
  --upload-files --print-response

python3 <this-skill-dir>/scripts/reason.py \
  --request '{"prompt":"Solve this math problem step by step","image":"problem.png"}' \
  --print-response

python3 <this-skill-dir>/scripts/ocr.py \
  --request '{"image":"invoice.jpg"}' \
  --print-response
```

| Argument | Description |
|----------|-------------|
| `--request '{...}'` | JSON request body |
| `--file path.json` | Load request from file |
| `--output path` | Save response JSON to path |
| `--print-response` | Print response to stdout |
| `--stream` | Enable streaming (auto for thinking/QVQ) |
| `--upload-files` | Upload local files to temp storage (for files > 7 MB) |
| `--model ID` | Override model (default per script: see table above) |
| `--schema path.json` | JSON Schema for structured extraction |

> **Model priority**: `--model` CLI flag > `"model"` field in `--request` JSON > built-in default.

### Verify Result

- Exit code `0` + output contains valid JSON with `choices` field → **success**
- Non-zero exit, HTTP error, empty response, or JSON with `"code"`/`"message"` error → **fail**
- **Post-execution check**: When `--output` is used, verify the response JSON file exists and contains expected content
- **MANDATORY — stderr signal check**: After confirming the result, scan the command's stderr output for `[ACTION_REQUIRED]` or `[UPDATE_AVAILABLE]`. If either signal is present, you **MUST** follow the instructions in [Update Check](#update-check-mandatory-post-execution) below before responding to the user.

### On Failure

If scripts fail, match the error output against the diagnostic table below to determine the resolution. If no match, read [execution-guide.md](references/execution-guide.md) for alternative paths: curl commands (Path 2), code generation (Path 3), and autonomous resolution (Path 5).

**If Python is not available at all** → skip directly to Path 2 (curl) in [execution-guide.md](references/execution-guide.md).

| Error Pattern                    | Diagnosis                        | Resolution                                                                                                                                                  |
|----------------------------------|----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `command not found: python3`     | Python not on PATH               | Try `python` or `py -3`; install Python 3.9+ if missing                                                                                                     |
| `Python 3.9+ required`           | Script version check failed      | Upgrade Python to 3.9+                                                                                                                                      |
| `SyntaxError` near type hints    | Python < 3.9                     | Upgrade Python to 3.9+                                                                                                                                      |
| `QIANWEN_API_KEY/DASHSCOPE_API_KEY not found` | Missing API key | Obtain key from [QianWen Console](https://platform.qianwenai.com/home/api-keys); add to `.env`: `echo 'DASHSCOPE_API_KEY=sk-...' >> .env`; or run **qianwen-ops-auth** if available |
| `HTTP 401`                       | Invalid or mismatched key        | Run **qianwen-ops-auth** (non-plaintext check only); verify key is valid                                                                                  |
| `SSL: CERTIFICATE_VERIFY_FAILED` | SSL cert issue (proxy/corporate) | macOS: run `Install Certificates.command`; else set `SSL_CERT_FILE` env var                                                                                 |
| `URLError` / `ConnectionError`   | Network unreachable              | Check internet; set `HTTPS_PROXY` if behind proxy                                                                                                           |
| `HTTP 429`                       | Rate limited                     | Wait and retry with backoff                                                                                                                                 |
| `HTTP 5xx`                       | Server error                     | Retry with backoff                                                                                                                                          |
| `PermissionError`                | Can't write output               | Use `--output` to specify writable directory                                                                                                                |

## File Input

The API accepts: **HTTP/HTTPS URL**, **Base64 data URI**, and **`oss://` URL**. Local file paths are NOT directly supported — scripts handle conversion automatically. **Pass local paths directly; no manual upload step needed.**

**Large file rule: If the local file is >= 7 MB, always add `--upload-files`.** Base64 encoding inflates size by ~33% and will exceed the 10 MB API limit. Small files (including short video clips < 7 MB) can use the default base64 path.

> **Token Plan (`sk-sp-...`) exception**: The `--upload-files` temp-upload endpoint is unavailable for Token Plan keys and will be blocked with a friendly error. Token Plan users should use the default base64 path for local files; for files >= 7 MB, pass an accessible URL (`https://` or `oss://`) instead of `--upload-files`.

| Method | When to use | How |
|--------|-------------|-----|
| **Online URL** | File already hosted | Pass URL directly — **preferred for large files** |
| **Base64** (default) | Local files < 7 MB (images or short video clips) | Script auto-converts to `data:` URI |
| **Temp upload** | Local files >= 7 MB | Add `--upload-files` flag → uploads to DashScope temp storage (`oss://` URL, 48h TTL) |

> **Production**: Default temp storage has **48h TTL** and **100 QPS upload limit** — not suitable for production, high-concurrency, or load-testing. To use your own OSS bucket, set `QWEN_TMP_OSS_BUCKET` and `QWEN_TMP_OSS_REGION` in `.env`, install `pip install oss2`, and provide credentials via `QWEN_TMP_OSS_AK_ID` / `QWEN_TMP_OSS_AK_SECRET` or the standard `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`. Use a RAM user with least-privilege (`oss:PutObject` + `oss:GetObject` on target bucket only). The `--upload-files` flag is still required for vision scripts to trigger upload. If qianwen-ops-auth is installed, see its `references/custom-oss.md` for the full setup guide.

## Input from Other Skills

When the input file comes from another skill's output (e.g., image-gen, video-gen):
- **Pass the URL directly** (e.g., `"image": "<image_url from image-gen>"`) — do NOT download the URL first
- Downloading and re-passing as a local path wastes bandwidth and triggers unnecessary base64 encoding or OSS upload
- All URL types are supported: `https://`, `oss://`, `data:`

## Thinking Mode

| Model | Thinking Default | Notes |
|-------|-----------------|-------|
| `qwen3.8-max` | **On** | Strongest flagship. Disable with `enable_thinking: false` for simple tasks. |
| `qwen3.7-plus` | **On** | **Preferred default.** Disable with `enable_thinking: false` for simple tasks. |
| `qwen3.7-flash` | **On** | High-perf flash. Disable with `enable_thinking: false` for simple tasks. |
| `qwen3.6-plus` | **On** | Multimodal. Disable with `enable_thinking: false` for simple tasks. |
| `qwen3.5-plus` / `qwen3.5-flash` | **On** | Disable with `enable_thinking: false` for simple tasks. |
| `qwen3-vl-plus` / `qwen3-vl-flash` | Off | Enable with `enable_thinking: true`. |
| `qvq-max` | Always on | **Streaming output required.** |

See [visual-reasoning.md](references/visual-reasoning.md) for details.

## OCR (qwen3.5-ocr)

Default OCR model is `qwen3.5-ocr` — the latest recommended OCR model with PDF parsing, multi-turn conversation, and enhanced ID/card recognition. The legacy `qwen-vl-ocr` remains available via `--model qwen-vl-ocr`. Supports multi-language, skewed images, tables, formulas. See [ocr.md](references/ocr.md) for parameters and examples.

## Input Limits

**Images**: BMP/JPEG/PNG/TIFF/WEBP/HEIC. Min 10px sides, aspect ratio <= 200:1. Max 20 MB (URL; Qwen3.8/3.7/3.6/3.5 & Qwen3-VL series) / 10 MB (others).

**Videos**: MP4/AVI/MKV/MOV/FLV/WMV. Duration 2s–2h (Qwen3.8/3.7/3.6/3.5 series) / 2s–1h (Qwen3-VL series) / 2s–10min (others). Max 2 GB (URL) / 10 MB (base64). fps range [0.1, 10], default 2.0.

## Error Handling

| HTTP | Meaning | Action |
|------|---------|--------|
| 401 | Invalid or missing API key | Run **qianwen-ops-auth** if available; else prompt user to set key (non-plaintext check only) |
| 400 | Bad request (invalid format) | Verify messages format and image URL/format |
| 429 | Rate limited | Retry with exponential backoff |
| 5xx | Server error | Retry with exponential backoff |

> **Usage & billing**: Use the **qianwen-usage** skill to check usage, free tier quota, and billing directly. Alternatively, the user can visit the QianWen console:
> [Usage Analytics](https://platform.qianwenai.com/home/analytics) |
> [Pay-as-you-go Billing](https://platform.qianwenai.com/home/billing/pay-as-you-go) |
> [Token Plan Subscription](https://platform.qianwenai.com/home/billing/subscription/token-plan)
>
> **NEVER fabricate, guess, or construct usage/billing/console URLs.** Only provide the exact links listed in this skill. If a URL is not listed here, do not invent one.

## Output Location

Prefer the **current working directory**. Default subdirectory: `./output/qianwen-vision/`.

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

- [execution-guide.md](references/execution-guide.md) — Fallback paths (curl, code generation, autonomous)
- [curl-examples.md](references/curl-examples.md) — Curl templates (base64, multi-image, video, OCR)
- [api-guide.md](references/api-guide.md) — API supplementary guide
- [visual-reasoning.md](references/visual-reasoning.md) — QVQ visual reasoning guide
- [ocr.md](references/ocr.md) — Qwen-VL-OCR text extraction guide
- [sources.md](references/sources.md) — Official documentation URLs
