import { describe, expect, it } from "vitest";
import type { EntityRef } from "./types.js";
import {
  canonicalizeRef,
  canonicalizeRefs,
  crnToUrl,
  urlToCrn,
  urlToParsedCrn,
  urlToRef,
} from "./canonicalize.js";

describe("urlToCrn", () => {
  it("converts codex-web task URL to CRN", () => {
    const url = "https://chatgpt.com/codex/tasks/task_e_69897ce1fef0832e900b408fb5e79043";
    expect(urlToCrn(url)).toBe("crn:1:codex-web:*:task:task_e_69897ce1fef0832e900b408fb5e79043");
  });

  it("converts GitHub PR URL to CRN", () => {
    const url = "https://github.com/dgarson/clawdbrain/pull/347";
    expect(urlToCrn(url)).toBe("crn:1:github:dgarson/clawdbrain:pr:347");
  });

  it("converts GitHub issue URL to CRN", () => {
    const url = "https://github.com/openclaw/openclaw/issues/42";
    expect(urlToCrn(url)).toBe("crn:1:github:openclaw/openclaw:issue:42");
  });

  it("converts GitHub commit URL to CRN", () => {
    const url = "https://github.com/dgarson/clawdbrain/commit/abc123def";
    expect(urlToCrn(url)).toBe("crn:1:github:dgarson/clawdbrain:commit:abc123def");
  });

  it("converts GitHub repo URL to CRN", () => {
    const url = "https://github.com/dgarson/clawdbrain";
    expect(urlToCrn(url)).toBe("crn:1:github:dgarson/clawdbrain:repo:dgarson/clawdbrain");
  });

  it("converts Claude project URL to CRN", () => {
    const url = "https://claude.ai/project/abc123-def456";
    expect(urlToCrn(url)).toBe("crn:1:claude-web:*:project:abc123-def456");
  });

  it("returns null for unrecognized URL", () => {
    expect(urlToCrn("https://example.com/random/path")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(urlToCrn("")).toBeNull();
  });
});

describe("urlToParsedCrn", () => {
  it("parses codex-web task URL", () => {
    const url = "https://chatgpt.com/codex/tasks/task_e_abc123";
    const parsed = urlToParsedCrn(url);
    expect(parsed).toEqual({
      scheme: "crn",
      version: "1",
      service: "codex-web",
      scope: "*",
      resourceType: "task",
      resourceId: "task_e_abc123",
    });
  });

  it("returns null for unrecognized URL", () => {
    expect(urlToParsedCrn("https://example.com")).toBeNull();
  });
});

describe("crnToUrl", () => {
  it("resolves codex-web task CRN to URL", () => {
    expect(crnToUrl("crn:1:codex-web:*:task:task_e_abc123")).toBe(
      "https://chatgpt.com/codex/tasks/task_e_abc123",
    );
  });

  it("resolves GitHub PR CRN to URL", () => {
    expect(crnToUrl("crn:1:github:dgarson/clawdbrain:pr:347")).toBe(
      "https://github.com/dgarson/clawdbrain/pull/347",
    );
  });

  it("does not resolve GitHub URL when scope is unknown", () => {
    expect(crnToUrl("crn:1:github:*:pr:347")).toBeUndefined();
  });

  it("resolves GitHub issue CRN to URL", () => {
    expect(crnToUrl("crn:1:github:openclaw/openclaw:issue:42")).toBe(
      "https://github.com/openclaw/openclaw/issues/42",
    );
  });

  it("resolves GitHub commit CRN to URL", () => {
    expect(crnToUrl("crn:1:github:dgarson/clawdbrain:commit:abc123")).toBe(
      "https://github.com/dgarson/clawdbrain/commit/abc123",
    );
  });

  it("resolves Claude project CRN to URL", () => {
    expect(crnToUrl("crn:1:claude-web:*:project:proj_abc123")).toBe(
      "https://claude.ai/project/proj_abc123",
    );
  });

  it("does not resolve unsupported Claude task CRN", () => {
    expect(crnToUrl("crn:1:claude-web:*:task:proj_abc123")).toBeUndefined();
  });

  it("returns undefined for invalid CRN", () => {
    expect(crnToUrl("not-a-crn")).toBeUndefined();
  });

  it("returns undefined for unregistered service", () => {
    expect(crnToUrl("crn:1:work:main:item:abc")).toBeUndefined();
  });
});

describe("canonicalizeRef", () => {
  it("enriches ref with CRN and URI from kind + id (codex-web:task)", () => {
    const ref: EntityRef = {
      kind: "codex-web:task",
      id: "task_e_abc123",
    };
    const result = canonicalizeRef(ref);
    expect(result.crn).toBe("crn:1:codex-web:*:task:task_e_abc123");
    expect(result.uri).toBe("https://chatgpt.com/codex/tasks/task_e_abc123");
    // Original not mutated
    expect(ref.crn).toBeUndefined();
  });

  it("enriches ref with CRN and URI from kind + id (github:pr)", () => {
    const ref: EntityRef = {
      kind: "github:pr",
      id: "347",
    };
    // github:pr needs scope, so CRN uses "*" and URL is left unset.
    const result = canonicalizeRef(ref);
    expect(result.crn).toBe("crn:1:github:*:pr:347");
    expect(result.uri).toBeUndefined();
  });

  it("resolves URL from CRN when id is a CRN string", () => {
    const ref: EntityRef = {
      kind: "codex-web:task",
      id: "crn:1:codex-web:*:task:task_e_abc123",
    };
    const result = canonicalizeRef(ref);
    expect(result.crn).toBe("crn:1:codex-web:*:task:task_e_abc123");
    expect(result.uri).toBe("https://chatgpt.com/codex/tasks/task_e_abc123");
  });

  it("generates CRN from existing URI", () => {
    const ref: EntityRef = {
      kind: "codex-web:task",
      id: "task_e_abc123",
      uri: "https://chatgpt.com/codex/tasks/task_e_abc123",
    };
    const result = canonicalizeRef(ref);
    expect(result.crn).toBe("crn:1:codex-web:*:task:task_e_abc123");
  });

  it("preserves existing URI when CRN resolves", () => {
    const ref: EntityRef = {
      kind: "codex-web:task",
      id: "crn:1:codex-web:*:task:abc",
      uri: "https://custom.url/override",
    };
    const result = canonicalizeRef(ref);
    // Existing URI is preserved
    expect(result.uri).toBe("https://custom.url/override");
    expect(result.crn).toBe("crn:1:codex-web:*:task:abc");
  });

  it("handles internal refs without URL resolution", () => {
    const ref: EntityRef = {
      kind: "graphiti:node",
      id: "c9f3f845-3c3f-4a6c-a356-802b14eb7704",
    };
    const result = canonicalizeRef(ref);
    // Internal services don't have URL patterns registered
    expect(result.crn).toBeUndefined();
    expect(result.uri).toBeUndefined();
  });

  it("handles refs with no kind mapping", () => {
    const ref: EntityRef = {
      kind: "agent",
      id: "main",
    };
    const result = canonicalizeRef(ref);
    // Top-level kinds don't have CRN mapping
    expect(result.crn).toBeUndefined();
  });
});

describe("canonicalizeRefs", () => {
  it("processes array of refs", () => {
    const refs: EntityRef[] = [
      { kind: "codex-web:task", id: "task_1" },
      { kind: "codex-web:task", id: "task_2" },
    ];
    const results = canonicalizeRefs(refs);
    expect(results).toHaveLength(2);
    expect(results[0].crn).toContain("task_1");
    expect(results[1].crn).toContain("task_2");
  });

  it("handles empty array", () => {
    expect(canonicalizeRefs([])).toEqual([]);
  });
});

describe("urlToRef", () => {
  it("creates ref from codex-web URL", () => {
    const ref = urlToRef("https://chatgpt.com/codex/tasks/task_e_abc123");
    expect(ref).toEqual({
      kind: "codex-web:task",
      id: "task_e_abc123",
      uri: "https://chatgpt.com/codex/tasks/task_e_abc123",
      crn: "crn:1:codex-web:*:task:task_e_abc123",
    });
  });

  it("creates ref from GitHub PR URL", () => {
    const ref = urlToRef("https://github.com/dgarson/clawdbrain/pull/347");
    expect(ref).toEqual({
      kind: "github:pr",
      id: "347",
      uri: "https://github.com/dgarson/clawdbrain/pull/347",
      crn: "crn:1:github:dgarson/clawdbrain:pr:347",
    });
  });

  it("creates ref from GitHub issue URL", () => {
    const ref = urlToRef("https://github.com/openclaw/openclaw/issues/42");
    expect(ref).toEqual({
      kind: "github:issue",
      id: "42",
      uri: "https://github.com/openclaw/openclaw/issues/42",
      crn: "crn:1:github:openclaw/openclaw:issue:42",
    });
  });

  it("returns null for unrecognized URL", () => {
    expect(urlToRef("https://example.com/thing")).toBeNull();
  });
});

describe("round-trip: URL → CRN → URL", () => {
  const testCases = [
    {
      name: "Codex task",
      url: "https://chatgpt.com/codex/tasks/task_e_69897ce1fef0832e900b408fb5e79043",
    },
    {
      name: "GitHub PR",
      url: "https://github.com/dgarson/clawdbrain/pull/347",
    },
    {
      name: "GitHub issue",
      url: "https://github.com/openclaw/openclaw/issues/42",
    },
    {
      name: "GitHub commit",
      url: "https://github.com/dgarson/clawdbrain/commit/abc123def",
    },
  ];

  for (const tc of testCases) {
    it(`round-trips ${tc.name}`, () => {
      const crn = urlToCrn(tc.url);
      expect(crn).not.toBeNull();
      const resolvedUrl = crnToUrl(crn!);
      expect(resolvedUrl).toBe(tc.url);
    });
  }
});
