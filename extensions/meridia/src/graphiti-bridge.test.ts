import { describe, expect, it } from "vitest";
import type { MeridiaExperienceRecord } from "./meridia/types.js";
import { meridiaRecordToAddMemoryArgs, meridiaRecordToGraphitiEpisode } from "./graphiti-bridge.js";

function makeRecord(overrides: Partial<MeridiaExperienceRecord> = {}): MeridiaExperienceRecord {
  return {
    id: "rec_123",
    ts: "2026-02-09T00:00:00.000Z",
    kind: "experience",
    session: { id: "s1", key: "k1", runId: "r1" },
    tool: { name: "test.tool", callId: "c1", isError: false },
    capture: {
      score: 0.9,
      evaluation: { kind: "heuristic", score: 0.9, reason: "test" },
    },
    content: {
      topic: "Hello",
      summary: "World",
      context: "Ctx",
      tags: ["a", "b"],
    },
    data: {},
    ...overrides,
  } as MeridiaExperienceRecord;
}

describe("graphiti-bridge transformers", () => {
  it("builds a Graphiti episode from a Meridia record", () => {
    const { episode } = meridiaRecordToGraphitiEpisode({
      record: makeRecord(),
      source: "meridia.test",
      groupId: "g1",
    });

    expect(episode.kind).toBe("episode");
    expect(episode.id).toBe("rec_123");
    expect(episode.text).toContain("Hello");
    expect(episode.text).toContain("World");
    expect(episode.metadata?.groupId).toBe("g1");
  });

  it("builds MCP add_memory args as JSON source", () => {
    const args = meridiaRecordToAddMemoryArgs({
      record: makeRecord(),
      groupId: "g2",
      sourceDescription: "desc",
    });

    expect(args.source).toBe("json");
    expect(args.group_id).toBe("g2");
    expect(args.uuid).toBe("rec_123");

    const parsed = JSON.parse(args.episode_body) as any;
    expect(parsed._kind).toBe("meridia_experience_record");
    expect(parsed.id).toBe("rec_123");
  });
});
