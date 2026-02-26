import { describe, expect, it } from "vitest";
import { evaluateReviewers } from "./reviewers.js";
import type { IssueTicket } from "./types.js";

function makeTicket(overrides: Partial<IssueTicket> = {}): IssueTicket {
  return {
    id: "ticket-1",
    trackerId: "local-md",
    title: "Test ticket",
    status: "backlog",
    labels: [],
    classifications: [],
    references: [],
    relationships: [],
    reviewers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("evaluateReviewers", () => {
  it("returns empty array when there are no rules", () => {
    const result = evaluateReviewers([], makeTicket(), "create");
    expect(result).toEqual([]);
  });

  it("matches a rule with no triggerOn and no filter on any event", () => {
    const rules = [{ kind: "agent" as const, id: "xavier" }];
    expect(evaluateReviewers(rules, makeTicket(), "create")).toHaveLength(1);
    expect(evaluateReviewers(rules, makeTicket(), "in_review")).toHaveLength(1);
    expect(evaluateReviewers(rules, makeTicket(), "done")).toHaveLength(1);
  });

  it("includes label and kind in returned assignment", () => {
    const rules = [{ kind: "model" as const, id: "claude-sonnet-4-6", label: "AI Reviewer" }];
    const result = evaluateReviewers(rules, makeTicket(), "create");
    expect(result).toEqual([{ kind: "model", id: "claude-sonnet-4-6", label: "AI Reviewer" }]);
  });

  describe("triggerOn filtering", () => {
    it("matches when event is in triggerOn list", () => {
      const rules = [{ kind: "agent" as const, id: "alpha", triggerOn: ["create" as const] }];
      expect(evaluateReviewers(rules, makeTicket(), "create")).toHaveLength(1);
    });

    it("does not match when event is not in triggerOn list", () => {
      const rules = [{ kind: "agent" as const, id: "alpha", triggerOn: ["create" as const] }];
      expect(evaluateReviewers(rules, makeTicket(), "in_review")).toHaveLength(0);
    });

    it("matches any event in a multi-event triggerOn list", () => {
      const rules = [
        {
          kind: "agent" as const,
          id: "alpha",
          triggerOn: ["create" as const, "in_review" as const],
        },
      ];
      expect(evaluateReviewers(rules, makeTicket(), "create")).toHaveLength(1);
      expect(evaluateReviewers(rules, makeTicket(), "in_review")).toHaveLength(1);
      expect(evaluateReviewers(rules, makeTicket(), "done")).toHaveLength(0);
    });

    it("matches a status transition event by status name", () => {
      const rules = [{ kind: "agent" as const, id: "alpha", triggerOn: ["in_review" as const] }];
      expect(evaluateReviewers(rules, makeTicket(), "in_review")).toHaveLength(1);
      expect(evaluateReviewers(rules, makeTicket(), "blocked")).toHaveLength(0);
    });
  });

  describe("filter.labels (OR semantics)", () => {
    it("matches when ticket has at least one of the filter labels", () => {
      const rules = [
        { kind: "agent" as const, id: "alpha", filter: { labels: ["security", "compliance"] } },
      ];
      expect(evaluateReviewers(rules, makeTicket({ labels: ["security"] }), "create")).toHaveLength(
        1,
      );
      expect(
        evaluateReviewers(rules, makeTicket({ labels: ["compliance", "ux"] }), "create"),
      ).toHaveLength(1);
    });

    it("does not match when ticket has none of the filter labels", () => {
      const rules = [
        { kind: "agent" as const, id: "alpha", filter: { labels: ["security", "compliance"] } },
      ];
      expect(
        evaluateReviewers(rules, makeTicket({ labels: ["ux", "polish"] }), "create"),
      ).toHaveLength(0);
      expect(evaluateReviewers(rules, makeTicket({ labels: [] }), "create")).toHaveLength(0);
    });
  });

  describe("filter.classifications (OR semantics)", () => {
    it("matches when ticket has at least one matching classification", () => {
      const rules = [
        {
          kind: "agent" as const,
          id: "alpha",
          filter: {
            classifications: [
              { dimension: "risk" as const, value: "high" },
              { dimension: "priority" as const, value: "p0" },
            ],
          },
        },
      ];
      const ticket = makeTicket({
        classifications: [{ dimension: "risk", value: "high", source: "agent" }],
      });
      expect(evaluateReviewers(rules, ticket, "create")).toHaveLength(1);
    });

    it("matches the second classification option when first is absent", () => {
      const rules = [
        {
          kind: "agent" as const,
          id: "alpha",
          filter: {
            classifications: [
              { dimension: "risk" as const, value: "high" },
              { dimension: "priority" as const, value: "p0" },
            ],
          },
        },
      ];
      const ticket = makeTicket({
        classifications: [{ dimension: "priority", value: "p0" }],
      });
      expect(evaluateReviewers(rules, ticket, "create")).toHaveLength(1);
    });

    it("does not match when no classifications match", () => {
      const rules = [
        {
          kind: "agent" as const,
          id: "alpha",
          filter: { classifications: [{ dimension: "risk" as const, value: "high" }] },
        },
      ];
      const ticket = makeTicket({
        classifications: [{ dimension: "risk", value: "low" }],
      });
      expect(evaluateReviewers(rules, ticket, "create")).toHaveLength(0);
    });
  });

  describe("filter with both labels and classifications (AND between fields)", () => {
    it("matches only when both label and classification conditions are satisfied", () => {
      const rules = [
        {
          kind: "model" as const,
          id: "claude-opus-4-6",
          filter: {
            labels: ["security"],
            classifications: [{ dimension: "risk" as const, value: "high" }],
          },
        },
      ];
      const matching = makeTicket({
        labels: ["security"],
        classifications: [{ dimension: "risk", value: "high" }],
      });
      const missingLabel = makeTicket({
        labels: ["ux"],
        classifications: [{ dimension: "risk", value: "high" }],
      });
      const missingClassification = makeTicket({
        labels: ["security"],
        classifications: [{ dimension: "risk", value: "low" }],
      });
      expect(evaluateReviewers(rules, matching, "create")).toHaveLength(1);
      expect(evaluateReviewers(rules, missingLabel, "create")).toHaveLength(0);
      expect(evaluateReviewers(rules, missingClassification, "create")).toHaveLength(0);
    });
  });

  describe("triggerOn combined with filter", () => {
    it("requires both triggerOn and filter to match", () => {
      const rules = [
        {
          kind: "agent" as const,
          id: "alpha",
          triggerOn: ["in_review" as const],
          filter: { labels: ["security"] },
        },
      ];
      const secureTicket = makeTicket({ labels: ["security"] });
      const plainTicket = makeTicket({ labels: [] });
      expect(evaluateReviewers(rules, secureTicket, "in_review")).toHaveLength(1);
      expect(evaluateReviewers(rules, secureTicket, "create")).toHaveLength(0);
      expect(evaluateReviewers(rules, plainTicket, "in_review")).toHaveLength(0);
    });
  });

  it("returns all matching rules when multiple rules apply", () => {
    const rules = [
      { kind: "agent" as const, id: "alpha" },
      { kind: "agent" as const, id: "beta", triggerOn: ["create" as const] },
      { kind: "model" as const, id: "claude-sonnet-4-6", triggerOn: ["in_review" as const] },
    ];
    const onCreate = evaluateReviewers(rules, makeTicket(), "create");
    expect(onCreate.map((r) => r.id)).toEqual(expect.arrayContaining(["alpha", "beta"]));
    expect(onCreate.map((r) => r.id)).not.toContain("claude-sonnet-4-6");

    const onReview = evaluateReviewers(rules, makeTicket(), "in_review");
    expect(onReview.map((r) => r.id)).toEqual(
      expect.arrayContaining(["alpha", "claude-sonnet-4-6"]),
    );
    expect(onReview.map((r) => r.id)).not.toContain("beta");
  });
});
