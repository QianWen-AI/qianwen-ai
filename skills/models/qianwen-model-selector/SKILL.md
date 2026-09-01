---
name: qianwen-model-selector
description: "Recommend the best Qwen model and parameters. TRIGGER when: choosing between Qwen models, comparing Qwen model pricing, understanding Qwen model capabilities, checking usage or billing, viewing cost history, when an execution skill needs model selection advice, or user explicitly invokes this skill by name (e.g. use qianwen-model-selector). DO NOT TRIGGER when: non-Qwen model discussions (OpenAI, Gemini, etc.), general AI questions unrelated to Qwen."
compatibility: "Advisory skill, no execution dependencies. Cursor: auto-loaded. Claude Code: read this skill's SKILL.md before first use."
---

# Qwen Model Selector (Advisor)

## Detecting Key Type

Run this command to detect the API key type (outputs `token-plan`, `payg`, or `not-set`):

```bash
python3 -c "
import os
from pathlib import Path
env_file = Path('.env')
if not env_file.exists():
    for parent in [Path.cwd()] + list(Path.cwd().parents):
        if (parent / '.git').exists() or (parent / 'skills').is_dir():
            env_file = parent / '.env'
            break
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k, v = k.strip(), v.strip().strip('\"').strip(\"'\")
        if k in ('QIANWEN_API_KEY', 'DASHSCOPE_API_KEY') and k not in os.environ:
            os.environ[k] = v
key = os.environ.get('QIANWEN_API_KEY') or os.environ.get('DASHSCOPE_API_KEY') or ''
print('token-plan' if key.startswith('sk-sp-') else 'payg' if key else 'not-set')
"
```

| Output | Billing mode | Action |
|--------|-------------|--------|
| `token-plan` | Token Plan (Credits) | Select only from [Token Plan list](references/recommendation-matrix.md#token-plan-models). Default to Team superset when edition unknown. |
| `payg` | Pay-as-you-go | Full model catalog available; continue below. |
| `not-set` | No key configured | **Do not block.** Ask the user: "Which approach do you plan to use? (1) Standard PAYG key (2) Token Plan key (3) Skip for now — just browse recommendations." Proceed based on their choice. |

> **Windows**: If `python3` is not available, use `python`. The multi-line `-c` string works in both
> PowerShell and CMD. Alternatively, save the snippet to a temporary `.py` file and run it.

This skill operates in two modes:

1. **Interactive advisory** — asks diagnostic questions to recommend the right model (see Diagnostic Flow).
2. **Cross-skill resolution** — provides a fast-path model lookup for execution skills that need a model
   decision without user interaction (see [recommendation-matrix.md](references/recommendation-matrix.md)).

Do not fabricate model names — only recommend models listed in this skill or returned by CLI.
This skill is part of **QianWen-AI/qianwen-ai**.

## Skill directory

Load on demand. Do not fetch external URLs unless the user explicitly asks for the latest data.

| Location                                  | Purpose                                                                          |
|-------------------------------------------|----------------------------------------------------------------------------------|
| `references/cli-usage.md`                 | **CLI-first data strategy**: when to use CLI, 3-step login flow, display rules   |
| `references/error-handling.md`            | CLI error classification & recovery actions (auth, not-found, network, ...)      |
| `references/recommendation-matrix.md`     | Full model recommendation tables, Cross-Skill Resolution, Token Plan, Thinking |
| `references/pricing-disclaimer.md`        | PAYG only: pricing disclaimer (CN/EN) + console links                            |
| `references/pricing.md`                   | PAYG only: pricing structural overview (offline snapshot)                       |
| `references/model-list.md`                | PAYG only: model catalog (offline snapshot)                                     |
| `references/sources.md`                   | Official documentation URLs (manual lookup only)                                 |

## Prerequisites

**QianWen CLI is strongly recommended** — it is the authoritative real-time data source for model
availability, pricing, and quotas. Verify with:

```bash
qianwen version
```

If not installed:

```bash
npm install -g @qianwenai/qianwen-cli
```

Node.js >= 18 required. Without CLI you can still answer general navigation questions from offline
snapshots, but **you cannot answer "latest", "exact price", or "specific model details" questions**.

## Security & Credential Model

QianWen has **two independent credential systems** — never confuse them:

| Credential | Purpose | How to provide |
|------------|---------|----------------|
| **API Key** (`sk-...` / `sk-sp-...`) | Call model APIs in your code | `$DASHSCOPE_API_KEY` / `$QIANWEN_API_KEY` env var |
| **CLI session** | Authorize `qianwen` CLI subcommands | `qianwen auth login` (browser device flow) |

**Red lines (apply to both):**

- **NEVER output any credential value in plaintext.** Use variable references; report only status
  ("set" / "not set", "valid" / "invalid"). Never display `.env` or config file contents.
- **NEVER conflate the two systems.** When CLI returns `Not authenticated` / `AUTH_REQUIRED`, run the
  3-step device-flow login (see [cli-usage.md](references/cli-usage.md#authentication-3-step-login-flow)).
  **DO NOT** ask the user for an API key, and **DO NOT** try to set `$DASHSCOPE_API_KEY` to fix CLI auth.

## Data Resolution Order

Match the user's question to the right data source. **Do not fall back to a lower tier without trying
the recovery actions in the higher tier first.**

| Question type                                                  | Primary source                                          | Notes                                                |
|----------------------------------------------------------------|---------------------------------------------------------|------------------------------------------------------|
| General navigation ("which family for text chat?")             | SKILL.md `Default` table + `recommendation-matrix.md`   | Offline-answerable                                   |
| **Latest / exact / specific** (price, model details, quota)    | **CLI MUST be used** — see `cli-usage.md`               | Snapshots are stale; never invent numbers            |
| Search by capability ("model that does X")                     | `qianwen models search "<X>" --format json`             | Snapshot keyword coverage is incomplete              |
| CLI returned an error                                          | `error-handling.md` recovery actions, **then retry**    | Auth failure → run 3-step login, do not skip to snapshot |
| CLI completely unavailable AND user declines install/login     | `model-list.md`, `pricing.md` (with stale-data caveat)  | Only after CLI recovery genuinely failed             |
| All of the above cannot answer AND user confirms online lookup | URLs in `sources.md`                                    | Never proactively fetch                              |

## Diagnostic Flow (Interactive Advisory)

> **Prerequisite**: Complete [Detecting Key Type](#detecting-key-type) above and narrow the candidate set before
> proceeding. All recommendations below must stay within the user's billing scope.

Ask the user (in order):

1. **Content type?** — text / image / video / audio / vision
2. **Primary task?** — generation / understanding / coding / reasoning / translation
3. **Priority?** — quality vs speed vs cost
4. **Input size?** — short / medium / long context
5. **Structured output?** — JSON / function calling needed?

## Default Recommendations

No clear signals → use the canonical default for the domain. For specialized cases (reasoning, coding,
OCR, role-play, image editing, etc.) and per-domain comparison, see
[recommendation-matrix.md](references/recommendation-matrix.md).

| Domain              | Default          | Quality          | Speed              | Cost               |
|---------------------|------------------|------------------|--------------------|--------------------|
| text.chat           | qwen3.7-plus     | qwen3.8-max      | qwen3.7-flash      | qwen-turbo         |
| text.chat (balanced)| qwen3.7-plus     | qwen3.7-max      | qwen3.7-flash      | qwen3.7-flash      |
| vision.analyze      | qwen3.7-plus     | qwen3.8-max      | qwen3.8-flash      | qwen3.8-flash      |
| omni (voice+vision) | qwen3.5-omni-plus | qwen3.5-omni-plus | qwen3.5-omni-flash | —                  |
| image.generate      | wan2.7-image     | qwen-image-3.0-pro | wan2.2-t2i-flash   | wan2.2-t2i-flash · z-image-turbo (open-source) |
| image.edit          | wan2.7-image     | qwen-image-3.0-pro | wan2.5-i2i-preview | wan2.5-i2i-preview |
| video.t2v           | happyhorse-1.1-t2v | wan2.7-t2v       | happyhorse-1.1-t2v | —                  |
| video.i2v           | happyhorse-1.1-i2v | wan2.7-i2v       | happyhorse-1.1-i2v | —                  |
| video.edit          | wan2.7-videoedit | wan2.7-videoedit | happyhorse-1.0-video-edit | —           |
| audio.tts           | qwen-audio-3.0-tts-plus | qwen-audio-3.0-tts-plus | cosyvoice-v3.5-flash | qwen3-tts-flash |

> **Degradation**: If this skill is not loaded, each execution skill falls back to its own built-in
> default. This protocol is purely additive — it enhances model selection but never blocks execution.

## CLI Quick Reference

> **Auth required.** All `models` and `usage` commands need an active **CLI session** (browser
> device-flow login — **NOT** the API key). If the command returns `Not authenticated` / `AUTH_REQUIRED`:
> 1. **Run the 3-step device-flow login** in [cli-usage.md](references/cli-usage.md#authentication-3-step-login-flow)
>    (proactively open the verification URL using the OS-appropriate command, then poll immediately).
> 2. **Retry the original command** after `success`.
> 3. **DO NOT** ask the user for `$DASHSCOPE_API_KEY` / `$QIANWEN_API_KEY` — those are for model API
>    calls, not CLI session. See [Security & Credential Model](#security--credential-model) above.
> 4. **DO NOT** silently fall back to snapshots.
>
> **Token Plan (`sk-sp-` keys)**: Once an active CLI session is established (device-flow login),
> `qianwen usage` commands report both pay-as-you-go usage and Token Plan seat allowance /
> shared-package Credits for the logged-in account. For purchasing shared packages, adjusting
> seats, or full billing history, direct the user to the
> [Token Plan Subscription console](https://platform.qianwenai.com/home/billing/subscription/token-plan).
> Token Plan model availability (text + image + video + TTS) is documented in
> [recommendation-matrix.md](references/recommendation-matrix.md#token-plan-models).

| Need                          | Command                                                          |
|-------------------------------|------------------------------------------------------------------|
| Full model catalog            | `qianwen models list --all --format json`                        |
| Filter by modality            | `qianwen models list --input image --output text --format json`  |
| Single model details          | `qianwen models info <model-id> --format json`                   |
| Keyword search                | `qianwen models search "<query>" --format json`                  |
| Free tier remaining           | `qianwen usage free-tier --format json`                          |
| Auth status                   | `qianwen auth status --format json`                              |

**Display rules**: Parse `--format json` output and present a human-readable summary; never dump raw
JSON. Display `--format text` output as-is, then add analysis after `---`. See
[cli-usage.md](references/cli-usage.md#agent-display-rules-for-cli-output) for details.

## CLI Error Handling — Quick Guide

When CLI fails, **classify first, recover, then retry**. Never silently fall back to snapshots.

| Category          | Recovery (summary)                                                             |
|-------------------|--------------------------------------------------------------------------------|
| `auth-failure`    | Run 3-step login → **retry the original command**. Fall back only if user declines. |
| `not-installed`   | Show install command → ask user to install → retry. Do NOT silently use snapshot.   |
| `model-not-found` | Run `qianwen models search "<keyword>"` → propose top 3 → retry with correct ID.    |
| `network-timeout` | Retry once after 2s; only after second failure ask whether to fall back.            |
| `quota-exhausted` | Show [Billing Console](https://platform.qianwenai.com/home/billing/pay-as-you-go); do NOT use snapshot. |
| `version-mismatch`| Suggest `qianwen version --check` or update-check skill → upgrade → retry.          |
| `other`           | Show raw stderr; link to docs; only after user opt-out, fall back.                  |

Full classification, signals, and example flows: [error-handling.md](references/error-handling.md).

## Pricing & Cost Estimation (PAYG only)

Skip this section for Token Plan.

- **Latest pricing**: Run `qianwen models info <model> --format json` first; use `pricing.md` only as
  offline fallback. **Never invent a price.**
- **Mandatory disclaimer**: Every cost-related answer **must** end with the disclaimer in
  [pricing-disclaimer.md](references/pricing-disclaimer.md) (Chinese or English version, matching the
  user's response language). Omitting the disclaimer is a **critical failure**.
- **Free quota**: Never assume free quota is available — use `qianwen usage free-tier` to verify or
  direct the user to the [console](https://platform.qianwenai.com/home/benefits).
- **Usage / billing queries**: Direct the user to the appropriate console page — see the table in
  [pricing-disclaimer.md](references/pricing-disclaimer.md#usage--billing-console).

## Update Check

When the user asks to check for updates ("check for updates", "check version", "is there a new version",
"update skills"):

1. **Find qianwen-update-check**: Look for `qianwen-update-check/SKILL.md` in sibling skill directories.
2. **If found** — run: `python3 <qianwen-update-check-dir>/scripts/check_update.py --print-response`
   and report the result. Use `--force` if the user asks to force-check.
3. **If not found** — run `qianwen version --check` and report the result.

## Anti-Patterns

- **Never fabricate model names** — only recommend models listed in this skill or returned by CLI.
- **Never infer the API key type from the request wording** — use the configured Key or calling context.
- **Never recommend a model outside the user's billing scope** — Token Plan keys must only receive
  models from the [Token Plan list](references/recommendation-matrix.md#token-plan-models); PAYG
  keys may use the full catalog. Violating this causes hard failures for the user.
- **Never invent or guess any price figure** — use CLI / `pricing.md` / official pricing page only.
  Fabricating a price is a **critical failure**.
- **Never silently fall back to snapshots when CLI errors out** — apply
  [error-handling.md](references/error-handling.md) recovery actions first.
- **Never assume free quota is available** — quotas may have been consumed, expired, or removed. Always
  present the paid unit price first.
- **Never output API keys in plaintext** — see Security section.
- **Never confuse CLI session with API key** — CLI auth uses browser device-flow login; never offer
  `$DASHSCOPE_API_KEY` or `$QIANWEN_API_KEY` as a fix for CLI `Not authenticated` / `AUTH_REQUIRED` errors.
- **Never proactively fetch URLs or trigger web searches** — only access online sources when CLI +
  snapshots cannot answer AND the user confirms.
- **Never construct usage/billing/console URLs** — only use the exact links listed in this skill or its
  references. If a URL is not listed, do not invent one.
- **Always include the cost disclaimer** for any cost-related answer (see
  [pricing-disclaimer.md](references/pricing-disclaimer.md)).

## References

| Source                                                       | Purpose                                                          |
|--------------------------------------------------------------|------------------------------------------------------------------|
| [cli-usage.md](references/cli-usage.md)                      | CLI-first strategy, 3-step login, display rules, model detail URL |
| [error-handling.md](references/error-handling.md)            | CLI error classification & recovery                              |
| [recommendation-matrix.md](references/recommendation-matrix.md) | Full recommendation tables, Cross-Skill Resolution, Token Plan, Thinking Mode |
| [pricing-disclaimer.md](references/pricing-disclaimer.md)    | Pricing guidance + mandatory disclaimer + billing console links  |
| [pricing.md](references/pricing.md)                          | Pricing structural overview (offline snapshot)                   |
| [model-list.md](references/model-list.md)                    | Model catalog (offline snapshot)                                 |
| [sources.md](references/sources.md)                          | Official documentation URLs                                      |
| `qianwen models list --format json`                          | Dynamic: full model catalog with pricing, features, quotas       |
| `qianwen models info <id> --format json`                     | Dynamic: single model details (pricing tiers, context, rate limits) |
| `qianwen models search "<q>" --format json`                  | Dynamic: keyword-based model discovery                           |
| `qianwen usage free-tier --format json`                      | Dynamic: remaining free tier quota per model                     |
