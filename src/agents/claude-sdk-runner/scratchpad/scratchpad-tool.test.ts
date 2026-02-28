import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildScratchpadTool,
  SCRATCHPAD_NOTES_KEY,
  SCRATCHPAD_PLAN_KEY,
  SCRATCHPAD_REFS_KEY,
} from "./scratchpad-tool.js";

function makeState(overrides?: Partial<{ notes: string; plan: string; refs: string[] }>) {
  return {
    notes: overrides?.notes,
    plan: overrides?.plan,
    refs: overrides?.refs ?? [],
    appendCustomEntry: vi.fn(),
  };
}

describe("session.scratchpad tool — structure", () => {
  it("has name session.scratchpad", () => {
    const tool = buildScratchpadTool({ state: makeState() });
    expect(tool.name).toBe("session.scratchpad");
  });

  it("requires action parameter in schema", () => {
    const tool = buildScratchpadTool({ state: makeState() });
    const required = (tool.parameters as { required: string[] }).required;
    expect(required).toContain("action");
  });

  it("returns unknown-action message for unrecognised action", () => {
    const tool = buildScratchpadTool({ state: makeState() });
    const result = tool.execute("id", { action: "nope" });
    expect(result).toMatch(/Unknown action/);
  });
});

describe("set_notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets notes and persists with SCRATCHPAD_NOTES_KEY", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "set_notes", content: "my finding" });
    expect(state.notes).toBe("my finding");
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_NOTES_KEY, "my finding");
    expect(result).toMatch(/notes set/);
    expect(result).toMatch(/10\/4000/);
  });

  it("truncates when content exceeds maxNotes, warns in response", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state, maxNotes: 10 });
    const result = tool.execute("id", { action: "set_notes", content: "a".repeat(15) });
    expect(state.notes).toBe("a".repeat(10));
    expect(result).toMatch(/truncated/);
    expect(result).toMatch(/15 to 10/);
  });

  it("replaces existing notes", () => {
    const state = makeState({ notes: "old" });
    const tool = buildScratchpadTool({ state });
    tool.execute("id", { action: "set_notes", content: "new" });
    expect(state.notes).toBe("new");
  });

  it("treats missing content as empty string", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "set_notes" });
    expect(state.notes).toBe("");
    expect(result).toMatch(/notes set/);
  });
});

describe("append_notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appends to existing notes with newline separator", () => {
    const state = makeState({ notes: "first" });
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "append_notes", content: "second" });
    expect(state.notes).toBe("first\nsecond");
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_NOTES_KEY, "first\nsecond");
    expect(result).toMatch(/notes appended/);
  });

  it("appends to empty notes without leading newline", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    tool.execute("id", { action: "append_notes", content: "entry" });
    expect(state.notes).toBe("entry");
    expect(state.notes?.startsWith("\n")).toBe(false);
  });

  it("rejects when combined content would exceed maxNotes, notes unchanged", () => {
    const state = makeState({ notes: "abcde" });
    const tool = buildScratchpadTool({ state, maxNotes: 10 });
    // "abcde\n" + "xxxxx" = 11 chars, over budget of 10
    const result = tool.execute("id", { action: "append_notes", content: "xxxxx" });
    expect(state.notes).toBe("abcde");
    expect(state.appendCustomEntry).not.toHaveBeenCalled();
    expect(result).toMatch(/rejected/);
    expect(result).toMatch(/set_notes/);
  });
});

describe("set_plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets plan and persists with SCRATCHPAD_PLAN_KEY", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "set_plan", content: "step 1\nstep 2" });
    expect(state.plan).toBe("step 1\nstep 2");
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_PLAN_KEY, "step 1\nstep 2");
    expect(result).toMatch(/plan set/);
    expect(result).toMatch(/2000/);
  });

  it("truncates when content exceeds maxPlan, warns in response", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state, maxPlan: 5 });
    const result = tool.execute("id", { action: "set_plan", content: "toolong" });
    expect(state.plan).toBe("toolo");
    expect(result).toMatch(/truncated/);
  });

  it("replaces existing plan", () => {
    const state = makeState({ plan: "old plan" });
    const tool = buildScratchpadTool({ state });
    tool.execute("id", { action: "set_plan", content: "new plan" });
    expect(state.plan).toBe("new plan");
  });
});

describe("refs.add", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a ref and persists with SCRATCHPAD_REFS_KEY", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.add", ref: "src/foo.ts" });
    expect(state.refs).toEqual(["src/foo.ts"]);
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_REFS_KEY, ["src/foo.ts"]);
    expect(result).toMatch(/added "src\/foo\.ts"/);
    expect(result).toMatch(/1\/50/);
  });

  it("returns error for empty ref string", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.add", ref: "" });
    expect(result).toMatch(/non-empty/);
    expect(state.refs).toEqual([]);
  });

  it("drops oldest item atomically when at maxRefs capacity", () => {
    const state = makeState({ refs: ["a", "b", "c"] });
    const tool = buildScratchpadTool({ state, maxRefs: 3 });
    const result = tool.execute("id", { action: "refs.add", ref: "d" });
    // "a" dropped, "b","c","d" remain — no string was truncated mid-value
    expect(state.refs).toEqual(["b", "c", "d"]);
    expect(result).toMatch(/3\/3/);
  });

  it("accumulates multiple refs in order", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    tool.execute("id", { action: "refs.add", ref: "first" });
    tool.execute("id", { action: "refs.add", ref: "second" });
    expect(state.refs).toEqual(["first", "second"]);
  });
});

describe("refs.remove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes an existing ref and persists", () => {
    const state = makeState({ refs: ["a", "b", "c"] });
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.remove", ref: "b" });
    expect(state.refs).toEqual(["a", "c"]);
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_REFS_KEY, ["a", "c"]);
    expect(result).toMatch(/removed "b"/);
  });

  it("returns not-found message when ref is absent, refs unchanged", () => {
    const state = makeState({ refs: ["a"] });
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.remove", ref: "z" });
    expect(state.refs).toEqual(["a"]);
    expect(state.appendCustomEntry).not.toHaveBeenCalled();
    expect(result).toMatch(/not found/);
  });

  it("returns error for empty ref string", () => {
    const state = makeState({ refs: ["a"] });
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.remove", ref: "" });
    expect(result).toMatch(/non-empty/);
    expect(state.refs).toEqual(["a"]);
  });
});

describe("refs.set", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replaces all refs and persists with SCRATCHPAD_REFS_KEY", () => {
    const state = makeState({ refs: ["old"] });
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.set", items: ["x", "y"] });
    expect(state.refs).toEqual(["x", "y"]);
    expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_REFS_KEY, ["x", "y"]);
    expect(result).toMatch(/2\/50/);
  });

  it("caps to maxRefs when items exceeds limit", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state, maxRefs: 3 });
    const result = tool.execute("id", {
      action: "refs.set",
      items: ["a", "b", "c", "d", "e"],
    });
    expect(state.refs).toEqual(["a", "b", "c"]);
    expect(result).toMatch(/3\/3/);
  });

  it("clears refs when given empty array", () => {
    const state = makeState({ refs: ["a", "b"] });
    const tool = buildScratchpadTool({ state });
    const result = tool.execute("id", { action: "refs.set", items: [] });
    expect(state.refs).toEqual([]);
    expect(result).toMatch(/0\/50/);
  });

  it("filters out non-string items", () => {
    const state = makeState();
    const tool = buildScratchpadTool({ state });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool.execute("id", { action: "refs.set", items: ["valid", 42, null, "also-valid"] as any });
    expect(state.refs).toEqual(["valid", "also-valid"]);
  });
});

describe("backwards-compat (old SCRATCHPAD_ENTRY_KEY export)", () => {
  it("exports SCRATCHPAD_ENTRY_KEY constant", async () => {
    const mod = await import("./scratchpad-tool.js");
    expect(mod.SCRATCHPAD_ENTRY_KEY).toBe("openclaw:scratchpad");
  });

  it("exports new key constants", async () => {
    const mod = await import("./scratchpad-tool.js");
    expect(mod.SCRATCHPAD_NOTES_KEY).toBe("openclaw:scratchpad:notes");
    expect(mod.SCRATCHPAD_PLAN_KEY).toBe("openclaw:scratchpad:plan");
    expect(mod.SCRATCHPAD_REFS_KEY).toBe("openclaw:scratchpad:refs");
  });
});
