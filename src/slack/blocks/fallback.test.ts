import { describe, expect, it } from "vitest";
import type { SlackBlock } from "./types.js";
import { blocksToPlainText, validateBlocksForLimits } from "./fallback.js";

describe("blocksToPlainText", () => {
  describe("header blocks", () => {
    it("converts header to markdown h2", () => {
      const blocks: SlackBlock[] = [
        { type: "header", text: { type: "plain_text", text: "Hello World" } },
      ];
      expect(blocksToPlainText(blocks)).toBe("## Hello World");
    });
  });

  describe("divider blocks", () => {
    it("converts divider to ---", () => {
      const blocks: SlackBlock[] = [{ type: "divider" }];
      expect(blocksToPlainText(blocks)).toBe("---");
    });
  });

  describe("section blocks", () => {
    it("converts section with text", () => {
      const blocks: SlackBlock[] = [
        { type: "section", text: { type: "mrkdwn", text: "Hello *world*" } },
      ];
      expect(blocksToPlainText(blocks)).toBe("Hello *world*");
    });

    it("converts section with fields", () => {
      const blocks: SlackBlock[] = [
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: "*Name*" },
            { type: "mrkdwn", text: "John" },
          ],
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("*Name*");
      expect(result).toContain("John");
    });

    it("converts section with accessory button", () => {
      const blocks: SlackBlock[] = [
        {
          type: "section",
          text: { type: "mrkdwn", text: "Action needed" },
          accessory: {
            type: "button",
            text: { type: "plain_text", text: "Click me" },
            action_id: "test",
          },
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("Action needed");
      expect(result).toContain("[Click me]");
    });
  });

  describe("context blocks", () => {
    it("converts context elements with bullet separator", () => {
      const blocks: SlackBlock[] = [
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: "Author: John" },
            { type: "mrkdwn", text: "Date: 2025-01-01" },
          ],
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("Author: John");
      expect(result).toContain("•");
      expect(result).toContain("Date: 2025-01-01");
    });
  });

  describe("image blocks", () => {
    it("converts image to markdown image", () => {
      const blocks: SlackBlock[] = [
        {
          type: "image",
          image_url: "https://example.com/img.png",
          alt_text: "Example image",
        },
      ];
      expect(blocksToPlainText(blocks)).toBe("![Example image](https://example.com/img.png)");
    });
  });

  describe("actions blocks", () => {
    it("converts actions with buttons", () => {
      const blocks: SlackBlock[] = [
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Approve" },
              action_id: "approve",
              style: "primary",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Reject" },
              action_id: "reject",
              style: "danger",
            },
          ],
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("Actions:");
      expect(result).toContain("Approve");
      expect(result).toContain("Reject");
    });
  });

  describe("multiple blocks", () => {
    it("joins blocks with double newline", () => {
      const blocks: SlackBlock[] = [
        { type: "header", text: { type: "plain_text", text: "Title" } },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: "Content" } },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toBe("## Title\n\n---\n\nContent");
    });
  });

  describe("empty input", () => {
    it("returns empty string for empty blocks array", () => {
      expect(blocksToPlainText([])).toBe("");
    });
  });

  describe("input blocks", () => {
    it("converts input block with label and hint", () => {
      const blocks: SlackBlock[] = [
        {
          type: "input",
          label: { type: "plain_text", text: "Your email" },
          hint: { type: "plain_text", text: "Enter your work email" },
          element: {
            type: "email_text_input",
            action_id: "email",
          },
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("**Your email**");
      expect(result).toContain("Enter your work email");
    });
  });

  describe("interactive elements", () => {
    it("converts checkboxes", () => {
      const blocks: SlackBlock[] = [
        {
          type: "actions",
          elements: [
            {
              type: "checkboxes",
              action_id: "check",
              options: [
                {
                  text: { type: "plain_text", text: "Option A" },
                  value: "a",
                },
                {
                  text: { type: "plain_text", text: "Option B" },
                  value: "b",
                  description: { type: "plain_text", text: "B description" },
                },
              ],
            },
          ],
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("Option A");
      expect(result).toContain("Option B");
      expect(result).toContain("B description");
    });

    it("converts radio buttons", () => {
      const blocks: SlackBlock[] = [
        {
          type: "actions",
          elements: [
            {
              type: "radio_buttons",
              action_id: "radio",
              options: [
                { text: { type: "plain_text", text: "Yes" }, value: "yes" },
                { text: { type: "plain_text", text: "No" }, value: "no" },
              ],
            },
          ],
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("Select one:");
      expect(result).toContain("Yes");
      expect(result).toContain("No");
    });

    it("converts datepicker", () => {
      const blocks: SlackBlock[] = [
        {
          type: "actions",
          elements: [
            {
              type: "datepicker",
              action_id: "date",
              placeholder: { type: "plain_text", text: "Pick a date" },
            },
          ],
        },
      ];
      const result = blocksToPlainText(blocks);
      expect(result).toContain("📅");
      expect(result).toContain("Pick a date");
    });
  });
});

describe("validateBlocksForLimits", () => {
  it("returns empty array for valid blocks", () => {
    const blocks: SlackBlock[] = [
      { type: "header", text: { type: "plain_text", text: "Test" } },
      { type: "divider" },
    ];
    expect(validateBlocksForLimits(blocks)).toEqual([]);
  });

  it("warns when block count exceeds 50", () => {
    const blocks: SlackBlock[] = Array.from(
      { length: 51 },
      () => ({ type: "divider" }) as SlackBlock,
    );
    const warnings = validateBlocksForLimits(blocks);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("51");
    expect(warnings[0]).toContain("50");
  });

  it("warns when actions block has more than 25 elements", () => {
    const elements = Array.from({ length: 26 }, (_, i) => ({
      type: "button" as const,
      text: { type: "plain_text" as const, text: `btn${i}` },
      action_id: `act${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "actions", elements }];
    const warnings = validateBlocksForLimits(blocks);
    expect(warnings.some((w) => w.includes("26") && w.includes("25"))).toBe(true);
  });

  it("warns when section has more than 10 fields", () => {
    const fields = Array.from({ length: 11 }, (_, i) => ({
      type: "mrkdwn" as const,
      text: `field${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "section", fields }];
    const warnings = validateBlocksForLimits(blocks);
    expect(warnings.some((w) => w.includes("11") && w.includes("10"))).toBe(true);
  });

  it("warns when context has more than 10 elements", () => {
    const elements = Array.from({ length: 11 }, (_, i) => ({
      type: "mrkdwn" as const,
      text: `ctx${i}`,
    }));
    const blocks: SlackBlock[] = [{ type: "context", elements }];
    const warnings = validateBlocksForLimits(blocks);
    expect(warnings.some((w) => w.includes("11") && w.includes("10"))).toBe(true);
  });
});
