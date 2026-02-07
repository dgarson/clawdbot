import { describe, expect, it, vi } from "vitest";
import {
  stripHeartbeatTokens,
  stripThinkingTags,
  normalizeWhitespace,
  isSilentReply,
  deduplicateReplies,
  applyBlockChunking,
  normalizeText,
  normalizePayload,
  normalizeStreamingText,
  type BlockChunkingConfig,
} from "./normalization.js";

describe("normalization", () => {
  describe("stripHeartbeatTokens", () => {
    it("should return unchanged text without heartbeat token", () => {
      const result = stripHeartbeatTokens("Hello world");
      expect(result.text).toBe("Hello world");
      expect(result.didStrip).toBe(false);
      expect(result.shouldSkip).toBe(false);
    });

    it("should strip heartbeat token at start", () => {
      const result = stripHeartbeatTokens("HEARTBEAT_OK Hello");
      expect(result.text).toBe("Hello");
      expect(result.didStrip).toBe(true);
      expect(result.shouldSkip).toBe(false);
    });

    it("should strip heartbeat token at end", () => {
      const result = stripHeartbeatTokens("Hello HEARTBEAT_OK");
      expect(result.text).toBe("Hello");
      expect(result.didStrip).toBe(true);
      expect(result.shouldSkip).toBe(false);
    });

    it("should skip if only heartbeat token", () => {
      const result = stripHeartbeatTokens("HEARTBEAT_OK");
      expect(result.text).toBe("");
      expect(result.didStrip).toBe(true);
      expect(result.shouldSkip).toBe(true);
    });

    it("should call onStrip callback when stripping", () => {
      const onStrip = vi.fn();
      stripHeartbeatTokens("HEARTBEAT_OK Hello", onStrip);
      expect(onStrip).toHaveBeenCalled();
    });

    it("should not call onStrip when not stripping", () => {
      const onStrip = vi.fn();
      stripHeartbeatTokens("Hello world", onStrip);
      expect(onStrip).not.toHaveBeenCalled();
    });

    it("should handle empty string", () => {
      const result = stripHeartbeatTokens("");
      expect(result.text).toBe("");
      expect(result.didStrip).toBe(false);
      expect(result.shouldSkip).toBe(true);
    });
  });

  describe("stripThinkingTags", () => {
    it("should return unchanged text without thinking tags", () => {
      expect(stripThinkingTags("Hello world")).toBe("Hello world");
    });

    it("should strip <thinking> tags", () => {
      const input = "<thinking>internal thought</thinking>Hello world";
      expect(stripThinkingTags(input)).toBe("Hello world");
    });

    it("should strip <thought> tags", () => {
      const input = "<thought>internal thought</thought>Hello world";
      expect(stripThinkingTags(input)).toBe("Hello world");
    });

    it("should strip <antThinking> tags", () => {
      const input = "<antThinking>internal thought</antThinking>Hello world";
      expect(stripThinkingTags(input)).toBe("Hello world");
    });

    it("should strip <final> tags", () => {
      const input = "<final>content</final>Hello world";
      // Final tags are just removed, content stays in place
      expect(stripThinkingTags(input)).toBe("contentHello world");
    });

    it("should preserve thinking tags inside code blocks", () => {
      const input = "```\n<thinking>code example</thinking>\n```";
      expect(stripThinkingTags(input)).toBe("```\n<thinking>code example</thinking>\n```");
    });

    it("should handle nested tags", () => {
      const input = "<thinking>outer<thinking>inner</thinking></thinking>Hello";
      const result = stripThinkingTags(input);
      expect(result).toBe("Hello");
    });

    it("should handle empty string", () => {
      expect(stripThinkingTags("")).toBe("");
    });
  });

  describe("normalizeWhitespace", () => {
    it("should trim whitespace", () => {
      expect(normalizeWhitespace("  Hello  ")).toBe("Hello");
    });

    it("should return empty string for whitespace-only", () => {
      expect(normalizeWhitespace("   \n\t  ")).toBe("");
    });

    it("should handle empty string", () => {
      expect(normalizeWhitespace("")).toBe("");
    });

    it("should preserve internal whitespace", () => {
      expect(normalizeWhitespace("  Hello  World  ")).toBe("Hello  World");
    });
  });

  describe("isSilentReply", () => {
    it("should detect NO_REPLY token at start", () => {
      expect(isSilentReply("NO_REPLY")).toBe(true);
    });

    it("should detect NO_REPLY with trailing text", () => {
      expect(isSilentReply("NO_REPLY ignored")).toBe(true);
    });

    it("should detect NO_REPLY at end", () => {
      expect(isSilentReply("something NO_REPLY")).toBe(true);
    });

    it("should not detect NO_REPLY in middle of word", () => {
      expect(isSilentReply("SONO_REPLY")).toBe(false);
    });

    it("should support custom silent token", () => {
      expect(isSilentReply("SILENT", "SILENT")).toBe(true);
    });

    it("should return false for normal text", () => {
      expect(isSilentReply("Hello world")).toBe(false);
    });
  });

  describe("deduplicateReplies", () => {
    it("should return empty for empty inputs", () => {
      expect(deduplicateReplies([], [])).toBe("");
    });

    it("should concatenate partials when no blocks", () => {
      const result = deduplicateReplies(["Hello", " world"], []);
      expect(result).toBe("Hello world");
    });

    it("should join blocks when no partials", () => {
      const result = deduplicateReplies([], ["Block 1", "Block 2"]);
      expect(result).toBe("Block 1\n\nBlock 2");
    });

    it("should remove duplicate partials that match blocks", () => {
      const result = deduplicateReplies(["Hello", "World"], ["Hello"]);
      expect(result).toContain("World");
      expect(result).toContain("Hello");
    });

    it("should be case-insensitive for deduplication", () => {
      const result = deduplicateReplies(["HELLO"], ["hello"]);
      // Should not have duplicate
      expect(result.toLowerCase().split("hello").length - 1).toBe(1);
    });
  });

  describe("applyBlockChunking", () => {
    const defaultConfig: BlockChunkingConfig = {
      minChars: 50,
      maxChars: 200,
      breakPreference: "paragraph",
    };

    it("should return single chunk for short text", () => {
      const chunks = applyBlockChunking("Hello world", defaultConfig);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe("Hello world");
    });

    it("should return empty array for empty text", () => {
      const chunks = applyBlockChunking("", defaultConfig);
      expect(chunks).toHaveLength(0);
    });

    it("should split at paragraph boundaries", () => {
      const text =
        "First paragraph here.\n\nSecond paragraph here with more text to make it longer.\n\nThird paragraph.";
      const config: BlockChunkingConfig = {
        minChars: 10,
        maxChars: 80,
        breakPreference: "paragraph",
      };
      const chunks = applyBlockChunking(text, config);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toContain("First paragraph");
    });

    it("should split at newline boundaries", () => {
      const text = "Line 1 with some text\nLine 2 with more text\nLine 3 with even more text";
      const config: BlockChunkingConfig = {
        minChars: 10,
        maxChars: 40,
        breakPreference: "newline",
      };
      const chunks = applyBlockChunking(text, config);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should split at sentence boundaries", () => {
      const text =
        "First sentence here. Second sentence with more words. Third sentence at the end.";
      const config: BlockChunkingConfig = {
        minChars: 10,
        maxChars: 50,
        breakPreference: "sentence",
      };
      const chunks = applyBlockChunking(text, config);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should fall back to word boundary", () => {
      const text = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10";
      const config: BlockChunkingConfig = {
        minChars: 10,
        maxChars: 30,
        breakPreference: "paragraph",
      };
      const chunks = applyBlockChunking(text, config);
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should not end with a partial word
      // (i.e., should break at word boundaries)
      chunks.forEach((chunk) => {
        // Should not end mid-word (trailing letters without space)
        expect(chunk).not.toMatch(/word\d[a-z]+$/);
      });
    });
  });

  describe("normalizeText", () => {
    it("should return shouldSkip=true for empty input", () => {
      const result = normalizeText("");
      expect(result.shouldSkip).toBe(true);
      expect(result.text).toBe("");
    });

    it("should return shouldSkip=true for undefined input", () => {
      const result = normalizeText(undefined);
      expect(result.shouldSkip).toBe(true);
      expect(result.text).toBe("");
    });

    it("should normalize text with all rules", () => {
      const input = "HEARTBEAT_OK <thinking>thought</thinking> Hello world";
      const result = normalizeText(input);
      expect(result.text).toBe("Hello world");
      expect(result.didNormalize).toBe(true);
      expect(result.didStripHeartbeat).toBe(true);
      expect(result.didStripThinking).toBe(true);
    });

    it("should skip silent replies", () => {
      const result = normalizeText("NO_REPLY");
      expect(result.shouldSkip).toBe(true);
    });

    it("should call onHeartbeatStrip callback", () => {
      const onHeartbeatStrip = vi.fn();
      normalizeText("HEARTBEAT_OK Hello", { onHeartbeatStrip });
      expect(onHeartbeatStrip).toHaveBeenCalled();
    });

    it("should respect stripHeartbeat=false option", () => {
      const result = normalizeText("HEARTBEAT_OK Hello", { stripHeartbeat: false });
      expect(result.text).toContain("HEARTBEAT_OK");
      expect(result.didStripHeartbeat).toBe(false);
    });

    it("should respect stripThinking=false option", () => {
      const result = normalizeText("<thinking>thought</thinking>Hello", { stripThinking: false });
      expect(result.text).toContain("<thinking>");
    });

    it("should respect stripSilent=false option", () => {
      const result = normalizeText("NO_REPLY test", { stripSilent: false });
      expect(result.shouldSkip).toBe(false);
    });

    it("should handle whitespace-only result after normalization", () => {
      const result = normalizeText("HEARTBEAT_OK   ");
      expect(result.shouldSkip).toBe(true);
    });
  });

  describe("normalizePayload", () => {
    it("should return null for empty payload", () => {
      const result = normalizePayload({ text: "" });
      expect(result).toBeNull();
    });

    it("should normalize text in payload", () => {
      const result = normalizePayload({ text: "<thinking>thought</thinking>Hello" });
      expect(result).not.toBeNull();
      expect(result?.text).toBe("Hello");
    });

    it("should preserve media even with empty text", () => {
      const result = normalizePayload({ text: "", mediaUrl: "https://example.com/image.png" });
      expect(result).not.toBeNull();
      expect(result?.mediaUrl).toBe("https://example.com/image.png");
    });

    it("should preserve media with mediaUrls array", () => {
      const result = normalizePayload({ text: "", mediaUrls: ["https://example.com/1.png"] });
      expect(result).not.toBeNull();
    });

    it("should preserve channelData even with empty text", () => {
      const result = normalizePayload({ text: "", channelData: { custom: "data" } });
      expect(result).not.toBeNull();
    });
  });

  describe("normalizeStreamingText", () => {
    it("should return skip=true for empty input", () => {
      const result = normalizeStreamingText("");
      expect(result.skip).toBe(true);
      expect(result.text).toBeUndefined();
    });

    it("should return normalized text", () => {
      const result = normalizeStreamingText("<thinking>thought</thinking>Hello");
      expect(result.skip).toBe(false);
      expect(result.text).toBe("Hello");
    });

    it("should return skip=true for silent reply", () => {
      const result = normalizeStreamingText("NO_REPLY");
      expect(result.skip).toBe(true);
    });

    it("should pass through normalization options", () => {
      const onHeartbeatStrip = vi.fn();
      normalizeStreamingText("HEARTBEAT_OK Hello", { onHeartbeatStrip });
      expect(onHeartbeatStrip).toHaveBeenCalled();
    });
  });
});
