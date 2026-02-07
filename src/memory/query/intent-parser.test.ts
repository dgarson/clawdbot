import { describe, expect, it } from "vitest";
import { parseQueryIntent } from "./intent-parser.js";

describe("parseQueryIntent", () => {
  it("extracts entities, topics, and time hints from a mixed query", () => {
    const prompt = "What did Alice Johnson say about GraphRAG last week?";

    expect(parseQueryIntent(prompt)).toEqual({
      entities: ["Alice Johnson", "GraphRAG"],
      topics: ["graphrag"],
      timeHints: [
        {
          phrase: "last week",
          type: "relative",
          unit: "week",
          offset: -1,
        },
      ],
    });
  });

  it("handles hashtags and simple temporal cues", () => {
    const prompt = "Summarize #incident notes for OpenClaw yesterday.";

    expect(parseQueryIntent(prompt)).toEqual({
      entities: ["OpenClaw"],
      topics: ["incident"],
      timeHints: [
        {
          phrase: "yesterday",
          type: "relative",
          unit: "day",
          offset: -1,
        },
      ],
    });
  });

  it("captures topic phrases and numeric relative ranges", () => {
    const prompt = "Show me updates on topic authentication and #oncall in the last 3 days.";

    expect(parseQueryIntent(prompt)).toEqual({
      entities: [],
      topics: ["authentication", "oncall"],
      timeHints: [
        {
          phrase: "in the last 3 days",
          type: "relative",
          unit: "day",
          offset: -3,
        },
      ],
    });
  });

  it("captures quoted entities and absolute dates", () => {
    const prompt =
      "Compare the rollout plan for `MemoryIndexManager` and Auth Service on 2024-02-15.";

    expect(parseQueryIntent(prompt)).toEqual({
      entities: ["MemoryIndexManager", "Auth Service"],
      topics: [],
      timeHints: [
        {
          phrase: "2024-02-15",
          type: "absolute",
          date: "2024-02-15",
        },
      ],
    });
  });
});
