import { describe, it, expect } from "vitest";
import { extractRoleFromLabel, resolveAgentRoleFromConfig, validateSpawn } from "./lifecycle.js";

describe("extractRoleFromLabel", () => {
  it("extracts role from colon-separated label", () => {
    expect(extractRoleFromLabel("scout:auth-explore")).toBe("scout");
  });

  it("extracts role from plain label", () => {
    expect(extractRoleFromLabel("builder")).toBe("builder");
  });

  it("returns undefined for unknown roles", () => {
    expect(extractRoleFromLabel("unknown-thing")).toBeUndefined();
  });

  it("returns undefined for empty label", () => {
    expect(extractRoleFromLabel(undefined)).toBeUndefined();
  });
});

describe("resolveAgentRoleFromConfig", () => {
  const roles = { orchestrator: "orchestrator", spec: "scout", design: "lead" };

  it("resolves role for mapped agentId", () => {
    expect(resolveAgentRoleFromConfig("orchestrator", roles)).toBe("orchestrator");
    expect(resolveAgentRoleFromConfig("spec", roles)).toBe("scout");
    expect(resolveAgentRoleFromConfig("design", roles)).toBe("lead");
  });

  it("returns undefined for unmapped agentId", () => {
    expect(resolveAgentRoleFromConfig("main", roles)).toBeUndefined();
  });

  it("returns undefined when agentId is undefined", () => {
    expect(resolveAgentRoleFromConfig(undefined, roles)).toBeUndefined();
  });

  it("returns undefined when agentRoles is undefined", () => {
    expect(resolveAgentRoleFromConfig("orchestrator", undefined)).toBeUndefined();
  });

  it("returns undefined for invalid role values", () => {
    expect(resolveAgentRoleFromConfig("bad", { bad: "invalid-role" })).toBeUndefined();
  });
});

describe("validateSpawn", () => {
  it("allows orchestrator to spawn lead", () => {
    const result = validateSpawn("orchestrator", "lead", 0, 2, 1, 8);
    expect(result.allowed).toBe(true);
  });

  it("blocks orchestrator from spawning builder", () => {
    const result = validateSpawn("orchestrator", "builder", 0, 2, 1, 8);
    expect(result.allowed).toBe(false);
    expect((result as { reason: string }).reason).toContain("cannot spawn");
  });

  it("blocks spawn exceeding max depth", () => {
    const result = validateSpawn("lead", "scout", 2, 2, 1, 8);
    expect(result.allowed).toBe(false);
    expect((result as { reason: string }).reason).toContain("depth");
  });

  it("blocks spawn exceeding max concurrent agents", () => {
    const result = validateSpawn("lead", "scout", 1, 2, 8, 8);
    expect(result.allowed).toBe(false);
    expect((result as { reason: string }).reason).toContain("concurrent");
  });

  it("allows lead to spawn scout within limits", () => {
    const result = validateSpawn("lead", "scout", 1, 2, 3, 8);
    expect(result.allowed).toBe(true);
  });
});
