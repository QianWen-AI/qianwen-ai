# CLI Error Handling — qianwen-model-selector

When a CLI command fails, **do not silently fall back to static snapshots**. Classify the error first,
then apply the matching recovery action. Only fall back after recovery genuinely fails or the user
explicitly declines.

## Core principle

> **Recover first, fall back last.** Snapshots and web lookups are tertiary sources — they exist for
> the case when CLI is truly unreachable, not for the case when CLI returned a recoverable error.

## Error classification & recovery

| Category | Trigger signals | Recovery action |
|----------|-----------------|-----------------|
| `not-installed` | `command not found: qianwen`, `qianwen: No such file or directory` | Show install command (below) → ask user to install → after install, retry the original command. **Do NOT** silently switch to snapshots. |
| `auth-failure` | `Not authenticated`, `AUTH_REQUIRED`, `401`, `unauthorized`, `Please login first`, `token expired` | Run the **3-step device-flow login** in [cli-usage.md](cli-usage.md#authentication-3-step-login-flow) → after `success`, **retry the original command**. Only fall back if user explicitly declines to log in. **DO NOT** ask the user for `$DASHSCOPE_API_KEY` / `$QIANWEN_API_KEY` — those are for model API calls, not the CLI session (see [Authentication Model](cli-usage.md#authentication-model--important)). |
| `model-not-found` | `Model not found`, `unknown model`, `invalid model id`, `404` on a model id | Run `qianwen models search "<approximate-keyword>" --format json` → present top 3 candidates → ask user to confirm the correct ID → retry with the corrected ID. **Do NOT** fall back to snapshots (snapshot may also be missing the new model). |
| `network-timeout` | Network errors, `ETIMEDOUT`, `ECONNREFUSED`, `socket hang up`, `502/503/504` | Retry once after 2s. If second attempt also fails, inform user and ask whether to retry again or fall back to snapshot. |
| `rate-limit` | `429`, `rate limit exceeded`, `too many requests` | Inform user; direct them to [Rate Limit Console](https://platform.qianwenai.com/home/settings/monitoring/rate-limit). **Do NOT** auto-fall back — let user decide whether to wait and retry. |
| `quota-exhausted` | `quota exhausted`, `insufficient balance`, `free tier used up`, `403` on usage | Inform user; direct them to [Billing Console](https://platform.qianwenai.com/home/billing/pay-as-you-go). **Do NOT** fall back to snapshots — snapshots have no quota information, falling back would be misleading. |
| `permission-denied` | `403 Forbidden` on model/feature, `not subscribed`, Token Plan key (`sk-sp-...`) requesting a model outside its catalog | Read [tokenplan.md](../../../ops/qianwen-ops-auth/references/tokenplan.md) or its official sources. Explain the restriction and select only a documented model; never probe alternatives or automatically fall back to PAYG. |
| `version-mismatch` | `unsupported flag`, `unknown subcommand`, `please upgrade` | Suggest `qianwen version --check` or run the update-check skill. After upgrade, retry original command. |
| `other` | Unrecognized stderr output | Show the raw stderr to the user; link to [official docs](https://platform.qianwenai.com/docs/). Only after the user has seen the error and declined to debug, fall back to snapshot. |

## Install command (for `not-installed`)

```bash
npm install -g @qianwenai/qianwen-cli
```

Requires Node.js >= 18. Verify with:
```bash
qianwen version
```

## Recovery flow template

For any CLI error, follow this template:

1. **Classify** — match the stderr against the table above.
2. **Inform** — tell the user what went wrong, in one short sentence.
3. **Act** — perform the recovery action for that category.
4. **Retry** — re-run the **exact original command** after recovery succeeds.
5. **Fall back only if** — recovery failed OR user explicitly opted out.
6. **When falling back** — always state explicitly: "CLI unavailable, using offline snapshot (may be outdated)."

## Example flows

### Auth failure (most common)

```
User: "What's the price of qwen3.6-plus?"
Agent: $ qianwen models info qwen3.6-plus --format json
       → "Not authenticated"
Agent: [classify: auth-failure — CLI session, NOT an API key issue]
       "CLI session expired. Re-authenticating via browser device flow."
       $ qianwen auth login --init-only --format json
       → { "events": [{ "event": "device_code",
                         "verification_url": "https://<qianwenai-auth-url>",
                         "expires_in": 900 }] }
       [Agent extracts verification_url from events[0] — exact URL is server-issued, do NOT construct it manually]
       $ open "https://<qianwenai-auth-url>" ← Agent opens browser
                                               (macOS: open, Linux: xdg-open, Windows: start)
       "I've opened the authorization URL in your browser. If it didn't open, please copy
        this URL manually: <verification_url from above>.
        Waiting for completion..."
       $ qianwen auth login --complete --format json   ← starts polling immediately
       → { "events": [{ "event": "success",
                         "authenticated": true,
                         "user": { "xxxId": "xxx" } }] }
       [Agent confirms events[0].event === "success"]
       $ qianwen models info qwen3.6-plus --format json   ← retry original command
       → { ... pricing ... }
Agent: [present pricing]
```

> **Key details from the actual CLI implementation:**
> - `--init-only` outputs JSON `{ events: [{ event, verification_url, expires_in }] }` and exits
>   immediately — it does **not** open the browser or poll. The Agent must open the URL itself.
> - `--complete` polls a pending session and outputs `{ events: [{ event: "success", ... }] }` on
>   success, or `{ events: [{ event: "expired" | "error", ... }] }` on failure.
> - In non-TTY environments, running `qianwen auth login` without `--init-only` / `--complete`
>   auto-degrades to `--init-only --format json`, so the Agent should always use the explicit
>   two-step flow above.

> **DO NOT** in this flow: ask the user for `$DASHSCOPE_API_KEY` / `$QIANWEN_API_KEY`, prompt them to
> "open the URL and tell me when done", or wait between Step 2 and Step 3.

### Model not found

```
User: "Tell me about qwen3.7-plus"
Agent: $ qianwen models info qwen3.7-plus --format json
       → "Model not found"
Agent: [classify: model-not-found]
       "No model named qwen3.7-plus. Searching for similar..."
       $ qianwen models search "qwen3" --format json
       → [qwen3.6-plus, qwen3.5-plus, qwen3-max, ...]
       "Did you mean one of these?"
       [present top 3 with brief description]
```

### CLI not installed

```
User: "List all available image models"
Agent: $ qianwen models list --output image --format json
       → "command not found: qianwen"
Agent: [classify: not-installed]
       "QianWen CLI is not installed. Install with:
        npm install -g @qianwenai/qianwen-cli
        After install, I'll retry your query. Want me to wait, or use the
        offline snapshot now (may be outdated)?"
```
