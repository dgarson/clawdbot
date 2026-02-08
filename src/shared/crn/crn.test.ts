import { describe, expect, it } from "vitest";
import { buildCrn, matchCrnPattern, parseCrn } from "./index.js";

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
});
