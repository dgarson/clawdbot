import type { ApprovalsConfig, HitlApprovalsConfig } from "../config/types.approvals.js";

export type HitlEscalationConfig = {
  /** Role to escalate to when approval is denied. */
  onDeny?: string;
  /** Role to escalate to when approval times out. */
  onTimeout?: string;
  /** Maximum number of escalation attempts before giving up. */
  maxEscalations?: number;
};

export type HitlPolicyDefinition = {
  /** Stable identifier for audit records and request storage. */
  id: string;
  /** Exact tool name match (case-insensitive). */
  tool?: string;
  /** Tool category fallback match (case-insensitive). */
  category?: string;
  /** Wildcard tool match (supports `*` and `?`, case-insensitive). */
  pattern?: string;
  /** Minimum role required to approve this request. */
  minApproverRole?: string;
  /** If true, the approver must be different from the requesting actor. */
  requireDifferentActor?: boolean;
  /** Maximum approval chain depth to prevent escalation attacks (0 = no limit). */
  maxApprovalChainDepth?: number;
  /** Escalation configuration for denied/timeout scenarios. */
  escalation?: HitlEscalationConfig;
};

export type HitlPolicyEngineConfig = {
  policies?: HitlPolicyDefinition[];
  /** Optional explicit default policy id used when no tool/category/pattern match exists. */
  defaultPolicyId?: string;
  /** Ordered low→high roles used for minApproverRole checks. */
  approverRoleOrder?: string[];
};

export type HitlPolicyResolutionInput = {
  tool: string;
  category?: string;
};

export type HitlAuthorizationInput = {
  policy: HitlPolicyDefinition;
  approverRole?: string;
  approverActorId?: string;
  requestActorId?: string;
  /** Current approval chain depth (e.g., how many times this request has been escalated). */
  currentChainDepth?: number;
};

export type HitlAuthorizationResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "insufficient-role" | "same-actor-required-different" | "approval-chain-exceeded";
    };

export type HitlEscalationInput = {
  policy: HitlPolicyDefinition;
  trigger: "deny" | "timeout";
  currentEscalationCount?: number;
};

export type HitlEscalationResult =
  | {
      shouldEscalate: true;
      escalateToRole: string;
      maxEscalations: number;
    }
  | { shouldEscalate: false };

const DEFAULT_APPROVER_ROLE_ORDER = ["viewer", "operator", "admin", "owner"];

function normalizeToken(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("")
    .map((ch) => {
      if (ch === "*") {
        return ".*";
      }
      if (ch === "?") {
        return ".";
      }
      return escapeRegExp(ch);
    })
    .join("");
  return new RegExp(`^${escaped}$`, "i");
}

type NormalizedPolicy = HitlPolicyDefinition & {
  tool?: string;
  category?: string;
  minApproverRole?: string;
  pattern?: string;
  patternRegex?: RegExp;
};

function normalizePolicies(policies: HitlPolicyDefinition[]): NormalizedPolicy[] {
  const normalized: NormalizedPolicy[] = [];
  for (const policy of policies) {
    const id = policy.id?.trim();
    if (!id) {
      continue;
    }
    const pattern = policy.pattern?.trim() || undefined;
    normalized.push({
      ...policy,
      id,
      tool: normalizeToken(policy.tool),
      category: normalizeToken(policy.category),
      pattern,
      patternRegex: pattern ? wildcardToRegExp(pattern) : undefined,
      minApproverRole: normalizeToken(policy.minApproverRole),
    });
  }
  return normalized;
}

export type HitlPolicyEngine = {
  policies: HitlPolicyDefinition[];
  resolvePolicy(input: HitlPolicyResolutionInput): HitlPolicyDefinition | null;
  authorize(input: HitlAuthorizationInput): HitlAuthorizationResult;
  shouldEscalate(input: HitlEscalationInput): HitlEscalationResult;
};

function createPolicyEngineFromHitlConfig(config: HitlApprovalsConfig = {}): HitlPolicyEngine {
  return createHitlPolicyEngine({
    policies: config.policies,
    defaultPolicyId: config.defaultPolicyId,
    approverRoleOrder: config.approverRoleOrder,
  });
}

export function createHitlPolicyEngineFromConfig(
  approvals: ApprovalsConfig | null | undefined,
): HitlPolicyEngine {
  return createPolicyEngineFromHitlConfig(approvals?.hitl);
}

export function createHitlPolicyEngine(config: HitlPolicyEngineConfig = {}): HitlPolicyEngine {
  const normalizedPolicies = normalizePolicies(config.policies ?? []);

  const byTool = new Map<string, HitlPolicyDefinition>();
  const byCategory = new Map<string, HitlPolicyDefinition>();
  const byId = new Map<string, HitlPolicyDefinition>();
  const byPattern: Array<{ regex: RegExp; policy: HitlPolicyDefinition }> = [];

  for (const policy of normalizedPolicies) {
    byId.set(policy.id, policy);
    if (policy.tool && !byTool.has(policy.tool)) {
      byTool.set(policy.tool, policy);
    }
    if (policy.category && !byCategory.has(policy.category)) {
      byCategory.set(policy.category, policy);
    }
    if (policy.patternRegex) {
      byPattern.push({ regex: policy.patternRegex, policy });
    }
  }

  const defaultPolicy =
    config.defaultPolicyId && config.defaultPolicyId.trim().length > 0
      ? (byId.get(config.defaultPolicyId.trim()) ?? null)
      : (normalizedPolicies.find((policy) => !policy.tool && !policy.category && !policy.pattern) ??
        null);

  const roleOrder = (config.approverRoleOrder ?? DEFAULT_APPROVER_ROLE_ORDER)
    .map((role) => normalizeToken(role))
    .filter((role): role is string => Boolean(role));
  const roleRank = new Map(roleOrder.map((role, index) => [role, index]));

  function resolvePolicy(input: HitlPolicyResolutionInput): HitlPolicyDefinition | null {
    const tool = normalizeToken(input.tool);
    if (!tool) {
      return defaultPolicy;
    }

    const exact = byTool.get(tool);
    if (exact) {
      return exact;
    }

    const category = normalizeToken(input.category);
    if (category) {
      const fallback = byCategory.get(category);
      if (fallback) {
        return fallback;
      }
    }

    for (const entry of byPattern) {
      if (entry.regex.test(tool)) {
        return entry.policy;
      }
    }

    return defaultPolicy;
  }

  function authorize(input: HitlAuthorizationInput): HitlAuthorizationResult {
    const requiredRole = normalizeToken(input.policy.minApproverRole);
    const approverRole = normalizeToken(input.approverRole);

    if (requiredRole) {
      const requiredRank = roleRank.get(requiredRole);
      const approverRank = approverRole ? roleRank.get(approverRole) : undefined;
      if (requiredRank === undefined || approverRank === undefined || approverRank < requiredRank) {
        return { allowed: false, reason: "insufficient-role" };
      }
    }

    // Check no-self-approval (requireDifferentActor)
    if (input.policy.requireDifferentActor) {
      const approverActorId = input.approverActorId?.trim();
      const requestActorId = input.requestActorId?.trim();
      if (approverActorId && requestActorId && approverActorId === requestActorId) {
        return { allowed: false, reason: "same-actor-required-different" };
      }
    }

    // Check approval chain depth (approval-boundary enforcement)
    const maxDepth = input.policy.maxApprovalChainDepth;
    if (maxDepth !== undefined && maxDepth > 0) {
      const currentDepth = input.currentChainDepth ?? 0;
      if (currentDepth >= maxDepth) {
        return { allowed: false, reason: "approval-chain-exceeded" };
      }
    }

    return { allowed: true };
  }

  function shouldEscalate(input: HitlEscalationInput): HitlEscalationResult {
    const escalation = input.policy.escalation;
    if (!escalation) {
      return { shouldEscalate: false };
    }

    const triggerRole =
      input.trigger === "deny"
        ? normalizeToken(escalation.onDeny)
        : normalizeToken(escalation.onTimeout);

    if (!triggerRole) {
      return { shouldEscalate: false };
    }

    const maxEscalations = escalation.maxEscalations ?? 3;
    const currentCount = input.currentEscalationCount ?? 0;

    if (currentCount >= maxEscalations) {
      return { shouldEscalate: false };
    }

    // Verify the escalation target role exists in our role order
    if (!roleRank.has(triggerRole)) {
      return { shouldEscalate: false };
    }

    return {
      shouldEscalate: true,
      escalateToRole: triggerRole,
      maxEscalations,
    };
  }

  return {
    policies: normalizedPolicies,
    resolvePolicy,
    authorize,
    shouldEscalate,
  };
}
