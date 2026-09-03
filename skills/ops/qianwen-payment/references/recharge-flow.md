# Confirmed QianWen Recharge Flow

Load this reference only after the user has completed the create-attempt confirmation in `SKILL.md`. It is the authoritative business sequence from order creation through result polling. Command syntax and payload contracts live only in [cli-contracts.md](cli-contracts.md).

The retained pre-confirmation state must contain the authenticated account snapshot, normalized amount and cents, consumed confirmation, successful dependency-gate results, and preflight-selected `payment_path`.

## 1. Create and validate the order

Enforce the create-attempt confirmation rule in `SKILL.md`: re-read the authenticated account immediately before creation. If the account or any confirmed transaction field changed, invalidate the consumed confirmation and return to that confirmation stage.

Emit Progress node 1, then execute the create command exactly once and validate its response using [cli-contracts.md § Create an Alipay recharge order](cli-contracts.md).

Classify the create outcome using `cli-contracts.md`. If creation is unconfirmed, do not assume that no order was created; any later creation must return to the authorization rule in `SKILL.md`.

- If a validated order ID is available, retain it for a later user-requested snapshot.
- If no validated order ID is available, do not claim that this attempt can be queried later.

For a valid response, retain only the current order ID and the original `paymentUrl`, then continue with the `payment_path` selected before confirmation.

## 2. Initiate Alipay payment

Before either path starts, establish byte-for-byte equality between the link being handed off and the original validated `paymentUrl`. If equality cannot be established, retain the order and stop without running an Alipay command.

### Direct path

Use this branch only when preflight returned `payment_path=direct`.

1. Execute the pre-handoff signal once.
2. Only after a zero exit, immediately execute `submit-payment` once.
3. Apply the output separation in `cli-contracts.md`, then apply `SKILL.md` Progress node 2 to the complete user-facing stdout, if any.
4. After Progress node 2 completes, apply the payment-side outcome gate below. The `submit-payment` exit code is evidence but does not replace judging its complete result.

The pair is one deterministic sequence with no Agent decision or user interaction between commands. Use the exact commands in [cli-contracts.md § Direct Alipay commands](cli-contracts.md).

If the pre-handoff signal exits nonzero, is interrupted, or times out, do not invoke `submit-payment`; retain the existing order, emit the no-output recovery notice from `SKILL.md`, and stop. Never retry either direct command or switch to the Alipay Skill because the attempted command may already have produced side effects. If `submit-payment` was invoked, deliver any returned user-facing stdout and apply the outcome gate even when its exit is nonzero. No usable result is the ambiguous branch of that gate; when no user-facing content was returned, emit the same recovery notice before stopping.

### Alipay Skill path

Use this branch only when preflight returned `payment_path=alipay-payment-skill`. Load `alipay-payment-skill` before running any Alipay command and follow its cashier-payment flow with the original `paymentUrl` and available session context.

The Alipay Skill owns safety, commands, parameters, retries, and output within this step. Because it is delegated by this active outer flow, its final reply is the returned payment-side content. Its references to end or `STOP` end only the Alipay step and prohibit further Alipay commands; they do not by themselves decide whether the outer flow polls. Complete `SKILL.md` Progress node 2; only if control remains after delivery, return to this flow and apply the outcome gate.

### Payment-side outcome gate

After Progress node 2, judge the complete Alipay result in context rather than relying only on command exit or `STOP`:

- If the result clearly reports that the Alipay step failed, do not poll. Retain the existing order and stop without creating a replacement.
- If payment completed successfully, was initiated successfully, awaits user confirmation, is processing, or produced usable payment materials, continue to QianWen result polling.
- If the result is incomplete or too ambiguous to place in either branch, do not infer success or failure. Retain the existing order and stop.

For either no-poll branch, do not synthesize Progress node 3 or another QianWen status summary. Preserve already-delivered Alipay output unchanged. Only when no user-facing Alipay content exists, emit the no-output recovery notice from `SKILL.md`. The credit-proof rule remains solely in `SKILL.md`.

## 3. Poll the QianWen result

Only when the payment-side outcome gate permits polling, invoke `poll-recharge.mjs` once in the foreground using [cli-contracts.md § Foreground result polling](cli-contracts.md). Never add an Agent-side loop, timer, background task, or concurrent result query.

The poll must remain in the current turn. If the framework ends or interrupts it before a terminal classification, use the `unconfirmed` Progress node 3 response. Never resume the long poll in a later user-triggered turn.

Use the script's returned `category` directly with `SKILL.md` Progress node 3. Do not reinterpret the raw QianWen status.

After `credited` or `failed`, query the latest balance once. A balance-query failure does not alter the recharge result; state only that the latest balance is temporarily unavailable. Do not query history automatically.

## 4. Stop and recover

- Before order creation, a stop request cancels the flow without creating an order.
- While creation or payment initiation is in flight, do not force-kill the active command. Wait for its actual outcome or classify it as unconfirmed.
- **Missing QR recovery:** Only when the user reports that the payment QR was not displayed, use the data returned by Alipay for that payment to present the QR and payment link to the user again. The presented materials must be the retained Alipay materials associated with the current order; never substitute materials from another order.
- Stopping foreground polling does not cancel the order or issue a refund. Use the `unconfirmed` Progress node 3 response and retain the order.
- When the user later reports payment completion or requests status, use one Existing-order result snapshot. Never start another long polling loop.
- Never infer an order ID from logs, balance changes, history, or another flow. A user-supplied unambiguous order ID may be used for one read-only snapshot.
