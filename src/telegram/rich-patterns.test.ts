import { describe, expect, it } from "vitest";
import {
  encodeCallbackData,
  escapeHtml,
  renderPattern,
  simpleHash,
  type TelegramPatternResult,
  type TelegramPatternType,
} from "./rich-patterns.js";

// ─── Callback Data Encoding ─────────────────────────────────────────────────

describe("encodeCallbackData", () => {
  it("produces short callback_data within 64 bytes", () => {
    const result = encodeCallbackData("mc_sel", "option_1");
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(64);
    expect(result).toBe("mc_sel:option_1");
  });

  it("hashes long ids to fit within 64 bytes", () => {
    const longId = "a".repeat(100);
    const result = encodeCallbackData("mc_sel", longId);
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(64);
    expect(result).toContain("mc_sel:");
    // Should be hashed (8 hex chars)
    const id = result.split(":")[1];
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("handles empty id", () => {
    const result = encodeCallbackData("prefix", "");
    expect(result).toBe("prefix:");
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(64);
  });

  it("handles unicode characters in id", () => {
    const result = encodeCallbackData("sel", "选项一");
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(64);
  });

  it("produces deterministic output", () => {
    const a = encodeCallbackData("pref", "value123");
    const b = encodeCallbackData("pref", "value123");
    expect(a).toBe(b);
  });
});

describe("simpleHash", () => {
  it("returns 8-char hex string", () => {
    const hash = simpleHash("hello");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic", () => {
    expect(simpleHash("test")).toBe(simpleHash("test"));
  });

  it("produces different hashes for different inputs", () => {
    expect(simpleHash("a")).not.toBe(simpleHash("b"));
  });
});

// ─── HTML Escaping ───────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;",
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });
});

// ─── Pattern Rendering ──────────────────────────────────────────────────────

describe("renderPattern", () => {
  describe("multiple_choice", () => {
    it("renders question with option buttons", () => {
      const result = renderPattern("multiple_choice", {
        question: "Pick a color",
        options: [
          { text: "Red", value: "red" },
          { text: "Blue", value: "blue" },
          { text: "Green", value: "green" },
        ],
        actionIdPrefix: "color",
      });

      expect(result.html).toContain("<b>Pick a color</b>");
      expect(result.keyboard.length).toBeGreaterThan(0);

      // Should have 3 buttons (one per option)
      const allButtons = result.keyboard.flat();
      expect(allButtons).toHaveLength(3);
      expect(allButtons[0].text).toBe("Red");
      expect(allButtons[1].text).toBe("Blue");
      expect(allButtons[2].text).toBe("Green");
    });

    it("callback_data stays within 64 bytes", () => {
      const result = renderPattern("multiple_choice", {
        question: "Long options test",
        options: [
          { text: "Very Long Option Name Here", value: "a".repeat(100) },
          { text: "Another Long One", value: "b".repeat(100) },
        ],
        actionIdPrefix: "long_prefix_test",
      });

      for (const row of result.keyboard) {
        for (const btn of row) {
          expect(Buffer.byteLength(btn.callback_data, "utf8")).toBeLessThanOrEqual(64);
        }
      }
    });

    it("adds Done button for multi-select", () => {
      const result = renderPattern("multiple_choice", {
        question: "Select all that apply",
        options: [
          { text: "A", value: "a" },
          { text: "B", value: "b" },
        ],
        actionIdPrefix: "ms",
        allowMultiple: true,
      });

      const allButtons = result.keyboard.flat();
      const doneBtn = allButtons.find((b) => b.text.includes("Done"));
      expect(doneBtn).toBeDefined();
    });

    it("uses single-column layout for ≤4 options", () => {
      const result = renderPattern("multiple_choice", {
        question: "Pick one",
        options: [
          { text: "A", value: "a" },
          { text: "B", value: "b" },
          { text: "C", value: "c" },
        ],
        actionIdPrefix: "q",
      });

      // Each option should be on its own row (1 per row for ≤4 items)
      expect(result.keyboard).toHaveLength(3);
      expect(result.keyboard[0]).toHaveLength(1);
    });

    it("uses two-column layout for >4 options", () => {
      const result = renderPattern("multiple_choice", {
        question: "Pick one",
        options: [
          { text: "A", value: "a" },
          { text: "B", value: "b" },
          { text: "C", value: "c" },
          { text: "D", value: "d" },
          { text: "E", value: "e" },
        ],
        actionIdPrefix: "q",
      });

      // First row should have 2 buttons
      expect(result.keyboard[0]).toHaveLength(2);
    });

    it("provides plain text fallback", () => {
      const result = renderPattern("multiple_choice", {
        question: "Pick one",
        options: [
          { text: "A", value: "a", description: "First letter" },
          { text: "B", value: "b" },
        ],
        actionIdPrefix: "q",
      });

      expect(result.plainText).toContain("Pick one");
      expect(result.plainText).toContain("1. A — First letter");
      expect(result.plainText).toContain("2. B");
    });

    it("handles empty options array", () => {
      const result = renderPattern("multiple_choice", {
        question: "Nothing to choose",
        options: [],
        actionIdPrefix: "empty",
      });

      expect(result.html).toContain("Nothing to choose");
      expect(result.keyboard).toHaveLength(0);
    });
  });

  describe("confirmation", () => {
    it("renders title, message, and two buttons", () => {
      const result = renderPattern("confirmation", {
        title: "Delete file?",
        message: "This action cannot be undone.",
        actionIdPrefix: "del",
      });

      expect(result.html).toContain("<b>Delete file?</b>");
      expect(result.html).toContain("This action cannot be undone.");
      expect(result.keyboard).toHaveLength(1);
      expect(result.keyboard[0]).toHaveLength(2);
      expect(result.keyboard[0][0].text).toContain("Confirm");
      expect(result.keyboard[0][1].text).toContain("Cancel");
    });

    it("uses danger emoji for danger style", () => {
      const result = renderPattern("confirmation", {
        title: "Danger",
        message: "Are you sure?",
        actionIdPrefix: "d",
        style: "danger",
      });

      expect(result.keyboard[0][0].text).toContain("🔴");
    });

    it("uses custom button labels", () => {
      const result = renderPattern("confirmation", {
        title: "Approve",
        message: "Approve this PR?",
        actionIdPrefix: "apr",
        confirmLabel: "Yes, approve",
        cancelLabel: "No, skip",
      });

      expect(result.keyboard[0][0].text).toContain("Yes, approve");
      expect(result.keyboard[0][1].text).toContain("No, skip");
    });
  });

  describe("task_proposal", () => {
    it("renders task with accept/reject buttons", () => {
      const result = renderPattern("task_proposal", {
        title: "Deploy to production",
        description: "Deploy v2.1.0 to production cluster.",
        actionIdPrefix: "deploy",
      });

      expect(result.html).toContain("📋");
      expect(result.html).toContain("<b>Deploy to production</b>");
      expect(result.html).toContain("Deploy v2.1.0");
      expect(result.keyboard[0]).toHaveLength(2);
      expect(result.keyboard[0][0].text).toContain("Accept");
      expect(result.keyboard[0][1].text).toContain("Reject");
    });

    it("includes details as key-value pairs", () => {
      const result = renderPattern("task_proposal", {
        title: "Task",
        description: "Do stuff",
        details: [
          { label: "Branch", value: "main" },
          { label: "Version", value: "2.1.0" },
        ],
        actionIdPrefix: "t",
      });

      expect(result.html).toContain("<b>Branch</b>: main");
      expect(result.html).toContain("<b>Version</b>: 2.1.0");
    });

    it("adds modify button when modifyLabel is provided", () => {
      const result = renderPattern("task_proposal", {
        title: "Task",
        description: "Do stuff",
        actionIdPrefix: "t",
        modifyLabel: "Edit",
      });

      expect(result.keyboard[0]).toHaveLength(3);
      expect(result.keyboard[0][2].text).toContain("Edit");
    });
  });

  describe("action_items", () => {
    it("renders checklist with toggle buttons", () => {
      const result = renderPattern("action_items", {
        title: "TODO",
        items: [
          { id: "1", text: "Write tests", completed: false },
          { id: "2", text: "Fix bug", completed: true },
        ],
        actionIdPrefix: "todo",
      });

      expect(result.html).toContain("<b>TODO</b>");
      expect(result.html).toContain("⬜ Write tests");
      expect(result.html).toContain("✅ Fix bug");
      // Should have toggle buttons
      const allButtons = result.keyboard.flat();
      expect(allButtons.length).toBeGreaterThanOrEqual(2);
    });

    it("omits buttons when showCheckboxes is false", () => {
      const result = renderPattern("action_items", {
        title: "Read-only list",
        items: [{ id: "1", text: "Item", completed: false }],
        actionIdPrefix: "ro",
        showCheckboxes: false,
      });

      expect(result.keyboard).toHaveLength(0);
    });

    it("includes item details in italic", () => {
      const result = renderPattern("action_items", {
        title: "List",
        items: [{ id: "1", text: "Task", completed: false, details: "Due tomorrow" }],
        actionIdPrefix: "ai",
      });

      expect(result.html).toContain("<i>Due tomorrow</i>");
    });
  });

  describe("status", () => {
    it("renders status with correct emoji", () => {
      const cases: Array<{ status: string; emoji: string }> = [
        { status: "success", emoji: "✅" },
        { status: "warning", emoji: "⚠️" },
        { status: "error", emoji: "❌" },
        { status: "info", emoji: "ℹ️" },
      ];

      for (const { status, emoji } of cases) {
        const result = renderPattern("status", {
          title: "Build",
          message: "Build completed.",
          status,
        });
        expect(result.html).toContain(emoji);
      }
    });

    it("includes detail bullet points", () => {
      const result = renderPattern("status", {
        title: "Report",
        message: "Summary here.",
        status: "info",
        details: ["Point 1", "Point 2"],
      });

      expect(result.html).toContain("• Point 1");
      expect(result.html).toContain("• Point 2");
    });

    it("includes timestamp in italic", () => {
      const result = renderPattern("status", {
        title: "Update",
        message: "Done.",
        status: "success",
        timestamp: "2024-01-01 12:00",
      });

      expect(result.html).toContain("<i>2024-01-01 12:00</i>");
    });

    it("has no keyboard buttons (text-only)", () => {
      const result = renderPattern("status", {
        title: "S",
        message: "M",
        status: "info",
      });

      expect(result.keyboard).toHaveLength(0);
    });
  });

  describe("progress", () => {
    it("renders progress bar with percentage", () => {
      const result = renderPattern("progress", {
        title: "Upload",
        current: 50,
        total: 100,
      });

      expect(result.html).toContain("<b>Upload</b>");
      expect(result.html).toContain("50%");
      expect(result.html).toContain("50/100");
      // Should contain progress bar characters
      expect(result.html).toContain("█");
      expect(result.html).toContain("░");
    });

    it("handles zero total gracefully", () => {
      const result = renderPattern("progress", {
        title: "Empty",
        current: 0,
        total: 0,
      });

      expect(result.html).toContain("0%");
      expect(result.html).not.toContain("NaN");
    });

    it("caps at 100% for over-max values", () => {
      const result = renderPattern("progress", {
        title: "Over",
        current: 150,
        total: 100,
      });

      expect(result.html).toContain("100%");
    });

    it("hides percentage when showPercentage is false", () => {
      const result = renderPattern("progress", {
        title: "Quiet",
        current: 5,
        total: 10,
        showPercentage: false,
      });

      expect(result.html).not.toContain("%");
    });

    it("includes description when provided", () => {
      const result = renderPattern("progress", {
        title: "Loading",
        current: 3,
        total: 10,
        description: "Processing files...",
      });

      expect(result.html).toContain("Processing files...");
    });

    it("has no keyboard buttons (text-only)", () => {
      const result = renderPattern("progress", {
        title: "P",
        current: 1,
        total: 2,
      });

      expect(result.keyboard).toHaveLength(0);
    });
  });

  describe("info_grid", () => {
    it("renders key-value pairs in bold labels", () => {
      const result = renderPattern("info_grid", {
        title: "Server Info",
        items: [
          { label: "CPU", value: "85%" },
          { label: "Memory", value: "4.2 GB" },
          { label: "Disk", value: "120 GB" },
        ],
      });

      expect(result.html).toContain("<b>Server Info</b>");
      expect(result.html).toContain("<b>CPU</b>: 85%");
      expect(result.html).toContain("<b>Memory</b>: 4.2 GB");
      expect(result.html).toContain("<b>Disk</b>: 120 GB");
    });

    it("has no keyboard buttons (text-only)", () => {
      const result = renderPattern("info_grid", {
        title: "Info",
        items: [{ label: "K", value: "V" }],
      });

      expect(result.keyboard).toHaveLength(0);
    });

    it("escapes HTML in values", () => {
      const result = renderPattern("info_grid", {
        title: "Test",
        items: [{ label: "HTML", value: "<script>alert(1)</script>" }],
      });

      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });
  });

  describe("unknown pattern", () => {
    it("returns error message for unknown patterns", () => {
      const result = renderPattern("unknown_thing" as TelegramPatternType, {});
      expect(result.html).toContain("Unknown pattern");
      expect(result.keyboard).toHaveLength(0);
    });
  });

  describe("callback_data 64-byte constraint", () => {
    it("all interactive patterns produce callback_data ≤ 64 bytes", () => {
      const interactivePatterns: Array<{
        pattern: TelegramPatternType;
        params: Record<string, unknown>;
      }> = [
        {
          pattern: "multiple_choice",
          params: {
            question: "Q",
            options: Array.from({ length: 8 }, (_, i) => ({
              text: `Option ${i}`,
              value: `very_long_option_value_${i}_${"x".repeat(50)}`,
            })),
            actionIdPrefix: "long_action_id_prefix",
          },
        },
        {
          pattern: "confirmation",
          params: {
            title: "T",
            message: "M",
            actionIdPrefix: "a_very_long_action_id_prefix_here",
          },
        },
        {
          pattern: "task_proposal",
          params: {
            title: "T",
            description: "D",
            actionIdPrefix: "task_long_prefix",
            modifyLabel: "Modify",
          },
        },
        {
          pattern: "action_items",
          params: {
            title: "AI",
            items: Array.from({ length: 8 }, (_, i) => ({
              id: `item_${"x".repeat(60)}_${i}`,
              text: `Item ${i}`,
              completed: false,
            })),
            actionIdPrefix: "ai_long_prefix",
          },
        },
      ];

      for (const { pattern, params } of interactivePatterns) {
        const result = renderPattern(pattern, params);
        for (const row of result.keyboard) {
          for (const btn of row) {
            const bytes = Buffer.byteLength(btn.callback_data, "utf8");
            expect(bytes).toBeLessThanOrEqual(
              64,
              `Pattern "${pattern}" button "${btn.text}" callback_data is ${bytes} bytes (max 64)`,
            );
          }
        }
      }
    });
  });
});
