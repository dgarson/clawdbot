/**
 * ACP Handoff State Machine — Phase 1
 * 
 * Implements the handoff lifecycle:
 * draft → proposed → validating → accepted/rejected → activated → completed → closed
 * 
 * Based on: /Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-handoff-plan-barry.md
 */

import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type {
  HandoffStatus,
  ACPHandoffPackage,
  HandoffTransition,
  HandoffRecord,
  HandoffRejection,
  HandoffRejectionCode,
  ACLPermission,
} from "./handoff-types.js";
import type { AcpACL } from "./acl.js";
import type { AcpRegistry } from "./registry.js";

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<HandoffStatus, HandoffStatus[]> = {
  draft: ["proposed"],
  proposed: ["validating", "rejected"],
  validating: ["accepted", "rejected"],
  accepted: ["activated"],
  rejected: ["closed"],
  activated: ["completed", "rejected"],
  completed: ["closed"],
  closed: [],
};

/**
 * Required fields to exit draft state
 * Format: ["context.field" or "work_state.field" or "task.field"]
 */
const DRAFT_EXIT_REQUIREMENTS: Array<{ section: "context" | "work_state" | "task"; field: string }> = [
  { section: "context", field: "summary" },
  { section: "work_state", field: "next_step" },
  { section: "task", field: "success_criteria" },
];

export type HandoffStateMachineConfig = {
  acl: AcpACL;
  registry: AcpRegistry;
  timeoutMs?: {
    proposed?: number; // Default: 30 minutes
    activated?: number; // Default: 24 hours
  };
};

export type HandoffCreateParams = {
  taskId: string;
  threadId: string;
  fromAgent: string;
  toAgent: string;
  title: string;
  reason: string;
  package: Omit<ACPHandoffPackage, "handoff_id" | "thread_id" | "verification">;
};

export type HandoffAcceptParams = {
  handoffId: string;
  agent: string;
  notes?: string;
};

export type HandoffRejectParams = {
  handoffId: string;
  agent: string;
  rejection: HandoffRejection;
};

/**
 * Terminal statuses that allow creating a new handoff for the same task
 */
const TERMINAL_STATUSES: HandoffStatus[] = ["rejected", "closed"];

/**
 * ACP Handoff State Machine
 */
export class HandoffStateMachine {
  private acl: AcpACL;
  private registry: AcpRegistry;
  private handoffs: Map<string, HandoffRecord> = new Map();
  private activeByTask: Map<string, string> = new Map(); // task_id -> handoff_id
  private timeoutMs: {
    proposed: number;
    activated: number;
  };

  constructor(config: HandoffStateMachineConfig) {
    this.acl = config.acl;
    this.registry = config.registry;
    this.timeoutMs = {
      proposed: config.timeoutMs?.proposed ?? 30 * 60 * 1000, // 30 minutes
      activated: config.timeoutMs?.activated ?? 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  /**
   * Create a new handoff in draft state
   */
  async create(params: HandoffCreateParams): Promise<HandoffRecord> {
    // Check for existing non-terminal handoff for this task
    const existingForTask = this.getActiveForTask(params.taskId);
    if (existingForTask) {
      throw new Error(`Active handoff already exists for task ${params.taskId}: ${existingForTask.id}`);
    }

    // Validate recipient via ACL
    const aclDecision = this.acl.validateHandoffRecipient(params.fromAgent, params.toAgent);
    if (!aclDecision.allowed) {
      throw new Error(`ACL validation failed: ${aclDecision.reason}`);
    }

    // Build complete package
    const fullPackage: ACPHandoffPackage = {
      ...params.package,
      handoff_id: randomUUID(),
      thread_id: params.threadId,
      verification: {
        schema_version: "1.0.0",
        package_hash: this.computePackageHash(params.package),
      },
    };

    // Create record
    const now = new Date().toISOString();
    const record: HandoffRecord = {
      id: fullPackage.handoff_id,
      thread_id: params.threadId,
      task_id: params.taskId,
      from_agent: params.fromAgent,
      to_agent: params.toAgent,
      title: params.title,
      reason: params.reason,
      package_json: JSON.stringify(fullPackage),
      status: "draft",
      provenance_json: JSON.stringify(fullPackage.provenance),
      verification_json: JSON.stringify(fullPackage.verification),
      initiated_at: now,
      transitions: [],
    };

    // Store in memory
    this.handoffs.set(record.id, record);

    // Persist to registry
    await this.registry.append("handoff", {
      id: record.id,
      task_id: record.task_id,
      from_agent: record.from_agent,
      to_agent: record.to_agent,
      status: record.status,
      initiated_at: record.initiated_at,
    });

    return record;
  }

  /**
   * Transition handoff to new status
   */
  async transition(
    handoffId: string,
    toStatus: HandoffStatus,
    agent: string,
    notes?: string,
    rejection?: HandoffRejection
  ): Promise<HandoffRecord> {
    const record = this.handoffs.get(handoffId);
    if (!record) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    // Validate transition
    const allowedNext = VALID_TRANSITIONS[record.status];
    if (!allowedNext.includes(toStatus)) {
      throw new Error(
        `Invalid transition from ${record.status} to ${toStatus}. Valid: ${allowedNext.join(", ")}`
      );
    }

    // Validate required fields for draft → proposed
    if (record.status === "draft" && toStatus === "proposed") {
      this.validateDraftExit(record);
    }

    // Check cycle detection for proposed → validating
    if (record.status === "proposed" && toStatus === "validating") {
      this.validateNoCycle(record);
    }

    // Check ACL permissions
    const permission = this.getRequiredPermission(toStatus);
    if (permission) {
      const decision = this.acl.checkPermission(permission, agent);
      if (!decision.allowed) {
        throw new Error(`Permission denied: ${decision.reason}`);
      }
    }

    // Create transition record
    const transition: HandoffTransition = {
      from_status: record.status,
      to_status: toStatus,
      agent,
      timestamp: new Date().toISOString(),
      notes,
      rejection,
    };

    // Update record
    record.status = toStatus;
    record.transitions.push(transition);

    if (toStatus === "closed" || toStatus === "rejected") {
      record.resolved_at = transition.timestamp;
      record.resolution_notes = notes;
      // Remove from active tracking
      this.activeByTask.delete(record.task_id);
    } else if (toStatus === "activated") {
      // Track as active
      this.activeByTask.set(record.task_id, record.id);
    }

    // Persist transition to registry
    await this.registry.append("handoff", {
      handoff_id: record.id,
      transition,
    });

    return record;
  }

  /**
   * Get handoff by ID
   */
  get(handoffId: string): HandoffRecord | undefined {
    return this.handoffs.get(handoffId);
  }

  /**
   * Get active (non-terminal) handoff for a task
   */
  getActiveForTask(taskId: string): HandoffRecord | undefined {
    // First check explicitly tracked activated handoffs
    const handoffId = this.activeByTask.get(taskId);
    if (handoffId) {
      const handoff = this.handoffs.get(handoffId);
      if (handoff && !TERMINAL_STATUSES.includes(handoff.status)) {
        return handoff;
      }
    }

    // Also check for any other non-terminal handoff for this task
    for (const handoff of this.handoffs.values()) {
      if (handoff.task_id === taskId && !TERMINAL_STATUSES.includes(handoff.status)) {
        return handoff;
      }
    }

    return undefined;
  }

  /**
   * Query handoffs by criteria
   */
  query(criteria: {
    fromAgent?: string;
    toAgent?: string;
    status?: HandoffStatus[];
    since?: string;
  }): HandoffRecord[] {
    let results = Array.from(this.handoffs.values());

    if (criteria.fromAgent) {
      results = results.filter(r => r.from_agent === criteria.fromAgent);
    }
    if (criteria.toAgent) {
      results = results.filter(r => r.to_agent === criteria.toAgent);
    }
    if (criteria.status) {
      results = results.filter(r => criteria.status!.includes(r.status));
    }
    if (criteria.since) {
      results = results.filter(r => r.initiated_at >= criteria.since!);
    }

    return results.sort((a, b) => a.initiated_at.localeCompare(b.initiated_at));
  }

  /**
   * Get handoffs requiring timeout escalation
   */
  getOverdue(): {
    proposed: HandoffRecord[];
    activated: HandoffRecord[];
  } {
    const now = Date.now();
    const proposed: HandoffRecord[] = [];
    const activated: HandoffRecord[] = [];

    for (const record of this.handoffs.values()) {
      if (record.status === "proposed") {
        const lastTransition = record.transitions[record.transitions.length - 1];
        if (lastTransition) {
          const elapsed = now - new Date(lastTransition.timestamp).getTime();
          if (elapsed > this.timeoutMs.proposed) {
            proposed.push(record);
          }
        }
      } else if (record.status === "activated") {
        const lastTransition = record.transitions[record.transitions.length - 1];
        if (lastTransition) {
          const elapsed = now - new Date(lastTransition.timestamp).getTime();
          if (elapsed > this.timeoutMs.activated) {
            activated.push(record);
          }
        }
      }
    }

    return { proposed, activated };
  }

  /**
   * Validate draft can be proposed
   */
  private validateDraftExit(record: HandoffRecord): void {
    const pkg = JSON.parse(record.package_json) as ACPHandoffPackage;

    for (const { section, field } of DRAFT_EXIT_REQUIREMENTS) {
      let value: unknown;
      
      if (section === "context") {
        value = pkg.context[field as keyof typeof pkg.context];
      } else if (section === "work_state") {
        value = pkg.work_state[field as keyof typeof pkg.work_state];
      } else if (section === "task") {
        value = pkg.task[field as keyof typeof pkg.task];
      }
      
      if (!value || (Array.isArray(value) && value.length === 0)) {
        throw new Error(`Cannot propose handoff: missing required field: ${section}.${field}`);
      }
    }
  }

  /**
   * Validate no cycle in handoff chain
   */
  private validateNoCycle(record: HandoffRecord): void {
    const pkg = JSON.parse(record.package_json) as ACPHandoffPackage;
    const chain = pkg.provenance.handoff_chain || [];

    if (chain.includes(record.to_agent)) {
      throw new Error(
        `Cycle detected: ${record.to_agent} appears in handoff chain: ${chain.join(" → ")}`
      );
    }
  }

  /**
   * Get required permission for transition
   */
  private getRequiredPermission(status: HandoffStatus): ACLPermission | null {
    const permissions: Record<HandoffStatus, ACLPermission> = {
      draft: "handoff:initiate",
      proposed: "handoff:initiate",
      validating: "handoff:accept",
      accepted: "handoff:accept",
      rejected: "handoff:reject",
      activated: "handoff:accept",
      completed: "handoff:accept",
      closed: "handoff:accept",
    };
    return permissions[status] || null;
  }

  /**
   * Compute SHA-256 hash of package
   */
  private computePackageHash(pkg: unknown): string {
    const content = JSON.stringify(pkg, Object.keys(pkg as object).sort());
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Load handoffs from registry (for recovery)
   */
  async loadFromRegistry(): Promise<void> {
    const entries = await this.registry.query("handoff");
    
    // Group entries by handoff_id
    const byId = new Map<string, typeof entries>();
    for (const entry of entries) {
      const data = entry.data as { handoff_id?: string; id?: string };
      const id = data.handoff_id || data.id;
      if (!id) continue;

      if (!byId.has(id)) {
        byId.set(id, []);
      }
      byId.get(id)!.push(entry);
    }

    // Reconstruct handoff records
    for (const [id, entries] of byId) {
      const first = entries[0].data as any;
      const record: HandoffRecord = {
        id,
        thread_id: first.thread_id,
        task_id: first.task_id,
        from_agent: first.from_agent,
        to_agent: first.to_agent,
        title: first.title || "",
        reason: first.reason || "",
        package_json: first.package_json || "{}",
        status: first.status,
        provenance_json: first.provenance_json || "{}",
        verification_json: first.verification_json || "{}",
        initiated_at: first.initiated_at,
        resolved_at: first.resolved_at,
        resolution_notes: first.resolution_notes,
        transitions: entries
          .filter(e => (e.data as any).transition)
          .map(e => (e.data as any).transition),
      };

      this.handoffs.set(id, record);
      
      if (record.status === "activated") {
        this.activeByTask.set(record.task_id, record.id);
      }
    }
  }
}

/**
 * Create handoff state machine instance
 */
export function createHandoffStateMachine(config: HandoffStateMachineConfig): HandoffStateMachine {
  return new HandoffStateMachine(config);
}
