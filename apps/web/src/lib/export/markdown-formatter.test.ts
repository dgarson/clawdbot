/**
 * Tests for markdown formatting utilities.
 */
import { describe, it, expect } from "vitest";
import {
  formatConversationAsMarkdown,
  formatMessagesAsMarkdown,
} from "./markdown-formatter";
import type { Conversation, Message } from "@/stores/useConversationStore";

describe("formatMessagesAsMarkdown", () => {
  const mockMessages: Message[] = [
    {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "What is the meaning of life?",
      timestamp: "2024-01-15T10:00:00.000Z",
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      role: "assistant",
      content: "That's a profound question! The meaning of life is often considered to be 42.",
      timestamp: "2024-01-15T10:01:00.000Z",
    },
    {
      id: "msg-3",
      conversationId: "conv-1",
      role: "system",
      content: "You are a helpful assistant.",
      timestamp: "2024-01-15T09:59:00.000Z",
    },
  ];

  it("formats each message with role heading", () => {
    const result = formatMessagesAsMarkdown(mockMessages);

    expect(result).toContain("### User");
    expect(result).toContain("### Assistant");
    expect(result).toContain("### System");
  });

  it("includes message content", () => {
    const result = formatMessagesAsMarkdown(mockMessages);

    expect(result).toContain("What is the meaning of life?");
    expect(result).toContain("That's a profound question!");
    expect(result).toContain("You are a helpful assistant.");
  });

  it("includes timestamps by default", () => {
    const result = formatMessagesAsMarkdown(mockMessages);

    // Should contain formatted dates
    expect(result).toContain("January");
    expect(result).toContain("2024");
  });

  it("excludes timestamps when option is false", () => {
    const result = formatMessagesAsMarkdown(mockMessages, { includeTimestamps: false });

    // Should not contain the timestamp formatting
    expect(result).not.toContain("*January");
  });

  it("uses agent name when provided", () => {
    const result = formatMessagesAsMarkdown(mockMessages, {
      includeAgentNames: true,
      agentName: "Claude",
    });

    expect(result).toContain("### Claude");
    expect(result).not.toContain("### Assistant");
  });

  it("separates messages with horizontal rules", () => {
    const result = formatMessagesAsMarkdown(mockMessages);

    expect(result).toContain("---");
  });

  it("handles empty messages array", () => {
    const result = formatMessagesAsMarkdown([]);

    expect(result).toBe("");
  });

  it("handles single message", () => {
    const result = formatMessagesAsMarkdown([mockMessages[0]]);

    expect(result).toContain("### User");
    expect(result).toContain("What is the meaning of life?");
    expect(result).not.toContain("---\n\n###"); // No separator needed
  });
});

describe("formatConversationAsMarkdown", () => {
  const mockConversation: Conversation = {
    id: "conv-1",
    title: "Discussion about Life",
    agentId: "agent-1",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T11:00:00.000Z",
  };

  const mockMessages: Message[] = [
    {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "Hello!",
      timestamp: "2024-01-15T10:00:00.000Z",
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      role: "assistant",
      content: "Hi there!",
      timestamp: "2024-01-15T10:01:00.000Z",
    },
  ];

  it("includes conversation title as H1", () => {
    const result = formatConversationAsMarkdown(mockConversation, mockMessages);

    expect(result).toContain("# Discussion about Life");
  });

  it("includes agent name in metadata", () => {
    const result = formatConversationAsMarkdown(mockConversation, mockMessages, {
      agentName: "Claude Assistant",
    });

    expect(result).toContain("**Agent:** Claude Assistant");
  });

  it("includes created date in metadata", () => {
    const result = formatConversationAsMarkdown(mockConversation, mockMessages);

    expect(result).toContain("**Created:**");
    expect(result).toContain("January");
  });

  it("includes all messages", () => {
    const result = formatConversationAsMarkdown(mockConversation, mockMessages);

    expect(result).toContain("Hello!");
    expect(result).toContain("Hi there!");
  });

  it("includes export footer", () => {
    const result = formatConversationAsMarkdown(mockConversation, mockMessages);

    expect(result).toContain("*Exported from Clawdbrain*");
  });

  it("handles conversation without title", () => {
    const noTitle: Conversation = { ...mockConversation, title: "" };
    const result = formatConversationAsMarkdown(noTitle, mockMessages);

    expect(result).toContain("# Conversation");
  });

  it("handles empty messages", () => {
    const result = formatConversationAsMarkdown(mockConversation, []);

    expect(result).toContain("# Discussion about Life");
    expect(result).toContain("*Exported from Clawdbrain*");
  });

  it("respects includeTimestamps option", () => {
    const withTimestamps = formatConversationAsMarkdown(mockConversation, mockMessages, {
      includeTimestamps: true,
    });
    const withoutTimestamps = formatConversationAsMarkdown(mockConversation, mockMessages, {
      includeTimestamps: false,
    });

    expect(withTimestamps.length).toBeGreaterThan(withoutTimestamps.length);
  });

  it("respects includeAgentNames option", () => {
    const withAgentName = formatConversationAsMarkdown(mockConversation, mockMessages, {
      includeAgentNames: true,
      agentName: "Claude",
    });

    expect(withAgentName).toContain("### Claude");
  });
});
