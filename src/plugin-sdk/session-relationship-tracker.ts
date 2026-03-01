/**
 * Session Relationship Tracker
 *
 * Tracks parent↔child session relationships for extensions that need
 * cross-session visibility (e.g., cost rollup across subagent hierarchies,
 * audit trails spanning spawned agents).
 *
 * Works alongside SessionRuntimeStore — call `trackSpawn` from your
 * `subagent_spawned` handler and `trackEnd` from `subagent_ended`.
 * Then use `getRelated()` to pull related session states for holistic views.
 */

export type SessionRelationship = {
  parentSessionKey: string;
  childSessionKey: string;
  runId?: string;
  agentId?: string;
  label?: string;
  spawnedAt: number;
  endedAt?: number;
  outcome?: string;
};

export type RelatedSessions = {
  /** The session key being queried */
  sessionKey: string;
  /** Parent session key (if this is a child/subagent) */
  parent?: string;
  /** Direct child session keys */
  children: string[];
  /** All ancestor session keys (parent, grandparent, ...) */
  ancestors: string[];
  /** All descendant session keys (children, grandchildren, ...) */
  descendants: string[];
};

export class SessionRelationshipTracker {
  /** child → parent mapping */
  private readonly parentOf = new Map<string, string>();
  /** parent → Set<children> mapping */
  private readonly childrenOf = new Map<string, Set<string>>();
  /** Full relationship records keyed by child session key */
  private readonly records = new Map<string, SessionRelationship>();

  /**
   * Record a parent→child session spawn.
   * Call this from your `subagent_spawned` hook handler.
   */
  trackSpawn(params: {
    parentSessionKey: string;
    childSessionKey: string;
    runId?: string;
    agentId?: string;
    label?: string;
  }): void {
    const rel: SessionRelationship = {
      parentSessionKey: params.parentSessionKey,
      childSessionKey: params.childSessionKey,
      runId: params.runId,
      agentId: params.agentId,
      label: params.label,
      spawnedAt: Date.now(),
    };

    this.parentOf.set(params.childSessionKey, params.parentSessionKey);
    this.records.set(params.childSessionKey, rel);

    let children = this.childrenOf.get(params.parentSessionKey);
    if (!children) {
      children = new Set();
      this.childrenOf.set(params.parentSessionKey, children);
    }
    children.add(params.childSessionKey);
  }

  /**
   * Record that a child session has ended.
   * Call this from your `subagent_ended` hook handler.
   */
  trackEnd(childSessionKey: string, outcome?: string): void {
    const rel = this.records.get(childSessionKey);
    if (rel) {
      rel.endedAt = Date.now();
      rel.outcome = outcome;
    }
  }

  /**
   * Get the full relationship graph for a session.
   */
  getRelated(sessionKey: string): RelatedSessions {
    return {
      sessionKey,
      parent: this.parentOf.get(sessionKey),
      children: [...(this.childrenOf.get(sessionKey) ?? [])],
      ancestors: this.getAncestors(sessionKey),
      descendants: this.getDescendants(sessionKey),
    };
  }

  /** Get the parent session key for a child, if any. */
  getParent(childSessionKey: string): string | undefined {
    return this.parentOf.get(childSessionKey);
  }

  /** Get direct children of a parent session. */
  getChildren(parentSessionKey: string): string[] {
    return [...(this.childrenOf.get(parentSessionKey) ?? [])];
  }

  /** Get the relationship record for a child session. */
  getRecord(childSessionKey: string): SessionRelationship | undefined {
    return this.records.get(childSessionKey);
  }

  /**
   * Collect states from a store for all related sessions.
   * Generic over any store-like object with a `get(key)` method.
   */
  collectRelatedStates<T>(
    sessionKey: string,
    store: { get(key: string): T },
  ): Map<string, T> {
    const related = this.getRelated(sessionKey);
    const result = new Map<string, T>();

    // Include self
    const self = store.get(sessionKey);
    if (self !== undefined) {
      result.set(sessionKey, self);
    }

    // Include all ancestors and descendants
    for (const key of [...related.ancestors, ...related.descendants]) {
      const state = store.get(key);
      if (state !== undefined) {
        result.set(key, state);
      }
    }

    return result;
  }

  /** Remove all tracking data for a session and its children. */
  cleanup(sessionKey: string): void {
    // Remove as child
    const parent = this.parentOf.get(sessionKey);
    if (parent) {
      this.childrenOf.get(parent)?.delete(sessionKey);
    }
    this.parentOf.delete(sessionKey);
    this.records.delete(sessionKey);

    // Remove as parent (but don't cascade — children keep their records)
    this.childrenOf.delete(sessionKey);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getAncestors(sessionKey: string): string[] {
    const ancestors: string[] = [];
    let current = this.parentOf.get(sessionKey);
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      ancestors.push(current);
      current = this.parentOf.get(current);
    }
    return ancestors;
  }

  private getDescendants(sessionKey: string): string[] {
    const descendants: string[] = [];
    const stack = [...(this.childrenOf.get(sessionKey) ?? [])];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const key = stack.pop()!;
      if (visited.has(key)) continue;
      visited.add(key);
      descendants.push(key);
      const grandchildren = this.childrenOf.get(key);
      if (grandchildren) {
        for (const gc of grandchildren) {
          stack.push(gc);
        }
      }
    }
    return descendants;
  }
}

/**
 * Create a new relationship tracker and optionally wire it to subagent hooks.
 *
 * @example
 * ```ts
 * const tracker = createSessionRelationshipTracker();
 *
 * api.on("subagent_spawned", (event, ctx) => {
 *   tracker.trackSpawn({
 *     parentSessionKey: ctx.requesterSessionKey!,
 *     childSessionKey: event.childSessionKey,
 *     runId: event.runId,
 *     agentId: event.agentId,
 *     label: event.label,
 *   });
 * });
 *
 * api.on("subagent_ended", (event) => {
 *   tracker.trackEnd(event.targetSessionKey, event.outcome);
 * });
 *
 * // Later, in any hook handler:
 * const related = tracker.collectRelatedStates(sessionKey, store);
 * // related is a Map of all ancestor/descendant session states
 * ```
 */
export function createSessionRelationshipTracker(): SessionRelationshipTracker {
  return new SessionRelationshipTracker();
}
