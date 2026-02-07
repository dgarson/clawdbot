import type { DiscoveryResult, SubagentReport } from "./types.js";

const JSON_FENCE_PATTERN = /```(?:json)?\s*\n([\s\S]*?)\n```/;

/**
 * Parse a subagent's final reply into a structured report.
 * Looks for a JSON block first; falls back to plain text summary.
 */
export function parseSubagentReport(
  rawReply: string | undefined,
  metadata: { question: string; label: string },
): SubagentReport {
  const defaultReport: SubagentReport = {
    summary: rawReply?.trim() || `No output from subagent (${metadata.label})`,
    findings: [],
    decisions: [],
    blockers: [],
    artifacts: [],
  };

  if (!rawReply?.trim()) {
    return defaultReport;
  }

  // Try extracting structured JSON from fenced code block.
  const fenceMatch = rawReply.match(JSON_FENCE_PATTERN);
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed && typeof parsed === "object") {
        return {
          summary: typeof parsed.summary === "string" ? parsed.summary : defaultReport.summary,
          findings: Array.isArray(parsed.findings)
            ? parsed.findings.filter((f: unknown) => typeof f === "string")
            : [],
          decisions: Array.isArray(parsed.decisions)
            ? parsed.decisions.filter((d: unknown) => typeof d === "string")
            : [],
          blockers: Array.isArray(parsed.blockers)
            ? parsed.blockers.filter((b: unknown) => typeof b === "string")
            : [],
          artifacts: Array.isArray(parsed.artifacts)
            ? parsed.artifacts.filter((a: unknown) => typeof a === "string")
            : [],
        };
      }
    } catch {
      // JSON parse failed — fall through to plain text.
    }
  }

  // Try parsing the entire reply as JSON (no fence).
  try {
    const parsed = JSON.parse(rawReply.trim());
    if (parsed && typeof parsed === "object" && typeof parsed.summary === "string") {
      return {
        summary: parsed.summary,
        findings: Array.isArray(parsed.findings)
          ? parsed.findings.filter((f: unknown) => typeof f === "string")
          : [],
        decisions: Array.isArray(parsed.decisions)
          ? parsed.decisions.filter((d: unknown) => typeof d === "string")
          : [],
        blockers: Array.isArray(parsed.blockers)
          ? parsed.blockers.filter((b: unknown) => typeof b === "string")
          : [],
        artifacts: Array.isArray(parsed.artifacts)
          ? parsed.artifacts.filter((a: unknown) => typeof a === "string")
          : [],
      };
    }
  } catch {
    // Not JSON — use plain text.
  }

  return defaultReport;
}

/**
 * Aggregate multiple discovery reports into a consolidated context
 * for injection into the decompose phase.
 */
export function aggregateDiscoveryReports(results: DiscoveryResult[]): {
  consolidatedFindings: string;
  allInsights: string[];
  allBlockers: string[];
} {
  const findingParts: string[] = [];
  const allInsights: string[] = [];
  const allBlockers: string[] = [];

  for (const result of results) {
    if (result.status !== "ok" && !result.findings) {
      findingParts.push(`### ${result.question}\n*Discovery failed (${result.status})*`);
      continue;
    }

    findingParts.push(`### ${result.question}\n${result.findings}`);
    allInsights.push(...result.keyInsights);

    // Parse the findings for blockers if structured.
    const report = parseSubagentReport(result.findings, {
      question: result.question,
      label: result.question,
    });
    allBlockers.push(...report.blockers);
  }

  return {
    consolidatedFindings: findingParts.join("\n\n"),
    allInsights: [...new Set(allInsights)],
    allBlockers: [...new Set(allBlockers)],
  };
}
