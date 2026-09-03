---
name: qianwen-payment
description: "QianWenAI cash balance query and fixed-amount Alipay recharge orchestration. Owns the outer recharge lifecycle while delegating the payment-side step to `alipay-payment-skill` when selected. Covers balance, recharge orders, order results, recharge history, missing current-order QR recovery, Token Plan redirects, and recharge page guidance. TRIGGER when: explicit QianWenAI balance query, confirmed recharge request with amount, model-call error explicitly reporting insufficient QianWenAI balance or account overdue, recharge result/history query, the user reports that the current QianWenAI recharge QR was not displayed, Token Plan purchase redirect, user wants guidance for the QianWenAI recharge page, or user explicitly invokes this skill by name (e.g. use qianwen-payment). DO NOT TRIGGER when: usage/billing/subscription queries (use qianwen-usage), incoming Alipay payment links or unrelated merchant orders (use alipay-payment-skill), refunds, non-QianWenAI products."
---

# QianWen Payment

QianWenAI (千问AI平台) cash balance query and fixed-amount Alipay recharge. Use this Skill only for a QianWenAI account. Do not infer recharge intent or an overdue account from a low balance, a generic quota error, HTTP status, or unrelated model failure.

## Compatibility and resources

Requires Node 18.18+ for every route in this Skill. Use `scripts/preflight.mjs` to enforce the runtime baseline, determine QianWen CLI compatibility, and select the available Alipay payment path; do not reproduce or override its version and capability decisions in prose.

| Location | Authoritative responsibility |
| --- | --- |
| `scripts/preflight.mjs` | Route dependency probe, amount normalization, and transaction-critical response validation |
| `scripts/recharge-result-contract.mjs` | Recharge-result identity and status classification |
| `scripts/poll-recharge.mjs` | Foreground post-payment result polling |
| `references/recharge-flow.md` | Confirmed-order business sequence, branching, stop and recovery |
| `references/cli-contracts.md` | Commands, arguments, JSON shapes, script interfaces and exit codes |
| `references/sources.md` | Manual provenance lookup only |

Load references only when the current route needs their authoritative detail. For fixed-amount recharge, read `recharge-flow.md` only after the user confirms order creation. Also read its recovery section when the user explicitly reports that the current order's QR was not displayed and the current order's Alipay materials are still retained.

## Routes

| Request | Route | Business boundary |
| --- | --- | --- |
| Balance | `balance-summary` | Read-only |
| Confirmed overdue or explicit model-call balance error | Ask whether to recharge | Does not authorize an amount or transaction |
| Fixed-amount Alipay recharge | `recharge-order` | One create confirmation per attempt, then payment and conditional foreground result polling |
| Current-order QR not displayed | `missing-qr-recovery` | User-triggered presentation recovery from retained Alipay materials; no command or new order |
| Existing-order result | `recharge-result` | One read-only snapshot; never starts a polling loop |
| Recharge history | `recharge-history` | Read-only, default 30 days |
| Recharge page guidance | `recharge-page` | Confirm before opening the browser |
| Token Plan purchase | None | Redirect to the Token Plan page listed in `sources.md` |

## Core rules

1. **Localize only QianWen-owned output.** Follow the language of the user's latest substantive message. The AI risk notice may be translated in full. Only user-facing Alipay content is passed through verbatim; route-specific control data is never user-facing.
2. **One confirmation, one create attempt.** Confirm the exact masked account, normalized amount, Alipay method, and operation scope. A confirmation authorizes exactly one invocation of the create command and is consumed before that invocation. It cannot authorize another order, including in the same conversation with the same account and amount or for a retry, replacement, or additional order. A status query, QR recovery, payment continuation, or statement that payment was completed never authorizes creation. Never automatically retry an interrupted, malformed, timed-out, nonzero, or otherwise unconfirmed create attempt.
3. **One payment owner within an outer recharge lifecycle.** This Skill owns order creation, payment handoff, and the decision to query the QianWen result. Preflight selects `direct` or `alipay-payment-skill` before order creation. `alipay-payment-skill` owns safety, commands, retries, output, and stop decisions only within the delegated payment-side step. Never switch paths after a direct Alipay command has started because its side effects may be unknown.
4. **No payment improvisation.** Use only the unchanged, validated `paymentUrl` from the current create response. Never accept, rewrite, reconstruct, normalize, decode/re-encode, or substitute a link from the user, history, logs, or another order.
5. **One proof of credit.** Only the shared recharge-result classifier returning `category=credited` proves the recharge was credited. An Alipay result, QR scan, user statement, balance change, or history entry does not.
6. **Protect credentials and transaction data.** Never request an Alipay password, bank-card number, SMS code, API key, cookie, or pasted token. Keep full account identifiers, order IDs, payment links, and raw payloads only in current-flow memory. Do not copy them to files, logs, long-term memory, or sub-agent messages.
7. **Deliver before polling.** Complete Progress node 2 before any result query or `poll-recharge.mjs`. A command result visible only to the Agent, file read, preview, draft, or planned final reply is not delivery.
8. **Polling route.** Use [recharge-flow.md](references/recharge-flow.md) for polling eligibility and business sequencing.
9. **Consistent execution context.** Apply the execution-context and authentication-recovery contract in [cli-contracts.md](references/cli-contracts.md) to QianWen commands.

## Direct-path sessionId resolution

This section applies only to the direct path. The delegated path follows `alipay-payment-skill`. `sessionId` is optional and applies only to `alipay-bot submit-payment`; `trigger-payment-signal` never receives it. Use the first non-empty value from this order:

| Priority | Source |
| --- | --- |
| 1 | Runtime metadata: `sessionId` / `session_id` |
| 2 | Current conversation: `threadId` / `thread_id` / `conversationId` / `conversation_id` / `agentContextId`; for Codex: `CODEX_THREAD_ID` |
| 3 | Environment variable `AIPAY_SESSION_ID` |

Use the value as-is. Do not generate one, ask the user for one, or substitute another business ID. If all sources are empty, omit `--session-id`.

## Pre-confirmation fast path

### 1. Amount

Use only the amount intentionally supplied for the current recharge.

- Convert yuan, jiao/mao, and fen exactly with decimal-string or integer arithmetic.
- Continue only when the amount is unambiguous, positive, denominated in CNY, and exactly representable in cents.
- Ask for one exact amount when it is missing, approximate, a range, contains multiple candidates, uses another currency, or has sub-cent precision.
- Never guess, round, truncate, or reuse an amount from another request.

Validate the normalized amount together with route dependencies:

```bash
node <skill-dir>/scripts/preflight.mjs --route recharge-order --amount <normalized>
```

For every `recharge-order` attempt, the compatible Alipay CLI and `alipay-payment-skill` are independent blocking dependencies. Preflight validates the CLI contract; separately verify that `alipay-payment-skill` is present and loadable in the host's available-Skill registry. Neither dependency substitutes for the other, even when preflight selects `payment_path=direct`. Complete both checks before authentication, confirmation, or order creation.

After both dependency gates pass, retain the returned `payment_path`. `direct` means the optional pre-handoff signal capability is available; `alipay-payment-skill` means payment submission must use the already-verified `alipay-payment-skill`. If either dependency is unavailable, stop and use [cli-contracts.md § Dependency setup](references/cli-contracts.md) only when installation guidance is needed.

### 2. Authentication and account snapshot

Verify a server-authenticated QianWen CLI account using the authentication contract in [cli-contracts.md](references/cli-contracts.md). Use only the CLI OAuth device flow; show only its returned verification URL and never ask for credentials or tokens.

Retain the full account identifier only for current-flow consistency checks and show only its masked form. Immediately before creation, re-read the authenticated account and compare it with the confirmed snapshot. Any account, amount, currency, payment-method, or operation-scope change invalidates the confirmation.

Do not query balance, recharge history, or prior orders before creation. They add latency without protecting this transaction.

### 3. Confirmation

For every fresh fixed-amount create confirmation, the first visible line must be this complete AI risk notice, localized when appropriate:

```text
AI risk notice: This recharge request was prepared by AI and may not reflect your actual intent. Review the amount, account, and operation scope; do not confirm if anything is incorrect.
```

Then show the masked account, normalized amount, Alipay method, and that confirmation creates one recharge order and enters the payment flow. End with a natural confirmation question. Do not use a mechanical Confirm/Cancel option list.

- Affirmative: recheck the account and normalized amount, consume the confirmation, then read and execute [recharge-flow.md](references/recharge-flow.md).
- Negative: run nothing and output the localized equivalent of `Recharge canceled`.
- Material change: show a new confirmation block with the risk notice.

## User-visible progress

Communicate only these business transitions. Do not expose CLI commands, arguments, skill routing, validators, service names, polling internals, `sessionId`, the internal polling deadline, or raw QianWen-side errors unless the user explicitly asks for troubleshooting information.

### Progress node 1: order creation

After confirmation and before invoking the create command:

```text
Creating the recharge order…
```

### Progress node 2: Alipay output delivered

- **Direct path:** use only the user-facing stdout identified by [cli-contracts.md § Direct Alipay commands](references/cli-contracts.md). Deliver it exactly once and directly as the user-facing response. Render its Markdown normally; do not add a preface, heading, fenced code block, or status summary. Preserve all non-media text byte-for-byte; do not translate, summarize, wrap, or filter its business content. Apply only this transport adaptation:
  - If stdout contains `MEDIA: <path-or-url>` lines, extract every reference and remove only those lines from the text. Send the remaining text unchanged, then send the referenced images in their original order through the image/media channel.
  - If no image/media channel is available, append the references as Markdown images to the single text response in their original order.
  - If stdout already contains Markdown images, preserve them unchanged and do not send duplicate images. Never open, analyze, or modify a referenced image. Do not reuse it except to re-present the retained QR from the current order when the user reports that it was not displayed.
- **Alipay Skill path:** follow the content, formatting, and media rules from `alipay-payment-skill` without reproducing them here. The scope of its lifecycle terminators within this outer flow is defined in [recharge-flow.md](references/recharge-flow.md). If it already emitted content through a user-visible channel, do not repeat it.

For the direct path, `MEDIA:` handling changes only the transport representation and is not Alipay result validation. For either path, Progress node 2 is complete only after the selected path's content is user-visible. If the runtime cannot publish that text without ending the outer turn, use it as the final reply, do not poll in that turn, and use one existing-order snapshot after the user's next message. Never defer the Alipay content into a planned final reply after polling. The pass-through rule overrides the QianWen-side localization, hiding, and error-rewriting rules above.

If the confirmed flow requests no-output recovery because the payment step produced no user-facing content, show the localized equivalent of: `The payment step did not return any displayable result, so its outcome is unknown. The existing recharge order has been retained. Do not create another order or pay again; ask me to check this order before retrying.` This is a QianWen-owned recovery notice, not Alipay output or proof of the recharge result.

The exactly-once rule has one exception: when the user reports that the current payment QR was not displayed, follow [recharge-flow.md § 4](references/recharge-flow.md) to re-present the QR and payment link from the Alipay data returned for that payment.

### Progress node 3: QianWen recharge result

Use the category returned by the shared result classifier:

- `credited`: `Recharge credited. ¥<amount> has been added to your QianWenAI balance.` Then append `Recharge records may be delayed by approximately 10 seconds.`
- `failed`: `Recharge was not credited. Check the Alipay transaction status before trying again.`
- `processing` or `unconfirmed`: `Recharge result not yet confirmed. If you have already paid, do not pay again — tell me once payment is complete and I will check the final result for you.`

When the confirmed-flow contract requests a post-terminal balance query, append `Current available balance: ¥<balance>.` after a validated response. If that query fails, append `Latest balance is temporarily unavailable.` Never alter or replace the recharge result based on the balance response.

Never say that you will report the result automatically or later. The user must send another message before a later snapshot can be queried.

## Other routes

### Balance

Use [cli-contracts.md § Balance](references/cli-contracts.md). Show the validated CNY amount. A low or zero balance alone does not prove overdue status or authorize recharge.

### Recharge eligibility

- An explicit QianWenAI recharge request enters the amount flow directly.
- A user-confirmed overdue account or an explicit model-call error for insufficient QianWenAI balance may offer one localized recharge choice; opt-in still does not authorize an amount or order.
- Do not suggest recharge for generic failures, HTTP 403, free-tier exhaustion, Token Plan quota, or spending limits.

### Existing-order result

Use one snapshot from [cli-contracts.md § Existing-order result](references/cli-contracts.md). Do not query Alipay status or start `poll-recharge.mjs`. Present the result with Progress node 3.

### Recharge history

Use [cli-contracts.md § Recharge history](references/cli-contracts.md). On exit `0`, convert the CLI
result into a human-readable response. History is informational and never proves a particular order
result.

### Recharge page guidance

Explain that the command opens the validated QianWenAI recharge page and ask whether to proceed before using [cli-contracts.md § Recharge page guidance](references/cli-contracts.md). Show the returned validated URL; never construct one.

### Token Plan

Do not buy, renew, upgrade, or add quota to a Token Plan. Direct purchase requests to the Token Plan page listed in [sources.md](references/sources.md). Route existing-plan status, quota, and billing questions to `qianwen-usage`.

## Update check

For update requests, use the sibling `qianwen-update-check` Skill when available; otherwise run `qianwen version --check`. Never run an update check during an unresolved recharge flow.
