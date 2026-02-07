import { describe, expect, it } from "vitest";
import { extractTextFromClaudeAgentSdkEvent } from "./extract.js";

describe("extractTextFromClaudeAgentSdkEvent", () => {
  describe("thinking/reasoning block filtering", () => {
    it("filters out thinking blocks from content arrays", () => {
      const event = {
        content: [
          { type: "text", text: "Hello" },
          { type: "thinking", text: "This is my reasoning" },
          { type: "text", text: "World" },
        ],
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);

      expect(result).toBe("Hello\nWorld");
    });

    it("filters out reasoning blocks from content arrays", () => {
      const event = {
        content: [
          { type: "text", text: "Answer:" },
          { type: "reasoning", text: "Let me think about this" },
          { type: "text", text: "42" },
        ],
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);

      expect(result).toBe("Answer:\n42");
    });

    it("strips thinking tags from text content", () => {
      const event = {
        text: "<thinking>I should consider this</thinking>The answer is 42",
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);

      expect(result).toBe("The answer is 42");
    });

    it("strips thinking tags from nested content", () => {
      const event = {
        message: {
          content: [{ type: "text", text: "<think>reasoning here</think>Final answer" }],
        },
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);

      expect(result).toBe("Final answer");
    });

    it("handles mixed thinking blocks and tags", () => {
      const event = {
        content: [
          { type: "thinking", text: "Block thinking" },
          { type: "text", text: "<thinking>Tag thinking</thinking>Clean text" },
        ],
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);

      expect(result).toBe("Clean text");
    });
  });

  describe("basic text extraction", () => {
    it("extracts plain string events", () => {
      const result = extractTextFromClaudeAgentSdkEvent("Hello world");
      expect(result).toBe("Hello world");
    });

    it("extracts text from {text: ...} shape", () => {
      const result = extractTextFromClaudeAgentSdkEvent({ text: "Hello" });
      expect(result).toBe("Hello");
    });

    it("extracts text from {delta: ...} shape", () => {
      const result = extractTextFromClaudeAgentSdkEvent({ delta: "Hello" });
      expect(result).toBe("Hello");
    });

    it("extracts text from content array", () => {
      const event = {
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);
      expect(result).toBe("Hello\nWorld");
    });

    it("extracts text from message wrapper", () => {
      const event = {
        message: {
          content: [{ type: "text", text: "Hello" }],
        },
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);
      expect(result).toBe("Hello");
    });

    it("extracts text from data wrapper", () => {
      const event = {
        data: {
          content: [{ type: "text", text: "Hello" }],
        },
      };

      const result = extractTextFromClaudeAgentSdkEvent(event);
      expect(result).toBe("Hello");
    });

    it("returns undefined for empty events", () => {
      expect(extractTextFromClaudeAgentSdkEvent({})).toBeUndefined();
      expect(extractTextFromClaudeAgentSdkEvent(null)).toBeUndefined();
      expect(extractTextFromClaudeAgentSdkEvent(undefined)).toBeUndefined();
    });
  });
});
