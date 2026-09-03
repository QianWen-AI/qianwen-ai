/**
 * Shared identity validation and status classification for recharge results.
 *
 * Keep this module side-effect free: both the one-shot preflight validator and
 * the foreground poller depend on it as the single source of truth.
 */

const RESULT_REASONS = new Set(["timed_out", "interrupted", "unrecognized_status"]);
const LOCAL_UNKNOWN_REASONS = new Set(["timed_out", "interrupted"]);
const FAILURE_STATUSES = new Set(["FUND_FAILED", "CANCEL"]);
const PROCESSING_STATUSES = new Set([
  "WAIT",
  "CHARGE_BACK",
  "ACCTBOOK_SUCCESS",
  "BIZACTION_SUCCESS",
  "BIZNOTIFY_SUCCESS",
]);

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Check that a result belongs to the requested QianWen recharge order.
 *
 * @param {unknown} doc parsed CLI response
 * @param {string | null | undefined} expectedRechargeOrderId requested order ID
 * @returns {string[]} stable validation error codes
 */
export function validateRechargeResultIdentity(doc, expectedRechargeOrderId) {
  if (!isPlainObject(doc)) return ["result_not_a_json_object"];

  const errors = [];
  if (doc.type !== "recharge") errors.push("type_not_recharge");
  if (!isNonEmptyString(doc.rechargeOrderId)) {
    errors.push("recharge_order_id_missing");
  } else if (expectedRechargeOrderId === null || expectedRechargeOrderId === undefined) {
    errors.push("expect_recharge_order_id_required");
  } else if (doc.rechargeOrderId !== expectedRechargeOrderId) {
    errors.push("recharge_order_id_mismatch");
  }
  return errors;
}

/**
 * Classify a structurally parsed recharge-result snapshot.
 *
 * After response validation, FUND_FAILED and CANCEL are explicit failures
 * regardless of an accepted reason. For all other statuses, a non-null reason
 * makes the snapshot unconfirmed. In
 * particular, DONE only proves credit when no reason is present. Unknown
 * statuses and unsupported combinations are also deliberately fail-closed.
 *
 * @param {unknown} doc parsed CLI response
 * @returns {{category: "credited" | "failed" | "processing" | "unconfirmed", credited: boolean, terminal: boolean, raw_status: unknown, reason: unknown}}
 */
export function classifyRechargeResult(doc) {
  const status = isPlainObject(doc) ? doc.status : undefined;
  const reason = isPlainObject(doc) && doc.reason !== undefined ? doc.reason : null;

  let category = "unconfirmed";
  if (FAILURE_STATUSES.has(status)) {
    category = "failed";
  } else if (reason === null) {
    if (status === "DONE") {
      category = "credited";
    } else if (PROCESSING_STATUSES.has(status)) {
      category = "processing";
    }
  }

  return {
    category,
    credited: category === "credited",
    terminal: category === "credited" || category === "failed",
    raw_status: status,
    reason,
  };
}

/**
 * Validate the public recharge-result response and return its shared
 * classification in the tuple shape expected by preflight.mjs.
 *
 * @param {unknown} doc parsed CLI response
 * @param {string | null | undefined} expectedRechargeOrderId requested order ID
 * @returns {[string[], object]}
 */
export function validateRechargeResult(doc, expectedRechargeOrderId) {
  const identityErrors = validateRechargeResultIdentity(doc, expectedRechargeOrderId);
  const errors = [...identityErrors];
  if (!isPlainObject(doc)) return [errors, {}];

  const status = doc.status;
  if (!isNonEmptyString(status)) errors.push("status_missing");

  const classification = classifyRechargeResult(doc);
  const reason = doc.reason === undefined ? null : doc.reason;
  if (reason !== null) {
    if (!RESULT_REASONS.has(reason)) {
      errors.push("unsupported_reason");
    } else if (LOCAL_UNKNOWN_REASONS.has(reason) && status !== "UNKNOWN") {
      errors.push("local_reason_requires_unknown_status");
    }
  }

  return [errors, errors.length > 0 ? {} : classification];
}
