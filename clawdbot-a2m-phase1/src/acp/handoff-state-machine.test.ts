/**
 * ACP Handoff State Machine Tests — Phase 1
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HandoffStateMachine, createHandoffStateMachine } from "./handoff-state-machine.js";
import { createAcpACL } from "./acl.js";
import { createAcpRegistry } from "./registry.js";
import type { ACLPolicy } from "./handoff-types.js";

describe("HandoffStateMachine", () => {
  let tempDir: string;
  let stateMachine: HandoffStateMachine;
  let acl: ReturnType<typeof createAcpACL>;
  let registry: ReturnType<typeof createAcpRegistry>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "acp-handoff-test-"));
    acl = createAcpACL();
    registry = createAcpRegistry(tempDir);
    await registry.initialize();

    stateMachine = createHandoffStateMachine({
      acl,
      registry,
      timeoutMs: {
        proposed: 1000, // 1 second for testing
        activated: 2000, // 2 seconds for testing
      },
    });

    // Register test agents with ACL
    const senderPolicy: ACLPolicy = {
      agent_id: "agent-sender",
      role: "executor",
      permissions: [
        "handoff:initiate",
        "handoff:accept",
        "handoff:reject",
        "message:send",
      ],
    };

    const receiverPolicy: ACLPolicy = {
      agent_id: "agent-receiver",
      role: "reviewer",
      permissions: [
        "handoff:accept",
        "handoff:reject",
        "message:send",
        "artifact:read",
      ],
    };

    acl.registerPolicies([senderPolicy, receiverPolicy]);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create", () => {
    it("should create a handoff in draft state", async () => {
      const record = await stateMachine.create({
        taskId: "task-001",
        threadId: "thread-001",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review authentication module",
        reason: "Need security review",
        package: {
          task: {
            task_id: "task-001",
            title: "Review authentication module",
            objective: "Review the authentication module for security vulnerabilities",
            success_criteria: ["All tests pass", "No critical issues found"],
            priority: "P1",
          },
          context: {
            summary: "Authentication module needs security review",
            next_step: "Run security scan",
            success_criteria: ["Security scan passes"],
          },
          work_state: {
            status: "review",
            next_step: "Await review feedback",
          },
          artifacts: [],
          provenance: {
            origin_session: "session-001",
            handoff_chain: [],
          },
          policy: {
            classification: "internal",
            requires_human_approval: false,
          },
        },
      });

      expect(record.id).toBeDefined();
      expect(record.status).toBe("draft");
      expect(record.from_agent).toBe("agent-sender");
      expect(record.to_agent).toBe("agent-receiver");
      expect(record.task_id).toBe("task-001");
    });

    it("should reject duplicate active handoffs for same task", async () => {
      await stateMachine.create({
        taskId: "task-001",
        threadId: "thread-001",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review 1",
        reason: "Review needed",
        package: {
          task: {
            task_id: "task-001",
            title: "Review 1",
            objective: "Review",
            success_criteria: ["Pass"],
            priority: "P1",
          },
          context: {
            summary: "Review",
            next_step: "Review",
            success_criteria: ["Pass"],
          },
          work_state: {
            status: "review",
            next_step: "Review",
          },
          artifacts: [],
          provenance: {
            origin_session: "s1",
          },
          policy: {
            classification: "internal",
            requires_human_approval: false,
          },
        },
      });

      await expect(
        stateMachine.create({
          taskId: "task-001",
          threadId: "thread-002",
          fromAgent: "agent-sender",
          toAgent: "agent-receiver",
          title: "Review 2",
          reason: "Review needed",
          package: {
            task: {
              task_id: "task-001",
              title: "Review 2",
              objective: "Review",
              success_criteria: ["Pass"],
              priority: "P1",
            },
            context: {
              summary: "Review",
              next_step: "Review",
              success_criteria: ["Pass"],
            },
            work_state: {
              status: "review",
              next_step: "Review",
            },
            artifacts: [],
            provenance: {
              origin_session: "s2",
            },
            policy: {
              classification: "internal",
              requires_human_approval: false,
            },
          },
        })
      ).rejects.toThrow("Active handoff already exists");
    });

    it("should validate ACL permissions for sender", async () => {
      // Register agent without handoff permissions
      acl.registerPolicy({
        agent_id: "agent-noperm",
        role: "observer",
        permissions: ["artifact:read"],
      });

      await expect(
        stateMachine.create({
          taskId: "task-002",
          threadId: "thread-002",
          fromAgent: "agent-noperm",
          toAgent: "agent-receiver",
          title: "Review",
          reason: "Review needed",
          package: {
            task: {
              task_id: "task-002",
              title: "Review",
              objective: "Review",
              success_criteria: ["Pass"],
              priority: "P1",
            },
            context: {
              summary: "Review",
              next_step: "Review",
              success_criteria: ["Pass"],
            },
            work_state: {
              status: "review",
              next_step: "Review",
            },
            artifacts: [],
            provenance: {
              origin_session: "s1",
            },
            policy: {
              classification: "internal",
              requires_human_approval: false,
            },
          },
        })
      ).rejects.toThrow("ACL validation failed");
    });
  });

  describe("transition", () => {
    it("should transition draft → proposed → validating → accepted", async () => {
      const record = await stateMachine.create({
        taskId: "task-003",
        threadId: "thread-003",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review",
        reason: "Review needed",
        package: {
          task: {
            task_id: "task-003",
            title: "Review",
            objective: "Review",
            success_criteria: ["Pass"],
            priority: "P1",
          },
          context: {
            summary: "Review",
            next_step: "Review",
            success_criteria: ["Pass"],
          },
          work_state: {
            status: "review",
            next_step: "Review",
          },
          artifacts: [],
          provenance: {
            origin_session: "s1",
          },
          policy: {
            classification: "internal",
            requires_human_approval: false,
          },
        },
      });

      // Draft → Proposed
      const proposed = await stateMachine.transition(
        record.id,
        "proposed",
        "agent-sender"
      );
      expect(proposed.status).toBe("proposed");
      expect(proposed.transitions).toHaveLength(1);

      // Proposed → Validating
      const validating = await stateMachine.transition(
        record.id,
        "validating",
        "agent-receiver"
      );
      expect(validating.status).toBe("validating");

      // Validating → Accepted
      const accepted = await stateMachine.transition(
        record.id,
        "accepted",
        "agent-receiver",
        "Package validated successfully"
      );
      expect(accepted.status).toBe("accepted");
    });

    it("should reject invalid transitions", async () => {
      const record = await stateMachine.create({
        taskId: "task-004",
        threadId: "thread-004",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review",
        reason: "Review needed",
        package: {
          task: {
            task_id: "task-004",
            title: "Review",
            objective: "Review",
            success_criteria: ["Pass"],
            priority: "P1",
          },
          context: {
            summary: "Review",
            next_step: "Review",
            success_criteria: ["Pass"],
          },
          work_state: {
            status: "review",
            next_step: "Review",
          },
          artifacts: [],
          provenance: {
            origin_session: "s1",
          },
          policy: {
            classification: "internal",
            requires_human_approval: false,
          },
        },
      });

      // Try to skip to accepted (invalid)
      await expect(
        stateMachine.transition(record.id, "accepted", "agent-receiver")
      ).rejects.toThrow("Invalid transition");
    });

    it("should detect cycles in handoff chain", async () => {
      const record = await stateMachine.create({
        taskId: "task-005",
        threadId: "thread-005",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review",
        reason: "Review needed",
        package: {
          task: {
            task_id: "task-005",
            title: "Review",
            objective: "Review",
            success_criteria: ["Pass"],
            priority: "P1",
          },
          context: {
            summary: "Review",
            next_step: "Review",
            success_criteria: ["Pass"],
          },
          work_state: {
            status: "review",
            next_step: "Review",
          },
          artifacts: [],
          provenance: {
            origin_session: "s1",
            handoff_chain: ["agent-receiver"], // Cycle!
          },
          policy: {
            classification: "internal",
            requires_human_approval: false,
          },
        },
      });

      await stateMachine.transition(record.id, "proposed", "agent-sender");

      await expect(
        stateMachine.transition(record.id, "validating", "agent-receiver")
      ).rejects.toThrow("Cycle detected");
    });
  });

  describe("rejection", () => {
    it("should handle rejection flow", async () => {
      const record = await stateMachine.create({
        taskId: "task-006",
        threadId: "thread-006",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review",
        reason: "Review needed",
        package: {
          task: {
            task_id: "task-006",
            title: "Review",
            objective: "Review",
            success_criteria: ["Pass"],
            priority: "P1",
          },
          context: {
            summary: "Review",
            next_step: "Review",
            success_criteria: ["Pass"],
          },
          work_state: {
            status: "review",
            next_step: "Review",
          },
          artifacts: [],
          provenance: {
            origin_session: "s1",
          },
          policy: {
            classification: "internal",
            requires_human_approval: false,
          },
        },
      });

      await stateMachine.transition(record.id, "proposed", "agent-sender");

      const rejected = await stateMachine.transition(
        record.id,
        "rejected",
        "agent-receiver",
        "Cannot accept at this time",
        {
          code: "recipient_overloaded",
          reason: "Currently handling too many handoffs",
          retry_after: 3600,
        }
      );

      expect(rejected.status).toBe("rejected");
      expect(rejected.transitions[1].rejection?.code).toBe("recipient_overloaded");
      expect(rejected.resolved_at).toBeDefined();
    });
  });

  describe("query", () => {
    it("should query handoffs by agent", async () => {
      await stateMachine.create({
        taskId: "task-007",
        threadId: "thread-007",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review 1",
        reason: "Review",
        package: {
          task: { task_id: "task-007", title: "R1", objective: "R", success_criteria: ["P"], priority: "P1" },
          context: { summary: "R", next_step: "R", success_criteria: ["P"] },
          work_state: { status: "review", next_step: "R" },
          artifacts: [],
          provenance: { origin_session: "s1" },
          policy: { classification: "internal", requires_human_approval: false },
        },
      });

      await stateMachine.create({
        taskId: "task-008",
        threadId: "thread-008",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review 2",
        reason: "Review",
        package: {
          task: { task_id: "task-008", title: "R2", objective: "R", success_criteria: ["P"], priority: "P1" },
          context: { summary: "R", next_step: "R", success_criteria: ["P"] },
          work_state: { status: "review", next_step: "R" },
          artifacts: [],
          provenance: { origin_session: "s1" },
          policy: { classification: "internal", requires_human_approval: false },
        },
      });

      const fromSender = stateMachine.query({ fromAgent: "agent-sender" });
      expect(fromSender).toHaveLength(2);

      const toReceiver = stateMachine.query({ toAgent: "agent-receiver" });
      expect(toReceiver).toHaveLength(2);
    });
  });

  describe("timeout", () => {
    it("should detect overdue handoffs", async () => {
      const record = await stateMachine.create({
        taskId: "task-009",
        threadId: "thread-009",
        fromAgent: "agent-sender",
        toAgent: "agent-receiver",
        title: "Review",
        reason: "Review",
        package: {
          task: { task_id: "task-009", title: "R", objective: "R", success_criteria: ["P"], priority: "P1" },
          context: { summary: "R", next_step: "R", success_criteria: ["P"] },
          work_state: { status: "review", next_step: "R" },
          artifacts: [],
          provenance: { origin_session: "s1" },
          policy: { classification: "internal", requires_human_approval: false },
        },
      });

      await stateMachine.transition(record.id, "proposed", "agent-sender");

      // Should not be overdue yet
      let overdue = stateMachine.getOverdue();
      expect(overdue.proposed).toHaveLength(0);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be overdue now
      overdue = stateMachine.getOverdue();
      expect(overdue.proposed).toHaveLength(1);
      expect(overdue.proposed[0].id).toBe(record.id);
    });
  });
});
