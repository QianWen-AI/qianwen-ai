---
name: qianwen-video-generation
description: "Generate videos using Wan and HappyHorse models. Supports text-to-video, image-to-video, first+last frame, reference-based role-play, and video editing (VACE). TRIGGER when: user wants to create, generate, or edit video content, mentions video generation/animation/video clips/Wan/HappyHorse models, or explicitly invokes this skill by name (e.g. use qianwen-video-generation). DO NOT TRIGGER when: user wants to generate images (use qianwen-image-generation), understand/analyze existing videos (use qianwen-vision), text-only tasks."
compatibility: "Requires Python 3.9+ and curl. Cursor: auto-loaded. Claude Code: read this skill's SKILL.md before first use."
---

# Qwen Video Generation

Generate videos using Wan and HappyHorse models. All tasks are **asynchronous** — submit, then poll until
completion.
This skill is part of **QianWen-AI/qianwen-ai**.

> **⚠️ Critical Parameter Differences by Mode:**
> - **kf2v (First+Last Frame)**: Duration is **fixed at 5 seconds** — other values will fail. Output is **silent only**.
> - **Resolution parameter varies**: t2v/r2v/vace use `size` (e.g. `"1280*720"`); i2v/kf2v use `resolution` (e.g. `"720P"`).

## Skill directory

Use this skill's internal files to execute and learn. Load reference files on demand when the default path fails or you need details.

| Location | Purpose |
|----------|---------|
| `scripts/video.py` | Default execution — mode auto-detect, submit, poll, download |
| `references/execution-guide.md` | Fallback: curl for all 5 modes, code generation |
| `references/request-fields.md` | Field tables and audio handling by mode |
| `references/workflows.md` | Duration extensions, multi-shot, VACE pipelines |
| `references/polling-guide.md` | Polling patterns and timing |
| `references/merge-media.md` | Concat, trim, audio overlay — ffmpeg/moviepy recipes |
| `references/prompt-guide.md` | Per-mode prompt formulas, sound description, multi-shot structure |
| `references/examples.md` | Full script examples per mode |
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

Token Plan does not support local file upload; for i2v/r2v/kf2v modes, provide reference images/videos
as accessible URLs (`https://` or `oss://`) rather than local paths.

Token Plan supports only specific models — use exactly a model from the references above; do not
guess or probe model availability. For PAYG, continue below.

## Mode Selection Guide

| User Want | Mode | Key Field |
|-----------|------|------------|
| Generate video from text description only | **t2v** | `prompt` only |
| Animate a single image | **i2v** | `img_url` or `reference_image` |
| wan2.7 unified i2v: first frame, first+last frame, video continuation, audio sync | **i2v** | `media[]`, `first_frame_url`, `first_clip_url`, `driving_audio_url` |
| Transition between two images (**⚠️ 5s fixed, silent only**) | **kf2v** | `first_frame_url` + `last_frame_url` |
| Role-play: make characters act a new script | **r2v** | `reference_urls` (up to 5) |
| Video editing: multi-image ref, repainting, local edit, extend, outpaint | **vace** | `function` (default `wanx2.1-vace-plus`) |
| Video editing (no `function` field, uses media array) | **videoedit** | model = `wan2.7-videoedit` or `happyhorse-1.0-video-edit` |

### Model Selection

1. **User specified a model** → use directly.
2. **Consult the qianwen-model-selector skill** when model choice depends on capability, scenario, or pricing.
3. **No signal, clear task** → defaults: t2v → `happyhorse-1.1-t2v`, i2v → `happyhorse-1.1-i2v`, kf2v → `wan2.2-kf2v-flash`, r2v → `happyhorse-1.1-r2v`, vace → `wanx2.1-vace-plus`, videoedit → `wan2.7-videoedit`. t2v/i2v/r2v defaults (HappyHorse 1.1) are TP+PAYG compatible with audio output, 3–15s; kf2v/vace/videoedit defaults are **PAYG-only**. For wan2.6 features (multi-shot, `size` param), explicitly set `--model wan2.6-t2v` / `--model wan2.6-i2v-flash`. For wan2.7 features, explicitly set `--model wan2.7-t2v` / `--model wan2.7-i2v` / `--model wan2.7-videoedit`. For HappyHorse 1.0 series, set `--model happyhorse-1.0-{t2v,i2v,r2v,video-edit}`.

## Models

### t2v (Text-to-Video)

| Model | Features |
|-------|----------|
| `wan2.7-t2v` | Ratio control, auto-dubbing, 5000 char prompt, 720P/1080P. Use `resolution` + `ratio` params. |
| `wan2.7-t2v-2026-06-12` | Snapshot of wan2.7-t2v. Same capabilities. |
| `wan2.6-t2v` | Audio, multi-shot, 2–15s, 720P/1080P. Use `size` param. |
| `wan2.5-t2v-preview` | Audio, 5s/10s, 480P/720P/1080P |
| `wan2.2-t2v-plus` | Silent, 5s, 480P/1080P |

### i2v (Image-to-Video)

| Model | Features |
|-------|----------|
| `wan2.7-i2v` | Unified protocol: first frame, first+last frame, video continuation, audio sync. Uses `media[]` array. |
| `wan2.6-i2v-flash` | Audio/silent, multi-shot, 2–15s, 720P/1080P. Uses `img_url`. |
| `wan2.6-i2v` | Audio, multi-shot, 2–15s, 720P/1080P |
| `wan2.5-i2v-preview` | Audio, 5s/10s, 480P/720P/1080P |

### kf2v / r2v / vace

| Model                                       | Features                                                            |
|---------------------------------------------|---------------------------------------------------------------------|
| `wan2.2-kf2v-flash` **(kf2v default)**      | Silent, 5s, 480P/720P/1080P                                         |
| `wan2.7-r2v`                                | **Multi-reference (image/video/audio)** role-play. `input.media=[{type,url}]` up to 5 mixed refs (`reference_image`/`reference_video`/`reference_audio`). `resolution` 720P/1080P + `duration` ≤10s, no `ratio`. **PAYG-only.** |
| `wan2.7-r2v-2026-06-12`                     | Snapshot of wan2.7-r2v. Subject reference + voice customization + storyboard. |
| `wan2.6-r2v`                                | Audio, single/multi character, 2–10s, 720P/1080P                    |
| `wan2.6-r2v-flash`                          | Audio/silent, multi-character, 2–10s, 720P/1080P. PAYG-only.        |
| `wanx2.1-vace-plus` **(vace)**               | Multi-image ref, repainting, local edit, ≤5s, 720P                  |

### wan3.0-video / wan3.0-video-prime (All-in-One t2v + i2v)

Unified all-in-one models supporting both text-to-video (t2v) and image-to-video (i2v)
in a single model. Mode is auto-detected: **t2v** when only `prompt` is given, **i2v** when
a reference image is supplied (`img_url` / `reference_image` / `media`). **PAYG-only.**

| Model                 | Features                                                                     |
|-----------------------|------------------------------------------------------------------------------|
| `wan3.0-video`        | t2v + i2v, `resolution` 480P/720P/1080P + `ratio` (adaptive/16:9/9:16/1:1) + `duration` ≤30s. i2v uses `input.media=[{type:reference_image,url}]`. |
| `wan3.0-video-prime`  | Higher-quality variant of wan3.0-video. Same payload/parameters.             |

> **PAYG-only**: `wan2.7-r2v`, `wan3.0-video`, `wan3.0-video-prime`, `wan2.2-kf2v-flash`, `wanx2.1-vace-plus`, and `wan2.7-videoedit` are **not available on Token Plan**. Under Token Plan, local file upload is unsupported — supply all reference images/videos/audio as accessible URLs (`https://` or `oss://`), never local paths.

### videoedit (Video Editing)

Prompt-driven video editing with optional reference images. No `function` field; uses
`input.media = [1 video] + [refs]`. Default model: `wan2.7-videoedit`.

| Model                       | Refs cap | Notes                                                                  |
|-----------------------------|----------|------------------------------------------------------------------------|
| `wan2.7-videoedit` (default)| ≤4       | Local/global prompt-driven edit; supports `negative_prompt`. |
| `happyhorse-1.0-video-edit` | ≤5       | Element replacement via reference images; preserves original dynamics. |

For pricing details, see [wan2.7-videoedit](https://www.qianwenai.com/models/wan2.7-videoedit) · [happyhorse-1.0-video-edit](https://www.qianwenai.com/models/happyhorse-1.0-video-edit).

### HappyHorse Series

| Model                       | Mode      | Payload differences vs wan2.6                                         |
|-----------------------------|-----------|-----------------------------------------------------------------------|
| `happyhorse-1.1-t2v` **default** | t2v       | **Audio output**, 3–15s, 720P/1080P. TP+PAYG compatible. Uses `resolution` + `ratio` (NOT `size`). Same structure as 1.0-t2v. |
| `happyhorse-1.1-i2v` **default** | i2v       | **Audio output**, 3–15s, 720P/1080P. TP+PAYG compatible. Uses `media=[{type:'first_frame',url}]` (exactly one). Same constraints as 1.0-i2v. |
| `happyhorse-1.1-r2v` **default** | r2v       | **Audio output**, 3–15s, 720P/1080P. TP+PAYG compatible. Uses `media=[{type:reference_image,url}]` + `resolution` + `ratio`. Up to 9 refs. |
| `happyhorse-1.0-t2v`        | t2v       | Uses `resolution` + `ratio` (NOT `size`). |
| `happyhorse-1.0-i2v`        | i2v       | Uses `media=[{type:'first_frame',url}]` (exactly one). NO `negative_prompt`/`prompt_extend`/`ratio`/`last_frame`/`first_clip`/`driving_audio`. Wan2.6-style `img_url` auto-converted. |
| `happyhorse-1.0-r2v`        | r2v       | Uses `media=[{type:reference_image,url}]` + `resolution` + `ratio`. Up to 9 refs. |
| `happyhorse-1.0-video-edit` | videoedit | Uses `input.media = [1 video] + [refs]`. No `function` field. Up to 5 refs. |

Endpoint: `/services/aigc/video-generation/video-synthesis`.


> **⚠️ Important**: The model list above is a **point-in-time snapshot** and may be outdated. Model availability
> changes frequently. **Always check the [official model list](https://www.qianwenai.com/models)
> for the authoritative, up-to-date catalog before making model decisions.**

> **Model details**: For more information about a specific model, direct the user to its detail page: `https://www.qianwenai.com/models/<model-name>` (replace `<model-name>` with the exact model ID, e.g. `wan2.7-t2v` → https://www.qianwenai.com/models/wan2.7-t2v). NEVER modify or guess the model name in the URL.

> **Dynamic model queries**: If the **qianwen-model-selector** skill or **QianWen CLI** (`qianwen models info <model>`) is available, use it for real-time model data. CLI requires authentication — see the **qianwen-usage** skill for login flow.

## Execution

> **⚠️ Multiple artifacts**: When generating multiple files in a single session, you MUST append a numeric suffix to each filename (e.g. `out_1.mp4`, `out_2.mp4`) to prevent overwrites.

### Prerequisites

- **API Key**: Use the non-plaintext detector in **Key Compatibility**; do not replace it with a
  variable-presence check. If no Key is found, use qianwen-ops-auth when available or guide the user
  to configure `DASHSCOPE_API_KEY`/`QIANWEN_API_KEY` in `.env`. Skills may be installed independently.
- Python 3.9+ (stdlib only, **no pip install needed**)
- For media merging (concat, trim, audio overlay): see [merge-media.md](references/merge-media.md) for ffmpeg/moviepy recipes suited to the user's environment

### Environment Check

Before first execution, verify Python is available:

```bash
python3 --version  # must be 3.9+
```

If `python3` is not found, try `python --version` or `py -3 --version`. If Python is unavailable or below 3.9, skip to **Path 2 (curl)** in [execution-guide.md](references/execution-guide.md).

### Default: Run Script

**Script path**: Scripts are in the `scripts/` subdirectory **of this skill's directory** (the directory containing this SKILL.md). **You MUST first locate this skill's installation directory, then ALWAYS use the full absolute path to execute scripts.** Do NOT assume scripts are in the current working directory. Do NOT use `cd` to switch directories before execution.

**Execution note:** Run all scripts in the **foreground** — wait for stdout; do not background.

**Discovery:** Run `python3 <this-skill-dir>/scripts/video.py --help` first to see all available arguments.

```bash
python3 <this-skill-dir>/scripts/video.py \
  --request '{"prompt":"A detective in a rainy city at night","size":"1280*720","duration":5}' \
  --print-response
```

| Argument | Description |
|----------|-------------|
| `--request '{...}'` | JSON request body |
| `--file path.json` | Load request from file |
| `--mode MODE` | Override auto-detected mode (t2v/i2v/kf2v/r2v/vace) |
| `--model ID` | Override model |
| `--output path` | Directory or file path. If path ends with a video extension (.mp4/.mov/.webm/.mkv/.m4v etc.), it is used as the output filename (parent dir auto-created). Otherwise treated as directory — video is auto-named from the OSS URL basename, preventing overwrites across runs; use distinct filenames across calls to avoid overwriting response data |
| `--print-response` | Print response JSON to stdout |
| `--submit-only` | Submit and exit (print task_id) |
| `--task-id ID` | Operate on existing task |
| `--poll-interval N` | Seconds between polls (default: 15) |
| `--timeout N` | Max wait seconds (default: 600) |

> **Model priority**: `--model` CLI flag > `"model"` field in `--request` JSON > built-in default.

### Verify Result

- Exit code `0` + response has `output.task_id` → **submission success**
- Poll reaches `task_status: SUCCEEDED` → **generation complete**
- Non-zero exit, HTTP error, or `FAILED` status → **fail**
- **Post-execution check**: Verify the output video file exists and has non-zero size (`ls -la <output_dir>`)
- **MANDATORY — stderr signal check**: After confirming the result, scan the command's stderr output for `[ACTION_REQUIRED]` or `[UPDATE_AVAILABLE]`. If either signal is present, you **MUST** follow the instructions in [Update Check](#update-check-mandatory-post-execution) below before responding to the user.

### On Failure

If the script fails, match the error output against the diagnostic table below to determine the resolution. If no match, read [execution-guide.md](references/execution-guide.md) for alternative paths: curl commands (Path 2 — all 5 modes), code generation (Path 3), and autonomous resolution (Path 5).

**If Python is not available at all** → skip directly to Path 2 (curl) in [execution-guide.md](references/execution-guide.md).

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
| `ImportError: moviepy` | moviepy not installed | `pip install moviepy`, or use system ffmpeg instead (see [merge-media.md](references/merge-media.md)) |
| `PermissionError` | Can't write output | Use `--output` to specify writable directory |

## Request Fields Summary

All modes require `prompt`. See [request-fields.md](references/request-fields.md) for full field tables per mode.

### ⚠️ Resolution Parameter by Mode (Critical)

| Mode | Parameter | Format | Example |
|------|-----------|--------|--------|
| t2v | `size` | `"WxH"` | `"1280*720"`, `"1920*1080"` |
| r2v | `size` | `"WxH"` | `"1280*720"`, `"1920*1080"` |
| vace | `size` | `"WxH"` | `"1280*720"` |
| i2v | `resolution` | `"xxxP"` | `"720P"`, `"1080P"` |
| kf2v | `resolution` | `"xxxP"` | `"480P"`, `"720P"`, `"1080P"` |

> **Using the wrong parameter name will cause the API call to fail.**

### Mode-Specific Required Fields

- i2v needs `img_url`/`reference_image`. kf2v needs `first_frame_url` + `last_frame_url`. r2v needs `reference_urls`. vace needs `function`.

## Cost Estimation

> 🚨 **NEVER guess or fabricate any price figure.** Always direct the user to the
> [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing) for exact rates.

Cost is billed per second of generated video. Price varies by model and resolution. For the latest rates, check
the [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing).

| Model            | 720P (USD)         | 1080P (USD)        |
|------------------|--------------------|--------------------|
| wan2.7-t2v       | per-second billing | per-second billing |
| wan2.7-i2v       | per-second billing | per-second billing |
| wan2.6-t2v       | per-second billing | per-second billing |
| wan2.6-i2v-flash | per-second billing | per-second billing |
| wan2.6-r2v-flash | per-second billing | per-second billing |

Quick example: happyhorse-1.1-t2v 5s 720P — check
the [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing) for current per-second
rates. Some models may offer a limited free quota — **do not assume any call is free**; use the **qianwen-usage** skill to check remaining free tier quota, or verify in the user's [QianWen console](https://platform.qianwenai.com/home/benefits).

To check actual usage and bills: use the **qianwen-usage** skill, or visit the console:
[Usage Analytics](https://platform.qianwenai.com/home/analytics) |
[Pay-as-you-go Billing](https://platform.qianwenai.com/home/billing/pay-as-you-go) |
[Token Plan Subscription](https://platform.qianwenai.com/home/billing/subscription/token-plan)

> **NEVER fabricate, guess, or construct usage/billing/console URLs.** Only provide the exact links listed in this skill. If a URL is not listed here, do not invent one.

## Local File Handling

When the user provides local file paths (images, videos, audio), pass them directly to the script. The script **automatically uploads** local files to DashScope temporary storage (`oss://` URL, 48h TTL) and injects the `X-DashScope-OssResourceResolve: enable` header. No manual upload step is needed.

> **Production**: Default temp storage has **48h TTL** and **100 QPS upload limit** — not suitable for production, high-concurrency, or load-testing. To use your own OSS bucket, set `QWEN_TMP_OSS_BUCKET` and `QWEN_TMP_OSS_REGION` in `.env`, install `pip install oss2`, and provide credentials via `QWEN_TMP_OSS_AK_ID` / `QWEN_TMP_OSS_AK_SECRET` or the standard `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`. Use a RAM user with least-privilege (`oss:PutObject` + `oss:GetObject` on target bucket only). If qianwen-ops-auth is installed, see its `references/custom-oss.md` for the full setup guide.

## Cross-Skill Chaining

When using output from another skill as input (e.g., image-gen → i2v, audio-tts → audio overlay):
- **Pass the URL directly** (e.g., `"img_url": "<image_url from image-gen>"`) — do NOT download and re-pass as local path
- The script detects URL prefixes (`https://`, `oss://`) and passes them through without re-upload
- Use `local_path` from the response only for user preview or non-API operations

When passing this skill's output to another skill (e.g., vace edit, vision analyze):
- **Pass `video_url` from the response** — do NOT download and re-pass as local path

| Scenario | Use |
|----------|-----|
| Feed to another skill | `video_url` / `image_url` (URL) |
| Show to user / local playback | `local_path` (local file) |

## Important Notes

- **Async only**: All video APIs require `X-DashScope-Async: enable` header.
- **kf2v**: Uses a **different API endpoint**. Duration **fixed at 5s**, **silent only**.
- **r2v**: Use `character1`/`character2`/... in prompt. Up to 5 references (max 3 videos).
- **vace**: Must specify `function`. **Silent only**, output **≤5s**.
- **Multi-shot**: Set `shot_type: "multi"` AND `prompt_extend: true`.
- **Video URL expires in 24h** — the script auto-downloads to `--output` dir. When chaining to another skill (e.g., vace edit), pass `video_url` directly — do NOT re-download.
- For advanced workflows → see [workflows.md](references/workflows.md).

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `401 Unauthorized` | Invalid or missing API key | Run **qianwen-ops-auth** if available; else prompt user to set key (non-plaintext check only) |
| `current user api does not support synchronous calls` | Missing async header | Add `X-DashScope-Async: enable` |
| `429` / `5xx` | Rate limit or server error | Retry with backoff |
| `The product is not activated` / `Model not subscribed` | Third-party model not enabled on account | Visit [Model Market](https://www.qianwenai.com/models), find the model, click "Enable" / "开通" |
| Task `FAILED` | Generation failed | Check `output.message` in poll response |

## Output Location

Prefer the **current working directory**. Default subdirectory: `./output/qianwen-video-generation/`.

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

- [execution-guide.md](references/execution-guide.md) — Fallback paths (curl for all modes, code generation, autonomous)
- [request-fields.md](references/request-fields.md) — Detailed field tables by mode + audio handling
- [workflows.md](references/workflows.md) — Duration extensions, audio workarounds, multi-shot, VACE pipelines
- [polling-guide.md](references/polling-guide.md) — Polling patterns and timing recommendations
- [merge-media.md](references/merge-media.md) — Guide for generating merge/trim/audio-overlay code
- [examples.md](references/examples.md) — Full script execution examples for all modes
- [sources.md](references/sources.md) — Official documentation URLs
