/**
 * Inter-agent mail scenario runner.
 *
 * Interprets `.scenario.json` files as end-to-end test scripts. Each scenario
 * describes a sequence of agent mail operations with assertions after each step.
 *
 * --------------------------------------------------------------------------
 * SCENARIO FORMAT OVERVIEW
 * --------------------------------------------------------------------------
 *
 * {
 *   "id": "unique-scenario-id",
 *   "description": "Human-readable description",
 *   "config": { ...plugin config (rules, mailbox_acls, delivery_policies)... },
 *   "steps": [ ...Step[] ]
 * }
 *
 * STEP FIELDS
 * -----------
 *   id?          — unique id for capture references in later steps
 *   description? — human-readable summary
 *   actor?       — agentId performing the action (required for tool actions)
 *   action       — what to do (see ACTION TYPES below)
 *   params?      — action-specific parameters (supports variable interpolation)
 *   capture?     — extract values after the step for use in later steps
 *   expect?      — assertions to verify after the step
 *
 * ACTION TYPES
 * ------------
 *   mail.send        — send a message (params: to_agent_id, subject, body, urgency?, tags?)
 *   mail.inbox       — claim unread messages (params: filter_urgency?, filter_tags?,
 *                        include_stale?, mailbox_id?)
 *   mail.ack         — ack processing messages (params: message_ids, mailbox_id?)
 *   mail.forward     — forward a message (params: message_id, to_agent_id, notes?,
 *                        urgency?, tags?, mailbox_id?)
 *   mail.recipients  — list allowed recipients (params: search?)
 *   bounce_mail      — return to sender (params: message_id, reason, confidence,
 *                        mailbox_id?)
 *   seed_message     — inject a message directly into a mailbox (bypasses tools/ACLs;
 *                        params: to, from, subject, body, urgency?, tags?, status?,
 *                        processing_expires_at? — use "$past" or "$future" literals)
 *   assert_mailbox   — read-only assertion on mailbox state; no action taken
 *
 * CAPTURE SYNTAX
 * --------------
 *   "capture": {
 *     "my_key": { "source": "result", "regex": "id: (msg_[^,)]+)" },
 *     "first_id": { "source": "mailbox", "agent": "agent-b", "path": "messages[0].id" }
 *   }
 *
 *   Captured values are stored as strings under `step_id.capture_key`.
 *
 * VARIABLE INTERPOLATION
 * ----------------------
 *   In any `params` string value, use "${step_id.capture_key}" to reference a
 *   previously captured value. Arrays of strings are also interpolated element-wise.
 *
 *   Special literals (usable as param values or in seed_message timestamps):
 *     "$past"   — current time minus 1 hour (useful for pre-expired leases)
 *     "$future" — current time plus 1 hour
 *     "$now"    — current time (ms)
 *
 * EXPECT SHAPE
 * ------------
 *   {
 *     "result_contains": "substring",      — tool result must contain this
 *     "result_not_contains": "substring",  — tool result must NOT contain this
 *     "throws": "error substring",         — step must reject with this message
 *     "mailbox": {
 *       "agent": "agent-b",
 *       "count":            n,             — total non-deleted message count
 *       "unread_count":     n,
 *       "processing_count": n,
 *       "read_count":       n,
 *       "messages": [                      — ordered by mailbox position
 *         {
 *           "from":          "agent-a",
 *           "to":            "agent-b",
 *           "subject":       "Hello",
 *           "subject_contains": "ell",
 *           "body_contains": "World",
 *           "status":        "processing",
 *           "urgency":       "normal",
 *           "has_tag":       "task",        — message has at least this tag
 *           "tags":          ["a", "b"],    — exact tag set
 *           "is_bounce":     true,
 *           "is_forwarded":  true,
 *           "lineage_length": 2
 *         }
 *       ]
 *     }
 *   }
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parsePluginConfig, type ResolvedInterAgentMailConfig } from "../src/config.js";
import type { MailUrgency } from "../src/config.js";
import {
  appendMessage,
  mailboxPath,
  newMessageId,
  readMailbox,
  type MailMessage,
  type MessageStatus,
} from "../src/store.js";
import { createBounceMailTool, createMailTool } from "../src/tools.js";

// ============================================================================
// Schema types
// ============================================================================

export type ScenarioFile = {
  id: string;
  description?: string;
  /** Plugin config to use. Defaults to allow-all with no ACLs. */
  config?: Record<string, unknown>;
  steps: ScenarioStep[];
};

export type ScenarioStep = {
  /** Unique id, required if this step's captured values are referenced later. */
  id?: string;
  description?: string;
  /** Agent performing the action (required for all tool actions). */
  actor?: string;
  action: ScenarioAction;
  params?: Record<string, unknown>;
  capture?: Record<string, CaptureSpec>;
  expect?: StepExpect;
};

export type ScenarioAction =
  | "mail.send"
  | "mail.inbox"
  | "mail.ack"
  | "mail.forward"
  | "mail.recipients"
  | "bounce_mail"
  | "seed_message"
  | "assert_mailbox";

export type CaptureSpec =
  | { source: "result"; regex: string }
  | { source: "mailbox"; agent: string; path: string };

export type StepExpect = {
  result_contains?: string;
  result_not_contains?: string;
  /** Expects the step to reject. Value is a substring of the error message. */
  throws?: string;
  /** Assert a single agent's mailbox state after this step. */
  mailbox?: MailboxExpect;
  /** Assert multiple agents' mailbox states after this step. */
  mailboxes?: MailboxExpect[];
};

export type MailboxExpect = {
  agent: string;
  count?: number;
  unread_count?: number;
  processing_count?: number;
  read_count?: number;
  messages?: MessageExpect[];
};

export type MessageExpect = {
  from?: string;
  to?: string;
  subject?: string;
  subject_contains?: string;
  body_contains?: string;
  status?: MessageStatus;
  urgency?: MailUrgency;
  has_tag?: string;
  tags?: string[];
  is_bounce?: boolean;
  is_forwarded?: boolean;
  lineage_length?: number;
};

// ============================================================================
// Runner context
// ============================================================================

type RunContext = {
  tmpDir: string;
  config: ResolvedInterAgentMailConfig;
  /** step_id → { capture_key → value } */
  captures: Map<string, Record<string, string>>;
};

// ============================================================================
// Public entrypoint
// ============================================================================

/**
 * Loads a `.scenario.json` file, runs all steps, and throws on any failure.
 * Designed to be called from a Vitest test.
 */
export async function runScenarioFile(filePath: string): Promise<void> {
  const raw = await fs.readFile(filePath, "utf-8");
  const scenario: ScenarioFile = JSON.parse(raw);
  await runScenario(scenario);
}

export async function runScenario(scenario: ScenarioFile): Promise<void> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mail-scenario-"));

  try {
    const parsed = parsePluginConfig(scenario.config as Record<string, unknown> | undefined);
    if (!parsed.ok) {
      throw new Error(`Scenario config invalid: ${parsed.message}`);
    }

    const ctx: RunContext = {
      tmpDir,
      config: parsed.value,
      captures: new Map(),
    };

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i]!;
      const label = step.id ?? step.description ?? `step[${i}]`;
      try {
        await executeStep(step, ctx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Scenario '${scenario.id}' failed at ${label}: ${msg}`);
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// ============================================================================
// Step executor
// ============================================================================

async function executeStep(step: ScenarioStep, ctx: RunContext): Promise<void> {
  const params = interpolateParams(step.params ?? {}, ctx.captures);
  const { expect: exp } = step;

  // Steps that expect a throw need special handling
  if (exp?.throws !== undefined) {
    let threw = false;
    let errorMsg = "";
    try {
      await dispatchAction(step.action, step.actor, params, ctx);
      threw = false;
    } catch (err) {
      threw = true;
      errorMsg = err instanceof Error ? err.message : String(err);
    }
    if (!threw) {
      throw new Error(`Expected step to throw "${exp.throws}" but it succeeded.`);
    }
    if (!errorMsg.toLowerCase().includes(exp.throws.toLowerCase())) {
      throw new Error(`Expected error to contain "${exp.throws}" but got: "${errorMsg}"`);
    }
    return; // No further assertions when throws is expected
  }

  const result = await dispatchAction(step.action, step.actor, params, ctx);

  // Capture values
  if (step.id && step.capture) {
    const capturedForStep: Record<string, string> = {};
    for (const [key, spec] of Object.entries(step.capture)) {
      capturedForStep[key] = await extractCapture(spec, result, ctx.tmpDir);
    }
    ctx.captures.set(step.id, capturedForStep);
  }

  // Assert expectations
  if (exp) {
    await assertExpect(exp, result, ctx.tmpDir);
  }
}

// ============================================================================
// Action dispatch
// ============================================================================

async function dispatchAction(
  action: ScenarioAction,
  actor: string | undefined,
  params: Record<string, unknown>,
  ctx: RunContext,
): Promise<string> {
  switch (action) {
    case "mail.send":
    case "mail.inbox":
    case "mail.ack":
    case "mail.forward":
    case "mail.recipients": {
      if (!actor) throw new Error(`actor is required for action '${action}'.`);
      const tool = createMailTool({ stateDir: ctx.tmpDir, config: ctx.config, api: {} });
      const mapped = mapActionToParam(action);
      return tool.execute({ action: mapped, ...params }, { agentId: actor });
    }

    case "bounce_mail": {
      if (!actor) throw new Error(`actor is required for action 'bounce_mail'.`);
      const tool = createBounceMailTool({ stateDir: ctx.tmpDir, config: ctx.config, api: {} });
      return tool.execute(params, { agentId: actor });
    }

    case "seed_message":
      return seedMessage(params, ctx.tmpDir);

    case "assert_mailbox":
      // No action — just returns empty string so expectations can run
      return "";

    default:
      throw new Error(`Unknown action: ${String(action)}`);
  }
}

function mapActionToParam(action: ScenarioAction): string {
  return action.replace("mail.", "");
}

// ============================================================================
// seed_message
// ============================================================================

async function seedMessage(params: Record<string, unknown>, tmpDir: string): Promise<string> {
  const to = requireParam(params, "to");
  const from = requireParam(params, "from");
  const subject = requireParam(params, "subject");
  const body = (params.body as string | undefined) ?? "";
  const urgency = (params.urgency as MailUrgency | undefined) ?? "normal";
  const tags = (params.tags as string[] | undefined) ?? [];
  const status = (params.status as MessageStatus | undefined) ?? "unread";

  const now = Date.now();

  // Handle special timestamp literals
  const processingAt =
    status === "processing" ? (resolveTimestamp(params.processing_at, now) ?? now) : null;
  const processingExpiresAt =
    status === "processing"
      ? (resolveTimestamp(params.processing_expires_at, now) ?? now + 5 * 60_000)
      : null;

  const message: MailMessage = {
    id: newMessageId(),
    from,
    to,
    subject,
    body,
    urgency,
    tags,
    status,
    created_at: resolveTimestamp(params.created_at, now) ?? now,
    read_at: status === "read" ? now : null,
    deleted_at: status === "deleted" ? now : null,
    processing_at: processingAt,
    processing_expires_at: processingExpiresAt,
    forwarded_from: (params.forwarded_from as string | null | undefined) ?? null,
    lineage: (params.lineage as string[] | undefined) ?? [],
  };

  const filePath = mailboxPath(tmpDir, to);
  await appendMessage(filePath, message);
  return `seeded message ${message.id} into ${to}'s mailbox`;
}

/** Resolves "$past", "$future", "$now", or numeric ms values. */
function resolveTimestamp(val: unknown, now: number): number | null {
  if (val === "$past") return now - 60 * 60_000; // 1 hour ago
  if (val === "$future") return now + 60 * 60_000; // 1 hour from now
  if (val === "$now") return now;
  if (typeof val === "number") return val;
  return null;
}

// ============================================================================
// Variable interpolation
// ============================================================================

/**
 * Replaces "${step_id.key}" references and "$past"/"$future"/"$now" literals
 * in all string values (and string array elements) within params.
 */
function interpolateParams(
  params: Record<string, unknown>,
  captures: Map<string, Record<string, string>>,
): Record<string, unknown> {
  const now = Date.now();

  function interpolateValue(val: unknown): unknown {
    if (typeof val === "string") {
      if (val === "$past") return now - 60 * 60_000;
      if (val === "$future") return now + 60 * 60_000;
      if (val === "$now") return now;
      // Replace "${step_id.key}" references
      return val.replace(/\$\{([^.}]+)\.([^}]+)\}/g, (_, stepId, key) => {
        const stepCaptures = captures.get(stepId);
        if (!stepCaptures) {
          throw new Error(`No captures found for step '${stepId}'. Check step ids.`);
        }
        const captured = stepCaptures[key];
        if (captured === undefined) {
          throw new Error(`Capture key '${key}' not found in step '${stepId}'.`);
        }
        return captured;
      });
    }
    if (Array.isArray(val)) {
      return val.map(interpolateValue);
    }
    if (val !== null && typeof val === "object") {
      return interpolateParams(val as Record<string, unknown>, captures);
    }
    return val;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    result[k] = interpolateValue(v);
  }
  return result;
}

// ============================================================================
// Capture extraction
// ============================================================================

async function extractCapture(spec: CaptureSpec, result: string, tmpDir: string): Promise<string> {
  if (spec.source === "result") {
    const match = result.match(new RegExp(spec.regex));
    if (!match?.[1]) {
      throw new Error(`Capture regex /${spec.regex}/ did not match result: "${result}"`);
    }
    return match[1];
  }

  // source === "mailbox" — wrap in { messages } so paths like "messages[0].id" resolve
  const messages = await readMailbox(mailboxPath(tmpDir, spec.agent));
  const value = resolvePath({ messages }, spec.path);
  if (value === undefined) {
    throw new Error(`Capture path '${spec.path}' resolved to undefined in ${spec.agent}'s mailbox`);
  }
  return String(value);
}

/** Resolves a dot/bracket path like "messages[0].id" against a value. */
function resolvePath(root: unknown, dotPath: string): unknown {
  const parts = dotPath.replace(/\[(\d+)\]/g, ".$1").split(".");
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ============================================================================
// Assertions
// ============================================================================

async function assertExpect(exp: StepExpect, result: string, tmpDir: string): Promise<void> {
  if (exp.result_contains !== undefined) {
    if (!result.includes(exp.result_contains)) {
      throw new Error(`Expected result to contain "${exp.result_contains}" but got:\n${result}`);
    }
  }

  if (exp.result_not_contains !== undefined) {
    if (result.includes(exp.result_not_contains)) {
      throw new Error(
        `Expected result NOT to contain "${exp.result_not_contains}" but it did:\n${result}`,
      );
    }
  }

  if (exp.mailbox) {
    await assertMailbox(exp.mailbox, tmpDir);
  }

  if (exp.mailboxes) {
    for (const mb of exp.mailboxes) {
      await assertMailbox(mb, tmpDir);
    }
  }
}

async function assertMailbox(exp: MailboxExpect, tmpDir: string): Promise<void> {
  const messages = await readMailbox(mailboxPath(tmpDir, exp.agent));

  if (exp.count !== undefined) {
    const nonDeleted = messages.filter((m) => m.status !== "deleted").length;
    if (nonDeleted !== exp.count) {
      throw new Error(
        `Mailbox '${exp.agent}': expected ${exp.count} non-deleted messages, got ${nonDeleted}`,
      );
    }
  }

  if (exp.unread_count !== undefined) {
    const n = messages.filter((m) => m.status === "unread").length;
    if (n !== exp.unread_count) {
      throw new Error(`Mailbox '${exp.agent}': expected ${exp.unread_count} unread, got ${n}`);
    }
  }

  if (exp.processing_count !== undefined) {
    const n = messages.filter((m) => m.status === "processing").length;
    if (n !== exp.processing_count) {
      throw new Error(
        `Mailbox '${exp.agent}': expected ${exp.processing_count} processing, got ${n}`,
      );
    }
  }

  if (exp.read_count !== undefined) {
    const n = messages.filter((m) => m.status === "read").length;
    if (n !== exp.read_count) {
      throw new Error(`Mailbox '${exp.agent}': expected ${exp.read_count} read, got ${n}`);
    }
  }

  if (exp.messages) {
    for (let i = 0; i < exp.messages.length; i++) {
      const pred = exp.messages[i]!;
      const msg = messages[i];
      if (!msg) {
        throw new Error(
          `Mailbox '${exp.agent}': expected message at index ${i} but mailbox has only ${messages.length} messages`,
        );
      }
      assertMessagePredicate(pred, msg, `${exp.agent}[${i}]`);
    }
  }
}

function assertMessagePredicate(pred: MessageExpect, msg: MailMessage, label: string): void {
  const check = <T>(field: string, expected: T, actual: T) => {
    if (actual !== expected) {
      throw new Error(`Message ${label}.${field}: expected "${expected}", got "${actual}"`);
    }
  };

  if (pred.from !== undefined) check("from", pred.from, msg.from);
  if (pred.to !== undefined) check("to", pred.to, msg.to);
  if (pred.subject !== undefined) check("subject", pred.subject, msg.subject);
  if (pred.status !== undefined) check("status", pred.status, msg.status);
  if (pred.urgency !== undefined) check("urgency", pred.urgency, msg.urgency);

  if (pred.subject_contains !== undefined) {
    if (!msg.subject.includes(pred.subject_contains)) {
      throw new Error(
        `Message ${label}.subject: expected to contain "${pred.subject_contains}", got "${msg.subject}"`,
      );
    }
  }

  if (pred.body_contains !== undefined) {
    if (!msg.body.includes(pred.body_contains)) {
      throw new Error(
        `Message ${label}.body: expected to contain "${pred.body_contains}", got "${msg.body.slice(0, 100)}..."`,
      );
    }
  }

  if (pred.has_tag !== undefined) {
    if (!msg.tags.includes(pred.has_tag)) {
      throw new Error(
        `Message ${label}.tags: expected to include "${pred.has_tag}", got [${msg.tags.join(", ")}]`,
      );
    }
  }

  if (pred.tags !== undefined) {
    const msgTags = [...msg.tags].sort().join(",");
    const expTags = [...pred.tags].sort().join(",");
    if (msgTags !== expTags) {
      throw new Error(`Message ${label}.tags: expected [${expTags}], got [${msgTags}]`);
    }
  }

  if (pred.is_bounce !== undefined) {
    const isBounce = msg.tags.includes("_bounce");
    if (isBounce !== pred.is_bounce) {
      throw new Error(`Message ${label}.is_bounce: expected ${pred.is_bounce}, got ${isBounce}`);
    }
  }

  if (pred.is_forwarded !== undefined) {
    const isFwd = msg.forwarded_from !== null;
    if (isFwd !== pred.is_forwarded) {
      throw new Error(`Message ${label}.is_forwarded: expected ${pred.is_forwarded}, got ${isFwd}`);
    }
  }

  if (pred.lineage_length !== undefined) {
    if (msg.lineage.length !== pred.lineage_length) {
      throw new Error(
        `Message ${label}.lineage_length: expected ${pred.lineage_length}, got ${msg.lineage.length}`,
      );
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function requireParam(params: Record<string, unknown>, key: string): string {
  const val = params[key];
  if (typeof val !== "string" || !val.trim()) {
    throw new Error(`seed_message: '${key}' is required`);
  }
  return val;
}
