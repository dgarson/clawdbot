import { describe, expect, it } from "vitest";
import {
  extractFirstJsonObject,
  normalizeForegroundEnvelope,
  normalizeSubagentResult,
  parseBoolean,
  parseNumber,
  SPECIALIST_PROMPTS,
} from "./subagent-normalization.js";

// ---------------------------------------------------------------------------
// extractFirstJsonObject
// ---------------------------------------------------------------------------

describe("extractFirstJsonObject", () => {
  it("parses a plain JSON string", () => {
    const result = extractFirstJsonObject('{"summary":"done"}');
    expect(result).toEqual({ summary: "done" });
  });

  it("returns null for empty string", () => {
    expect(extractFirstJsonObject("")).toBeNull();
  });

  it("returns null for non-JSON text", () => {
    expect(extractFirstJsonObject("hello world")).toBeNull();
  });

  it("extracts JSON from surrounding text", () => {
    const result = extractFirstJsonObject('Here is the result: {"summary":"found it"} done.');
    expect(result).toEqual({ summary: "found it" });
  });

  it("strips markdown code fences", () => {
    const fenced = '```json\n{"summary":"fenced"}\n```';
    const result = extractFirstJsonObject(fenced);
    expect(result).toEqual({ summary: "fenced" });
  });

  it("strips markdown fences without language tag", () => {
    const fenced = '```\n{"summary":"plain fence"}\n```';
    const result = extractFirstJsonObject(fenced);
    expect(result).toEqual({ summary: "plain fence" });
  });

  it("handles trailing commas", () => {
    const result = extractFirstJsonObject('{"summary":"ok", "confidence": 0.5,}');
    expect(result).toEqual({ summary: "ok", confidence: 0.5 });
  });

  it("handles JSON comments", () => {
    const withComments = `{
      // this is a comment
      "summary": "commented",
      "confidence": 0.8
    }`;
    const result = extractFirstJsonObject(withComments);
    expect(result).toEqual({ summary: "commented", confidence: 0.8 });
  });

  it("returns null for arrays (only objects expected)", () => {
    expect(extractFirstJsonObject("[1, 2, 3]")).toBeNull();
  });

  it("handles trailing comma before closing bracket in nested array", () => {
    const result = extractFirstJsonObject('{"summary":"ok","artifacts":["a","b",]}');
    expect(result).toEqual({ summary: "ok", artifacts: ["a", "b"] });
  });
});

// ---------------------------------------------------------------------------
// parseBoolean / parseNumber
// ---------------------------------------------------------------------------

describe("parseBoolean", () => {
  it("passes through booleans", () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean(false)).toBe(false);
  });

  it("converts string variants", () => {
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("YES")).toBe(true);
    expect(parseBoolean("y")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean("n")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("false")).toBe(false);
  });

  it("converts numbers", () => {
    expect(parseBoolean(1)).toBe(true);
    expect(parseBoolean(0)).toBe(false);
    expect(parseBoolean(42)).toBe(true);
  });

  it("returns undefined for unrecognized values", () => {
    expect(parseBoolean("maybe")).toBeUndefined();
    expect(parseBoolean(null)).toBeUndefined();
    expect(parseBoolean(undefined)).toBeUndefined();
  });
});

describe("parseNumber", () => {
  it("passes through finite numbers", () => {
    expect(parseNumber(0.85)).toBe(0.85);
    expect(parseNumber(0)).toBe(0);
  });

  it("parses string numbers", () => {
    expect(parseNumber("0.82")).toBe(0.82);
    expect(parseNumber("  1  ")).toBe(1);
  });

  it("returns undefined for non-numeric", () => {
    expect(parseNumber("abc")).toBeUndefined();
    expect(parseNumber(Number.NaN)).toBeUndefined();
    expect(parseNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeForegroundEnvelope
// ---------------------------------------------------------------------------

describe("normalizeForegroundEnvelope", () => {
  it("normalizes foreground envelope aliases", () => {
    const result = normalizeForegroundEnvelope(
      JSON.stringify({ action: "delegate", immediateText: "Checking that now", tasks: [] }),
    );

    expect(result.action).toBe("delegate");
    expect(result.immediate_text).toBe("Checking that now");
    expect(result.delegations).toEqual([]);
  });

  it("falls back to respond_now for plain text", () => {
    const result = normalizeForegroundEnvelope("Sure, let me check on that.");
    expect(result.action).toBe("respond_now");
    expect(result.immediate_text).toBe("Sure, let me check on that.");
    expect(result.delegations).toEqual([]);
  });

  it("falls back to default text when immediate_text is missing", () => {
    const result = normalizeForegroundEnvelope('{"action":"respond_now"}');
    expect(result.immediate_text).toBe("One moment while I check that.");
  });

  it("parses full delegation envelope", () => {
    const input = JSON.stringify({
      action: "delegate",
      immediate_text: "Let me look that up.",
      delegations: [{ specialist: "research", goal: "find the answer" }],
    });
    const result = normalizeForegroundEnvelope(input);
    expect(result.action).toBe("delegate");
    expect(result.immediate_text).toBe("Let me look that up.");
    expect(result.delegations).toHaveLength(1);
    expect(result.delegations[0].specialist).toBe("research");
  });

  it("handles fenced JSON envelope", () => {
    const input = '```json\n{"action":"delegate","message":"Checking","tasks":[]}\n```';
    const result = normalizeForegroundEnvelope(input);
    expect(result.action).toBe("delegate");
    expect(result.immediate_text).toBe("Checking");
  });
});

// ---------------------------------------------------------------------------
// normalizeSubagentResult
// ---------------------------------------------------------------------------

describe("normalizeSubagentResult", () => {
  it("extracts JSON from mixed text with aliases", () => {
    const result = normalizeSubagentResult(
      `Here's what I found:\n{"answer":"Done","score":"0.9","needsFollowup":"no","attachments":[]}`,
    );

    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Done");
    expect(result?.confidence).toBe(0.9);
    expect(result?.needs_followup).toBe(false);
  });

  it("parses canonical schema directly", () => {
    const input = JSON.stringify({
      summary: "The meeting is at 3pm",
      confidence: 0.95,
      needs_followup: false,
      followup_question: null,
      artifacts: [],
    });
    const result = normalizeSubagentResult(input);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("The meeting is at 3pm");
    expect(result?.confidence).toBe(0.95);
  });

  it("handles camelCase aliases", () => {
    const input = JSON.stringify({
      spokenSummary: "Result here",
      certainty: "0.7",
      followUpRequired: "yes",
      followupQuestion: "Need more info?",
      sources: ["source1"],
    });
    const result = normalizeSubagentResult(input);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Result here");
    expect(result?.confidence).toBe(0.7);
    expect(result?.needs_followup).toBe(true);
    expect(result?.followup_question).toBe("Need more info?");
    expect(result?.artifacts).toEqual(["source1"]);
  });

  it("handles markdown-fenced JSON", () => {
    const input = '```json\n{"summary":"fenced result","confidence":0.8}\n```';
    const result = normalizeSubagentResult(input);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("fenced result");
  });

  it("handles trailing commas in output", () => {
    const input = '{"summary": "trailing comma result", "confidence": 0.6,}';
    const result = normalizeSubagentResult(input);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("trailing comma result");
  });

  it("handles case-insensitive key matching", () => {
    const input = JSON.stringify({
      Summary: "uppercase key",
      Confidence: 0.5,
    });
    const result = normalizeSubagentResult(input);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("uppercase key");
  });

  it("returns null for empty string", () => {
    expect(normalizeSubagentResult("")).toBeNull();
  });

  it("returns null for JSON without required summary field", () => {
    expect(normalizeSubagentResult('{"confidence": 0.5}')).toBeNull();
  });

  it("returns null for non-JSON text", () => {
    expect(normalizeSubagentResult("I couldn't find anything.")).toBeNull();
  });

  it("applies defaults for optional fields", () => {
    const result = normalizeSubagentResult('{"summary":"minimal"}');
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe(0.5);
    expect(result?.needs_followup).toBe(false);
    expect(result?.followup_question).toBeNull();
    expect(result?.artifacts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SPECIALIST_PROMPTS
// ---------------------------------------------------------------------------

describe("SPECIALIST_PROMPTS", () => {
  it("has entries for all three specialist types", () => {
    expect(SPECIALIST_PROMPTS.research).toBeTruthy();
    expect(SPECIALIST_PROMPTS.scheduler).toBeTruthy();
    expect(SPECIALIST_PROMPTS.policy).toBeTruthy();
  });

  it("each prompt contains role-specific keywords", () => {
    expect(SPECIALIST_PROMPTS.research.toLowerCase()).toContain("research");
    expect(SPECIALIST_PROMPTS.scheduler.toLowerCase()).toContain("schedul");
    expect(SPECIALIST_PROMPTS.policy.toLowerCase()).toContain("policy");
  });
});
