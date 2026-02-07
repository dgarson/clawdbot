import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Shared decision type (same values as exec approval for compatibility)
// ---------------------------------------------------------------------------

export type ToolApprovalDecision = "allow-once" | "allow-always" | "deny";

// ---------------------------------------------------------------------------
// Request & record types
// ---------------------------------------------------------------------------

export type ToolApprovalRequestPayload = {
  toolName: string;
  paramsSummary?: string | null;
  riskClass?: string | null;
  sideEffects?: string[] | null;
  reasonCodes?: string[] | null;
  sessionKey?: string | null;
  agentId?: string | null;
  expiresAtMs?: number | null;
  requestHash: string;
  /** Legacy exec-specific fields preserved for backward compatibility. */
  command?: string | null;
  cwd?: string | null;
  host?: string | null;
  security?: string | null;
  ask?: string | null;
  resolvedPath?: string | null;
};

export type ToolApprovalRecord = {
  id: string;
  request: ToolApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
  resolvedAtMs?: number;
  decision?: ToolApprovalDecision;
  resolvedBy?: string | null;
};

// ---------------------------------------------------------------------------
// Internal pending entry
// ---------------------------------------------------------------------------

type PendingEntry = {
  record: ToolApprovalRecord;
  resolve: (decision: ToolApprovalDecision | null) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// ---------------------------------------------------------------------------
// ToolApprovalManager — generic, tool-agnostic approval state machine
// ---------------------------------------------------------------------------

export class ToolApprovalManager {
  private pending = new Map<string, PendingEntry>();

  /**
   * Create a new approval record. Does NOT start the wait timer;
   * call `waitForDecision` to begin the countdown.
   */
  create(
    request: ToolApprovalRequestPayload,
    timeoutMs: number,
    id?: string | null,
  ): ToolApprovalRecord {
    const now = Date.now();
    const resolvedId = id && id.trim().length > 0 ? id.trim() : randomUUID();
    return {
      id: resolvedId,
      request,
      createdAtMs: now,
      expiresAtMs: now + timeoutMs,
    };
  }

  /**
   * Start waiting for a decision on a previously created record.
   * Resolves to `null` if the timeout expires without a decision.
   */
  async waitForDecision(
    record: ToolApprovalRecord,
    timeoutMs: number,
  ): Promise<ToolApprovalDecision | null> {
    return await new Promise<ToolApprovalDecision | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(record.id);
        resolve(null);
      }, timeoutMs);
      this.pending.set(record.id, { record, resolve, reject, timer });
    });
  }

  /**
   * Resolve a pending approval. Returns false if the id is not found
   * or the requestHash does not match (anti-stale guard).
   */
  resolve(
    recordId: string,
    decision: ToolApprovalDecision,
    requestHash: string,
    resolvedBy?: string | null,
  ): boolean {
    const pending = this.pending.get(recordId);
    if (!pending) {
      return false;
    }
    // Anti-stale: requestHash must match
    if (pending.record.request.requestHash !== requestHash) {
      return false;
    }
    clearTimeout(pending.timer);
    pending.record.resolvedAtMs = Date.now();
    pending.record.decision = decision;
    pending.record.resolvedBy = resolvedBy ?? null;
    this.pending.delete(recordId);
    pending.resolve(decision);
    return true;
  }

  /**
   * Look up a pending record by id. Returns null if not found or already resolved.
   */
  getSnapshot(recordId: string): ToolApprovalRecord | null {
    const entry = this.pending.get(recordId);
    return entry?.record ?? null;
  }

  /**
   * Return a snapshot of all currently pending approval records.
   */
  listPending(): ToolApprovalRecord[] {
    return Array.from(this.pending.values()).map((e) => e.record);
  }

  /**
   * Compute a deterministic SHA-256 request hash for anti-stale validation.
   */
  static computeRequestHash(payload: {
    toolName: string;
    paramsSummary?: string | null;
    sessionKey?: string | null;
    agentId?: string | null;
  }): string {
    const canonical = JSON.stringify({
      toolName: payload.toolName,
      paramsSummary: payload.paramsSummary ?? "",
      sessionKey: payload.sessionKey ?? "",
      agentId: payload.agentId ?? "",
    });
    return createHash("sha256").update(canonical).digest("hex");
  }
}
