import { describe, it, expect } from "vitest";
import { detectPlanPatterns, buildScratchpadNudge } from "./nudge.js";

describe("detectPlanPatterns", () => {
  it("detects numbered list patterns (3+ items)", () => {
    expect(detectPlanPatterns("Here's my plan:\n1. Do X\n2. Do Y\n3. Do Z")).toBe(true);
  });

  it("detects 'step N' patterns (3+ references)", () => {
    expect(
      detectPlanPatterns("Step 1: Initialize the database\nStep 2: Run migrations\nStep 3: Seed"),
    ).toBe(true);
  });

  it("detects markdown task list patterns (3+ items)", () => {
    expect(detectPlanPatterns("- [ ] First task\n- [ ] Second task\n- [x] Done task")).toBe(true);
  });

  it("returns false for plain text without plan patterns", () => {
    expect(detectPlanPatterns("Hello, how can I help you today?")).toBe(false);
  });

  it("returns false for short numbered items (less than 3)", () => {
    expect(detectPlanPatterns("1. Just one item\n2. And another")).toBe(false);
  });

  it("detects 'phase' patterns", () => {
    expect(detectPlanPatterns("Phase 1: Design\nPhase 2: Build\nPhase 3: Test")).toBe(true);
  });

  it("detects 'stage' patterns", () => {
    expect(detectPlanPatterns("Stage 1: Gather\nStage 2: Process\nStage 3: Output")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(detectPlanPatterns("")).toBe(false);
  });
});

describe("buildScratchpadNudge", () => {
  it("returns turn-count nudge with turn number", () => {
    const nudge = buildScratchpadNudge("turn-count", 10);
    expect(nudge).toContain("scratchpad");
    expect(nudge).toContain("10");
    expect(nudge).toContain("[Hint:");
  });

  it("returns plan-detected nudge", () => {
    const nudge = buildScratchpadNudge("plan-detected");
    expect(nudge).toContain("scratchpad");
    expect(nudge).toContain("plan");
    expect(nudge).toContain("[Hint:");
  });

  it("returns post-compaction nudge", () => {
    const nudge = buildScratchpadNudge("post-compaction");
    expect(nudge).toContain("scratchpad");
    expect(nudge).toContain("compact");
    expect(nudge).toContain("[Hint:");
  });

  it("returns stale-scratchpad nudge with turns-since count", () => {
    const nudge = buildScratchpadNudge("stale-scratchpad", 15);
    expect(nudge).toContain("scratchpad");
    expect(nudge).toContain("15");
    expect(nudge).toContain("updated");
    expect(nudge).toContain("[Hint:");
  });
});
