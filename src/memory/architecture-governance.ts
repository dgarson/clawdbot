/**
 * Memory Architecture Governance — injectable access-control layer.
 *
 * `IMemoryGovernance` is the single seam through which all read/write access
 * decisions flow. Every IMemoryService implementation holds a governance
 * instance (defaulting to PermissiveMemoryGovernance for backwards compat)
 * and defers allow/deny decisions to it.
 *
 * Rule evaluation: first-match-wins, evaluated in declaration order.
 * If no rule matches, the `default` action applies (default "allow" when
 * no config is provided — permissive — "deny" when config is explicitly set).
 */

import type {
  MemoryGovernanceConfig,
  MemoryGovernanceRule,
  MemoryMetadata,
  MemoryNode,
} from "./architecture.js";

// ============================================================================
// IMemoryGovernance — injectable interface
// ============================================================================

/**
 * Injectable governance interface for memory read/write access control.
 *
 * All IMemoryService implementations accept an IMemoryGovernance instance
 * (defaulting to PermissiveMemoryGovernance for backwards compat) and defer
 * all access decisions to it.
 */
export interface IMemoryGovernance {
  /**
   * Returns true if the calling agent is allowed to store memory with
   * the described metadata.
   *
   * @param agentId - The requesting agent (may be undefined for anonymous writes).
   * @param metadata - The metadata for the node being stored.
   */
  canWrite(agentId: string | undefined, metadata: Omit<MemoryMetadata, "confidenceScore">): boolean;

  /**
   * Returns true if the calling agent is allowed to read the given node.
   *
   * @param agentId - The requesting agent (may be undefined).
   * @param node - The candidate MemoryNode.
   */
  canRead(agentId: string | undefined, node: MemoryNode): boolean;

  /**
   * Filters a list of nodes to only those readable by the given agentId.
   * Convenience wrapper around canRead().
   */
  filterReadable(agentId: string | undefined, nodes: MemoryNode[]): MemoryNode[];
}

// ============================================================================
// PermissiveMemoryGovernance — default backwards-compat implementation
// ============================================================================

/**
 * Default governance that allows all reads and writes.
 * Used as the no-op fallback when no governance config is provided, or
 * when createMemoryGovernance() is called with undefined/empty config.
 */
export class PermissiveMemoryGovernance implements IMemoryGovernance {
  canWrite(
    _agentId: string | undefined,
    _metadata: Omit<MemoryMetadata, "confidenceScore">,
  ): boolean {
    return true;
  }

  canRead(_agentId: string | undefined, _node: MemoryNode): boolean {
    return true;
  }

  filterReadable(_agentId: string | undefined, nodes: MemoryNode[]): MemoryNode[] {
    return nodes;
  }
}

// ============================================================================
// AllowlistMemoryGovernance — rule-based implementation
// ============================================================================

function ruleMatchesOperation(rule: MemoryGovernanceRule, operation: "read" | "write"): boolean {
  // If the rule does not specify operations, it applies to both read and write.
  if (!rule.operations || rule.operations.length === 0) {
    return true;
  }
  return rule.operations.includes(operation);
}

function ruleMatchesMetadata(
  rule: MemoryGovernanceRule,
  metadata: Omit<MemoryMetadata, "confidenceScore">,
): boolean {
  const match = rule.match;
  if (!match) {
    // No match predicate — applies to all metadata.
    return true;
  }

  if (match.agentId !== undefined && match.agentId !== metadata.agentId) {
    return false;
  }
  if (match.userId !== undefined && match.userId !== metadata.userId) {
    return false;
  }
  if (match.sourceId !== undefined && match.sourceId !== metadata.sourceId) {
    return false;
  }
  if (match.domain !== undefined && match.domain !== metadata.domain) {
    return false;
  }
  if (match.tag !== undefined && !(metadata.tags ?? []).includes(match.tag)) {
    return false;
  }

  return true;
}

function evaluateGovernancePolicy(
  metadata: Omit<MemoryMetadata, "confidenceScore">,
  policy: MemoryGovernanceConfig,
  operation: "read" | "write",
): boolean {
  const defaultAction = policy.default ?? "deny";
  const rules = policy.rules ?? [];

  for (const rule of rules) {
    if (!rule?.action) {
      continue;
    }
    if (!ruleMatchesOperation(rule, operation)) {
      continue;
    }
    if (!ruleMatchesMetadata(rule, metadata)) {
      continue;
    }
    // First matching rule wins.
    return rule.action === "allow";
  }

  return defaultAction === "allow";
}

/**
 * Rule-based governance implementation backed by a MemoryGovernanceConfig.
 *
 * Rules are evaluated in declaration order; the first matching rule wins.
 * If no rule matches, the `default` action applies.
 *
 * The default `default` is "deny" — add explicit allow rules for all
 * agents/partitions you want to permit.
 *
 * Rules can be scoped to specific operations via `operations?: ('read' | 'write')[]`.
 * A rule without `operations` applies to both reads and writes.
 */
export class AllowlistMemoryGovernance implements IMemoryGovernance {
  constructor(private readonly policy: MemoryGovernanceConfig) {}

  canWrite(
    _agentId: string | undefined,
    metadata: Omit<MemoryMetadata, "confidenceScore">,
  ): boolean {
    return evaluateGovernancePolicy(metadata, this.policy, "write");
  }

  canRead(_agentId: string | undefined, node: MemoryNode): boolean {
    return evaluateGovernancePolicy(node.metadata, this.policy, "read");
  }

  filterReadable(agentId: string | undefined, nodes: MemoryNode[]): MemoryNode[] {
    return nodes.filter((node) => this.canRead(agentId, node));
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an IMemoryGovernance instance from an optional MemoryGovernanceConfig.
 *
 * - If config is undefined: returns PermissiveMemoryGovernance (all allow, backwards compat).
 * - If config has rules or an explicit default: returns AllowlistMemoryGovernance.
 *
 * Inject the result into IMemoryService implementations via the constructor.
 *
 * @example
 * const governance = createMemoryGovernance({
 *   default: "deny",
 *   rules: [
 *     { action: "allow", match: { agentId: "tim" } },
 *     { action: "allow", operations: ["read"], match: { agentId: "oscar" } },
 *   ],
 * });
 */
export function createMemoryGovernance(config?: MemoryGovernanceConfig): IMemoryGovernance {
  if (!config || (!config.rules?.length && config.default === undefined)) {
    return new PermissiveMemoryGovernance();
  }
  return new AllowlistMemoryGovernance(config);
}
