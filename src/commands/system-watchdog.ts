import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import {
  inspectGatewayRestart,
  terminateStaleGatewayPids,
  waitForGatewayHealthyRestart,
} from "../cli/daemon-cli/restart-health.js";
import { createDefaultDeps } from "../cli/deps.js";
import { messageCommand } from "../commands/message.js";
import type { OpenClawConfig } from "../config/config.js";
import {
  parseConfigJson5,
  readConfigFileSnapshot,
  resolveGatewayPort,
  loadConfig,
} from "../config/config.js";
import { resolveGatewayLogPaths } from "../daemon/launchd.js";
import { resolveGatewayService } from "../daemon/service.js";
import { runCommandWithTimeout, type SpawnResult } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveUserPath, shortenHomePath } from "../utils.js";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BRANCH_INTERVAL_MS = 60 * 60_000;
const DEFAULT_ERROR_LOOKBACK_LINES = 250;
const DEFAULT_NOTIFY_RETRIES = 3;
const DEFAULT_NOTIFY_RETRY_DELAY_MS = 1_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 20 * 60_000;
const STATE_FILE_BASENAME = "watchdog-state.json";
const NOTIFY_QUEUE_BASENAME = "watchdog-notify-queue.jsonl";
const OPENCLAW_CONFIG_BAK_DEPTH = 5;

type WatchdogLogRule = {
  name: string;
  match: string;
  pid: string;
};

type WatchdogSystemStatus = {
  channel: string;
  targets: string[];
  notifyOnHealthy: boolean;
  llmSummary: {
    enabled: boolean;
    model: string;
  };
  tts: {
    enabled: boolean;
    model: string;
    voice: string;
    targetPath?: string;
  };
};

type WatchdogRecovery = {
  enabled: boolean;
  stashBeforeRepair: boolean;
};

export type WatchdogConfig = {
  intervalMs: number;
  branchCheckIntervalMs: number;
  deploymentDir: string;
  expectedBranch: string;
  gitRemote: string;
  gitRemoteBranch: string;
  logPaths: string[];
  errorLookbackLines: number;
  errorKillRules: WatchdogLogRule[];
  systemStatus: WatchdogSystemStatus;
  recovery: WatchdogRecovery;
  statePath: string;
  notifyQueuePath: string;
};

type WatchdogState = {
  lastBranch?: string;
  lastBranchCheckAt?: number;
  lastHealthyAt?: number;
  lastCycleAt?: number;
};

type WatchdogCycleResult = {
  ok: boolean;
  actions: string[];
  errors: string[];
  branch: string | null;
  gatewayHealthy: boolean;
};

type SystemStatusPayload = {
  severity: "info" | "warn" | "critical";
  title: string;
  details: string[];
};

export type CompiledLogRule = {
  name: string;
  match: RegExp;
  pid: RegExp;
};

function toNumber(raw: unknown, fallback: number, min = 1): number {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.floor(parsed));
}

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") {
    return raw;
  }
  return fallback;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    error === null ||
    error === undefined ||
    typeof error === "string" ||
    typeof error === "number" ||
    typeof error === "boolean" ||
    typeof error === "bigint" ||
    typeof error === "symbol"
  ) {
    return String(error);
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized !== undefined) {
      return serialized;
    }
  } catch {
    // ignore serialization errors and use a fallback below
  }
  return Object.prototype.toString.call(error);
}

function parseString(raw: unknown, fallback: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value || fallback;
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function resolveConfigPath(input?: string): string {
  if (input?.trim()) {
    return resolveUserPath(input.trim());
  }
  return path.join(resolveUserPath("~/.openclaw"), "watchdog.json");
}

function resolveDefaultStatePath(): string {
  return path.join(resolveUserPath("~/.openclaw"), STATE_FILE_BASENAME);
}

function resolveDefaultNotifyQueuePath(): string {
  return path.join(resolveUserPath("~/.openclaw"), NOTIFY_QUEUE_BASENAME);
}

export function parseWatchdogConfig(raw: unknown): WatchdogConfig {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const systemStatusObj =
    obj.systemStatus && typeof obj.systemStatus === "object"
      ? (obj.systemStatus as Record<string, unknown>)
      : {};
  const llmSummaryObj =
    systemStatusObj.llmSummary && typeof systemStatusObj.llmSummary === "object"
      ? (systemStatusObj.llmSummary as Record<string, unknown>)
      : {};
  const ttsObj =
    systemStatusObj.tts && typeof systemStatusObj.tts === "object"
      ? (systemStatusObj.tts as Record<string, unknown>)
      : {};
  const recoveryObj =
    obj.recovery && typeof obj.recovery === "object"
      ? (obj.recovery as Record<string, unknown>)
      : {};

  const ruleCandidates = Array.isArray(obj.errorKillRules) ? (obj.errorKillRules as unknown[]) : [];

  const errorKillRules: WatchdogLogRule[] = ruleCandidates
    .map((rule) => {
      const item = rule && typeof rule === "object" ? (rule as Record<string, unknown>) : {};
      const name = parseString(item.name, "unnamed-rule");
      const match = parseString(item.match, "");
      const pid = parseString(item.pid, "");
      if (!match || !pid) {
        return null;
      }
      return { name, match, pid };
    })
    .filter((rule): rule is WatchdogLogRule => rule != null);

  return {
    intervalMs: toNumber(obj.intervalMs, DEFAULT_INTERVAL_MS),
    branchCheckIntervalMs: toNumber(obj.branchCheckIntervalMs, DEFAULT_BRANCH_INTERVAL_MS),
    deploymentDir: resolveUserPath(parseString(obj.deploymentDir, "~/openclaw")),
    expectedBranch: parseString(obj.expectedBranch, "dgarson/fork"),
    gitRemote: parseString(obj.gitRemote, "origin"),
    gitRemoteBranch: parseString(obj.gitRemoteBranch, "dgarson/fork"),
    logPaths: parseStringList(obj.logPaths).map((entry) => resolveUserPath(entry)),
    errorLookbackLines: toNumber(obj.errorLookbackLines, DEFAULT_ERROR_LOOKBACK_LINES),
    errorKillRules,
    systemStatus: {
      channel: parseString(systemStatusObj.channel, "slack"),
      targets: parseStringList(systemStatusObj.targets),
      notifyOnHealthy: parseBool(systemStatusObj.notifyOnHealthy, false),
      llmSummary: {
        enabled: parseBool(llmSummaryObj.enabled, false),
        model: parseString(llmSummaryObj.model, "gpt-4.1-mini"),
      },
      tts: {
        enabled: parseBool(ttsObj.enabled, false),
        model: parseString(ttsObj.model, "gpt-4o-mini-tts"),
        voice: parseString(ttsObj.voice, "alloy"),
        targetPath:
          typeof ttsObj.targetPath === "string" ? resolveUserPath(ttsObj.targetPath) : undefined,
      },
    },
    recovery: {
      enabled: parseBool(recoveryObj.enabled, true),
      stashBeforeRepair: parseBool(recoveryObj.stashBeforeRepair, true),
    },
    statePath:
      typeof obj.statePath === "string" && obj.statePath.trim()
        ? resolveUserPath(obj.statePath)
        : resolveDefaultStatePath(),
    notifyQueuePath:
      typeof obj.notifyQueuePath === "string" && obj.notifyQueuePath.trim()
        ? resolveUserPath(obj.notifyQueuePath)
        : resolveDefaultNotifyQueuePath(),
  };
}

async function loadWatchdogConfig(configPath: string): Promise<WatchdogConfig> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseConfigJson5(raw);
  if (!parsed.ok) {
    throw new Error(`Watchdog config parse failed (${configPath}): ${parsed.error}`);
  }
  const cfg = parseWatchdogConfig(parsed.parsed);
  const logs = resolveGatewayLogPaths(process.env);
  const defaultLogPaths = [logs.stdoutPath, logs.stderrPath, "/tmp/openclaw-gateway.log"];
  cfg.logPaths = Array.from(new Set([...(cfg.logPaths ?? []), ...defaultLogPaths]));
  return cfg;
}

async function readState(pathname: string): Promise<WatchdogState> {
  try {
    const raw = await fs.readFile(pathname, "utf8");
    const parsed = JSON.parse(raw) as WatchdogState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(pathname: string, state: WatchdogState): Promise<void> {
  await fs.mkdir(path.dirname(pathname), { recursive: true });
  await fs.writeFile(pathname, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function compileRules(rules: WatchdogLogRule[]): CompiledLogRule[] {
  return rules.map((rule) => ({
    name: rule.name,
    match: new RegExp(rule.match, "i"),
    pid: new RegExp(rule.pid, "i"),
  }));
}

async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  const lines: string[] = [];
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const all = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return all.slice(-Math.max(1, maxLines));
  } catch {
    return lines;
  }
}

export function extractPidsFromLogLines(lines: string[], rules: CompiledLogRule[]): number[] {
  const found = new Set<number>();
  for (const line of lines) {
    for (const rule of rules) {
      if (!rule.match.test(line)) {
        continue;
      }
      const pidMatch = line.match(rule.pid);
      const value = pidMatch?.[1] ?? "";
      const pid = Number(value);
      if (Number.isFinite(pid) && pid > 1) {
        found.add(pid);
      }
    }
  }
  return [...found];
}

async function findPidsFromRecentErrors(cfg: WatchdogConfig): Promise<number[]> {
  const rules = compileRules(cfg.errorKillRules);
  if (rules.length === 0) {
    return [];
  }
  const lines: string[] = [];
  for (const filePath of cfg.logPaths) {
    const tail = await readLastLines(filePath, cfg.errorLookbackLines);
    lines.push(...tail);
  }
  return extractPidsFromLogLines(lines, rules);
}

async function runCmd(argv: string[], cwd?: string, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS) {
  const result = await runCommandWithTimeout(argv, {
    timeoutMs,
    cwd,
    noOutputTimeoutMs: 180_000,
  });
  if (result.code !== 0) {
    throw new Error(commandFailureText(argv, result));
  }
  return result;
}

function commandFailureText(argv: string[], result: SpawnResult): string {
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const tail = stderr || stdout || `exit=${String(result.code)}`;
  return `${argv.join(" ")} failed: ${tail.split("\n").slice(-4).join("\n")}`;
}

async function currentBranch(repoDir: string): Promise<string | null> {
  const res = await runCommandWithTimeout(
    ["git", "-C", repoDir, "rev-parse", "--abbrev-ref", "HEAD"],
    { timeoutMs: 10_000 },
  ).catch(() => null);
  if (!res || res.code !== 0) {
    return null;
  }
  const branch = res.stdout.trim();
  return branch || null;
}

async function checkAndFixInvalidConfig(runtime: RuntimeEnv, actions: string[]): Promise<boolean> {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.valid) {
    return false;
  }

  const configPath = snapshot.path;
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  const invalidBackup = `${configPath}.invalid-${stamp}.json`;

  try {
    await fs.copyFile(configPath, invalidBackup);
    actions.push(`backed-up-invalid-config:${invalidBackup}`);
  } catch (err) {
    runtime.error(
      `watchdog: unable to backup invalid config ${shortenHomePath(configPath)}: ${String(err)}`,
    );
  }

  const candidates = [
    `${configPath}.bak`,
    ...Array.from(
      { length: OPENCLAW_CONFIG_BAK_DEPTH },
      (_, idx) => `${configPath}.bak.${idx + 1}`,
    ),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf8");
      const parsed = parseConfigJson5(raw);
      if (!parsed.ok) {
        continue;
      }
      await fs.copyFile(candidate, configPath);
      const restored = await readConfigFileSnapshot();
      if (restored.valid) {
        actions.push(`restored-config-from:${candidate}`);
        return true;
      }
    } catch {
      // ignore and continue
    }
  }

  return false;
}

function createNullWriter(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

async function restartGatewayWithRecoveryActions(params: {
  cfg: OpenClawConfig;
  actions: string[];
}): Promise<{ healthy: boolean; stalePids: number[] }> {
  const service = resolveGatewayService();
  const port = resolveGatewayPort(params.cfg, process.env);
  const stdout = createNullWriter();

  await service.restart({ env: process.env, stdout });
  let health = await waitForGatewayHealthyRestart({
    service,
    port,
  });

  if (!health.healthy && health.staleGatewayPids.length > 0) {
    const killed = await terminateStaleGatewayPids(health.staleGatewayPids);
    if (killed.length > 0) {
      params.actions.push(`terminated-stale-gateway-pids:${killed.join(",")}`);
    }
    await service.restart({ env: process.env, stdout });
    health = await waitForGatewayHealthyRestart({ service, port });
  }

  return {
    healthy: health.healthy,
    stalePids: health.staleGatewayPids,
  };
}

async function performGitRepair(params: { cfg: WatchdogConfig; actions: string[] }): Promise<void> {
  const dir = params.cfg.deploymentDir;
  const branch = params.cfg.expectedBranch;
  const remote = params.cfg.gitRemote;
  const remoteBranch = params.cfg.gitRemoteBranch;

  const status = await runCommandWithTimeout(["git", "-C", dir, "status", "--porcelain"], {
    timeoutMs: 15_000,
  });

  if (status.code !== 0) {
    throw new Error(commandFailureText(["git", "-C", dir, "status", "--porcelain"], status));
  }

  if (params.cfg.recovery.stashBeforeRepair && status.stdout.trim()) {
    await runCmd(
      [
        "git",
        "-C",
        dir,
        "stash",
        "push",
        "-u",
        "-m",
        `watchdog-auto-stash-${new Date().toISOString()}`,
      ],
      undefined,
      30_000,
    );
    params.actions.push("git-stash-push-u");
  }

  await runCmd(["git", "-C", dir, "fetch", remote, remoteBranch], undefined, 60_000);
  await runCmd(["git", "-C", dir, "checkout", branch], undefined, 30_000);
  await runCmd(["git", "-C", dir, "pull", "--rebase", remote, remoteBranch], undefined, 90_000);
  params.actions.push(`git-sync:${branch}`);

  await runCmd(["pnpm", "install"], dir);
  await runCmd(["pnpm", "build"], dir);
  await runCmd(["pnpm", "ui:build"], dir);
  params.actions.push("rebuild:pnpm-install-build-ui-build");
}

function formatStatusText(payload: SystemStatusPayload): string {
  const lines = [
    `[System Status][${payload.severity.toUpperCase()}] ${payload.title}`,
    ...payload.details.map((line) => `- ${line}`),
    `- host: ${os.hostname()}`,
    `- time: ${new Date().toISOString()}`,
  ];
  return lines.join("\n");
}

async function summarizeWithLlmIfEnabled(cfg: WatchdogConfig, text: string): Promise<string> {
  if (!cfg.systemStatus.llmSummary.enabled) {
    return text;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return text;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.systemStatus.llmSummary.model,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the alert as concise operations status text with no fluff and max 6 bullet lines.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      return text;
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rewritten = json.choices?.[0]?.message?.content?.trim();
    return rewritten || text;
  } catch {
    return text;
  }
}

async function maybeSynthesizeTts(cfg: WatchdogConfig, text: string): Promise<string | null> {
  if (!cfg.systemStatus.tts.enabled) {
    return null;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const targetPath =
    cfg.systemStatus.tts.targetPath ??
    path.join(resolveUserPath("~/.openclaw"), `watchdog-${Date.now()}.mp3`);

  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.systemStatus.tts.model,
        voice: cfg.systemStatus.tts.voice,
        input: text.slice(0, 4_000),
        format: "mp3",
      }),
    });

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
    return targetPath;
  } catch {
    return null;
  }
}

async function enqueueNotification(queuePath: string, payload: SystemStatusPayload): Promise<void> {
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  await fs.appendFile(queuePath, JSON.stringify(payload) + "\n", "utf8");
}

async function flushQueuedNotifications(
  cfg: WatchdogConfig,
  runtime: RuntimeEnv,
  notifyFn: (payload: SystemStatusPayload) => Promise<boolean>,
): Promise<void> {
  try {
    const raw = await fs.readFile(cfg.notifyQueuePath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) {
      return;
    }
    const keep: string[] = [];
    for (const line of lines) {
      try {
        const payload = JSON.parse(line) as SystemStatusPayload;
        const sent = await notifyFn(payload);
        if (!sent) {
          keep.push(line);
        }
      } catch {
        // discard malformed queue line
      }
    }
    if (keep.length === 0) {
      await fs.unlink(cfg.notifyQueuePath).catch(() => {
        // best effort
      });
      return;
    }
    await fs.writeFile(cfg.notifyQueuePath, keep.join("\n") + "\n", "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      runtime.error(`watchdog: failed to flush notification queue: ${String(err)}`);
    }
  }
}

async function sendSystemStatus(
  cfg: WatchdogConfig,
  runtime: RuntimeEnv,
  payload: SystemStatusPayload,
): Promise<boolean> {
  if (cfg.systemStatus.targets.length === 0) {
    return false;
  }

  const deps = createDefaultDeps();
  const originalText = formatStatusText(payload);
  const text = await summarizeWithLlmIfEnabled(cfg, originalText);
  const ttsPath = await maybeSynthesizeTts(cfg, text);

  let delivered = false;
  for (const target of cfg.systemStatus.targets) {
    for (let attempt = 1; attempt <= DEFAULT_NOTIFY_RETRIES; attempt += 1) {
      try {
        await messageCommand(
          {
            action: "send",
            channel: cfg.systemStatus.channel,
            target,
            message: text,
          },
          deps,
          runtime,
        );
        delivered = true;

        if (ttsPath) {
          await messageCommand(
            {
              action: "send",
              channel: cfg.systemStatus.channel,
              target,
              message: "System status voice note",
              media: ttsPath,
            },
            deps,
            runtime,
          );
        }
        break;
      } catch (err) {
        if (attempt === DEFAULT_NOTIFY_RETRIES) {
          runtime.error(`watchdog: status delivery failed target=${target}: ${String(err)}`);
          break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, DEFAULT_NOTIFY_RETRY_DELAY_MS * attempt),
        );
      }
    }
  }

  return delivered;
}

async function ensureGatewayHealthy(
  _runtime: RuntimeEnv,
  cfg: WatchdogConfig,
  actions: string[],
): Promise<{ healthy: boolean; stalePids: number[] }> {
  const service = resolveGatewayService();
  const gatewayCfg = loadConfig();
  const port = resolveGatewayPort(gatewayCfg, process.env);
  const initial = await inspectGatewayRestart({ service, port, env: process.env });
  if (initial.healthy) {
    return { healthy: true, stalePids: [] };
  }

  const pidsFromErrors = await findPidsFromRecentErrors(cfg);
  if (pidsFromErrors.length > 0) {
    await terminateStaleGatewayPids(pidsFromErrors);
    actions.push(`terminated-error-log-pids:${pidsFromErrors.join(",")}`);
  }

  let restartResult: { healthy: boolean; stalePids: number[] } = {
    healthy: false,
    stalePids: initial.staleGatewayPids,
  };
  let restartError: unknown;
  try {
    restartResult = await restartGatewayWithRecoveryActions({ cfg: gatewayCfg, actions });
    if (restartResult.healthy) {
      actions.push("gateway-restarted");
      return restartResult;
    }
  } catch (err) {
    restartError = err;
    actions.push(`gateway-restart-error:${String(err)}`);
  }

  if (!cfg.recovery.enabled) {
    return restartResult;
  }

  try {
    await performGitRepair({ cfg, actions });
    const recovered = await restartGatewayWithRecoveryActions({ cfg: loadConfig(), actions });
    if (recovered.healthy) {
      actions.push("gateway-recovered-after-git-repair");
    }
    return recovered;
  } catch (err) {
    actions.push(`gateway-recovery-error:${String(err)}`);
    if (restartError) {
      actions.push(`gateway-restart-before-recovery-error:${formatUnknownError(restartError)}`);
    }
    return restartResult;
  }
}

async function runWatchdogCycle(
  runtime: RuntimeEnv,
  cfg: WatchdogConfig,
  state: WatchdogState,
  now = Date.now(),
): Promise<WatchdogCycleResult> {
  const actions: string[] = [];
  const errors: string[] = [];

  const restored = await checkAndFixInvalidConfig(runtime, actions);
  if (restored) {
    actions.push("config-restored-from-backup");
  }

  const health = await ensureGatewayHealthy(runtime, cfg, actions);
  const healthy = health.healthy;

  const branchDue =
    !state.lastBranchCheckAt || now - state.lastBranchCheckAt >= cfg.branchCheckIntervalMs;

  let branch: string | null = state.lastBranch ?? null;
  if (branchDue) {
    branch = await currentBranch(cfg.deploymentDir);
    state.lastBranchCheckAt = now;
    if (branch) {
      const previous = state.lastBranch;
      state.lastBranch = branch;
      if (branch !== cfg.expectedBranch && previous !== branch) {
        actions.push(`branch-drift:${previous ?? "unknown"}->${branch}`);
      }
    } else {
      errors.push("failed-to-read-current-branch");
    }
  }

  state.lastCycleAt = now;
  if (healthy) {
    state.lastHealthyAt = now;
  }

  return {
    ok: healthy && errors.length === 0,
    actions,
    errors,
    branch,
    gatewayHealthy: healthy,
  };
}

async function notifyCycleResult(
  runtime: RuntimeEnv,
  cfg: WatchdogConfig,
  result: WatchdogCycleResult,
): Promise<void> {
  const hasBranchDrift = result.actions.some((action) => action.startsWith("branch-drift:"));
  const hasRecoveryFailure = !result.gatewayHealthy;
  const hasConfigRestore = result.actions.includes("config-restored-from-backup");

  if (
    !hasBranchDrift &&
    !hasRecoveryFailure &&
    !hasConfigRestore &&
    !cfg.systemStatus.notifyOnHealthy
  ) {
    return;
  }

  const severity: SystemStatusPayload["severity"] = hasRecoveryFailure
    ? "critical"
    : hasBranchDrift
      ? "warn"
      : "info";

  const payload: SystemStatusPayload = {
    severity,
    title: hasRecoveryFailure
      ? "Gateway watchdog detected unrecovered failure"
      : hasBranchDrift
        ? "Gateway deployment branch drift detected"
        : hasConfigRestore
          ? "Gateway config was auto-restored from backup"
          : "Gateway watchdog healthy",
    details: [
      `gatewayHealthy=${String(result.gatewayHealthy)}`,
      `branch=${result.branch ?? "unknown"}`,
      `actions=${result.actions.join(",") || "none"}`,
      `errors=${result.errors.join(",") || "none"}`,
    ],
  };

  const delivered = await sendSystemStatus(cfg, runtime, payload);
  if (!delivered) {
    await enqueueNotification(cfg.notifyQueuePath, payload);
  }
}

export async function systemWatchdogCommand(
  opts: {
    config?: string;
    once?: boolean;
    interval?: string;
    branchInterval?: string;
    json?: boolean;
  },
  runtime: RuntimeEnv,
) {
  const configPath = resolveConfigPath(opts.config);
  const cfg = await loadWatchdogConfig(configPath);

  if (opts.interval?.trim()) {
    cfg.intervalMs = toNumber(opts.interval, cfg.intervalMs);
  }
  if (opts.branchInterval?.trim()) {
    cfg.branchCheckIntervalMs = toNumber(opts.branchInterval, cfg.branchCheckIntervalMs);
  }

  await fs.mkdir(path.dirname(cfg.statePath), { recursive: true });
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    do {
      const state = await readState(cfg.statePath);
      await flushQueuedNotifications(
        cfg,
        runtime,
        async (payload) => await sendSystemStatus(cfg, runtime, payload),
      );
      const result = await runWatchdogCycle(runtime, cfg, state);
      await writeState(cfg.statePath, state);
      await notifyCycleResult(runtime, cfg, result);

      if (opts.json) {
        runtime.log(JSON.stringify(result));
      } else {
        runtime.log(
          `[watchdog] healthy=${String(result.gatewayHealthy)} branch=${result.branch ?? "unknown"} actions=${result.actions.length} errors=${result.errors.length}`,
        );
      }

      if (opts.once) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, cfg.intervalMs));
    } while (!stopped);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
