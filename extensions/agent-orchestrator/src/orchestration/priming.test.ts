import { describe, it, expect } from "vitest";
import { buildRoleContext } from "./priming.js";

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
