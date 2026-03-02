import { describe, it, expect } from "vitest";
import type { AgentRole } from "../types.js";
import { ROLE_MAIL_GUIDANCE, buildRoleContext } from "./priming.js";

describe("buildRoleContext", () => {
  it("returns role instructions for a known role", () => {
    const ctx = buildRoleContext("scout", undefined, []);
    expect(ctx).toContain("[Agent Scout]");
    expect(ctx).toContain("read-only");
  });

  it("includes task description when provided", () => {
    const ctx = buildRoleContext("builder", "Implement auth endpoints", []);
    expect(ctx).toContain("Implement auth endpoints");
  });

  it("includes fleet status for orchestrator", () => {
    const ctx = buildRoleContext("orchestrator", undefined, [
      { role: "lead", sessionKey: "s1", status: "active" },
      { role: "scout", sessionKey: "s2", status: "completed" },
    ]);
    expect(ctx).toContain("Active workers");
    expect(ctx).toContain("lead");
    expect(ctx).toContain("s1");
  });

  it("includes fleet status for lead", () => {
    const ctx = buildRoleContext("lead", undefined, [
      { role: "builder", sessionKey: "s3", status: "active" },
    ]);
    expect(ctx).toContain("Active workers");
  });

  it("excludes fleet status for builder", () => {
    const ctx = buildRoleContext("builder", undefined, [
      { role: "scout", sessionKey: "s4", status: "active" },
    ]);
    expect(ctx).not.toContain("Active workers");
  });

  it("returns empty string for unknown role", () => {
    const ctx = buildRoleContext(undefined, undefined, []);
    expect(ctx).toBe("");
  });
});

describe("ROLE_MAIL_GUIDANCE", () => {
  const ALL_ROLES: AgentRole[] = ["orchestrator", "lead", "scout", "builder", "reviewer"];

  it("has guidance for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_MAIL_GUIDANCE[role]).toBeDefined();
      expect(ROLE_MAIL_GUIDANCE[role].length).toBeGreaterThan(0);
    }
  });

  it("includes [Mail Guidance] marker for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_MAIL_GUIDANCE[role]).toContain("[Mail Guidance]");
    }
  });
});

describe("buildRoleContext — mail guidance", () => {
  it("includes mail guidance for each role", () => {
    const roles: AgentRole[] = ["orchestrator", "lead", "scout", "builder", "reviewer"];
    for (const role of roles) {
      const ctx = buildRoleContext(role, undefined, []);
      expect(ctx).toContain("[Mail Guidance]");
    }
  });

  it("places mail guidance after role instructions and before task description", () => {
    const ctx = buildRoleContext("scout", "Analyze auth module", []);
    const roleIdx = ctx.indexOf("[Agent Scout]");
    const mailIdx = ctx.indexOf("[Mail Guidance]");
    const taskIdx = ctx.indexOf("[Current Task]");
    expect(roleIdx).toBeGreaterThanOrEqual(0);
    expect(mailIdx).toBeGreaterThan(roleIdx);
    expect(taskIdx).toBeGreaterThan(mailIdx);
  });

  it("includes mail guidance even without task description", () => {
    const ctx = buildRoleContext("builder", undefined, []);
    expect(ctx).toContain("[Mail Guidance]");
    expect(ctx).toContain("mail your lead when done");
  });
});
