import { describe, it, expect } from "vitest";
import { extractRoleFromLabel, validateSpawn } from "./lifecycle.js";

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
