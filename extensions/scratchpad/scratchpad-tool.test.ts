import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildScratchpadTool, SCRATCHPAD_ENTRY_KEY } from "./scratchpad-tool.js";

function makeState(initial?: string) {
  return {
    scratchpad: initial,
    appendCustomEntry: vi.fn(),
  };
}

describe("session.scratchpad tool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has name session.scratchpad", () => {
    const tool = buildScratchpadTool({ state: makeState() });
    expect(tool.name).toBe("session.scratchpad");
  });

  it("replace mode: sets scratchpad and persists via appendCustomEntry", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { content: "my notes" });
    expect(state.scratchpad).toBe("my notes");
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_ENTRY_KEY, "my notes");
    expect(result).toMatch(/saved \(replace\)/);
  });

  it("replace mode: truncates when content exceeds maxChars, includes 'truncated' in response", () => {
    const state = makeState();
    const maxChars = 40;
    const tool = buildScratchpadTool({ state, maxChars });
    // 41 chars — over budget of 40
    const longContent = "a".repeat(41);
    const result = tool.execute("id", { content: longContent });
    expect(state.scratchpad).toBe("a".repeat(maxChars));
    expect(result).toMatch(/truncated/);
  });

  it("append mode: appends to existing content with newline separator", () => {
    const state = makeState("first line");
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { content: "second line", mode: "append" });
    expect(state.scratchpad).toBe("first line\nsecond line");
    expect(state.appendCustomEntry).toHaveBeenCalledWith(
      SCRATCHPAD_ENTRY_KEY,
      "first line\nsecond line",
    );
    expect(result).toMatch(/saved \(append\)/);
  });

  it("append mode: rejects when combined content exceeds budget, scratchpad unchanged", () => {
    const state = makeState("existing");
    const maxChars = 20;
    const tool = buildScratchpadTool({ state, maxChars });
    // "existing\n" (9 chars) + 20 chars = 29 chars, over budget of 20
    const longContent = "x".repeat(20);
    const result = tool.execute("id", { content: longContent, mode: "append" });
    expect(state.scratchpad).toBe("existing");
    expect(state.appendCustomEntry).not.toHaveBeenCalled();
    expect(result).toMatch(/rejected/);
    expect(result).toMatch(/unchanged/);
  });

  it("default mode is replace when mode is omitted", () => {
    const state = makeState("old content");
    const tool = buildScratchpadTool({ state });
    tool.execute("id", { content: "new content" });
    expect(state.scratchpad).toBe("new content");
  });

  it("append to empty scratchpad works without leading newline", () => {
    const state = makeState(undefined);
    const tool = buildScratchpadTool({ state });
    tool.execute("id", { content: "first entry", mode: "append" });
    expect(state.scratchpad).toBe("first entry");
    expect(state.scratchpad?.startsWith("\n")).toBe(false);
  });
});
