---
name: qianwen-usage
description: "Manage account auth and query usage/billing/subscription. Use for: login, logout, check usage, view billing, free tier quota, Token Plan status, pay-as-you-go costs, settled bills, model cost breakdown, call logs (which requests failed, 4xx/5xx errors, request latency, recent models called, request-id lookup), subscription status, order history, team seats, PAYG spending limit. Skip for: model browsing, payment/recharge (use qianwen-payment), non-account tasks."
---

# QianWen Usage

Unified entry point for QianWen account, usage, billing, and subscription: auth status, usage summary, free tier quota, Token Plan, pay-as-you-go, settled bills, model cost breakdown, subscription status, order history, team seats, and PAYG spending limit.

## Prerequisites

- **QianWen CLI** must be installed. Verify with:

```bash
qianwen version
```

If not installed, run:

```bash
npm install -g @qianwenai/qianwen-cli
```

Node.js >= 18 required.

- Authentication: No configuration needed on first use. The CLI handles non-TTY detection and safe login automatically (see Authentication Flow below).

### Environment Variables

| Variable                  | Description                                                                                  |
|---------------------------|----------------------------------------------------------------------------------------------|
| `QIANWEN_KEYRING`         | Set to `plaintext`, `no`, `0`, `false`, or `off` to opt out of OS keychain credential storage. |
| `QIANWEN_CREDENTIALS_DIR` | Override file-based credential directory (default: `~/.qianwen/credentials`).                |

## Execution Baseline

These rules apply to every command in this skill:

- **CLI version baseline: 1.3.0.** Before executing, check `qianwen version`. If the installed version is below 1.3.0, do NOT invoke commands that may be missing (notably the `billing` and `subscription` groups); explain that the installed CLI predates the baseline and wait for the user to confirm an upgrade before proceeding. (This is a pre-execution check on every run — distinct from the "CLI Update Check" section below, which only applies when the user explicitly asks about CLI updates.)
- **Whitelist only.** Only run the commands and parameters documented in this file. Never concatenate arbitrary shell strings or pass unchecked user input into command lines.
- **Uniform result states.** Map every command result to one of five states: `success` / `partial` / `empty` / `confirmation_required` / `error`. Never fill in missing or failed results with mock data — report what actually happened.
- **URLs from CLI output only.** Only present URLs returned by the CLI (e.g., `verification_url`). Never fabricate a URL from a name or a guess.

## Authentication Flow (for Agents)

The CLI auto-detects non-TTY environments and degrades safely — no wrapper script needed.

### TL;DR — 3-step auth path

1. `qianwen auth status --format json` → `authenticated: true` → skip to commands
2. `qianwen auth login --init-only --format json` → extract `verification_url` → open in browser
3. `qianwen auth login --complete --format json` → poll until `success` event

### Quick check: already logged in?

```bash
qianwen auth status --format json
```

If `authenticated: true` and token is not expired, skip login entirely.

### Recommended: Two-phase login

Works in all environments (desktop, headless, remote container).

**Step 1 — Initialize login (non-blocking):**
```bash
qianwen auth login --init-only --format json
```
Exits immediately. Parse the stdout JSON `events` array:
- `already_authenticated` → user is logged in, skip to commands
- `device_code` → extract `verification_url` and present it to the user

On desktop environments with a browser, open the URL for the user:
```bash
open "$VERIFICATION_URL"          # macOS
xdg-open "$VERIFICATION_URL"      # Linux
start "" "$VERIFICATION_URL"      # Windows
```

**Step 2 — IMMEDIATELY start polling (do NOT wait for user confirmation):**
```bash
qianwen auth login --complete --format json
```
Parse the stdout JSON `events` array:
- `success` → login complete, proceed to commands
- `expired` → device code expired, go back to Step 1
- `error` → report failure

### TTY environments (interactive terminal)

If the agent is running in a TTY (e.g., user's terminal), simply run:
```bash
qianwen auth login
```
The CLI will automatically open the browser and poll until authorization completes.

### JSON event structure

Both `--init-only` and `--complete` output a single JSON document:
```json
{
  "events": [
    {"event": "device_code", "verification_url": "...", "expires_in": 300},
    {"event": "success", "authenticated": true, "user": {"aliyunId": "..."}}
  ]
}
```

Event types: `already_authenticated`, `device_code`, `success`, `expired`, `error`, `pending`.

### NEVER:

- ❌ Ask the user "Have you completed authorization?" before running `--complete`
- ❌ Wait for user confirmation before polling — run `--complete` immediately after presenting the URL
- ❌ Re-run `--init-only` without completing (this creates a new device code and invalidates the previous one)

## Usage

All commands support `--format json` for structured, machine-parseable output (**recommended default**), and `--format text` for clean plaintext output.

For agent use, **always prefer `--format json`** and parse the JSON response. Only fall back to `--format text` when the user explicitly requests human-readable plaintext.

Never parse `table` format programmatically — it contains ANSI codes and Unicode borders.

### Auth Commands

**`qianwen auth status`** — Check current authentication state

```bash
qianwen auth status --format json
```

**`qianwen auth logout`** — Revoke session server-side and clear local credentials

⚠️ **Confirmation required**: logout is destructive to the current session. Always ask the user to confirm first (`confirmation_required` state); only run the command after explicit confirmation.

```bash
qianwen auth logout
```

### Usage Commands

**`qianwen usage summary`** — View usage summary (free tier, Token Plan, pay-as-you-go)

```bash
qianwen usage summary                      # Current month
qianwen usage summary --period last-month  # Last month
qianwen usage summary --from 2026-03-01 --to 2026-03-31
qianwen usage summary --format json        # JSON output
```

**Period presets**: `today`, `yesterday`, `week`, `month` (default), `last-month`, `quarter`, `year`, `YYYY-MM`

**`qianwen usage breakdown`** — View model usage breakdown

```bash
qianwen usage breakdown --model qwen3.6-plus --days 7
qianwen usage breakdown --model qwen3.5-plus --period 2026-03
qianwen usage breakdown --model qwen-plus --period 2026-03 --granularity month
qianwen usage breakdown --model qwen3.6-plus --format json
```

**`qianwen usage free-tier`** — View free tier quota details

```bash
qianwen usage free-tier
qianwen usage free-tier --format json
```

**`qianwen usage payg`** — View pay-as-you-go billing details

Shows **real-time, not-yet-settled** pay-as-you-go consumption. For finalized, settled billing cycles, use `qianwen billing summary` (see Billing Commands below).

```bash
qianwen usage payg
qianwen usage payg --format json
qianwen usage payg --period month --format json   # Recommended: current month real-time PAYG
```

**`qianwen usage logs`** — Browse paginated call logs (per-request history), filterable by time, model, and status

Use this for **request-level** questions — "which calls failed?", "show me the 4xx/5xx errors", "how long did those requests take?", "which models did I call recently?", "look up this request id". This is distinct from `usage summary`/`breakdown` (aggregate token/cost) — route failure-diagnosis, latency, and call-history questions here, not to summary/breakdown.

```bash
qianwen usage logs --period month --format json
qianwen usage logs --period 24h --status 4xx --status 5xx --format json   # recent client/server errors
qianwen usage logs --model qwen-plus --page 2 --page-size 50 --format json
qianwen usage logs --from 2026-07-25 --to 2026-08-07 --format json         # explicit range (must be ≤ 14 days)
qianwen usage logs --request-id 8c81644f-... --format json                # exact lookup
```

Options:
- `--from` / `--to` — date range (`YYYY-MM-DD` or RFC3339)
- `--period <preset>` — `1h`, `24h`, `7d`, `today`, `yesterday`, `week`, `month`, … (same preset family as `usage summary`)
- `--model <id>` — filter by model; **repeatable** (pass multiple `--model` flags to include several models)
- `--status <type>` — status filter: `0` (cancelled), `2xx` (success), `4xx` (client error), `5xx` (server error); **repeatable**
- `--request-id <id>` — exact request id; **when set, all other filters are ignored**
- `--page <n>` (default 1) / `--page-size <n>` (1..100)

**⚠️ 14-day range limit**: the resolved time range must be **≤ 14 days**. Any range wider than 14 days (whether via `--from`/`--to` or a long `--period`) returns `INVALID_ARGUMENT` (exit 4, `"Time range cannot be longer than 14 days."`). To scan a longer history, slide a ≤14-day window with successive `--from`/`--to` calls. This differs from `usage summary`/`breakdown`, which accept multi-month ranges.

**Pagination**: results are paged. To walk the full history within a window, start at `--page 1 --page-size 100`, then keep incrementing `--page` while `page × pageSize < totalCount`, until all `totalCount` entries are retrieved.

JSON structure (per CLI source — top-level `totalCount` / `page` / `pageSize` / `period` / `items`; within `items[]`, `errorCode` is present only for failed calls, and `usages` carries the per-request token/character consumption and is empty for failed/cancelled calls):

```json
{
  "totalCount": 4,
  "page": 1,
  "pageSize": 20,
  "period": { "from": "2026-07-25", "to": "2026-08-07" },
  "items": [
    { "requestId": "8c81644f-...", "model": "wan3.0-video", "statusCode": 403, "durationMs": 548, "errorCode": "Forbidden.NoPermission", "usages": [] },
    { "requestId": "8e3a2c02-...", "model": "qwen3.8-max", "statusCode": 200, "durationMs": 956, "usages": [ { "type": "tokens", "total": 1820 } ] }
  ]
}
```

`period.from` / `period.to` echo the resolved window: calendar presets and explicit `--from`/`--to` dates render as `YYYY-MM-DD`, while rolling presets (`1h`, `24h`, `7d`) render as RFC3339 timestamps. When no calls match, the CLI returns `totalCount: 0` with an empty `items: []` — map this to the `empty` state (not an error).

Fields: `requestId` (correlate with server-side traces), `model`, `statusCode` (HTTP-style code — `2xx` success, `4xx` client error, `5xx` server error, `0` cancelled), `durationMs` (call latency), `errorCode` (failure reason, present only on non-2xx), `usages` (per-request consumption; empty for failed/cancelled calls). Use `statusCode` + `errorCode` for failure triage and `durationMs` for latency analysis.

### Breakdown Parameters: How to Think About Them

**Three independent dimensions — combine them freely:**

`--model` (required) + **date range** + **granularity**

**Model scope:**
- `--model <id>` — single model (e.g. `qwen3.5-plus`); **required** for breakdown

**Date range** — three patterns, pick by how the user described the period:

| Pattern | When to use | How it works |
|---|---|---|
| `--period YYYY-MM` | User names a specific month ("March", "last April") | Exact calendar month, start to end |
| `--period <preset>` | User describes a relative period | `last-month` = previous full month; `month` = this month so far; `quarter` = this calendar quarter so far |
| `--days N` | User says "last N days" | Rolling window backwards from today, crosses month boundaries naturally |
| `--from YYYY-MM-DD --to YYYY-MM-DD` | User gives explicit dates or a named quarter/range | Full control, use when other patterns don't fit |

**Granularity** — determines the grouping of results, not the range:

- `day` (default) — one row per day; good for spotting usage spikes
- `month` — one row per calendar month; good for multi-month trends
- `quarter` — one row per quarter; good for Q-over-Q comparison

**Classic examples:**
```bash
# Single model, single month, daily detail
qianwen usage breakdown --model qwen3.5-plus --period 2026-03

# Single model, last 3 months, monthly summary
qianwen usage breakdown --model qwen3.5-plus --days 90 --granularity month

# Single model, specific quarter, quarterly rollup
qianwen usage breakdown --model qwen3.5-plus --from 2026-01-01 --to 2026-03-31 --granularity quarter

# Single model, this month, daily breakdown
qianwen usage breakdown --model qwen3.6-plus --period month
```

### Billing Commands

**`qianwen billing summary`** — Settled bill totals for an inclusive `YYYY-MM` cycle window

```bash
qianwen billing summary --from 2026-05 --to 2026-07 --format json
qianwen billing summary --charge-type payg --format json   # payg | subscription | all (default)
```

Returns **settled bills** (finalized billing cycles). This is different from `qianwen usage payg`, which shows **real-time, not-yet-settled** consumption of the current period — use `usage payg` for "how much have I spent so far" and `billing summary` for "what was billed in past cycles".

`cycles` covers **every month** in the `--from`..`--to` window, in order, with no gaps. Each cycle carries `billingCycle`, `aftertaxAmount`, and a `settled` flag. `chargeType` is the internal value — `all`, `prepaid` for subscription, `postpaid` for payg; amounts are decimal strings.

Read `settled` to tell two very different states apart:

- `settled: true` → the cycle has a real settled bill. `aftertaxAmount` is the actual amount, and `"0.000000"` means a genuine zero bill (the CLI renders it as `¥0`). Report it as a real amount, not "No bill".
- `settled: false` → the server returned no bill for that month; `aftertaxAmount` is `null`. The CLI renders this month as `No bill`; report it as no bill for that month, never as `¥0`.

`totals.aftertaxAmount` sums only the settled cycles (unsettled months contribute nothing).

```json
{
  "period": { "from": "2026-05", "to": "2026-08" },
  "chargeType": "all",
  "currency": "CNY",
  "cycles": [
    { "billingCycle": "202605", "aftertaxAmount": null, "settled": false },
    { "billingCycle": "202606", "aftertaxAmount": "3.710000", "settled": true },
    { "billingCycle": "202607", "aftertaxAmount": null, "settled": false },
    { "billingCycle": "202608", "aftertaxAmount": "0.000000", "settled": true }
  ],
  "totals": { "aftertaxAmount": "3.71" }
}
```

**`qianwen billing breakdown`** — Top-N consumption by model (or API key)

```bash
qianwen billing breakdown --period month --group-by model --top 10 --format json
qianwen billing breakdown --group-by api-key --top 10 --format json
```

Options: `--group-by model|api-key` (default `model`), `--top <n>` (default 10, max 100), `--granularity day|month` (default `month`), `--charge-type all|subscription|payg`, plus `--period` / `--from` / `--to` date range. Day granularity requires a range ≤ 31 days; month granularity ≤ 12 months.

JSON structure for a single-period query (per CLI source, the raw `ConsumeBreakdown` object):

```json
{
  "groupBy": "model",
  "period": { "from": "2026-07-01", "to": "2026-07-29" },
  "chargeType": "all",
  "rows": [
    { "groupKey": "qwen3.6-plus", "groupLabel": "qwen3.6-plus", "amount": "5.20" },
    { "groupKey": "qwen-plus", "groupLabel": "qwen-plus", "amount": "1.80" }
  ],
  "totalRows": 12,
  "totalAmount": "9.80",
  "currency": "CNY"
}
```

When the range spans multiple periods (e.g. several months), the JSON is instead sliced per period: `{ "groupBy", "dateRange": { "from", "to" }, "granularity", "chargeType", "slices": [ { "period", "rows", "totalAmount" } ], "currency" }`.

**`qianwen billing limit`** — Pay-as-you-go consumption limit and alert configuration

```bash
qianwen billing limit --format json
```

**Read-only** — this command only displays the PAYG spending limit; the CLI does not support modifying it. Direct users to the console for changes.

JSON structure (per CLI source, the raw `UsageLimit` object; `limitAmount` may be `null` when no limit is set):

```json
{
  "status": "normal",
  "limitAmount": "500.00",
  "currency": "CNY",
  "alertThreshold": "80"
}
```

`status` values: `normal` / `active` / `exceeded` / `warning` / `unknown`.

### Subscription Commands

**`qianwen subscription status`** — Aggregate subscription status across plans

```bash
qianwen subscription status --format json
qianwen subscription status --plan token --format json
```

JSON structure (per CLI source: the `SubscriptionStatus` fields plus `diagnostics`; `recentOrders[].orderType` and `.status` are already mapped to display labels like `Purchase` / `Paid`; nullable fields may be `null`, arrays may be empty):

```json
{
  "isGray": false,
  "plan": "Token Plan Team Edition",
  "period": { "start": "2026-07-01", "end": "2026-08-01" },
  "quota": { "remaining": 21000, "total": 25000, "usedPct": 16 },
  "autoRenew": true,
  "renewable": true,
  "remainingDays": 3,
  "seatTiers": [
    { "specType": "standard", "seats": 2, "totalCredits": 50000, "remainingCredits": 42000, "usedPct": 16, "nextCycleFlushTime": "2026-08-01" }
  ],
  "creditPacks": [
    { "instanceId": "cp-xxxxxxxx", "totalCredits": 10000, "remainingCredits": 8000, "expiresAt": "2026-12-31" }
  ],
  "recentOrders": [
    { "orderId": "20260701xxxx", "orderType": "Purchase", "orderTime": "2026-07-01 10:00:00", "amount": "199.00", "status": "Paid" }
  ],
  "diagnostics": []
}
```

Status is composed from multiple sub-calls; partial failures appear in `diagnostics` (each entry: `api`, `errorCode`, `errorMessage`) — map such results to the `partial` state. If `data` is `null` entirely, the command exits with code 1 (`error` state).

**⚠️ `nextCycleFlushTime` only means a quota reset when `autoRenew` is true.** The CLI returns `nextCycleFlushTime: null` for every seat tier when `autoRenew` is `false` (auto-renewal explicitly OFF), so a non-null value can be read as "credits reset to full on this date". If `autoRenew` is `null` (renewal state unknown), the field may still carry a date — do NOT present it as a guaranteed reset. Never tell the user "your credits will reset on <date>" unless `autoRenew` is `true`. When `autoRenew` is `false`, frame the `period.end` date as an **expiry**, e.g. "your subscription expires on <date>; auto-renew is off, so the plan will lapse unless you renew" — not as a reset.

**`qianwen subscription orders`** — Order history (purchase / renew / upgrade)

```bash
qianwen subscription orders --page 1 --page-size 100 --format json
qianwen subscription orders --from 2026-01-01 --to 2026-06-30 --type purchase --format json
```

Options: `--page <n>` (default 1), `--page-size <n>` (default 20, max 100), `--type purchase|renew|upgrade`, `--from` / `--to` (`YYYY-MM-DD`).

**Pagination**: results are paged. To fetch the full history, start at `--page 1 --page-size 100`, then keep incrementing `--page` while `pagination.page × pagination.pageSize < pagination.total`, until all `pagination.total` orders are retrieved.

JSON structure (per CLI source: `orderType` / `status` are display labels; `amount` is the display string with currency symbol):

```json
{
  "orders": [
    { "orderId": "20260701xxxx", "orderType": "Purchase", "orderTime": "2026-07-01 10:00:00", "amount": "¥199.00", "currency": "CNY", "status": "Paid" }
  ],
  "pagination": { "page": 1, "pageSize": 100, "total": 231 },
  "diagnostics": []
}
```

**`qianwen subscription tokenplan status`** — Token Plan instance detail (period, auto-renew, seat summary)

```bash
qianwen subscription tokenplan status --format json
```

JSON structure (per CLI source; `period` / `autoRenew` / `renewable` / `seatSummary` are `null` when the corresponding sub-call fails — check `diagnostics`; credit values are decimal strings):

```json
{
  "product": "Token Plan Team Edition",
  "period": { "start": "2026-07-01", "end": "2026-08-01", "remainingDays": 3 },
  "autoRenew": { "enabled": true, "period": 1, "periodUnit": "M" },
  "renewable": { "canRenew": true, "interceptCode": null },
  "seatSummary": {
    "groups": [
      { "specType": "standard", "seats": 2, "assigned": 1, "totalValue": "50000", "surplusValue": "42000", "unit": "Credits", "nextCycleFlushTime": "2026-08-01" }
    ],
    "total": { "seats": 2, "totalValue": "50000", "surplusValue": "42000", "unit": "Credits" }
  },
  "diagnostics": []
}
```

If all four data fields are `null`, the command exits with code 1 (`error` state).

**⚠️ `seatSummary.groups[].nextCycleFlushTime` only means a quota reset when `autoRenew.enabled` is true.** The CLI returns `nextCycleFlushTime: null` for every group when `autoRenew.enabled` is `false` (auto-renewal explicitly OFF). If `autoRenew` itself is `null` (state unknown), a date may still be present — do NOT treat it as a guaranteed reset. Only say "credits reset on <date>" when `autoRenew.enabled` is `true`; when it is `false`, present `period.end` as the **expiry** date after which the plan lapses unless renewed.

**`qianwen subscription tokenplan seats`** — Per-seat detail and remaining credits (team seats)

```bash
qianwen subscription tokenplan seats --page 1 --page-size 100 --format json
qianwen subscription tokenplan seats --spec-type standard --format json   # pro | standard
```

Options: `--page <n>` (default 1), `--page-size <n>` (default 20, max 100), `--spec-type pro|standard`. Same pagination rule as orders: keep incrementing `--page` while `page.current × page.size < page.total`.

JSON structure (per CLI source; `cycle` / `config` may be `null`; `cycle.surplusValue` is the seat's remaining credits for the current cycle):

```json
{
  "page": { "current": 1, "size": 100, "total": 2 },
  "filter": { "specType": null },
  "items": [
    {
      "instanceCode": "tp-xxxxxxxx",
      "specType": "standard",
      "status": "NORMAL",
      "memberId": "12xxxxxxxxxxxx34",
      "assignable": true,
      "assignment": "assigned",
      "payMode": "Subscription",
      "productType": "TokenPlan",
      "cycle": { "startTime": "2026-07-01", "endTime": "2026-08-01", "totalValue": "25000", "surplusValue": "21000", "unit": "Credits" },
      "config": { "planType": "standard", "creditValue": 25000, "seatNum": 1, "quotaCycle": "MONTH" }
    }
  ],
  "diagnostics": []
}
```

## Output and Agent Display Rules

CLI commands return JSON by default in agent/pipe environments (`auto` format: TTY → table, pipe → json).
**JSON is the primary output mode for agents** — always pass `--format json` explicitly, parse the structured response, then present a human-readable summary to the user.

### JSON output example (`--format json`)

```bash
qianwen usage summary --period month --format json
```

Returns structured JSON with three sections:
```json
{
  "period": { "from": "2026-04-01", "to": "2026-04-24" },
  "free_tier": [
    { "model_id": "qwen3.6-plus", "quota": { "remaining": 850000, "total": 1000000, "unit": "tokens", "used_pct": 15 } }
  ],
  "token_plan": {
    "subscribed": true,
    "planName": "Token Plan Team Edition",
    "status": "valid",
    "totalCredits": 25000,
    "remainingCredits": 21000,
    "usedPct": 16,
    "resetDate": "2026-05-01",
    "addonRemaining": 8000
  },
  "pay_as_you_go": {
    "models": [
      { "model_id": "qwen3.6-plus", "usage": { "tokens_total": 480000 }, "cost": 0.38, "currency": "CNY" },
      { "model_id": "qwen-plus", "usage": { "tokens_total": 460000 }, "cost": 0.13, "currency": "CNY" }
    ],
    "total": { "cost": 0.51, "currency": "CNY" }
  }
}
```

> **Note on `token_plan`**: The China site (qianwen CLI) returns the `token_plan` branch as shown above. Coding Plan is an international-site (qwencloud) concept — the China site does not generate a Coding Plan display branch.

### Text output example (`--format text`)

```bash
qianwen usage summary --period month --format text
```

```plaintext
Usage Summary  ·  2026-04-10

-- Free Tier Quota -------------------------------------------------------
Model                Remaining      Total          Progress
qwen3.6-plus         850K tokens    1M tokens      85% left
wan2.6-t2i           38 images      50 images      76% left
--------------------------------------------------------------------------

-- Token Plan  ·  Token Plan Team Edition - Standard Seat  ·  valid-------
Usage:      25K / 25K Credits
Quota Left: 100%
Status:     valid
Resets:     2026-06-01
--------------------------------------------------------------------------

-- Pay-as-you-go · 2026-04-01 → 2026-04-10 -------------------------------
Model                Usage              Cost
qwen3.6-plus         480K tok           $0.38
qwen-plus            460K tok           $0.13
--------------------------------------------------------------------------
Total                —                  $0.51
```

### ⚠️ CRITICAL: How to present output to the user

**When using `--format json` (recommended for agents):**

1. **Parse the JSON** and extract the relevant data for the user's question
2. **Present a human-readable summary** — do not dump raw JSON to the user
3. **Add analysis AFTER the summary** — clearly separated with `---`

**When using `--format text`:**

1. **Display CLI output EXACTLY AS-IS** — no modification, no reformatting
2. **Preserve all formatting** — alignment, spacing, progress bars, separators
3. **Add analysis AFTER output only** — clearly separated with `---`

**NEVER:**
- ❌ Dump raw JSON to the user without interpretation
- ❌ Reformat or summarize text/table output
- ❌ Add prefixes like "Here's your usage:"
- ❌ Convert text/table output to bullet points

**✅ CORRECT (JSON mode):**
```
Your QianWen usage for April:

**Free Tier**: qwen3.6-plus has 85% remaining (850K / 1M tokens), wan2.6-t2i has 76% remaining (38 / 50 images).
**Token Plan (PRO)**: 8% used this month (82.5K / 90K requests).
**Pay-as-you-go**: $0.51 total — qwen3.6-plus $0.38, qwen-plus $0.13.

---

**💡 Analysis**: Your qwen3.6-plus free tier is 85% remaining...
```

**✅ CORRECT (Text mode):**
```
[CLI text output - exactly as-is]

---

**💡 Analysis**: Your qwen3.6-plus free tier is 85% remaining...
```

**❌ WRONG:**
```
Here's your usage:
- qwen3.6-plus: 850K tokens remaining (85% left)
```

## Exit Codes

| Code | Meaning              |
|------|----------------------|
| 0    | Success              |
| 1    | General/usage error  |
| 2    | Authentication error |
| 3    | Network error        |
| 4    | Configuration error  |
| 130  | Interrupted          |

- On a non-zero exit code, still attempt to parse any structured JSON on stdout first — it may contain a usable error payload or partial result.
- On exit code 2 (authentication error): guide the user through the Authentication Flow, then retry the original task **at most once**. NEVER loop login attempts.

## CLI Update Check

When the user explicitly asks to check for cli updates (e.g. "check for cli updates", "check cli version", "is there a new version cli"):

1. Run: `qianwen version --check`
2. Report the result.

The QianWen CLI handles update notifications natively; no additional stderr signal handling is required in this skill.

## Implementation Notes

- **Pay-as-you-go**: API returns total usage only (no input/output split)
- **Token Plan**: Aggregate request counts at plan level (no per-model breakdown)
- **logout**: Revokes server-side session and clears local credentials (keychain + file). Server-side call is best-effort — local logout always succeeds.
- **Authentication**: Uses OAuth 2.0 Device Authorization Grant with PKCE. Credentials stored in OS keychain when available, with encrypted file fallback.
- **breakdown --model is required**: Unlike the previous Python implementation, the CLI requires `--model` for breakdown. To query all models' usage, use `qianwen usage summary` instead.
