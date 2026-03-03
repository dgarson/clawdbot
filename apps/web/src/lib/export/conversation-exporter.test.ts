/**
 * Tests for conversation export functionality.
 */
import { describe, it, expect } from "vitest";
import {
  exportConversations,
  exportSingleConversation,
} from "./conversation-exporter";
import type { Conversation, Message } from "@/stores/useConversationStore";

describe("exportConversations", () => {
  const mockConversations: Conversation[] = [
    {
      id: "conv-1",
      title: "Test Conversation 1",
      agentId: "agent-1",
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-15T11:00:00.000Z",
    },
    {
      id: "conv-2",
      title: "Test Conversation 2",
      createdAt: "2024-01-16T10:00:00.000Z",
      updatedAt: "2024-01-16T12:00:00.000Z",
    },
  ];

  const mockMessages: Record<string, Message[]> = {
    "conv-1": [
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
        content: "Hi there! How can I help?",
        timestamp: "2024-01-15T10:01:00.000Z",
      },
    ],
    "conv-2": [
      {
        id: "msg-3",
        conversationId: "conv-2",
        role: "user",
        content: "Question",
        timestamp: "2024-01-16T10:00:00.000Z",
      },
    ],
  };

  const getMessages = (id: string) => mockMessages[id] ?? [];
  const getAgentName = (id: string) => (id === "agent-1" ? "Test Agent" : undefined);

  describe("version and metadata", () => {
    it("includes version 1.0", () => {
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });

      expect(result.version).toBe("1.0");
    });

    it("includes exportedAt timestamp", () => {
      const before = new Date().toISOString();
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });
      const after = new Date().toISOString();

      expect(result.exportedAt >= before).toBe(true);
      expect(result.exportedAt <= after).toBe(true);
    });
  });

  describe("conversation export", () => {
    it("exports all conversations", () => {
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });

      expect(result.conversations).toHaveLength(2);
    });

    it("exports conversation metadata", () => {
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });

      const conv = result.conversations[0];
      expect(conv.id).toBe("conv-1");
      expect(conv.title).toBe("Test Conversation 1");
      expect(conv.agentId).toBe("agent-1");
      expect(conv.agentName).toBe("Test Agent");
      expect(conv.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(conv.updatedAt).toBe("2024-01-15T11:00:00.000Z");
    });

    it("exports messages for each conversation", () => {
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });

      expect(result.conversations[0].messages).toHaveLength(2);
      expect(result.conversations[1].messages).toHaveLength(1);
    });

    it("exports message content correctly", () => {
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });

      const msg = result.conversations[0].messages[0];
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello!");
      expect(msg.timestamp).toBe("2024-01-15T10:00:00.000Z");
    });

    it("handles conversations without agent", () => {
      const result = exportConversations({
        conversations: mockConversations,
        getMessages,
        getAgentName,
      });

      expect(result.conversations[1].agentId).toBeUndefined();
      expect(result.conversations[1].agentName).toBeUndefined();
    });

    it("handles empty conversations array", () => {
      const result = exportConversations({
        conversations: [],
        getMessages,
        getAgentName,
      });

      expect(result.conversations).toHaveLength(0);
    });
  });
});

describe("exportSingleConversation", () => {
  const mockConversation: Conversation = {
    id: "conv-1",
    title: "Research on Quantum Computing",
    agentId: "agent-1",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T11:00:00.000Z",
  };

  const mockMessages: Message[] = [
    {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "What is quantum computing?",
      timestamp: "2024-01-15T10:00:00.000Z",
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      role: "assistant",
      content: "Quantum computing uses quantum mechanics...",
      timestamp: "2024-01-15T10:01:00.000Z",
    },
  ];

  describe("JSON format", () => {
    it("returns JSON content type", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        agentName: "Test Agent",
        format: "json",
      });

      expect(result.mimeType).toBe("application/json");
    });

    it("generates .json filename", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "json",
      });

      expect(result.filename).toMatch(/^research-on-quantum-computing-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("returns valid JSON content", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "json",
      });

      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it("includes conversation data in JSON", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        agentName: "Test Agent",
        format: "json",
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe("1.0");
      expect(parsed.conversations).toHaveLength(1);
      expect(parsed.conversations[0].title).toBe("Research on Quantum Computing");
      expect(parsed.conversations[0].agentName).toBe("Test Agent");
    });
  });

  describe("Markdown format", () => {
    it("returns markdown content type", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "markdown",
      });

      expect(result.mimeType).toBe("text/markdown");
    });

    it("generates .md filename", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "markdown",
      });

      expect(result.filename).toMatch(/^research-on-quantum-computing-\d{4}-\d{2}-\d{2}\.md$/);
    });

    it("includes title in markdown", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "markdown",
      });

      expect(result.content).toContain("# Research on Quantum Computing");
    });

    it("includes messages in markdown", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "markdown",
      });

      expect(result.content).toContain("What is quantum computing?");
      expect(result.content).toContain("Quantum computing uses quantum mechanics...");
    });

    it("includes agent name when provided", () => {
      const result = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        agentName: "Claude Assistant",
        format: "markdown",
        options: { includeAgentNames: true },
      });

      expect(result.content).toContain("Claude Assistant");
    });

    it("respects includeTimestamps option", () => {
      const withTimestamps = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "markdown",
        options: { includeTimestamps: true },
      });

      const withoutTimestamps = exportSingleConversation({
        conversation: mockConversation,
        messages: mockMessages,
        format: "markdown",
        options: { includeTimestamps: false },
      });

      // With timestamps should have more content (the date strings)
      expect(withTimestamps.content.length).toBeGreaterThan(withoutTimestamps.content.length);
    });
  });

  describe("filename sanitization", () => {
    it("sanitizes special characters in filename", () => {
      const result = exportSingleConversation({
        conversation: {
          ...mockConversation,
          title: "What's the best way? Let's find out!",
        },
        messages: mockMessages,
        format: "json",
      });

      expect(result.filename).not.toContain("'");
      expect(result.filename).not.toContain("?");
      expect(result.filename).not.toContain("!");
    });

    it("handles very long titles", () => {
      const result = exportSingleConversation({
        conversation: {
          ...mockConversation,
          title: "A".repeat(100),
        },
        messages: mockMessages,
        format: "json",
      });

      // Filename should be truncated (50 chars max for title part)
      expect(result.filename.length).toBeLessThan(70);
    });

    it("handles empty title", () => {
      const result = exportSingleConversation({
        conversation: {
          ...mockConversation,
          title: "",
        },
        messages: mockMessages,
        format: "json",
      });

      expect(result.filename).toMatch(/^conversation-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });
});
