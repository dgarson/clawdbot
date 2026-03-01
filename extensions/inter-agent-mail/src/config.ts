import type { OpenClawPluginConfigSchema } from "../../../src/plugins/types.js";

// ============================================================================
// Urgency levels — ordered from lowest to highest priority
// ============================================================================

export const MAIL_URGENCY_LEVELS = ["low", "normal", "high", "urgent"] as const;
export type MailUrgency = (typeof MAIL_URGENCY_LEVELS)[number];

// ============================================================================
// Mailbox ACL permissions
// "peek"       — read-only, never marks messages as read
// "read_mark"  — can read and mark as read, cannot delete or forward
// "read_write" — full read/mark/delete/forward access (cannot send as owner)
// ============================================================================

export const MAILBOX_ACL_LEVELS = ["peek", "read_mark", "read_write"] as const;
export type MailboxAclLevel = (typeof MAILBOX_ACL_LEVELS)[number];

// ============================================================================
// Enforcement levels — controls how aggressively the plugin gates tool calls
// until the agent checks its inbox / acks pending messages.
//
// "none"   — advisory only (prompt notification); no tool blocking (default)
// "soft"   — block "acting" tools (write/edit/exec) until inbox is checked;
//            "thinking" tools (read/search) are always allowed
// "strict" — block ALL non-mail tools until inbox is checked, and block
//            terminal/output tools until pending acks are cleared
// ============================================================================

export const ENFORCEMENT_LEVELS = ["none", "soft", "strict"] as const;
export type EnforcementLevel = (typeof ENFORCEMENT_LEVELS)[number];

// ============================================================================
// Plugin config types
// ============================================================================

export type MailRoutingRule = {
  from: string; // agent id or "*"
  to: string; // agent id or "*"
};

export type MailboxAclMap = Record<string, MailboxAclLevel>; // delegateAgentId → level

export type MailDeliveryPolicy = {
  wakeOnUrgent?: boolean;
  inboxOnlyDuringHeartbeat?: boolean;
  defaultUrgency?: MailUrgency;
  /**
   * How long (ms) a claimed message stays in "processing" before being
   * automatically reset to "unread" on the next inbox call. Default: 300_000 (5 min).
   */
  processing_ttl_ms?: number;
  /**
   * Whether the bounce_mail tool is enabled for this agent.
   * Must also be allowlisted in the gateway. Default: false.
   */
  bounce_enabled?: boolean;
};

export type InterAgentMailPluginConfig = {
  rules?: {
    allow?: MailRoutingRule[];
    deny?: MailRoutingRule[];
  };
  /** Keys are owner agent ids; values map delegate id → ACL level */
  mailbox_acls?: Record<string, MailboxAclMap>;
  /** Per-agent delivery policies */
  delivery_policies?: Record<string, MailDeliveryPolicy>;
  /**
   * Default enforcement level for all agents unless overridden per-agent.
   * Controls whether the plugin gates tool calls until the agent checks its
   * inbox and acks pending messages. Default: "none".
   */
  defaultEnforcement?: EnforcementLevel;
};

// ============================================================================
// Resolved (runtime) config with defaults applied
// ============================================================================

export type ResolvedInterAgentMailConfig = {
  allowRules: MailRoutingRule[];
  denyRules: MailRoutingRule[];
  mailboxAcls: Record<string, MailboxAclMap>;
  deliveryPolicies: Record<string, MailDeliveryPolicy>;
  defaultEnforcement: EnforcementLevel;
};

const DEFAULT_ALLOW_RULES: MailRoutingRule[] = [{ from: "*", to: "*" }];

// ============================================================================
// Parse + validate
// ============================================================================

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isMailUrgency(v: string): v is MailUrgency {
  return MAIL_URGENCY_LEVELS.includes(v as MailUrgency);
}

function isAclLevel(v: string): v is MailboxAclLevel {
  return MAILBOX_ACL_LEVELS.includes(v as MailboxAclLevel);
}

function isEnforcementLevel(v: string): v is EnforcementLevel {
  return ENFORCEMENT_LEVELS.includes(v as EnforcementLevel);
}

function parseRoutingRule(raw: unknown, path: string): MailRoutingRule {
  if (!isRecord(raw)) {
    throw new Error(`${path}: expected object`);
  }
  const from = raw.from;
  const to = raw.to;
  if (typeof from !== "string" || !from.trim()) {
    throw new Error(`${path}.from: must be a non-empty string`);
  }
  if (typeof to !== "string" || !to.trim()) {
    throw new Error(`${path}.to: must be a non-empty string`);
  }
  return { from: from.trim(), to: to.trim() };
}

function parseRules(
  raw: unknown,
  path: string,
): { allow: MailRoutingRule[]; deny: MailRoutingRule[] } {
  if (raw === undefined) {
    return { allow: [...DEFAULT_ALLOW_RULES], deny: [] };
  }
  if (!isRecord(raw)) {
    throw new Error(`${path}: expected object`);
  }
  const allowRaw = raw.allow;
  const denyRaw = raw.deny;
  const allow: MailRoutingRule[] = [];
  const deny: MailRoutingRule[] = [];
  if (allowRaw !== undefined) {
    if (!Array.isArray(allowRaw)) {
      throw new Error(`${path}.allow: must be an array`);
    }
    for (let i = 0; i < allowRaw.length; i++) {
      allow.push(parseRoutingRule(allowRaw[i], `${path}.allow[${i}]`));
    }
  } else {
    allow.push(...DEFAULT_ALLOW_RULES);
  }
  if (denyRaw !== undefined) {
    if (!Array.isArray(denyRaw)) {
      throw new Error(`${path}.deny: must be an array`);
    }
    for (let i = 0; i < denyRaw.length; i++) {
      deny.push(parseRoutingRule(denyRaw[i], `${path}.deny[${i}]`));
    }
  }
  return { allow, deny };
}

function parseMailboxAcls(raw: unknown, path: string): Record<string, MailboxAclMap> {
  if (raw === undefined) {
    return {};
  }
  if (!isRecord(raw)) {
    throw new Error(`${path}: expected object`);
  }
  const result: Record<string, MailboxAclMap> = {};
  for (const [ownerId, delegateMap] of Object.entries(raw)) {
    if (!isRecord(delegateMap)) {
      throw new Error(`${path}.${ownerId}: expected object mapping delegate id to ACL level`);
    }
    const acls: MailboxAclMap = {};
    for (const [delegateId, level] of Object.entries(delegateMap)) {
      if (typeof level !== "string" || !isAclLevel(level)) {
        throw new Error(
          `${path}.${ownerId}.${delegateId}: must be one of ${MAILBOX_ACL_LEVELS.join(", ")}`,
        );
      }
      acls[delegateId] = level;
    }
    result[ownerId] = acls;
  }
  return result;
}

function parseDeliveryPolicy(raw: unknown, path: string): MailDeliveryPolicy {
  if (!isRecord(raw)) {
    throw new Error(`${path}: expected object`);
  }
  const policy: MailDeliveryPolicy = {};
  if (raw.wakeOnUrgent !== undefined) {
    if (typeof raw.wakeOnUrgent !== "boolean") {
      throw new Error(`${path}.wakeOnUrgent: must be a boolean`);
    }
    policy.wakeOnUrgent = raw.wakeOnUrgent;
  }
  if (raw.inboxOnlyDuringHeartbeat !== undefined) {
    if (typeof raw.inboxOnlyDuringHeartbeat !== "boolean") {
      throw new Error(`${path}.inboxOnlyDuringHeartbeat: must be a boolean`);
    }
    policy.inboxOnlyDuringHeartbeat = raw.inboxOnlyDuringHeartbeat;
  }
  if (raw.defaultUrgency !== undefined) {
    if (typeof raw.defaultUrgency !== "string" || !isMailUrgency(raw.defaultUrgency)) {
      throw new Error(`${path}.defaultUrgency: must be one of ${MAIL_URGENCY_LEVELS.join(", ")}`);
    }
    policy.defaultUrgency = raw.defaultUrgency;
  }
  if (raw.processing_ttl_ms !== undefined) {
    if (typeof raw.processing_ttl_ms !== "number" || raw.processing_ttl_ms <= 0) {
      throw new Error(`${path}.processing_ttl_ms: must be a positive number`);
    }
    policy.processing_ttl_ms = raw.processing_ttl_ms;
  }
  if (raw.bounce_enabled !== undefined) {
    if (typeof raw.bounce_enabled !== "boolean") {
      throw new Error(`${path}.bounce_enabled: must be a boolean`);
    }
    policy.bounce_enabled = raw.bounce_enabled;
  }
  return policy;
}

function parseDeliveryPolicies(raw: unknown, path: string): Record<string, MailDeliveryPolicy> {
  if (raw === undefined) {
    return {};
  }
  if (!isRecord(raw)) {
    throw new Error(`${path}: expected object`);
  }
  const result: Record<string, MailDeliveryPolicy> = {};
  for (const [agentId, policyRaw] of Object.entries(raw)) {
    result[agentId] = parseDeliveryPolicy(policyRaw, `${path}.${agentId}`);
  }
  return result;
}

export function parsePluginConfig(
  raw: unknown,
): { ok: true; value: ResolvedInterAgentMailConfig } | { ok: false; message: string } {
  try {
    if (raw === undefined || raw === null) {
      return {
        ok: true,
        value: {
          allowRules: [...DEFAULT_ALLOW_RULES],
          denyRules: [],
          mailboxAcls: {},
          deliveryPolicies: {},
          defaultEnforcement: "none",
        },
      };
    }
    if (!isRecord(raw)) {
      return { ok: false, message: "config must be an object" };
    }
    const allowedKeys = new Set([
      "rules",
      "mailbox_acls",
      "delivery_policies",
      "defaultEnforcement",
    ]);
    for (const key of Object.keys(raw)) {
      if (!allowedKeys.has(key)) {
        return { ok: false, message: `unknown config key: ${key}` };
      }
    }
    const { allow, deny } = parseRules(raw.rules, "rules");
    const mailboxAcls = parseMailboxAcls(raw.mailbox_acls, "mailbox_acls");
    const deliveryPolicies = parseDeliveryPolicies(raw.delivery_policies, "delivery_policies");
    let defaultEnforcement: EnforcementLevel = "none";
    if (raw.defaultEnforcement !== undefined) {
      if (
        typeof raw.defaultEnforcement !== "string" ||
        !isEnforcementLevel(raw.defaultEnforcement)
      ) {
        return {
          ok: false,
          message: `defaultEnforcement: must be one of ${ENFORCEMENT_LEVELS.join(", ")}`,
        };
      }
      defaultEnforcement = raw.defaultEnforcement;
    }
    return {
      ok: true,
      value: {
        allowRules: allow,
        denyRules: deny,
        mailboxAcls,
        deliveryPolicies,
        defaultEnforcement,
      },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export function createInterAgentMailConfigSchema(): OpenClawPluginConfigSchema {
  return {
    safeParse(value: unknown) {
      const result = parsePluginConfig(value);
      if (result.ok) {
        return { success: true, data: result.value };
      }
      return {
        success: false,
        error: { issues: [{ path: [], message: result.message }] },
      };
    },
  };
}

// ============================================================================
// ACL checks
// ============================================================================

/** Returns true if `from` is allowed to send to `to` per the routing rules. */
export function isRoutingAllowed(
  config: ResolvedInterAgentMailConfig,
  from: string,
  to: string,
): boolean {
  // Deny rules are evaluated first (deny takes precedence over allow)
  for (const rule of config.denyRules) {
    if (matchesRule(rule, from, to)) {
      return false;
    }
  }
  // Must match at least one allow rule
  for (const rule of config.allowRules) {
    if (matchesRule(rule, from, to)) {
      return true;
    }
  }
  return false;
}

function matchesRule(rule: MailRoutingRule, from: string, to: string): boolean {
  const fromMatch = rule.from === "*" || rule.from === from;
  const toMatch = rule.to === "*" || rule.to === to;
  return fromMatch && toMatch;
}

/**
 * Resolves the effective ACL level a `caller` has over `ownerMailbox`.
 * Returns null if the caller has no delegated access (and is not the owner).
 */
export function resolveMailboxAcl(
  config: ResolvedInterAgentMailConfig,
  ownerMailbox: string,
  caller: string,
): MailboxAclLevel | "owner" | null {
  if (caller === ownerMailbox) {
    return "owner";
  }
  const ownerAcls = config.mailboxAcls[ownerMailbox];
  if (!ownerAcls) {
    return null;
  }
  return ownerAcls[caller] ?? null;
}

export const DEFAULT_PROCESSING_TTL_MS = 5 * 60 * 1_000; // 5 minutes

/** Resolves the effective delivery policy for an agent, applying defaults. */
export function resolveDeliveryPolicy(
  config: ResolvedInterAgentMailConfig,
  agentId: string,
): Required<MailDeliveryPolicy> {
  const raw = config.deliveryPolicies[agentId] ?? {};
  return {
    wakeOnUrgent: raw.wakeOnUrgent ?? true,
    inboxOnlyDuringHeartbeat: raw.inboxOnlyDuringHeartbeat ?? false,
    defaultUrgency: raw.defaultUrgency ?? "normal",
    processing_ttl_ms: raw.processing_ttl_ms ?? DEFAULT_PROCESSING_TTL_MS,
    bounce_enabled: raw.bounce_enabled ?? false,
  };
}
