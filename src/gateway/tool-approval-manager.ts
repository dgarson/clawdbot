import { randomUUID } from "node:crypto";
import type { ToolApprovalDecision } from "../infra/tool-approvals.js";
import { computeToolApprovalRequestHash } from "../infra/tool-approval-hash.js";

export type { ToolApprovalDecision };

// ---------------------------------------------------------------------------
// Request & record types
// ---------------------------------------------------------------------------

export type ToolApprovalRequestPayload = {
  toolName: string;
  /** Marker for legacy exec.approval.* origins (used for compatibility). */
  source?: "exec-legacy" | null;
  paramsSummary?: string | null;
  riskClass?: string | null;
  sideEffects?: string[] | null;
  reasonCodes?: string[] | null;
  sessionKey?: string | null;
  agentId?: string | null;
  policyVersion?: string | null;
  expiresAtMs?: number | null;
  requestHash: string;
  /** @deprecated Legacy exec field — only set for exec.approval.* compatibility. */
  command?: string | null;
  /** @deprecated Legacy exec field — only set for exec.approval.* compatibility. */
  cwd?: string | null;
  /** @deprecated Legacy exec field — only set for exec.approval.* compatibility. */
  host?: string | null;
  /** @deprecated Legacy exec field — only set for exec.approval.* compatibility. */
  security?: string | null;
  /** @deprecated Legacy exec field — only set for exec.approval.* compatibility. */
  ask?: string | null;
  /** @deprecated Legacy exec field — only set for exec.approval.* compatibility. */
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
   * Compatibility resolve for legacy callers that only provide `{ id, decision }`
   * without a requestHash. Skips the anti-stale requestHash check.
   */
  resolveCompat(
    recordId: string,
    decision: ToolApprovalDecision,
    resolvedBy?: string | null,
  ): boolean {
    const pending = this.pending.get(recordId);
    if (!pending) {
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
   * Delegates to the shared helper in src/infra/tool-approval-hash.ts.
   */
  static computeRequestHash(payload: {
    toolName: string;
    paramsSummary?: string | null;
    sessionKey?: string | null;
    agentId?: string | null;
  }): string {
    return computeToolApprovalRequestHash(payload);
  }
}
