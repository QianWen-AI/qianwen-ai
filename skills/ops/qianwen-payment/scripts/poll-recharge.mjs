#!/usr/bin/env node
/**
 * Foreground poll for a recharge order's terminal status.
 *
 * This script repeatedly invokes `qianwen billing balance recharge result` and
 * waits until the shared recharge-result contract returns a terminal
 * classification or the local wall-clock budget is exhausted.
 *
 * It is strictly read-only: it only queries result snapshots, never creates or
 * mutates anything.  All progress/diagnostic output goes to stderr; stdout
 * receives exactly one JSON document at exit for the Agent to parse.
 *
 * Requires Node >= 18.18, matching the qianwen-payment Skill runtime baseline.
 *
 * Exit codes:
 *   0 = Terminal classification reached (read `category`).
 *   1 = Max poll duration elapsed without reaching a terminal state.
 *   2 = Usage error, runtime/CLI failure, or interruption.
 */

import { spawn } from "node:child_process";
import { resolveExecutable } from "./command-resolver.mjs";
import { validateRechargeResult } from "./recharge-result-contract.mjs";

// ---------------------------------------------------------------------------
// Cross-platform process execution (mirrors preflight.mjs patterns)
// ---------------------------------------------------------------------------

// Defensive argument gate for the Windows .cmd/shell path.
const SAFE_ARG_RE = /^[A-Za-z0-9._:=-]+$/;

const DEFAULT_INTERVAL_SECONDS = 5;
const DEFAULT_MAX_SECONDS = 7200;
const DEFAULT_CALL_TIMEOUT_SECONDS = 20;
const CONSECUTIVE_READ_FAILURE_LIMIT = 3;
// Retry only failures that may recover without changing local configuration or
// user authorization: the CLI's normalized transient recharge failure, a
// short-lived not-found result, and this wrapper's per-call timeout.
const RETRYABLE_READ_EXIT_CODES = new Set([3, 7, 124]);
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const TERMINATION_GRACE_MS = 250;

/** Resolve an executable on PATH, honouring PATHEXT on Windows. */
function which(cmd) {
  return resolveExecutable(cmd);
}

/**
 * Send a termination signal to the result-query process tree. Unix children run
 * in their own process group so wrapper scripts cannot leave a query behind.
 *
 * @param {import("node:child_process").ChildProcess} child active child process
 * @param {NodeJS.Signals} signal signal to deliver
 */
function signalChild(child, signal) {
  if (process.platform !== "win32" && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child when the process group no longer exists.
    }
  }
  child.kill(signal);
}

/**
 * Stop a running result-query process and force termination after a short grace
 * period so the parent can always emit its machine-readable outcome promptly.
 *
 * @param {import("node:child_process").ChildProcess} child active child process
 * @returns {NodeJS.Timeout}
 */
function terminateChild(child) {
  signalChild(child, "SIGTERM");
  const timer = setTimeout(() => {
    signalChild(child, "SIGKILL");
  }, TERMINATION_GRACE_MS);
  timer.unref();
  return timer;
}

/**
 * Spawn one QianWen result query without blocking signal delivery.
 *
 * @param {string[]} argv executable followed by structured arguments
 * @param {number} timeoutMs maximum runtime for the child process
 * @param {AbortSignal} signal outer interruption signal
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function run(argv, timeoutMs, signal) {
  const [exe, ...args] = argv;
  const isWindows = process.platform === "win32";
  const needsShell = isWindows && /\.(cmd|bat)$/i.test(exe);
  if (needsShell && !args.every((arg) => SAFE_ARG_RE.test(arg))) {
    return Promise.resolve({
      code: 126,
      stdout: "",
      stderr: "refusing to build shell text from unexpected argument",
    });
  }

  return new Promise((resolve) => {
    const options = { windowsHide: true, shell: needsShell, detached: !isWindows };
    const line = needsShell ? [exe, ...args].map((part) => `"${part}"`).join(" ") : exe;
    const childArgs = needsShell ? [] : args;
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let outputExceeded = false;
    let terminationTimer = null;

    const child = spawn(line, childArgs, options);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (terminationTimer !== null) clearTimeout(terminationTimer);
      signal.removeEventListener("abort", handleAbort);
      resolve(result);
    };

    const appendOutput = (current, chunk) => {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > MAX_OUTPUT_BYTES) {
        outputExceeded = true;
        if (terminationTimer === null) terminationTimer = terminateChild(child);
        return current;
      }
      return next;
    };

    child.stdout?.on("data", (chunk) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendOutput(stderr, chunk);
    });

    const handleAbort = () => {
      if (terminationTimer === null) terminationTimer = terminateChild(child);
    };
    signal.addEventListener("abort", handleAbort, { once: true });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      if (terminationTimer === null) terminationTimer = terminateChild(child);
    }, timeoutMs);
    timeoutTimer.unref();

    child.once("error", (error) => {
      const errorCode = error.code;
      if (errorCode === "ENOENT") {
        finish({ code: 127, stdout: "", stderr: "executable not found" });
      } else {
        finish({ code: 126, stdout, stderr: String(error.message ?? errorCode) });
      }
    });

    child.once("close", (code, childSignal) => {
      if (signal.aborted) {
        finish({ code: 130, stdout, stderr: "interrupted" });
      } else if (timedOut) {
        finish({ code: 124, stdout, stderr: `timed out after ${timeoutMs / 1000}s` });
      } else if (outputExceeded) {
        finish({ code: 126, stdout, stderr: "command output exceeded 4 MiB" });
      } else if (code === null) {
        finish({ code: 126, stdout, stderr: `terminated by signal ${childSignal ?? "unknown"}` });
      } else {
        finish({ code, stdout, stderr });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const USAGE = `\
usage: poll-recharge.mjs --recharge-order-id <id>
           [--interval-seconds <n>] [--max-seconds <n>]
           [--call-timeout-seconds <n>]

Foreground poll for a recharge order's terminal status.

  --recharge-order-id ID       Required. The order to poll.
  --interval-seconds N         Seconds between polls (default: ${DEFAULT_INTERVAL_SECONDS}).
  --max-seconds N              Max total poll duration in seconds (default: ${DEFAULT_MAX_SECONDS}).
  --call-timeout-seconds N     Timeout per result query in seconds (default: ${DEFAULT_CALL_TIMEOUT_SECONDS}).
  -h, --help                   Show this help.

Exit codes:
  0  Terminal classification reached (inspect category)
  1  Max poll duration elapsed before a terminal result
  2  Usage/runtime failure or interruption (SIGINT/SIGTERM)
`;

function usageError(message) {
  process.stderr.write(`${USAGE}\npoll-recharge.mjs: error: ${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const opts = {
    rechargeOrderId: null,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    maxSeconds: DEFAULT_MAX_SECONDS,
    callTimeoutSeconds: DEFAULT_CALL_TIMEOUT_SECONDS,
  };
  const takesValue = new Map([
    ["--recharge-order-id", "rechargeOrderId"],
    ["--interval-seconds", "intervalSeconds"],
    ["--max-seconds", "maxSeconds"],
    ["--call-timeout-seconds", "callTimeoutSeconds"],
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
    if (key === "rechargeOrderId") {
      opts.rechargeOrderId = value;
    } else {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0 || Math.floor(num) !== num) {
        usageError(`argument ${flag}: expected a positive integer, got '${value}'`);
      }
      opts[key] = num;
    }
  }
  if (opts.rechargeOrderId === null) {
    usageError("--recharge-order-id is required");
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitResult(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  const startMs = Date.now();
  const abortController = new AbortController();
  let interruptionSignal = null;
  let polls = 0;
  let consecutiveReadFailures = 0;
  let lastStatus = null;
  let lastCategory = "unconfirmed";

  /** Record the first interruption and cancel any active query or wait. */
  const handleInterruption = (signal) => {
    if (interruptionSignal !== null) return;
    interruptionSignal = signal;
    abortController.abort();
  };

  /** Emit the single machine-readable result for an interrupted poll. */
  const emitInterruption = () => {
    process.stderr.write(`\nInterrupted by ${interruptionSignal}.\n`);
    emitResult({
      ok: false,
      rechargeOrderId: opts.rechargeOrderId,
      status: lastStatus,
      terminal: false,
      category: "unconfirmed",
      credited: false,
      elapsedSeconds: Math.round((Date.now() - startMs) / 1000),
      polls,
      reason: "interrupted",
    });
    return 2;
  };

  /** Emit the single machine-readable result for the total polling deadline. */
  const emitTimeout = () => {
    const elapsedSeconds = Math.round((Date.now() - startMs) / 1000);
    process.stderr.write(`  max duration (${opts.maxSeconds}s) exceeded; giving up.\n`);
    emitResult({
      ok: false,
      rechargeOrderId: opts.rechargeOrderId,
      status: lastStatus,
      terminal: false,
      category: lastCategory,
      credited: false,
      elapsedSeconds,
      polls,
      reason: "timeout",
    });
    return 1;
  };

  /**
   * Retry a transient result-read failure until the consecutive-failure limit
   * is reached. The counter is reset only by a fully validated snapshot.
   *
   * @param {string} diagnostic internal failure description
   * @param {"read-error" | "not-found"} reason machine-readable final reason
   * @returns {Promise<boolean>} whether the poll loop should retry
   */
  const retryReadFailure = async (diagnostic, reason) => {
    consecutiveReadFailures += 1;
    const attempt = `${consecutiveReadFailures}/${CONSECUTIVE_READ_FAILURE_LIMIT}`;
    if (consecutiveReadFailures >= CONSECUTIVE_READ_FAILURE_LIMIT) {
      process.stderr.write(`  warning: ${diagnostic} (${attempt}); stopping.\n`);
      emitResult({
        ok: false,
        rechargeOrderId: opts.rechargeOrderId,
        status: lastStatus,
        terminal: false,
        category: "unconfirmed",
        credited: false,
        elapsedSeconds: Math.round((Date.now() - startMs) / 1000),
        polls,
        reason,
      });
      return false;
    }

    process.stderr.write(`  warning: ${diagnostic} (${attempt}); retrying.\n`);
    await sleepUntilNextPoll(opts.intervalSeconds, deadlineMs, abortController.signal);
    return true;
  };

  process.once("SIGINT", () => handleInterruption("SIGINT"));
  process.once("SIGTERM", () => handleInterruption("SIGTERM"));

  const exe = which("qianwen");
  if (exe === null) {
    process.stderr.write("Error: 'qianwen' CLI not found on PATH.\n");
    emitResult({
      ok: false,
      rechargeOrderId: opts.rechargeOrderId,
      status: null,
      terminal: false,
      category: "unconfirmed",
      credited: false,
      elapsedSeconds: 0,
      polls: 0,
      reason: "read-error",
    });
    return 2;
  }

  const deadlineMs = startMs + opts.maxSeconds * 1000;
  const callTimeoutMs = opts.callTimeoutSeconds * 1000;

  process.stderr.write(
    `Polling recharge result (interval=${opts.intervalSeconds}s, max=${opts.maxSeconds}s)...\n`,
  );

  while (Date.now() < deadlineMs) {
    if (interruptionSignal !== null) return emitInterruption();

    polls += 1;
    const elapsed = Math.round((Date.now() - startMs) / 1000);
    process.stderr.write(`  [poll #${polls}, ${elapsed}s elapsed] querying...\n`);
    const remainingMs = Math.max(1, deadlineMs - Date.now());

    const result = await run(
      [exe, "billing", "balance", "recharge", "result",
        "--recharge-order-id", opts.rechargeOrderId, "--format", "json"],
      Math.min(callTimeoutMs, remainingMs),
      abortController.signal,
    );

    if (interruptionSignal !== null) return emitInterruption();
    if (Date.now() >= deadlineMs) return emitTimeout();

    // Only explicitly recoverable read failures use the bounded retry allowance.
    // Authentication, configuration, usage, interruption, and local execution
    // failures require external action and therefore stop immediately.
    if (result.code !== 0) {
      const reason = result.code === 7 ? "not-found" : "read-error";
      if (RETRYABLE_READ_EXIT_CODES.has(result.code)) {
        const shouldRetry = await retryReadFailure(`CLI exited ${result.code}`, reason);
        if (!shouldRetry) return 2;
        if (interruptionSignal !== null) return emitInterruption();
        continue;
      }

      process.stderr.write(`  warning: CLI exited ${result.code}; stopping.\n`);
      emitResult({
        ok: false,
        rechargeOrderId: opts.rechargeOrderId,
        status: lastStatus,
        terminal: false,
        category: "unconfirmed",
        credited: false,
        elapsedSeconds: Math.round((Date.now() - startMs) / 1000),
        polls,
        reason,
      });
      return 2;
    }

    // Parse JSON from stdout.
    let doc;
    try {
      doc = JSON.parse(result.stdout.trim());
    } catch {
      process.stderr.write("  warning: stdout is not valid JSON; stopping.\n");
      emitResult({
        ok: false,
        rechargeOrderId: opts.rechargeOrderId,
        status: lastStatus,
        terminal: false,
        category: "unconfirmed",
        credited: false,
        elapsedSeconds: Math.round((Date.now() - startMs) / 1000),
        polls,
        reason: "read-error",
      });
      return 2;
    }

    const [validationErrors, classification] = validateRechargeResult(
      doc,
      opts.rechargeOrderId,
    );
    if (validationErrors.length > 0) {
      process.stderr.write("  error: recharge result failed validation.\n");
      emitResult({
        ok: false,
        rechargeOrderId: opts.rechargeOrderId,
        status: lastStatus,
        terminal: false,
        category: "unconfirmed",
        credited: false,
        elapsedSeconds: Math.round((Date.now() - startMs) / 1000),
        polls,
        reason: "read-error",
      });
      return 2;
    }

    consecutiveReadFailures = 0;

    const status = classification.raw_status;
    if (typeof status === "string") lastStatus = status;
    lastCategory = classification.category;

    if (classification.terminal) {
      const finalElapsed = Math.round((Date.now() - startMs) / 1000);
      process.stderr.write(
        `  terminal classification reached: ${classification.category} (${finalElapsed}s)\n`,
      );
      emitResult({
        ok: true,
        rechargeOrderId: opts.rechargeOrderId,
        status,
        terminal: true,
        category: classification.category,
        credited: classification.credited,
        elapsedSeconds: finalElapsed,
        polls,
      });
      return 0;
    }

    if (classification.category === "unconfirmed") {
      process.stderr.write("  result classification is unconfirmed; stopping.\n");
      emitResult({
        ok: false,
        rechargeOrderId: opts.rechargeOrderId,
        status: lastStatus,
        terminal: false,
        category: classification.category,
        credited: classification.credited,
        elapsedSeconds: Math.round((Date.now() - startMs) / 1000),
        polls,
        reason: "unrecognized_status",
      });
      return 2;
    }

    process.stderr.write("  result is still processing.\n");
    await sleepUntilNextPoll(opts.intervalSeconds, deadlineMs, abortController.signal);
    if (interruptionSignal !== null) return emitInterruption();
  }

  if (interruptionSignal !== null) return emitInterruption();
  return emitTimeout();
}

/**
 * Sleep for the interval or until the deadline, and wake immediately when the
 * outer poll is interrupted.
 *
 * @param {number} intervalSeconds configured poll interval
 * @param {number} deadlineMs absolute wall-clock deadline
 * @param {AbortSignal} signal outer interruption signal
 * @returns {Promise<void>}
 */
async function sleepUntilNextPoll(intervalSeconds, deadlineMs, signal) {
  const remaining = Math.max(0, deadlineMs - Date.now());
  const waitMs = Math.min(intervalSeconds * 1000, remaining);
  if (waitMs <= 0) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, waitMs);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

process.exitCode = await main();
