#!/usr/bin/env node
/**
 * Deterministic preflight and response validation for the qianwen-payment Skill.
 *
 * This script owns only the mechanical work that must not be improvised in prose:
 * route dependency probes, SemVer comparison (including prerelease ordering),
 * string-only validation/canonicalization of a resolved numeric CNY-yuan amount,
 * and JSON response shape validation.
 *
 * It is strictly read-only and side-effect free.  It never installs anything,
 * never creates an order, never pays, and never queries an order result.
 * Route reports carry CLI subcommands as structured metadata only -- never
 * as executable shell text.  Authorization, confirmation, and every
 * transaction decision stay with the Agent (see SKILL.md "Core rules").
 *
 * Probes it may run: qianwen version / alipay-bot --version /
 * alipay-bot trigger-payment-signal --help /
 * alipay-bot submit-payment --help
 *
 * Route names are the `qianwen` subcommand each one gates. Recharge history is
 * intentionally route-only: a zero CLI exit is authoritative and its
 * response is presented without a second payload validator.
 *   balance-summary   -> qianwen billing balance summary
 *   recharge-page     -> qianwen billing balance recharge          (no flags)
 *   recharge-order    -> qianwen billing balance recharge --channel alipay --amount
 *   recharge-result   -> qianwen billing balance recharge result
 *   recharge-history  -> qianwen billing balance recharge-history
 *
 * Usage:
 *   node preflight.mjs --route <route>
 *   node preflight.mjs --amount CNY_YUAN
 *   node preflight.mjs --validate <shape> [--expect-cents N]
 *                      [--expect-recharge-order-id ID] [--input FILE]
 *
 * Output: exactly one JSON document on stdout.  Diagnostics go to stderr.
 * Exit codes:
 *   0 = All script-owned blocking checks passed; external Skill registry gate excluded
 *   1 = Blocking dependency gap, anchor mismatch, or response validation failure
 *   2 = Usage or internal error
 *
 * Node built-ins only -- no npm install required. Requires Node >= 18.18 so the
 * preflight and the supported Alipay runtime share one executable baseline.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolveExecutable } from "./command-resolver.mjs";
import { validateRechargeResult } from "./recharge-result-contract.mjs";

export { validateRechargeResult } from "./recharge-result-contract.mjs";

const [NODE_MAJOR, NODE_MINOR] = process.versions.node
  .split(".")
  .slice(0, 2)
  .map((part) => Number.parseInt(part, 10));
if (
  !Number.isInteger(NODE_MAJOR) ||
  !Number.isInteger(NODE_MINOR) ||
  NODE_MAJOR < 18 ||
  (NODE_MAJOR === 18 && NODE_MINOR < 18)
) {
  fs.writeSync(
    1,
    `${JSON.stringify(
      {
        ok: false,
        error: "node_version_unsupported",
        version: process.versions.node,
        minimum: "18.18.0",
      },
      null,
      2,
    )}\n`,
  );
  fs.writeSync(
    2,
    `Error: Node 18.18+ required (found ${process.versions.node}). ` +
      "Install: https://nodejs.org/\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Route names mirror the `qianwen` subcommand each one gates. Validation shapes
// are the subset that requires an additional local contract check.
// `recharge-page` is the bare `recharge` command; `recharge-order` is the same
// command driven with --channel/--amount.
const ROUTE_CLI_COMMAND = {
  "balance-summary": ["billing", "balance", "summary"],
  "recharge-page": ["billing", "balance", "recharge"],
  "recharge-order": ["billing", "balance", "recharge", "--channel", "alipay", "--amount"],
  "recharge-result": ["billing", "balance", "recharge", "result"],
  "recharge-history": ["billing", "balance", "recharge-history"],
};
const VALIDATION_SHAPES = new Set([
  "balance-summary",
  "recharge-page",
  "recharge-order",
  "recharge-result",
]);
const ROUTE_MIN_CLI = {
  "balance-summary": "1.3.0",
  "recharge-page": "1.3.0",
  "recharge-result": "1.6.0",
  "recharge-history": "1.6.0",
  "recharge-order": "1.6.0",
};
const ALIPAY_SIGNAL_SUBCOMMAND = "trigger-payment-signal";
const ALIPAY_SIGNAL_OPTIONS = ["--payment-link", "--merchant-info", "--amount"];
const ALIPAY_SUBMIT_SUBCOMMAND = "submit-payment";
const ALIPAY_SUBMIT_OPTIONS = ["--session-id", "--payment-link", "--intent-summary"];
const ALIPAY_VERSION_PREFIX = "alipay-bot-cli ";

// Allowlist of hostnames permitted for order paymentUrl; matched case-insensitively.
// Mirrors the installed QianWen CLI's own payment-URL gate exactly -- re-verify
// against the CLI bundle after any CLI upgrade.
const PAYMENT_URL_HOSTS = [
  "account.qianwenai.com",
  "cashier.alipay.com",
  "excashier.alipay.com",
  "qr.alipay.com",
];

// The only accepted recharge page guidance entry.
const RECHARGE_PAGE_URL = "https://platform.qianwenai.com/home/billing/overview?target=recharge";

const PROBE_TIMEOUT_MS = 20_000;

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const AMOUNT_RE = /^(\d+)(?:\.(\d{1,2}))?$/;
const DECIMAL_RE = /^\d+(?:\.\d{1,2})?$/;

// Only fixed literals from this file are ever passed to run(); this pattern is
// the defensive gate that keeps the Windows .cmd path free of injectable text.
const SAFE_ARG_RE = /^[A-Za-z0-9._=-]+$/;

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

function hasAsciiControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function paymentUrlError(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    hasAsciiControlCharacter(value)
  ) {
    return "payment_url_invalid";
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "payment_url_invalid";
  }

  if (parsed.protocol !== "https:") return "payment_url_not_https";
  if (parsed.username !== "" || parsed.password !== "") {
    return "payment_url_has_userinfo";
  }
  // Case-insensitive match: normalize to lowercase before checking the allowlist
  if (!PAYMENT_URL_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return "payment_url_host_not_allowlisted";
  }
  return null;
}

// ---------------------------------------------------------------------------
// SemVer
// ---------------------------------------------------------------------------

/** Parse a SemVer string into {core: [major, minor, patch], prerelease}. */
export function parseSemver(raw) {
  if (typeof raw !== "string") return null;
  const m = SEMVER_RE.exec(raw.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    prerelease: m[4] ?? null,
  };
}

/**
 * SemVer prerelease precedence per semver.org §11: dot-separated identifiers,
 * numeric identifiers compare numerically and rank below alphanumeric ones,
 * a shorter identifier list ranks lower when all preceding ones are equal.
 */
function comparePrerelease(a, b) {
  const as = a.split(".");
  const bs = b.split(".");
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i += 1) {
    const x = as[i];
    const y = bs[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
      continue;
    }
    if (xNum) return -1;
    if (yNum) return 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * True when `actual` >= `minimum`.
 *
 * A prerelease of the minimum core version ranks below its final release, so
 * 1.6.0-alpha.1 does not satisfy a 1.6.0 minimum.
 */
export function meetsMinimum(actual, minimum) {
  const a = parseSemver(actual);
  const b = parseSemver(minimum);
  if (a === null || b === null) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  }
  if (!a.prerelease) return true;
  if (!b.prerelease) return false;
  return comparePrerelease(a.prerelease, b.prerelease) >= 0;
}

// ---------------------------------------------------------------------------
// Resolved CNY-yuan amount validation -- strings only, never float parsing
// ---------------------------------------------------------------------------

/** Validate and canonicalize one positive numeric CNY-yuan amount. */
export function normalizeAmount(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "amount_not_a_string" };
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "amount_empty" };
  if (text.startsWith("+") || text.startsWith("-")) {
    return { ok: false, reason: "amount_signed" };
  }
  if (text.toLowerCase().includes("e")) {
    return { ok: false, reason: "amount_scientific_notation" };
  }
  const m = AMOUNT_RE.exec(text);
  if (!m) return { ok: false, reason: "amount_not_positive_cny_decimal" };
  const intPart = m[1].replace(/^0+/, "") || "0";
  const fracPart = (m[2] ?? "").padEnd(2, "0");
  // BigInt keeps huge inputs exact; a float would silently round the cents.
  const cents = BigInt(intPart) * 100n + BigInt(fracPart);
  if (cents <= 0n) return { ok: false, reason: "amount_not_positive" };
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, reason: "amount_exceeds_safe_range" };
  }
  return {
    ok: true,
    raw: text,
    normalized: `${intPart}.${fracPart}`,
    cents: Number(cents),
  };
}

function sameCents(value, expectedCents) {
  if (typeof value !== "string") return false;
  const got = normalizeAmount(value);
  return got.ok === true && got.cents === expectedCents;
}

// ---------------------------------------------------------------------------
// Process probes
// ---------------------------------------------------------------------------

/** Resolve an executable on PATH, honouring PATHEXT on Windows. */
export function which(cmd) {
  return resolveExecutable(cmd);
}

function run(argv) {
  const [exe, ...args] = argv;
  const isWindows = process.platform === "win32";
  // Node refuses to spawn .cmd/.bat without a shell, so that one case goes
  // through the shell.  Every arg here is a fixed literal, and the guard below
  // fails closed if that ever stops being true.
  const needsShell = isWindows && /\.(cmd|bat)$/i.test(exe);
  if (needsShell && !args.every((arg) => SAFE_ARG_RE.test(arg))) {
    return [126, "", "refusing to build shell text from unexpected probe argument"];
  }
  const options = {
    encoding: "utf8",
    timeout: PROBE_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  };
  let res;
  if (needsShell) {
    const line = [exe, ...args].map((part) => `"${part}"`).join(" ");
    res = spawnSync(line, { ...options, shell: true });
  } else {
    res = spawnSync(exe, args, { ...options, shell: false });
  }
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  if (res.error) {
    const code = res.error.code;
    if (code === "ENOENT") return [127, "", "executable not found"];
    if (code === "ETIMEDOUT") {
      return [124, stdout, `probe timed out after ${PROBE_TIMEOUT_MS / 1000}s`];
    }
    return [126, stdout, String(res.error.message ?? code)];
  }
  if (res.status === null) {
    return [126, stdout, `probe terminated by signal ${res.signal ?? "unknown"}`];
  }
  return [res.status, stdout, stderr];
}

/** Parse exactly one JSON document from `text`, else null. */
function singleJson(text) {
  try {
    const parsed = JSON.parse(text.trim());
    return parsed === null ? null : parsed;
  } catch {
    return null;
  }
}

export function probeQianwenCli(minimum) {
  const exe = which("qianwen");
  if (exe === null) {
    return { name: "qianwen_cli", status: "gap", reason: "executable_not_found" };
  }
  const [code, out, err] = run([exe, "version", "--format", "json"]);
  if (code !== 0) {
    return {
      name: "qianwen_cli",
      status: "gap",
      reason: "version_command_failed",
      exit_code: code,
      stderr: err.trim().slice(0, 200),
    };
  }
  const doc = singleJson(out);
  if (!isPlainObject(doc) || typeof doc.version !== "string") {
    return { name: "qianwen_cli", status: "gap", reason: "version_not_single_json" };
  }
  const version = doc.version;
  const parsed = parseSemver(version);
  if (parsed === null) {
    return {
      name: "qianwen_cli",
      status: "gap",
      reason: "version_unparseable",
      version,
    };
  }
  if (!meetsMinimum(version, minimum)) {
    return {
      name: "qianwen_cli",
      status: "gap",
      reason: parsed.prerelease ? "prerelease_below_minimum" : "version_below_minimum",
      version,
      minimum,
    };
  }
  return { name: "qianwen_cli", status: "pass", version, minimum };
}

function probeAlipayVersion(exe) {
  const [versionCode, versionOut] = run([exe, "--version"]);
  if (versionCode !== 0) {
    return {
      status: "unavailable",
      reason: "version_command_failed",
      exit_code: versionCode,
    };
  }
  const line = versionOut.replace(/\n+$/, "");
  if (!line.startsWith(ALIPAY_VERSION_PREFIX)) {
    return { status: "unavailable", reason: "unexpected_version_output" };
  }
  const version = line.slice(ALIPAY_VERSION_PREFIX.length).trim();
  if (parseSemver(version) === null) {
    return { status: "unavailable", reason: "version_unparseable", version };
  }
  return { status: "observed", version };
}

/**
 * Probe the exact trigger-payment-signal contract used by the direct path.
 *
 * The version probe is diagnostic metadata only. Its failure, output format,
 * or reported value must not select a payment path; only this command's
 * observed option contract and the submit-payment probe determine routing.
 */
export function probeAlipayCli() {
  const exe = which("alipay-bot");
  if (exe === null) {
    return {
      name: "alipay_cli",
      status: "missing",
      reason: "executable_not_found",
      version_probe: { status: "unavailable", reason: "executable_not_found" },
    };
  }
  const versionProbe = probeAlipayVersion(exe);
  // trigger-payment-signal is intentionally omitted from some top-level help
  // output, so probe its help directly and verify the exact contract needed by
  // the pre-handoff flow.
  const [signalHelpCode, signalHelpOut, signalHelpErr] = run([
    exe,
    ALIPAY_SIGNAL_SUBCOMMAND,
    "--help",
  ]);
  if (signalHelpCode !== 0) {
    return {
      name: "alipay_cli",
      status: "missing",
      reason: "signal_help_command_failed",
      exit_code: signalHelpCode,
      version_probe: versionProbe,
    };
  }
  const signalHelp = signalHelpOut + signalHelpErr;
  if (!signalHelp.includes(`alipay-bot ${ALIPAY_SIGNAL_SUBCOMMAND}`)) {
    return {
      name: "alipay_cli",
      status: "missing",
      reason: "missing_subcommands",
      missing: [ALIPAY_SIGNAL_SUBCOMMAND],
      version_probe: versionProbe,
    };
  }
  const missingSignalOptions = ALIPAY_SIGNAL_OPTIONS.filter(
    (option) => !signalHelp.includes(option),
  );
  if (missingSignalOptions.length > 0) {
    return {
      name: "alipay_cli",
      status: "missing",
      reason: "missing_subcommand_options",
      subcommand: ALIPAY_SIGNAL_SUBCOMMAND,
      missing: missingSignalOptions,
      version_probe: versionProbe,
    };
  }
  return {
    name: "alipay_cli",
    status: "pass",
    subcommands: [ALIPAY_SIGNAL_SUBCOMMAND],
    version_probe: versionProbe,
  };
}

/**
 * Probe the `submit-payment` option contract directly.
 *
 * This is a hard CLI dependency shared by the direct and delegated-Skill paths.
 * `alipay-payment-skill` also executes submit-payment, so its availability cannot
 * compensate for a missing or incompatible command contract.
 */
export function probeAlipaySubmitPayment() {
  const check = {
    name: "alipay_submit_payment",
    subcommands: [ALIPAY_SUBMIT_SUBCOMMAND],
    required_options: [...ALIPAY_SUBMIT_OPTIONS],
  };
  const exe = which("alipay-bot");
  if (exe === null) {
    return { ...check, status: "gap", reason: "executable_not_found" };
  }
  const [helpCode, helpOut, helpErr] = run([exe, ALIPAY_SUBMIT_SUBCOMMAND, "--help"]);
  if (helpCode !== 0) {
    return {
      ...check,
      status: "gap",
      reason: "submit_help_command_failed",
      exit_code: helpCode,
    };
  }
  const submitHelp = helpOut + helpErr;
  if (!submitHelp.includes(`alipay-bot ${ALIPAY_SUBMIT_SUBCOMMAND}`)) {
    return { ...check, status: "gap", reason: "subcommand_not_found" };
  }
  const missingOptions = ALIPAY_SUBMIT_OPTIONS.filter(
    (option) => !submitHelp.includes(option),
  );
  if (missingOptions.length > 0) {
    return { ...check, status: "gap", reason: "missing_subcommand_options", missing: missingOptions };
  }
  return { ...check, status: "pass" };
}

// ---------------------------------------------------------------------------
// Response shape validation
// ---------------------------------------------------------------------------

export function validateRechargeOrder(doc, expectCents) {
  if (!isPlainObject(doc)) return ["order_not_a_json_object"];
  const errors = [];
  if (doc.type !== "recharge") errors.push("type_not_recharge");
  if (doc.channel !== "alipay") errors.push("channel_not_alipay");
  if (doc.currency !== "CNY") errors.push("currency_not_cny");
  if (doc.status !== "pending") errors.push("status_not_pending");
  if (!isNonEmptyString(doc.rechargeOrderId)) errors.push("recharge_order_id_missing");
  const amount = doc.amount;
  if (typeof amount !== "string" || !DECIMAL_RE.test(amount.trim())) {
    errors.push("amount_not_decimal_string");
  } else if (expectCents !== null && expectCents !== undefined && !sameCents(amount, expectCents)) {
    errors.push("amount_cents_mismatch");
  }
  const urlError = paymentUrlError(doc.paymentUrl);
  if (urlError !== null) errors.push(urlError);
  return errors;
}

export function validateBalanceSummary(doc) {
  if (!isPlainObject(doc)) return ["balance_not_a_json_object"];
  const errors = [];
  const available = doc.availableAmount;
  if (typeof available !== "string" || !DECIMAL_RE.test(available.trim())) {
    errors.push("available_amount_not_decimal_string");
  }
  if (doc.currency !== "CNY") errors.push("currency_not_cny");
  return errors;
}

/** Validate the recharge page guidance response. */
export function validateRechargePage(doc) {
  if (!isPlainObject(doc)) return ["recharge_page_not_a_json_object"];
  const errors = [];
  if (doc.rechargeUrl !== RECHARGE_PAGE_URL) {
    errors.push("recharge_url_not_the_official_entry");
  }
  if (typeof doc.opened !== "boolean") errors.push("opened_not_boolean");
  if (!isNonEmptyString(doc.message)) errors.push("message_missing");
  return errors;
}

// ---------------------------------------------------------------------------
// Route preflight
// ---------------------------------------------------------------------------

export function runRoute(route) {
  const checks = [probeQianwenCli(ROUTE_MIN_CLI[route])];
  let paymentPath;
  if (route === "recharge-order") {
    const signalCheck = probeAlipayCli();
    const submitCheck = probeAlipaySubmitPayment();
    checks.push(signalCheck, submitCheck);
    if (submitCheck.status === "pass") {
      paymentPath = signalCheck.status === "pass" ? "direct" : "alipay-payment-skill";
    }
  }
  return {
    route,
    cli_command: ROUTE_CLI_COMMAND[route],
    checks,
    ...(paymentPath === undefined ? {} : { payment_path: paymentPath }),
    gaps: checks.filter((check) => check.status === "gap"),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `usage: preflight.mjs --route ROUTE
       preflight.mjs --amount AMOUNT
       preflight.mjs --validate SHAPE [--expect-cents N]
                     [--expect-recharge-order-id ID] [--input FILE]

Read-only preflight and response validation for qianwen-payment

  --route ROUTE        Probe only the dependencies this CLI subcommand needs
  --amount AMOUNT      Resolved numeric CNY-yuan amount to validate/canonicalize
  --validate SHAPE     Validate the JSON response of that CLI subcommand,
                       read from stdin or --input
  --expect-cents N     Confirmed amount in cents (required when validating
                       recharge-order without --amount)
  --expect-recharge-order-id ID
                       Requested order ID (required for recharge-result)
  --input FILE         Read the payload from this file instead of stdin
  -h, --help           Show this help

ROUTE: ${Object.keys(ROUTE_CLI_COMMAND).sort().join(", ")}
SHAPE: ${[...VALIDATION_SHAPES].sort().join(", ")}

Exit codes:
  0  All script-owned blocking checks passed; external Skill registry gate excluded
  1  Blocking dependency gap, anchor mismatch, or response validation failure
  2  Usage or internal error
`;

function usageError(message) {
  process.stderr.write(`${USAGE}\npreflight.mjs: error: ${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = {
    route: null,
    amount: null,
    validate: null,
    expectCents: null,
    expectRechargeOrderId: null,
    input: null,
  };
  const takesValue = new Map([
    ["--route", "route"],
    ["--amount", "amount"],
    ["--validate", "validate"],
    ["--expect-cents", "expectCents"],
    ["--expect-recharge-order-id", "expectRechargeOrderId"],
    ["--input", "input"],
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "-h" || token === "--help") {
      process.stdout.write(USAGE);
      process.exit(0);
    }
    const eq = token.indexOf("=");
    const flag = eq === -1 ? token : token.slice(0, eq);
    const key = takesValue.get(flag);
    if (key === undefined) usageError(`unrecognized argument: ${token}`);
    let value;
    if (eq === -1) {
      value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        usageError(`argument ${flag}: expected one argument`);
      }
      i += 1;
    } else {
      value = token.slice(eq + 1);
    }
    options[key] = value;
  }
  if (options.route !== null && !Object.hasOwn(ROUTE_CLI_COMMAND, options.route)) {
    usageError(
      `argument --route: invalid choice: '${options.route}' ` +
        `(choose from ${Object.keys(ROUTE_CLI_COMMAND).sort().map((c) => `'${c}'`).join(", ")})`,
    );
  }
  if (options.validate !== null && !VALIDATION_SHAPES.has(options.validate)) {
    usageError(
      `argument --validate: invalid choice: '${options.validate}' ` +
        `(choose from ${[...VALIDATION_SHAPES].sort().map((c) => `'${c}'`).join(", ")})`,
    );
  }
  if (options.expectCents !== null) {
    if (!/^\d+$/.test(options.expectCents)) {
      usageError(`argument --expect-cents: invalid int value: '${options.expectCents}'`);
    }
    const cents = Number(options.expectCents);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      usageError("argument --expect-cents: expected a positive safe integer");
    }
    options.expectCents = cents;
  }
  if (
    options.expectRechargeOrderId !== null &&
    !isNonEmptyString(options.expectRechargeOrderId)
  ) {
    usageError("argument --expect-recharge-order-id: expected a non-empty value");
  }
  return options;
}

function readInput(inputPath) {
  // readFileSync(0) hangs when stdin is a TTY with no piped data; bail early.
  if (inputPath === null && process.stdin.isTTY) {
    usageError("--validate requires JSON input. Pipe CLI output or pass --input <file>");
  }
  let text;
  try {
    text = inputPath === null ? fs.readFileSync(0, "utf8") : fs.readFileSync(inputPath, "utf8");
  } catch (err) {
    process.stderr.write(`Error: cannot read input: ${err.message}\n`);
    return null;
  }
  return singleJson(text);
}

function main() {
  const args = parseArgv(process.argv.slice(2));

  if (args.route === null && args.amount === null && args.validate === null) {
    usageError("provide at least one of --route, --amount, or --validate");
  }

  const report = { ok: true };
  let amountAnchorMismatch = false;

  if (args.route !== null) {
    Object.assign(report, runRoute(args.route));
    if (report.gaps.length > 0) report.ok = false;
  }

  if (args.amount !== null) {
    report.amount = normalizeAmount(args.amount);
    if (!report.amount.ok) report.ok = false;
  }

  if (
    args.expectCents !== null &&
    report.amount?.ok === true &&
    args.expectCents !== report.amount.cents
  ) {
    amountAnchorMismatch = true;
    report.errors = ["amount_anchor_mismatch"];
    report.ok = false;
  }

  if (args.validate !== null) {
    const doc = readInput(args.input);
    if (doc === null) {
      report.ok = false;
      report.validation = {
        shape: args.validate,
        cli_command: ROUTE_CLI_COMMAND[args.validate],
        errors: ["payload_not_single_json_document"],
      };
    } else {
      let expect = args.expectCents;
      if (expect === null && isPlainObject(report.amount)) {
        expect = report.amount.cents ?? null;
      }
      let errors;
      let classification = {};
      if (args.validate === "recharge-order") {
        errors = amountAnchorMismatch
          ? ["amount_anchor_mismatch"]
          : validateRechargeOrder(doc, expect);
        if (expect === null && !amountAnchorMismatch) {
          // Fail closed: without a confirmed-cents anchor the response amount
          // was never cross-checked, so the validation is incomplete.
          errors.push("expect_cents_required");
        }
      } else if (args.validate === "balance-summary") {
        errors = validateBalanceSummary(doc);
      } else if (args.validate === "recharge-page") {
        errors = validateRechargePage(doc);
      } else {
        [errors, classification] = validateRechargeResult(doc, args.expectRechargeOrderId);
      }
      report.validation = {
        shape: args.validate,
        cli_command: ROUTE_CLI_COMMAND[args.validate],
        errors,
        ...(Object.keys(classification).length > 0 ? { classification } : {}),
      };
      if (errors.length > 0) report.ok = false;
    }
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

process.on("SIGINT", () => {
  process.stderr.write("Interrupted.\n");
  process.exit(2);
});

process.exit(main());
