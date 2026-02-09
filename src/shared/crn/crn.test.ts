import { describe, expect, it } from "vitest";
import {
  buildClaudeTaskCrn,
  buildCodexTaskCrn,
  buildCrn,
  buildExternalTaskCrn,
  claudeTaskUrl,
  codexTaskUrl,
  externalTaskUrlFromRefKind,
  matchCrnPattern,
  parseCrn,
} from "./index.js";

describe("crn", () => {
  it("parses greedy resource-id segments", () => {
    const parsed = parseCrn("crn:v1:browser:main:page:https://github.com:443/org/repo");
    expect(parsed.resourceId).toBe("https://github.com:443/org/repo");
  });

  it("normalizes prefix, tokens, and global scope alias", () => {
    const crn = buildCrn({
      service: "CHANNEL",
      scope: "-",
      resourceType: "Message",
      resourceId: "Slack/C0A/message/1",
    });
    expect(crn).toBe("crn:v1:channel:global:message:slack/C0A/message/1");
  });

  it("normalizes file path separators", () => {
    const crn = buildCrn({
      service: "file",
      scope: "main",
      resourceType: "path",
      resourceId: "local\\Users\\dev\\notes.txt",
    });
    expect(crn).toBe("crn:v1:file:main:path:local/Users/dev/notes.txt");
  });

  it("normalizes browser page URLs", () => {
    const crn = buildCrn({
      service: "browser",
      scope: "main",
      resourceType: "page",
      resourceId: "HTTPS://GITHUB.COM/Org/Repo",
    });
    expect(crn).toBe("crn:v1:browser:main:page:https://github.com/Org/Repo");
  });

  it("preserves explicit ports for query-only URLs", () => {
    const crn = buildCrn({
      service: "browser",
      scope: "main",
      resourceType: "page",
      resourceId: "https://example.com:443?x=1",
    });
    expect(crn).toBe("crn:v1:browser:main:page:https://example.com:443/?x=1");
  });

  it("matches CRN patterns", () => {
    const pattern = parseCrn("crn:v1:channel:*:message:slack/*", { mode: "pattern" });
    const target = parseCrn(
      "crn:v1:channel:main:message:slack/C0AB5HFJQM7/message/1770517119.421689",
    );
    expect(matchCrnPattern(pattern, target)).toBe(true);
  });

  // ── External coding-platform CRNs ──────────────────────────────────────

  describe("external platform CRNs", () => {
    it("builds a Codex task CRN with global scope", () => {
      const crn = buildCodexTaskCrn({ taskId: "abc-123" });
      expect(crn).toBe("crn:v1:codex-web:global:task:abc-123");
    });

    it("builds a Claude task CRN with global scope", () => {
      const crn = buildClaudeTaskCrn({ taskId: "conv-456" });
      expect(crn).toBe("crn:v1:claude-web:global:task:conv-456");
    });

    it("preserves task ID case and trims surrounding whitespace", () => {
      const crn = buildCrn({
        service: "codex-web",
        scope: "global",
        resourceType: "task",
        resourceId: "  AbC-123  ",
      });
      expect(crn).toBe("crn:v1:codex-web:global:task:AbC-123");
    });

    it("buildExternalTaskCrn dispatches by ref kind", () => {
      expect(buildExternalTaskCrn("external:codex-task", "t1")).toBe(
        "crn:v1:codex-web:global:task:t1",
      );
      expect(buildExternalTaskCrn("external:claude-task", "t2")).toBe(
        "crn:v1:claude-web:global:task:t2",
      );
      expect(buildExternalTaskCrn("unknown", "t3")).toBeUndefined();
    });

    it("generates correct Codex task URLs", () => {
      expect(codexTaskUrl("abc-123")).toBe("https://chatgpt.com/codex/tasks/abc-123");
    });

    it("generates correct Claude task URLs with session_ prefix", () => {
      expect(claudeTaskUrl("01EWNc9EagxLbAyRBeoHkA8i")).toBe(
        "https://claude.ai/code/session_01EWNc9EagxLbAyRBeoHkA8i",
      );
    });

    it("externalTaskUrlFromRefKind maps ref kinds to URLs", () => {
      expect(externalTaskUrlFromRefKind("external:codex-task", "id1")).toBe(
        "https://chatgpt.com/codex/tasks/id1",
      );
      expect(externalTaskUrlFromRefKind("external:claude-task", "id2")).toBe(
        "https://claude.ai/code/session_id2",
      );
      expect(externalTaskUrlFromRefKind("work:item", "id3")).toBeUndefined();
    });

    it("matches external CRN patterns", () => {
      const pattern = parseCrn("crn:v1:codex-web:*:task:*", { mode: "pattern" });
      const target = parseCrn("crn:v1:codex-web:global:task:abc-123");
      expect(matchCrnPattern(pattern, target)).toBe(true);
    });
  });
});
