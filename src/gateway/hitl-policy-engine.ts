export type HitlPolicyDefinition = {
  /** Stable identifier for audit records and request storage. */
  id: string;
  /** Exact tool name match (case-insensitive). */
  tool?: string;
  /** Tool category fallback match (case-insensitive). */
  category?: string;
  /** Minimum role required to approve this request. */
  minApproverRole?: string;
  /** If true, the approver must be different from the requesting actor. */
  requireDifferentActor?: boolean;
};

export type HitlPolicyEngineConfig = {
  policies?: HitlPolicyDefinition[];
  /** Optional explicit default policy id used when no tool/category match exists. */
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
};

export type HitlAuthorizationResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "insufficient-role" | "same-actor-required-different";
    };

const DEFAULT_APPROVER_ROLE_ORDER = ["viewer", "operator", "admin", "owner"];

function normalizeToken(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

function normalizePolicies(policies: HitlPolicyDefinition[]): HitlPolicyDefinition[] {
  return policies
    .map((policy) => {
      const id = policy.id?.trim();
      if (!id) {
        return null;
      }
      return {
        ...policy,
        id,
        tool: normalizeToken(policy.tool),
        category: normalizeToken(policy.category),
        minApproverRole: normalizeToken(policy.minApproverRole),
      };
    })
    .filter((policy): policy is HitlPolicyDefinition => Boolean(policy));
}

export type HitlPolicyEngine = {
  policies: HitlPolicyDefinition[];
  resolvePolicy(input: HitlPolicyResolutionInput): HitlPolicyDefinition | null;
  authorize(input: HitlAuthorizationInput): HitlAuthorizationResult;
};

export function createHitlPolicyEngine(config: HitlPolicyEngineConfig = {}): HitlPolicyEngine {
  const normalizedPolicies = normalizePolicies(config.policies ?? []);

  const byTool = new Map<string, HitlPolicyDefinition>();
  const byCategory = new Map<string, HitlPolicyDefinition>();
  const byId = new Map<string, HitlPolicyDefinition>();

  for (const policy of normalizedPolicies) {
    byId.set(policy.id, policy);
    if (policy.tool && !byTool.has(policy.tool)) {
      byTool.set(policy.tool, policy);
    }
    if (policy.category && !byCategory.has(policy.category)) {
      byCategory.set(policy.category, policy);
    }
  }

  const defaultPolicy =
    config.defaultPolicyId && config.defaultPolicyId.trim().length > 0
      ? (byId.get(config.defaultPolicyId.trim()) ?? null)
      : null;

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
