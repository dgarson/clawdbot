import { describe, expect, it } from "vitest";
import type { ParsedCrn, RefKind } from "./types.js";
import {
  buildCrn,
  getAllServicePatterns,
  getServicePattern,
  refKindToCrnParts,
  resolveUrl,
} from "./registry.js";

describe("getServicePattern", () => {
  it("returns pattern for codex-web", () => {
    const pattern = getServicePattern("codex-web");
    expect(pattern).toBeDefined();
    expect(pattern!.baseUrl).toBe("https://chatgpt.com/codex");
  });

  it("returns pattern for claude-web", () => {
    const pattern = getServicePattern("claude-web");
    expect(pattern).toBeDefined();
    expect(pattern!.baseUrl).toBe("https://claude.ai");
  });

  it("returns pattern for github", () => {
    const pattern = getServicePattern("github");
    expect(pattern).toBeDefined();
    expect(pattern!.baseUrl).toBe("https://github.com");
  });

  it("returns undefined for internal service without URL pattern", () => {
    const pattern = getServicePattern("agent");
    expect(pattern).toBeUndefined();
  });
});

describe("getAllServicePatterns", () => {
  it("returns all registered patterns", () => {
    const patterns = getAllServicePatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(5);
    const services = patterns.map(([s]) => s);
    expect(services).toContain("codex-web");
    expect(services).toContain("claude-web");
    expect(services).toContain("github");
    expect(services).toContain("slack");
    expect(services).toContain("notion");
  });
});

describe("resolveUrl", () => {
  it("resolves codex-web task to URL", () => {
    const crn: ParsedCrn = {
      scheme: "crn",
      version: "1",
      service: "codex-web",
      scope: "*",
      resourceType: "task",
      resourceId: "task_e_abc123",
    };
    expect(resolveUrl(crn)).toBe("https://chatgpt.com/codex/tasks/task_e_abc123");
  });

  it("resolves github PR to URL", () => {
    const crn: ParsedCrn = {
      scheme: "crn",
      version: "1",
      service: "github",
      scope: "dgarson/clawdbrain",
      resourceType: "pr",
      resourceId: "347",
    };
    expect(resolveUrl(crn)).toBe("https://github.com/dgarson/clawdbrain/pull/347");
  });

  it("returns undefined when github scope is unknown", () => {
    const crn: ParsedCrn = {
      scheme: "crn",
      version: "1",
      service: "github",
      scope: "*",
      resourceType: "pr",
      resourceId: "347",
    };
    expect(resolveUrl(crn)).toBeUndefined();
  });

  it("resolves github issue to URL", () => {
    const crn: ParsedCrn = {
      scheme: "crn",
      version: "1",
      service: "github",
      scope: "openclaw/openclaw",
      resourceType: "issue",
      resourceId: "42",
    };
    expect(resolveUrl(crn)).toBe("https://github.com/openclaw/openclaw/issues/42");
  });

  it("returns undefined for unknown service", () => {
    const crn: ParsedCrn = {
      scheme: "crn",
      version: "1",
      service: "work",
      scope: "main",
      resourceType: "item",
      resourceId: "abc",
    };
    expect(resolveUrl(crn)).toBeUndefined();
  });

  it("returns undefined for unknown resource type", () => {
    const crn: ParsedCrn = {
      scheme: "crn",
      version: "1",
      service: "codex-web",
      scope: "*",
      resourceType: "unknown-type",
      resourceId: "abc",
    };
    expect(resolveUrl(crn)).toBeUndefined();
  });
});

describe("buildCrn", () => {
  it("builds a standard CRN string", () => {
    expect(buildCrn("codex-web", "*", "task", "abc123")).toBe("crn:1:codex-web:*:task:abc123");
  });

  it("builds CRN with custom version", () => {
    expect(buildCrn("codex-web", "*", "task", "abc", "2")).toBe("crn:2:codex-web:*:task:abc");
  });

  it("builds CRN with scoped service", () => {
    expect(buildCrn("github", "dgarson/clawdbrain", "pr", "347")).toBe(
      "crn:1:github:dgarson/clawdbrain:pr:347",
    );
  });

  it("preserves resource IDs with colons", () => {
    expect(buildCrn("memory", "main", "entry", "has:colons:inside")).toBe(
      "crn:1:memory:main:entry:has:colons:inside",
    );
  });
});

describe("refKindToCrnParts", () => {
  it("maps codex-web:task to service + resource type", () => {
    const parts = refKindToCrnParts("codex-web:task");
    expect(parts).toEqual({ service: "codex-web", resourceType: "task" });
  });

  it("maps github:pr to service + resource type", () => {
    const parts = refKindToCrnParts("github:pr");
    expect(parts).toEqual({ service: "github", resourceType: "pr" });
  });

  it("maps graphiti:node to service + resource type", () => {
    const parts = refKindToCrnParts("graphiti:node");
    expect(parts).toEqual({ service: "graphiti", resourceType: "node" });
  });

  it("returns undefined for unsupported kinds on registered services", () => {
    const parts = refKindToCrnParts("claude-web:task" as RefKind);
    expect(parts).toBeUndefined();
  });

  it("returns undefined for top-level kinds", () => {
    expect(refKindToCrnParts("agent")).toBeUndefined();
    expect(refKindToCrnParts("session")).toBeUndefined();
  });
});

describe("service URL parsing", () => {
  describe("codex-web", () => {
    const pattern = getServicePattern("codex-web")!;

    it("parses standard codex task URL", () => {
      const result = pattern.parseUrl(
        "https://chatgpt.com/codex/tasks/task_e_69897ce1fef0832e900b408fb5e79043",
      );
      expect(result).toEqual({
        service: "codex-web",
        scope: "*",
        resourceType: "task",
        resourceId: "task_e_69897ce1fef0832e900b408fb5e79043",
      });
    });

    it("parses codex task URL with www", () => {
      const result = pattern.parseUrl("https://www.chatgpt.com/codex/tasks/task_abc");
      expect(result).not.toBeNull();
      expect(result!.resourceId).toBe("task_abc");
    });

    it("rejects non-codex URL", () => {
      expect(pattern.parseUrl("https://chatgpt.com/chat")).toBeNull();
    });
  });

  describe("github", () => {
    const pattern = getServicePattern("github")!;

    it("parses PR URL", () => {
      const result = pattern.parseUrl("https://github.com/dgarson/clawdbrain/pull/347");
      expect(result).toEqual({
        service: "github",
        scope: "dgarson/clawdbrain",
        resourceType: "pr",
        resourceId: "347",
      });
    });

    it("parses issue URL", () => {
      const result = pattern.parseUrl("https://github.com/openclaw/openclaw/issues/42");
      expect(result).toEqual({
        service: "github",
        scope: "openclaw/openclaw",
        resourceType: "issue",
        resourceId: "42",
      });
    });

    it("parses commit URL", () => {
      const result = pattern.parseUrl("https://github.com/dgarson/clawdbrain/commit/abc123def");
      expect(result).toEqual({
        service: "github",
        scope: "dgarson/clawdbrain",
        resourceType: "commit",
        resourceId: "abc123def",
      });
    });

    it("parses bare repo URL", () => {
      const result = pattern.parseUrl("https://github.com/dgarson/clawdbrain");
      expect(result).toEqual({
        service: "github",
        scope: "dgarson/clawdbrain",
        resourceType: "repo",
        resourceId: "dgarson/clawdbrain",
      });
    });

    it("parses repo URL with trailing slash", () => {
      const result = pattern.parseUrl("https://github.com/dgarson/clawdbrain/");
      expect(result).toEqual({
        service: "github",
        scope: "dgarson/clawdbrain",
        resourceType: "repo",
        resourceId: "dgarson/clawdbrain",
      });
    });
  });

  describe("claude-web", () => {
    const pattern = getServicePattern("claude-web")!;

    it("parses project URL", () => {
      const result = pattern.parseUrl("https://claude.ai/project/abc123-def456");
      expect(result).toEqual({
        service: "claude-web",
        scope: "*",
        resourceType: "project",
        resourceId: "abc123-def456",
      });
    });

    it("rejects non-project URL", () => {
      expect(pattern.parseUrl("https://claude.ai/chat")).toBeNull();
    });
  });
});
