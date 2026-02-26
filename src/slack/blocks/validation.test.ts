import { describe, expect, it } from "vitest";
import type { SlackBlock } from "./types.js";
import {
  validateBlocks,
  validateMobileReadability,
  validateUniqueActionIds,
  validateAll,
} from "./validation.js";

describe("validateBlocks", () => {
  it("returns valid for empty blocks array", () => {
    const result = validateBlocks([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for simple valid blocks", () => {
    const blocks: SlackBlock[] = [
      { type: "header", text: { type: "plain_text", text: "Title" } },
      { type: "divider" },
      { type: "section", text: { type: "mrkdwn", text: "Content" } },
    ];
    expect(validateBlocks(blocks).valid).toBe(true);
  });

  it("errors on more than 50 blocks", () => {
    const blocks: SlackBlock[] = Array.from(
      { length: 51 },
      () => ({ type: "divider" }) as SlackBlock,
    );
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("51") && e.includes("50"))).toBe(true);
  });

  it("errors on header text over 150 chars", () => {
    const blocks: SlackBlock[] = [
      { type: "header", text: { type: "plain_text", text: "x".repeat(151) } },
    ];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("150"))).toBe(true);
  });

  it("errors on actions block with more than 25 elements", () => {
    const elements = Array.from({ length: 26 }, (_, i) => ({
      type: "button" as const,
      text: { type: "plain_text" as const, text: `btn${i}` },
      action_id: `act${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "actions", elements }];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("26") && e.includes("25"))).toBe(true);
  });

  it("warns on empty actions block", () => {
    const blocks: SlackBlock[] = [{ type: "actions", elements: [] }];
    const result = validateBlocks(blocks);
    expect(result.warnings.some((w) => w.includes("no elements"))).toBe(true);
  });

  it("errors on button text over 75 chars", () => {
    const blocks: SlackBlock[] = [
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "x".repeat(76) },
            action_id: "test",
          },
        ],
      },
    ];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("75"))).toBe(true);
  });

  it("errors on section with more than 10 fields", () => {
    const fields = Array.from({ length: 11 }, (_, i) => ({
      type: "mrkdwn" as const,
      text: `f${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "section", fields }];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("11") && e.includes("10"))).toBe(true);
  });

  it("errors on section text over 3000 chars", () => {
    const blocks: SlackBlock[] = [
      { type: "section", text: { type: "mrkdwn", text: "x".repeat(3001) } },
    ];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("3000"))).toBe(true);
  });

  it("warns on empty section block", () => {
    const blocks: SlackBlock[] = [{ type: "section" }];
    const result = validateBlocks(blocks);
    expect(result.warnings.some((w) => w.includes("empty"))).toBe(true);
  });

  it("errors on context block with more than 10 elements", () => {
    const elements = Array.from({ length: 11 }, (_, i) => ({
      type: "mrkdwn" as const,
      text: `ctx${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "context", elements }];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("11") && e.includes("10"))).toBe(true);
  });

  it("errors on checkboxes with more than 10 options", () => {
    const options = Array.from({ length: 11 }, (_, i) => ({
      text: { type: "plain_text" as const, text: `opt${i}` },
      value: `v${i}`,
    }));
    const blocks: SlackBlock[] = [
      {
        type: "actions",
        elements: [{ type: "checkboxes", action_id: "cb", options }],
      },
    ];
    const result = validateBlocks(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("11") && e.includes("10"))).toBe(true);
  });
});

describe("validateMobileReadability", () => {
  it("returns valid for simple blocks", () => {
    const blocks: SlackBlock[] = [{ type: "section", text: { type: "mrkdwn", text: "Simple" } }];
    expect(validateMobileReadability(blocks).valid).toBe(true);
  });

  it("warns on section with more than 4 fields", () => {
    const fields = Array.from({ length: 6 }, (_, i) => ({
      type: "mrkdwn" as const,
      text: `f${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "section", fields }];
    const result = validateMobileReadability(blocks);
    expect(result.warnings.some((w) => w.includes("6 fields"))).toBe(true);
  });

  it("warns on actions with more than 5 elements", () => {
    const elements = Array.from({ length: 6 }, (_, i) => ({
      type: "button" as const,
      text: { type: "plain_text" as const, text: `b${i}` },
      action_id: `a${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "actions", elements }];
    const result = validateMobileReadability(blocks);
    expect(result.warnings.some((w) => w.includes("overflow"))).toBe(true);
  });
});

describe("validateUniqueActionIds", () => {
  it("returns valid for unique action IDs", () => {
    const blocks: SlackBlock[] = [
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "A" }, action_id: "a" },
          { type: "button", text: { type: "plain_text", text: "B" }, action_id: "b" },
        ],
      },
    ];
    expect(validateUniqueActionIds(blocks).valid).toBe(true);
  });

  it("errors on duplicate action IDs", () => {
    const blocks: SlackBlock[] = [
      {
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "A" }, action_id: "dup" },
          { type: "button", text: { type: "plain_text", text: "B" }, action_id: "dup" },
        ],
      },
    ];
    const result = validateUniqueActionIds(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate") && e.includes("dup"))).toBe(true);
  });

  it("checks section accessory action IDs", () => {
    const blocks: SlackBlock[] = [
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "A" }, action_id: "same" }],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "test" },
        accessory: { type: "button", text: { type: "plain_text", text: "B" }, action_id: "same" },
      },
    ];
    const result = validateUniqueActionIds(blocks);
    expect(result.valid).toBe(false);
  });
});

describe("validateAll", () => {
  it("combines all validations", () => {
    const blocks: SlackBlock[] = [
      { type: "header", text: { type: "plain_text", text: "Valid header" } },
    ];
    const result = validateAll(blocks);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("aggregates errors from all validators", () => {
    const blocks: SlackBlock[] = Array.from(
      { length: 51 },
      () => ({ type: "divider" }) as SlackBlock,
    );
    const result = validateAll(blocks);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
