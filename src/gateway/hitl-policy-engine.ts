import type { ApprovalsConfig, HitlApprovalsConfig } from "../config/types.approvals.js";

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
};

export type HitlPolicyEngineConfig = {
  policies?: HitlPolicyDefinition[];
  /** Optional explicit default policy id used when no tool/category/pattern match exists. */
  defaultPolicyId?: string;
  /** Ordered low→high roles used for minApproverRole checks. */
  approverRoleOrder?: string[];
  /** Enforce strict matrix validation (default: true). */
  strict?: boolean;
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
};

export type HitlAuthorizationResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "insufficient-role" | "same-actor-required-different";
    };

const DEFAULT_APPROVER_ROLE_ORDER = ["viewer", "operator", "admin", "owner"];
const DEFAULT_STRICT_POLICY_MATRIX = true;

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
};

function createPolicyEngineFromHitlConfig(config: HitlApprovalsConfig = {}): HitlPolicyEngine {
  return createHitlPolicyEngine({
    policies: config.policies,
    defaultPolicyId: config.defaultPolicyId,
    approverRoleOrder: config.approverRoleOrder,
    strict: config.strict,
  });
}

export function createHitlPolicyEngineFromConfig(
  approvals: ApprovalsConfig | null | undefined,
): HitlPolicyEngine {
  return createPolicyEngineFromHitlConfig(approvals?.hitl);
}

export function createHitlPolicyEngine(config: HitlPolicyEngineConfig = {}): HitlPolicyEngine {
  const normalizedPolicies = normalizePolicies(config.policies ?? []);
  const strict = config.strict ?? DEFAULT_STRICT_POLICY_MATRIX;

  const byTool = new Map<string, HitlPolicyDefinition>();
  const byCategory = new Map<string, HitlPolicyDefinition>();
  const categoryOnlyPolicies = new Map<string, HitlPolicyDefinition>();
  const byId = new Map<string, HitlPolicyDefinition>();
  const byPattern = new Map<string, { regex: RegExp; policy: HitlPolicyDefinition }>();
  const defaults: HitlPolicyDefinition[] = [];

  for (const policy of normalizedPolicies) {
    if (strict && byId.has(policy.id)) {
      throw new Error(`HITL policy matrix conflict: duplicate policy id '${policy.id}'.`);
    }
    byId.set(policy.id, policy);

    if (policy.tool) {
      if (strict && byTool.has(policy.tool)) {
        throw new Error(
          `HITL policy matrix conflict: duplicate tool selector '${policy.tool}' in policy '${policy.id}'.`,
        );
      }
      if (!byTool.has(policy.tool)) {
        byTool.set(policy.tool, policy);
      }
    }

    if (policy.category) {
      if (!policy.tool && strict && categoryOnlyPolicies.has(policy.category)) {
        throw new Error(
          `HITL policy matrix conflict: duplicate category selector '${policy.category}' in policy '${policy.id}'.`,
        );
      }
      if (!policy.tool) {
        categoryOnlyPolicies.set(policy.category, policy);
      }
      if (!byCategory.has(policy.category)) {
        byCategory.set(policy.category, policy);
      }
    }

    if (policy.patternRegex) {
      const key = (policy.pattern ?? "").toLowerCase();
      if (strict && byPattern.has(key)) {
        throw new Error(
          `HITL policy matrix conflict: duplicate pattern selector '${policy.pattern}' in policy '${policy.id}'.`,
        );
      }
      if (!byPattern.has(key)) {
        byPattern.set(key, { regex: policy.patternRegex, policy });
      }
    }

    if (!policy.tool && !policy.category && !policy.pattern) {
      defaults.push(policy);
    }
  }

  const defaultPolicy = (() => {
    const resolvedDefaultPolicyId = config.defaultPolicyId?.trim();
    if (resolvedDefaultPolicyId) {
      if (strict) {
        const found = byId.get(resolvedDefaultPolicyId);
        if (!found) {
          throw new Error(
            `HITL policy matrix conflict: defaultPolicyId '${resolvedDefaultPolicyId}' does not exist.`,
          );
        }
        return found;
      }
      return byId.get(resolvedDefaultPolicyId) ?? null;
    }

    if (strict && defaults.length > 1) {
      const ids = defaults.map((policy) => policy.id).join(", ");
      throw new Error(
        `HITL policy matrix conflict: multiple default policies found without explicit defaultPolicyId: ${ids}`,
      );
    }

    return defaults[0] ?? null;
  })();

  const roleOrder = (config.approverRoleOrder ?? DEFAULT_APPROVER_ROLE_ORDER)
    .map((role) => normalizeToken(role))
    .filter((role): role is string => Boolean(role));
  const roleRank = new Map(roleOrder.map((role, index) => [role, index]));
  const byPatternList = Array.from(byPattern.values());

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

    for (const entry of byPatternList) {
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

    if (input.policy.requireDifferentActor) {
      const approverActorId = input.approverActorId?.trim();
      const requestActorId = input.requestActorId?.trim();
      if (approverActorId && requestActorId && approverActorId === requestActorId) {
        return { allowed: false, reason: "same-actor-required-different" };
      }
    }

    return { allowed: true };
  }

  return {
    policies: normalizedPolicies,
    resolvePolicy,
    authorize,
  };
}
