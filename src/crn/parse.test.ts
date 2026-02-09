import { describe, expect, it } from "vitest";
import { isCrn, isKnownService, parseCrn, validateCrn } from "./parse.js";

describe("parseCrn", () => {
  it("parses a valid codex-web task CRN", () => {
    const crn = "crn:1:codex-web:*:task:task_e_69897ce1fef0832e900b408fb5e79043";
    const parsed = parseCrn(crn);
    expect(parsed).toEqual({
      scheme: "crn",
      version: "1",
      service: "codex-web",
      scope: "*",
      resourceType: "task",
      resourceId: "task_e_69897ce1fef0832e900b408fb5e79043",
    });
  });

  it("parses a GitHub PR CRN with owner/repo scope", () => {
    const crn = "crn:1:github:dgarson/clawdbrain:pr:347";
    const parsed = parseCrn(crn);
    expect(parsed).toEqual({
      scheme: "crn",
      version: "1",
      service: "github",
      scope: "dgarson/clawdbrain",
      resourceType: "pr",
      resourceId: "347",
    });
  });

  it("parses a work item CRN", () => {
    const crn = "crn:1:work:main:item:550e8400-e29b-41d4-a716-446655440000";
    const parsed = parseCrn(crn);
    expect(parsed).toEqual({
      scheme: "crn",
      version: "1",
      service: "work",
      scope: "main",
      resourceType: "item",
      resourceId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("handles greedy resource-id with embedded colons", () => {
    const crn = "crn:1:memory:main:entry:some:id:with:colons";
    const parsed = parseCrn(crn);
    expect(parsed).not.toBeNull();
    expect(parsed!.resourceId).toBe("some:id:with:colons");
  });

  it("returns null for empty string", () => {
    expect(parseCrn("")).toBeNull();
  });

  it("returns null for non-CRN string", () => {
    expect(parseCrn("https://example.com")).toBeNull();
  });

  it("returns null for incomplete CRN (missing resource-id)", () => {
    expect(parseCrn("crn:1:github:scope:type")).toBeNull();
  });

  it("returns null for CRN with missing fields", () => {
    expect(parseCrn("crn::::")).toBeNull();
    expect(parseCrn("crn:1:::")).toBeNull();
  });

  it("parses CRN with unknown service (forward compatibility)", () => {
    const crn = "crn:1:future-service:*:widget:abc123";
    const parsed = parseCrn(crn);
    expect(parsed).not.toBeNull();
    expect(parsed!.service).toBe("future-service");
  });

  it("parses a claude-web task CRN", () => {
    const crn = "crn:1:claude-web:*:task:proj_abc123";
    const parsed = parseCrn(crn);
    expect(parsed).toEqual({
      scheme: "crn",
      version: "1",
      service: "claude-web",
      scope: "*",
      resourceType: "task",
      resourceId: "proj_abc123",
    });
  });

  it("parses a graphiti node CRN", () => {
    const crn = "crn:1:graphiti:main:node:c9f3f845-3c3f-4a6c-a356-802b14eb7704";
    const parsed = parseCrn(crn);
    expect(parsed).toEqual({
      scheme: "crn",
      version: "1",
      service: "graphiti",
      scope: "main",
      resourceType: "node",
      resourceId: "c9f3f845-3c3f-4a6c-a356-802b14eb7704",
    });
  });
});

describe("isCrn", () => {
  it("returns true for valid CRN", () => {
    expect(isCrn("crn:1:codex-web:*:task:abc123")).toBe(true);
  });

  it("returns false for URL", () => {
    expect(isCrn("https://chatgpt.com/codex/tasks/abc")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCrn("")).toBe(false);
  });
});

describe("isKnownService", () => {
  it("recognizes internal services", () => {
    expect(isKnownService("agent")).toBe(true);
    expect(isKnownService("graphiti")).toBe(true);
    expect(isKnownService("work")).toBe(true);
    expect(isKnownService("cron")).toBe(true);
  });

  it("recognizes external services", () => {
    expect(isKnownService("codex-web")).toBe(true);
    expect(isKnownService("claude-web")).toBe(true);
    expect(isKnownService("github")).toBe(true);
    expect(isKnownService("slack")).toBe(true);
    expect(isKnownService("notion")).toBe(true);
  });

  it("rejects unknown services", () => {
    expect(isKnownService("imaginary")).toBe(false);
  });
});

describe("validateCrn", () => {
  it("returns null for valid CRN", () => {
    expect(validateCrn("crn:1:codex-web:*:task:abc123")).toBeNull();
  });

  it("returns error for missing prefix", () => {
    const err = validateCrn("not-a-crn");
    expect(err).toContain("crn:");
  });

  it("returns error for bad format", () => {
    const err = validateCrn("crn:1:github");
    expect(err).toContain("Invalid CRN format");
  });

  it("returns error for unsupported version", () => {
    const err = validateCrn("crn:99:codex-web:*:task:abc");
    expect(err).toContain("version");
  });

  it("returns error for unknown service", () => {
    const err = validateCrn("crn:1:made-up:*:thing:abc");
    expect(err).toContain("Unknown CRN service");
  });
});
