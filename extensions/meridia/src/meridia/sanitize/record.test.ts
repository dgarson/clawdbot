import { describe, expect, it } from "vitest";
import type { MeridiaExperienceRecord } from "../types.js";
import { sanitizeExperienceRecord } from "./record.js";

function makeRecord(overrides?: Partial<MeridiaExperienceRecord>): MeridiaExperienceRecord {
  return {
    id: "rec-1",
    ts: new Date().toISOString(),
    kind: "tool_result",
    session: { key: "s-1" },
    tool: { name: "exec", callId: "c-1", isError: false },
    capture: {
      score: 0.8,
      evaluation: { kind: "heuristic", score: 0.8, reason: "base reason" },
    },
    content: { topic: "topic", summary: "summary" },
    data: {
      args: { cmd: "echo hello" },
      result: { ok: true },
    },
    ...overrides,
  };
}

describe("sanitizeExperienceRecord", () => {
  it("redacts secrets from payload and text fields", () => {
    const secret = "sk-abc123456789012345678901234567890";
    const record = makeRecord({
      content: {
        topic: "deploy",
        summary: `using ${secret}`,
      },
      data: {
        args: { apiKey: secret, token: "Bearer eyJabc.def.ghi" },
        result: { password: "super-secret-password" },
      },
    });

    const sanitized = sanitizeExperienceRecord(record);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("super-secret-password");
  });

  it("truncates oversized result payloads", () => {
    const huge = "x".repeat(20_000);
    const sanitized = sanitizeExperienceRecord(
      makeRecord({
        data: {
          args: { mode: "huge" },
          result: { payload: huge },
        },
      }),
    );

    const serializedResult = JSON.stringify(sanitized.data?.result);
    expect(serializedResult.length).toBeLessThan(9_000);
  });

  it("sanitizes phenomenology and classification text", () => {
    const secret = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";
    const sanitized = sanitizeExperienceRecord(
      makeRecord({
        phenomenology: {
          anchors: [
            {
              phrase: `anchor ${secret}`,
              significance: `because ${secret}`,
            },
          ],
          uncertainties: [`uncertain ${secret}`],
          reconstitutionHints: [`hint ${secret}`],
        },
        classification: {
          confidence: 0.91,
          reasons: [`reason ${secret}`],
        },
      }),
    );

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain(secret);
  });
});
