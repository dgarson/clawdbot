import { describe, expect, it } from "vitest";
import { formatMemoryCrn, parseMemoryCrn } from "../src/contracts/crn.js";

describe("memory CRN", () => {
  it("round-trips", () => {
    const crn = formatMemoryCrn({
      version: "1",
      namespace: "memory",
      agentId: "agent-123",
      resourceType: "episode",
      resourceId: "ep-456",
    });

    expect(parseMemoryCrn(crn)).toEqual({
      version: "1",
      namespace: "memory",
      agentId: "agent-123",
      resourceType: "episode",
      resourceId: "ep-456",
    });
  });
});
