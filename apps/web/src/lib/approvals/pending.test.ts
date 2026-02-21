import { describe, expect, it } from "vitest";

import { derivePendingApprovalsSummary, getAgentPendingApprovalCount } from "./pending";

describe("approvals/pending", () => {
  it("returns zero summary when agents empty", () => {
    expect(derivePendingApprovalsSummary([])).toEqual({
      pendingApprovals: 0,
      pendingAgents: 0,
      nextAgentId: null,
    });
  });

  it("prefers pendingToolCallIds length over pendingApprovals", () => {
    const count = getAgentPendingApprovalCount({
      id: "a1",
      name: "A1",
      role: "Agent",
      status: "paused",
      pendingApprovals: 99,
      pendingToolCallIds: ["t1", "t2"],
    });
    expect(count).toBe(2);
  });

  it("selects next agent by pending desc, then lastActive desc", () => {
    const summary = derivePendingApprovalsSummary([
      {
        id: "a1",
        name: "Alpha",
        role: "Agent",
        status: "paused",
        pendingToolCallIds: ["t1"],
        lastActive: "2026-02-02T10:00:00.000Z",
      },
      {
        id: "a2",
        name: "Beta",
        role: "Agent",
        status: "paused",
        pendingToolCallIds: ["t2", "t3"],
        lastActive: "2026-02-02T09:00:00.000Z",
      },
      {
        id: "a3",
        name: "Gamma",
        role: "Agent",
        status: "paused",
        pendingToolCallIds: ["t4", "t5"],
        lastActive: "2026-02-02T11:00:00.000Z",
      },
    ]);

    expect(summary.pendingApprovals).toBe(5);
    expect(summary.pendingAgents).toBe(3);
    expect(summary.nextAgentId).toBe("a3");
  });
});

