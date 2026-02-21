import { describe, expect, it } from "vitest";
import { normalizeForegroundEnvelope, normalizeSubagentResult } from "./subagent-normalization.js";

describe("subagent normalization", () => {
  it("normalizes foreground envelope aliases", () => {
    const result = normalizeForegroundEnvelope(
      JSON.stringify({ action: "delegate", immediateText: "Checking that now", tasks: [] }),
    );

    expect(result.action).toBe("delegate");
    expect(result.immediate_text).toBe("Checking that now");
    expect(result.delegations).toEqual([]);
  });

  it("extracts json from mixed text", () => {
    const result = normalizeSubagentResult(
      `Here's what I found:\n{"answer":"Done","score":"0.9","needsFollowup":"no","attachments":[]}`,
    );

    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Done");
    expect(result?.confidence).toBe(0.9);
    expect(result?.needs_followup).toBe(false);
  });
});
