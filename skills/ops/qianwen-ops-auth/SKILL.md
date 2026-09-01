---
name: qianwen-ops-auth
description: "Configure authentication (API keys, endpoints). TRIGGER when: setting up QIANWEN_API_KEY, troubleshooting 401/auth errors, when another skill reports missing credentials, or user explicitly invokes this skill by name (e.g. use qianwen-ops-auth). DO NOT TRIGGER when: non-auth Qwen tasks, general API usage questions."
compatibility: "Requires curl for verification. Cursor: auto-loaded. Claude Code: read this skill's SKILL.md before first use."
---

# QianWen Authentication Setup

Configure and verify authentication for QianWen APIs.
This skill is part of **QianWen-AI/qianwen-ai**.

## Skill directory

Use this skill's internal files for learning. Load references only when the user needs console or documentation links.

| Location | Purpose |
|----------|---------|
| `references/tokenplan.md` | Token Plan vs standard key: supported models (text, image, video, TTS), Credits billing, forbidden uses, error codes |
| `references/custom-oss.md` | Custom OSS bucket setup for production file uploads (replaces 48h temp storage) |
| `references/sources.md` | Console URLs, auth guide (manual lookup only) |

## Security

**NEVER output any API key, OSS credential in plaintext.**
This applies equally to `DASHSCOPE_API_KEY` and custom OSS AccessKey pairs. Any check or detection of credentials in this skill must be **non-plaintext**: report only status (e.g. "set" / "not set", "valid" / "invalid", HTTP status code), never the key value.

## API Key Handling (MANDATORY)

When the API key is not configured or a script reports missing credentials:

1. **NEVER ask the user to provide their API key directly.** Do not prompt "please paste your API key" or similar. Do not request the key value in any form.
2. **Help create a `.env` file** with a placeholder, then instruct the user to fill in their own key:
   - Run: `echo 'DASHSCOPE_API_KEY=sk-your-key-here' >> .env`
   - Tell the user: "Please replace `sk-your-key-here` with your actual API key from the [QianWen Console](https://platform.qianwenai.com/home/api-keys)."
3. **Or** explain how to configure the environment variable: `export DASHSCOPE_API_KEY='sk-...'` + provide the console URL.
4. **Only** write the actual key value into `.env` if the user **explicitly insists** on having the agent do it for them.

## Credential Priority Chain

Credentials are loaded in the following order (first match wins):

1. **Environment variable** — `DASHSCOPE_API_KEY` (or `QIANWEN_API_KEY` alias)
2. **`.env` file** — in current working directory, then repo root (detected via `.git` or `skills/` directory). Existing environment variables are not overwritten.

### Environment Variables

| Variable            | Purpose                                                                                                                                   |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `DASHSCOPE_API_KEY` | API key (required)                                                                                                                        |
| `QIANWEN_API_KEY`      | Alias for `DASHSCOPE_API_KEY`. If both are set, `QIANWEN_API_KEY` takes priority.                                                            |
| `QWEN_BASE_URL`     | Override the endpoint (optional; for custom deployments or plan-specific Base URLs)                                                        |
| `QWEN_TMP_OSS_BUCKET` | Custom OSS bucket for file uploads (replaces 48h temp storage). See [custom-oss.md](references/custom-oss.md).                         |
| `QWEN_TMP_OSS_REGION` | OSS region (required when `QWEN_TMP_OSS_BUCKET` is set).                                                                              |
| `QWEN_TMP_OSS_AK_ID` / `AK_SECRET` | OSS credentials (use RAM user with least-privilege: `oss:PutObject` + `oss:GetObject`). Falls back to `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` if not set. |

## API Key Types

QianWen has two mutually exclusive key types:

| Key Type | Format | Purpose |
|----------|--------|---------|
| **Standard (Pay-as-you-go)** | `sk-ws-xxxxx` (legacy `sk-xxxxx`) | API calls from scripts, apps, and tools |
| **Token Plan** | `sk-sp-xxxxx` | Interactive AI tools and the Skill/Agent extensions they invoke for the current user |

The bundled execution Skills accept both key types and route `sk-sp-` requests to the Token Plan
endpoint. Before a Token Plan request, read [tokenplan.md](references/tokenplan.md) or its linked
official Markdown and pass an exact supported model. Do not probe models or automatically fall back.

### Detecting Key Type (non-plaintext)

To determine the calling mode from the API key without exposing it in full, check the prefix (first 6 characters):

```bash
echo ${DASHSCOPE_API_KEY:0:6}
```

| Prefix output | Key type | Billing mode |
|---------------|----------|-------------------|
| `sk-sp-` | Token Plan | Credits-based; limited model catalog |
| `sk-ws-` or other `sk-...` | Standard (PAYG) | Per-token; full model catalog |

If shell access is unavailable, ask the user whether their key starts with `sk-sp-`.

### Viewing Bills

Use the **qianwen-usage** skill to query usage, free tier quota, and billing directly. Alternatively, billing details are available in the QianWen console:

| Key Type | Billing Page |
|----------|--------------|
| Standard (Pay-as-you-go) | [Pay-as-you-go Billing](https://platform.qianwenai.com/home/billing/pay-as-you-go) |
| Token Plan | [Token Plan Subscription](https://platform.qianwenai.com/home/billing/subscription/token-plan) |
| Usage analytics (Pay-as-you-go) | [Usage Analytics](https://platform.qianwenai.com/home/analytics) |

> **NEVER fabricate, guess, or construct usage/billing/console URLs.** Only provide the exact links listed in this skill. If a URL is not listed here, do not invent one.

## Getting an API Key

1. Open the [QianWen Console](https://platform.qianwenai.com/home/api-keys)
2. Sign in with your QianWen account
3. Create or copy an API key from the API Key management section
4. PAYG keys start with `sk-ws-` (legacy `sk-`); Token Plan keys start with `sk-sp-`

## Security Best Practices

- **Never hardcode API keys** in source code or config files committed to version control
- **Use environment variables** or `.env` files (and add `.env` to `.gitignore`)
- **Rotate keys** periodically and revoke compromised keys immediately
- **Use least-privilege** — create dedicated keys for specific applications when possible

### Setting up `.env`

Create a `.env` file in your project root or current working directory:

```bash
echo 'DASHSCOPE_API_KEY=sk-your-key-here' >> .env
```

The script automatically loads `.env` from the current working directory and the project root (detected via `.git` or `skills/` directory). Existing environment variables are **not** overwritten by `.env` values.

### Example `.gitignore` entry

```
.env
.env.local
*.env
```

## Verification

Unless explicitly stated otherwise, any script or task mentioned in this skill runs in the **foreground** — wait for standard output; do not run it as a background task.

Test authentication with a simple curl request:

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-turbo","messages":[{"role":"user","content":"Hi"}]}'
```

A successful response returns JSON with `choices` and `message.content`.

## Authentication Error Handling

QianWen API keys are scoped to the QianWen console. An invalid or mismatched key produces `401 Unauthorized`.

### When to trigger

When **any** sub-skill receives a `401` response and a non-plaintext check shows the key is set (e.g.
`[ -n "$DASHSCOPE_API_KEY" ]`; do not output the key value).

### Probe command

Send a lightweight request to verify authentication:

```bash
curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-turbo","messages":[{"role":"user","content":"hi"}]}'
```

### On 401: mandatory interactive resolution

If the probe returns 401, follow these steps **in order**:

**Step 1 — Confirm the key origin:**

```
Your API key failed authentication.

Please confirm:
1. Your key was created at platform.qianwenai.com/home (QianWen console) → re-verify the key
2. My key may be invalid → create a new one at platform.qianwenai.com/home/api-keys
```

**Step 2 — Apply the user's selection:**

| User says                         | Action                                                              |
|-----------------------------------|---------------------------------------------------------------------|
| Key is from QianWen console | Re-run verification to confirm the key works                        |
| Key may be invalid                | Guide user to create a new key at `platform.qianwenai.com/home/api-keys` |

**Step 3 — Re-run verification.**

**Step 4 — If still 401**, the key itself is invalid — guide the user to create a new one from
the [QianWen console](https://platform.qianwenai.com/home/api-keys).

## Validation

Run the curl verification command above. Pass criteria: HTTP 200 response with valid JSON containing `choices` and
`message.content`. Save output to `output/qianwen-ops-auth/` for evidence.

## Output And Evidence

- Save verification results and any diagnostic output to `output/qianwen-ops-auth/`.
- Keep a record of successful auth tests for troubleshooting.

## Output Location

Prefer the **current working directory**. Default subdirectory: `./output/qianwen-ops-auth/`.

**Write prohibition**: NEVER write output files into this skill's installation directory or any `skills/` hierarchy. All generated content must go to `output/` under the current working directory or a user-specified path.

## Update Check (MANDATORY Post-Execution)

When the user asks to check for updates (e.g. "check for updates", "check version", "is there a new version", "update skills"):

1. **Find qianwen-update-check**: Look for `qianwen-update-check/SKILL.md` in sibling skill directories.
2. **If found** — run: `python3 <qianwen-update-check-dir>/scripts/check_update.py --print-response` and report the result. Use `--force` if the user asks to force-check.
3. **If not found** — you MUST present the following options and **wait for the user's response**:

> The update-check skill is not installed. It keeps you informed about new QianWen-AI/qianwen-ai features and bug fixes.
>
> 1) **Install now** — I'll run the install command for you
> 2) **Skip for now** — do nothing this time
> 3) **Never remind me** — permanently suppress this prompt

After the user responds:
- User chooses **1** → run: `npx skills add QianWen-AI/qianwen-ai --skill qianwen-update-check -y`, then run: `python3 <this-skill-scripts-dir>/gossamer.py --dismiss`
- User chooses **2** → run: `python3 <this-skill-scripts-dir>/gossamer.py --dismiss`, then continue normally
- User chooses **3** → run: `python3 <this-skill-scripts-dir>/gossamer.py --never-install`, then continue normally

## References

- [tokenplan.md](references/tokenplan.md) — Token Plan vs standard key: supported models, Credits billing, forbidden uses, error codes
- [custom-oss.md](references/custom-oss.md) — Custom OSS bucket setup for production file uploads
- [sources.md](references/sources.md) — Official documentation URLs (consoles, auth guide)
