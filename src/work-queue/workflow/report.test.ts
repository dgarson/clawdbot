import { describe, expect, it } from "vitest";
import type { DiscoveryResult } from "./types.js";
import { parseSubagentReport, aggregateDiscoveryReports } from "./report.js";

describe("parseSubagentReport", () => {
  const meta = { question: "test?", label: "test" };

  it("returns default report for undefined input", () => {
    const report = parseSubagentReport(undefined, meta);
    expect(report.summary).toContain("No output");
    expect(report.findings).toEqual([]);
    expect(report.blockers).toEqual([]);
  });

  it("returns default report for empty input", () => {
    const report = parseSubagentReport("", meta);
    expect(report.summary).toContain("No output");
  });

  it("parses JSON from fenced code block", () => {
    const raw = [
      "Here are my findings:",
      "```json",
      JSON.stringify({
        summary: "Found 3 files",
        findings: ["file1.ts", "file2.ts", "file3.ts"],
        decisions: ["Use file1.ts as entry point"],
        blockers: [],
        artifacts: ["/src/file1.ts"],
      }),
      "```",
      "That's all.",
    ].join("\n");

    const report = parseSubagentReport(raw, meta);
    expect(report.summary).toBe("Found 3 files");
    expect(report.findings).toEqual(["file1.ts", "file2.ts", "file3.ts"]);
    expect(report.decisions).toEqual(["Use file1.ts as entry point"]);
    expect(report.artifacts).toEqual(["/src/file1.ts"]);
  });

  it("parses raw JSON without fence", () => {
    const raw = JSON.stringify({
      summary: "Direct JSON",
      findings: ["one"],
      decisions: [],
      blockers: ["blocker1"],
      artifacts: [],
    });

    const report = parseSubagentReport(raw, meta);
    expect(report.summary).toBe("Direct JSON");
    expect(report.blockers).toEqual(["blocker1"]);
  });

  it("falls back to plain text for non-JSON", () => {
    const report = parseSubagentReport("Just plain text findings", meta);
    expect(report.summary).toBe("Just plain text findings");
    expect(report.findings).toEqual([]);
  });

  it("handles malformed JSON in fence gracefully", () => {
    const raw = "```json\n{ invalid json }\n```";
    const report = parseSubagentReport(raw, meta);
    // Falls through to try entire string as JSON, then falls back to plain text.
    expect(report.summary).toBe(raw);
  });

  it("filters non-string items from arrays", () => {
    const raw = JSON.stringify({
      summary: "Test",
      findings: ["valid", 123, null, "also valid"],
      decisions: [],
      blockers: [],
      artifacts: [],
    });

    const report = parseSubagentReport(raw, meta);
    expect(report.findings).toEqual(["valid", "also valid"]);
  });
});

describe("aggregateDiscoveryReports", () => {
  it("returns empty aggregation for no results", () => {
    const agg = aggregateDiscoveryReports([]);
    expect(agg.consolidatedFindings).toBe("");
    expect(agg.allInsights).toEqual([]);
    expect(agg.allBlockers).toEqual([]);
  });

  it("aggregates findings from multiple results", () => {
    const results: DiscoveryResult[] = [
      {
        question: "What APIs exist?",
        runId: "r1",
        sessionKey: "s1",
        status: "ok",
        findings: "Found REST API at /api/v1",
        keyInsights: ["REST API available"],
      },
      {
        question: "What tests exist?",
        runId: "r2",
        sessionKey: "s2",
        status: "ok",
        findings: "Found 50 test files",
        keyInsights: ["Good test coverage"],
      },
    ];

    const agg = aggregateDiscoveryReports(results);
    expect(agg.consolidatedFindings).toContain("What APIs exist?");
    expect(agg.consolidatedFindings).toContain("Found REST API at /api/v1");
    expect(agg.consolidatedFindings).toContain("What tests exist?");
    expect(agg.allInsights).toEqual(["REST API available", "Good test coverage"]);
  });

  it("handles failed discovery results", () => {
    const results: DiscoveryResult[] = [
      {
        question: "What deps are used?",
        runId: "r1",
        sessionKey: "s1",
        status: "error",
        findings: "",
        keyInsights: [],
      },
    ];

    const agg = aggregateDiscoveryReports(results);
    expect(agg.consolidatedFindings).toContain("Discovery failed");
  });

  it("deduplicates insights and blockers", () => {
    const results: DiscoveryResult[] = [
      {
        question: "Q1",
        runId: "r1",
        sessionKey: "s1",
        status: "ok",
        findings: "Found stuff",
        keyInsights: ["insight-A", "insight-B"],
      },
      {
        question: "Q2",
        runId: "r2",
        sessionKey: "s2",
        status: "ok",
        findings: "Found more",
        keyInsights: ["insight-A", "insight-C"],
      },
    ];

    const agg = aggregateDiscoveryReports(results);
    expect(agg.allInsights).toEqual(["insight-A", "insight-B", "insight-C"]);
  });
});
