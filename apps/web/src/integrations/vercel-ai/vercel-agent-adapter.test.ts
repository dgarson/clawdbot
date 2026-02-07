/**
 * Tests for Vercel AI Agent Adapter
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { VercelAgentAdapter } from "./vercel-agent-adapter";
import type { Agent } from "@/stores/useAgentStore";

// Mock the agent package
vi.mock("@clawdbrain/vercel-ai-agent", () => ({
	createAgent: vi.fn(() => ({
		runStream: vi.fn(),
		run: vi.fn(),
		getConversationHistory: vi.fn(() => []),
		clearConversationHistory: vi.fn(),
	})),
	ConversationalAgent: vi.fn(),
}));

describe("VercelAgentAdapter", () => {
	let mockAgent: Agent;

	beforeEach(() => {
		mockAgent = {
			id: "test-agent",
			name: "Test Agent",
			claudeSdkOptions: { provider: "anthropic" },
			model: "claude-3-5-sonnet-20241022",
			role: "Assistant",
			status: "offline",
		} as Agent;

		vi.clearAllMocks();
	});

	describe("initialization", () => {
		it("should create adapter with OpenAI model config", () => {
			const config = {
				agent: {
					...mockAgent,
					model: "openai/gpt-4-turbo",
				},
			};

			const adapter = new VercelAgentAdapter(config);
			expect(adapter).toBeDefined();
		});

		it("should create adapter with Anthropic model config", () => {
			const config = {
				agent: mockAgent,
			};

			const adapter = new VercelAgentAdapter(config);
			expect(adapter).toBeDefined();
		});

		it("should default to Anthropic if provider not recognized", () => {
			const config = {
				agent: {
					...mockAgent,
					model: "unknown/whatever",
				},
			};

			const adapter = new VercelAgentAdapter(config);
			expect(adapter).toBeDefined();
		});
	});

	describe("sendMessage", () => {
		it("should handle streaming response with text deltas", async () => {
			const { createAgent } = await import("@clawdbrain/vercel-ai-agent");
			const mockRunStream = vi.fn();

			// Mock streaming chunks
			const chunks = [
				{ type: "text-delta", textDelta: "Hello" },
				{ type: "text-delta", textDelta: " world" },
				{ type: "finish" },
			];

			// Make the mock return an async iterator
			mockRunStream.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					for (const chunk of chunks) {
						yield chunk;
					}
				},
			});

			(createAgent as Mock).mockReturnValue({
				runStream: mockRunStream,
				getConversationHistory: vi.fn(() => []),
			});

			const adapter = new VercelAgentAdapter({ agent: mockAgent });

			const streamCallback = vi.fn();
			const completeCallback = vi.fn();

			await adapter.sendMessage({
				sessionKey: "test-session",
				message: "Hello",
				onStream: streamCallback,
				onComplete: completeCallback,
			});

			// Verify streaming callbacks were called
			expect(streamCallback).toHaveBeenCalledWith("Hello");
			expect(streamCallback).toHaveBeenCalledWith(" world");
			expect(completeCallback).toHaveBeenCalledWith("Hello world");
		});

		it("should handle tool calls in stream", async () => {
			const { createAgent } = await import("@clawdbrain/vercel-ai-agent");
			const mockRunStream = vi.fn();

			const toolCall = {
				id: "call_123",
				name: "testTool",
				arguments: { arg: "value" },
			};

			const chunks = [
				{ type: "text-delta", textDelta: "Using tool..." },
				{ type: "tool-call", toolCall },
				{ type: "text-delta", textDelta: " done" },
				{ type: "finish" },
			];

			mockRunStream.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					for (const chunk of chunks) {
						yield chunk;
					}
				},
			});

			(createAgent as Mock).mockReturnValue({
				runStream: mockRunStream,
				getConversationHistory: vi.fn(() => []),
			});

			const adapter = new VercelAgentAdapter({ agent: mockAgent });

			const toolCallCallback = vi.fn();
			const completeCallback = vi.fn();

			await adapter.sendMessage({
				sessionKey: "test-session",
				message: "Use a tool",
				onToolCall: toolCallCallback,
				onComplete: completeCallback,
			});

			// Verify tool call was handled
			expect(toolCallCallback).toHaveBeenCalledWith(toolCall);
			expect(completeCallback).toHaveBeenCalledWith("Using tool... done");
		});

		it("should handle errors gracefully", async () => {
			const { createAgent } = await import("@clawdbrain/vercel-ai-agent");
			const mockRunStream = vi.fn();

			const testError = new Error("Test error");
			mockRunStream.mockRejectedValue(testError);

			(createAgent as Mock).mockReturnValue({
				runStream: mockRunStream,
				getConversationHistory: vi.fn(() => []),
			});

			const adapter = new VercelAgentAdapter({ agent: mockAgent });

			const errorCallback = vi.fn();

			await expect(
				adapter.sendMessage({
					sessionKey: "test-session",
					message: "This will fail",
					onError: errorCallback,
				})
			).rejects.toThrow("Test error");

			expect(errorCallback).toHaveBeenCalledWith(testError);
		});

		it("should maintain session history correctly", async () => {
			const { createAgent } = await import("@clawdbrain/vercel-ai-agent");
			const mockRunStream = vi.fn();

			const chunks = [
				{ type: "text-delta", textDelta: "Response" },
				{ type: "finish" },
			];

			mockRunStream.mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					for (const chunk of chunks) {
						yield chunk;
					}
				},
			});

			(createAgent as Mock).mockReturnValue({
				runStream: mockRunStream,
				getConversationHistory: vi.fn(() => []),
			});

			const adapter = new VercelAgentAdapter({ agent: mockAgent });

			await adapter.sendMessage({
				sessionKey: "test-session",
				message: "First message",
				onComplete: vi.fn(),
			});

			await adapter.sendMessage({
				sessionKey: "test-session",
				message: "Second message",
				onComplete: vi.fn(),
			});

			const history = adapter.getHistory("test-session");

			expect(history).toHaveLength(4); // 2 user + 2 assistant messages
			expect(history[0].role).toBe("user");
			expect(history[0].content).toBe("First message");
			expect(history[1].role).toBe("assistant");
			expect(history[1].content).toBe("Response");
			expect(history[2].role).toBe("user");
			expect(history[2].content).toBe("Second message");
			expect(history[3].role).toBe("assistant");
			expect(history[3].content).toBe("Response");
		});
	});

	describe("session management", () => {
		it("should clear specific session history", async () => {
			const { createAgent } = await import("@clawdbrain/vercel-ai-agent");
			const mockRunStream = vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield { type: "text-delta", textDelta: "Response" };
					yield { type: "finish" };
				},
			});

			(createAgent as Mock).mockReturnValue({
				runStream: mockRunStream,
				getConversationHistory: vi.fn(() => []),
			});

			const adapter = new VercelAgentAdapter({ agent: mockAgent });

			await adapter.sendMessage({
				sessionKey: "session-1",
				message: "Message 1",
				onComplete: vi.fn(),
			});

			await adapter.sendMessage({
				sessionKey: "session-2",
				message: "Message 2",
				onComplete: vi.fn(),
			});

			expect(adapter.getHistory("session-1")).toHaveLength(2);
			expect(adapter.getHistory("session-2")).toHaveLength(2);

			adapter.clearHistory("session-1");

			expect(adapter.getHistory("session-1")).toHaveLength(0);
			expect(adapter.getHistory("session-2")).toHaveLength(2);
		});

		it("should clear all session histories", async () => {
			const { createAgent } = await import("@clawdbrain/vercel-ai-agent");
			const mockRunStream = vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: async function* () {
					yield { type: "text-delta", textDelta: "Response" };
					yield { type: "finish" };
				},
			});

			(createAgent as Mock).mockReturnValue({
				runStream: mockRunStream,
				getConversationHistory: vi.fn(() => []),
			});

			const adapter = new VercelAgentAdapter({ agent: mockAgent });

			await adapter.sendMessage({
				sessionKey: "session-1",
				message: "Message 1",
				onComplete: vi.fn(),
			});

			await adapter.sendMessage({
				sessionKey: "session-2",
				message: "Message 2",
				onComplete: vi.fn(),
			});

			adapter.clearAllHistories();

			expect(adapter.getHistory("session-1")).toHaveLength(0);
			expect(adapter.getHistory("session-2")).toHaveLength(0);
		});
	});
});
