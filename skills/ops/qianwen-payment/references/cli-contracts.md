# QianWen Payment CLI Contracts

This reference is the authoritative source for commands, arguments, accepted payloads, script interfaces, exit codes, and execution context. Business authorization lives in `SKILL.md`; payment-step sequencing and result branching live in [recharge-flow.md](recharge-flow.md).

## Common command rules

- Every route and script in this Skill requires Node 18.18+.
- Run QianWen business commands with `--format json` and use stderr only for diagnostics.
- Pass arguments as structured argv. Never interpolate amounts, order IDs, payment URLs, or user text into shell command strings.
- Use `scripts/preflight.mjs --validate` only for routes that define a validator below.

## Dependency setup

Probe the route before its business command:

```text
node <skill-dir>/scripts/preflight.mjs --route <route>
```

`preflight.mjs` is the sole source of QianWen CLI minimum versions and direct Alipay capability decisions. Its `cli_command` field is diagnostic metadata; executable command syntax is defined in this reference.

- A `qianwen_cli` gap is blocking.
- For `recharge-order`, the `alipay_submit_payment` CLI check is blocking because both payment paths execute that command. The pre-handoff signal check selects the path: `direct` when it passes, otherwise `alipay-payment-skill`. The version probe is diagnostic only.
- The script cannot discover the host's Skill registry. Apply the independent Skill gate in `SKILL.md` for every recharge-order attempt, including `payment_path=direct`.

If a required component is unavailable, display the applicable complete command below and ask before installing anything. A positive response authorizes only that displayed installation command. For `recharge-order`, if either the compatible Alipay CLI or `alipay-payment-skill` is unavailable, use the Alipay installation command maintained by this Skill. After installation, rerun preflight and recheck the host's available-Skill registry before continuing; installation does not authorize order creation.

| Component | Installation command |
| --- | --- |
| QianWen CLI package | `npm install -g @qianwenai/qianwen-cli@latest` |
| Alipay CLI and payment Skill | `npx -y @alipay/agent-payment@latest install` |

Verify package provenance with [sources.md](sources.md).

### Preflight exit codes

| Exit | Meaning |
| --- | --- |
| `0` | All script-owned blocking checks passed; the external Skill registry gate is not included |
| `1` | Blocking dependency gap, anchor mismatch, or response validation failure |
| `2` | Usage or internal error |

For exit `2`, correct a local invocation mistake once. If a correctly formed invocation still fails, treat it as an internal error. A validator invocation failure never proves that a transaction succeeded or failed.

## Authentication

Balance, recharge order, existing-order result, and recharge-history commands require a server-verified QianWen CLI account.

The execution context includes the sandbox or permission level, access to the credential store, and network permissions. Run authentication-dependent QianWen commands with the same effective account context and access to the same credential store and network. This does not require one shell process or a single chained invocation. Never copy, display, or persist credentials to bridge contexts.

```text
qianwen auth status --format json
```

Accept only a response with `authenticated=true`, `server_verified=true`, and a non-empty `user.aliyunId`.

If authentication is required, use the CLI device flow:

```text
qianwen auth login --init-only --format json
qianwen auth login --complete --format json
```

The login-init response supplies the verification URL consumed by the `SKILL.md` authentication flow.

After a verified authentication snapshot, if one read-only QianWen business command returns `AUTH_REQUIRED` or exit `2`:

1. Do not immediately request another login. Compare that command's sandbox or permission level, credential-store access, and network permissions with the verified snapshot context.
2. If a context mismatch may explain the result, request scoped user approval to verify authentication and rerun that exact read-only command in the matching context. In that context, first run `qianwen auth status --format json` and require the same `user.aliyunId` as the retained snapshot. If the identity differs or cannot be verified, do not run the business command or request login; report the context mismatch.
3. After the identity check passes, retry the same business-command argv once. If that retry still requires authentication, or no context mismatch exists, follow the normal device-flow guidance.

For any operation bound to a confirmed or existing recharge, every completed device-flow reauthentication must be followed by `qianwen auth status --format json` in the same execution context. Compare `user.aliyunId` with the retained account snapshot before retrying the business command. If the identity differs, do not retry the command, create another order, or continue the recharge flow. Tell the user, using masked identifiers only, that the authenticated QianWenAI account changed and that they must switch back to the original account or start a new flow.

This recovery applies only to a single read-only QianWen command. Never apply it to recharge-order creation, recharge-page opening, an Alipay command, `poll-recharge.mjs`, or restarting a long poll.

## Amount normalization

```text
node <skill-dir>/scripts/preflight.mjs --amount <resolved CNY-yuan amount>
```

The returned normalized value and integer cents are the only values used by later commands and validation anchors.

## Balance

```text
qianwen billing balance summary --format json
```

Accepted shape:

```json
{
  "availableAmount": "0.07",
  "currency": "CNY"
}
```

Validate with `preflight.mjs --validate balance-summary`.

## Create an Alipay recharge order

Command:

```text
qianwen billing balance recharge --channel alipay --amount <normalized amount> --format json
```

Accepted shape:

```json
{
  "type": "recharge",
  "channel": "alipay",
  "amount": "0.01",
  "currency": "CNY",
  "status": "pending",
  "rechargeOrderId": "...",
  "paymentUrl": "https://..."
}
```

Validate with the confirmed cents anchor:

```text
node <skill-dir>/scripts/preflight.mjs --validate recharge-order \
  --expect-cents <confirmed cents>
```

The validator owns the exact required fields, amount comparison, URL syntax, protocol, userinfo rejection, and payment-host allowlist. It never rewrites the original URL. Without a positive safe-integer cents anchor, validation fails closed.

## Direct Alipay commands

Pre-handoff signal syntax:

```text
alipay-bot trigger-payment-signal \
  --payment-link '<original validated paymentUrl>' \
  --merchant-info 'Product: QianWenAI account recharge; Amount: ¥<amount>; Seller: QianWen; Order number: <rechargeOrderId>' \
  --amount '<normalized amount>'
```

The signal takes no `--session-id`. Its stdout is internal control data, including when it is JSON; it is never user-facing Alipay output. Keep it isolated even when both commands run in the same execution context, and never display it, combine it with `submit-payment` stdout, or pass it to Progress node 2. A `success=true` field or zero exit proves only that the signal command completed and permits the subsequent `submit-payment` invocation; it does not prove payment or credit.

```text
alipay-bot submit-payment \
  [--session-id '<resolved sessionId>'] \
  --payment-link '<original validated paymentUrl>' \
  --intent-summary 'Product: QianWenAI account recharge; Amount: ¥<amount>; Payee: QianWen'
```

`--session-id` is optional and resolved only as specified in `SKILL.md`. Invoke `submit-payment` in its default output mode. Exit `0` means the call succeeded. Its stdout is the only direct-path Alipay output consumed by Progress node 2. Preserve and deliver any stdout even when the command exits nonzero. Interpret the complete result only through the payment-side outcome gate in [recharge-flow.md](recharge-flow.md).

## Foreground result polling

```text
node <skill-dir>/scripts/poll-recharge.mjs --recharge-order-id <id> \
  [--interval-seconds <n>] [--max-seconds <n>] \
  [--call-timeout-seconds <n>]
```

Omit optional timing arguments to use script-owned defaults. The script calls the QianWen existing-order result command, validates each response identity, classifies it through `recharge-result-contract.mjs`, and returns exactly one JSON document on stdout. Diagnostics go to stderr.

The result includes the requested `rechargeOrderId`, raw `status`, `category`, `terminal`, elapsed seconds, and poll count. Use `category` directly; do not reinterpret `status`. The CLI normalizes transient recharge transport, throttling, and server failures to network exit `3`. Exit `3`, short-lived not-found exit `7`, and the poller's per-call timeout `124` count toward a bounded retry allowance. The poller stops as `unconfirmed` after three consecutive retryable read failures; the first two failures wait for the normal interval and retry, and any fully validated snapshot resets the counter. Every other nonzero exit, malformed JSON, identity mismatch, or another validation failure stops immediately and is never retried.

| Exit | Meaning |
| --- | --- |
| `0` | Shared classifier returned terminal `credited` or `failed` |
| `1` | Maximum poll duration reached before a terminal classification |
| `2` | Unconfirmed result, identity/read error, usage/runtime failure, or interruption |

## Existing-order result

Run one snapshot:

```text
qianwen billing balance recharge result --recharge-order-id <id> --format json
```

Validate it against the requested order:

```text
node <skill-dir>/scripts/preflight.mjs --validate recharge-result \
  --expect-recharge-order-id <requested id>
```

The validation report's `classification.category` comes from the same shared contract used by polling. Use that category directly with Progress node 3.

## Recharge history

```text
qianwen billing balance recharge-history --range 30d --page 1 --page-size 20 --format json
```

Treat exit `0` as a successful call and convert the CLI result into a human-readable response.

## Recharge page guidance

```text
qianwen billing balance recharge --format json
```

The command may immediately open a browser. Validate with `preflight.mjs --validate recharge-page`; the script owns the accepted recharge URL and never rewrites the returned value.

## QianWen CLI exit codes

| Exit | Meaning |
| --- | --- |
| `0` | Command completed; apply the route-specific handling above |
| `1` | Argument or general error |
| `2` | Authentication error |
| `3` | Network error |
| `4` | Configuration error |
| `5` | Rate-limited error |
| `6` | Server error |
| `7` | `NOT_FOUND`; apply the route-specific interpretation below |
| `8` | `TASK_NOT_COMPLETED`; a bounded result wait ended without a terminal status |
| `130` | Command interrupted |

Route-specific interpretation:

- For `recharge-order`, every nonzero exit leaves creation unconfirmed. Do not assume that no order was created; authorization for any later creation is governed by the create-attempt confirmation rule in `SKILL.md`.
- For recharge commands, transient transport, throttling, and server failures are normalized to exit `3`; global exits `5` and `6` are not emitted at this command boundary.
- For `recharge-result`, exit `7` means the order was not found or is unavailable for the authenticated account. A one-shot query stops immediately; `poll-recharge.mjs` retries only exits `3`, `7`, and its local per-call timeout `124` under the bounded consecutive-read-failure policy. Every other nonzero exit stops the poll immediately as unconfirmed. Retain the existing order context and never create a replacement.
- For another read-only route, exit `7` means the requested data is unavailable.
- Exit `8` or `130` during result waiting is unconfirmed, not proof of payment failure or order cancellation.

For routes with a defined validator, exit codes never substitute for response validation.
