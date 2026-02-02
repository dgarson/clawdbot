/**
 * Vercel AI Agent Adapter
 * Provides a drop-in replacement for gateway chat functionality using Vercel AI SDK
 */

import { ConversationalAgent, createAgent } from "@clawdbrain/vercel-ai-agent";
import type { Agent } from "@/stores/useAgentStore";
import type { ChatMessage } from "@/lib/api/sessions";

/** Tool call shape - compatible with both Vercel AI SDK and gateway ToolCall */
export interface VercelToolCall {
  id: string;  // Required to match gateway ToolCall
  toolCallId?: string;
  name: string;  // Required to match gateway ToolCall
  toolName?: string;
  arguments?: Record<string, unknown>;
  args?: Record<string, unknown>;
  // Gateway ToolCall compatibility fields (optional for Vercel AI)
  status?: "running" | "done" | "error";
  input?: string;
  output?: string;
  duration?: string;
  progress?: number;
}

export interface VercelAgentConfig {
  agent: Agent;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
  };
}

export interface SendMessageOptions {
  sessionKey: string;
  message: string;
  onStream?: (content: string) => void;
  onToolCall?: (toolCall: VercelToolCall) => void;
  onComplete?: (finalContent: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Adapter class that wraps Vercel AI SDK agent to match gateway interface
 */
export class VercelAgentAdapter {
  private conversationalAgent: ConversationalAgent | null = null;
  private config: VercelAgentConfig;

  // Track conversation history per session
  private sessionHistories: Map<string, ChatMessage[]> = new Map();

  constructor(config: VercelAgentConfig) {
    this.config = config;
    this.initializeAgent();
  }

  private initializeAgent() {
    try {
      const modelConfig = this.getModelConfig(this.config.agent);

      // Create agent with v5 configuration
      this.conversationalAgent = createAgent({
        model: modelConfig,
        tools: {}, // TODO: Add tool support
        systemPrompt: undefined, // TODO: Add system prompt support
        defaultExecutionConfig: {
          maxSteps: 10,
          stream: false,
        },
      });
    } catch (error) {
      console.error("Failed to initialize Vercel AI agent:", error);
      throw error;
    }
  }

  private getModelConfig(agent: Agent) {
    // Map gateway provider/model to v5 ModelConfig
    const model = agent.model || "";
    const providerFromModel = model.split("/")[0]?.toLowerCase();
    const provider = providerFromModel || agent.claudeSdkOptions?.provider?.toLowerCase() || "anthropic";
    const modelIdFromModel = model.includes("/") ? model.split("/").slice(1).join("/") : model;

    if (provider === "openai" || modelIdFromModel.includes("gpt")) {
      return {
        provider: "openai" as const,
        modelId: modelIdFromModel || "gpt-4-turbo",
      };
    }

    if (provider === "anthropic" || modelIdFromModel.includes("claude")) {
      return {
        provider: "anthropic" as const,
        modelId: modelIdFromModel || "claude-3-5-sonnet-20241022",
      };
    }

    // Default to Anthropic
    return {
      provider: "anthropic" as const,
      modelId: "claude-3-5-sonnet-20241022",
    };
  }

  /**
   * Send a message and handle streaming response
   */
  async sendMessage(options: SendMessageOptions): Promise<void> {
    const { sessionKey, message, onStream, onToolCall, onComplete, onError } = options;

    if (!this.conversationalAgent) {
      const error = new Error("Conversational agent not initialized");
      onError?.(error);
      throw error;
    }

    try {
      // Get session history
      const history = this.sessionHistories.get(sessionKey) || [];

      // Add user message to history
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
      };
      history.push(userMessage);

      // Run the agent with streaming (v5 format)
      const stream = await this.conversationalAgent.runStream({
        messages: message,
        executionConfig: {
          stream: true,
        },
      });

      let accumulatedContent = "";

      // Process stream
      for await (const chunk of stream) {
        if (chunk.type === "text-delta" && chunk.textDelta) {
          accumulatedContent += chunk.textDelta;
          onStream?.(chunk.textDelta);
        } else if (chunk.type === "tool-call" && chunk.toolCall) {
          // Handle tool calls
          onToolCall?.(chunk.toolCall);
        } else if (chunk.type === "step-finish" && chunk.stepResult) {
          // Handle step completion (can access tool results here if needed)
          if (chunk.stepResult.toolCalls && chunk.stepResult.toolCalls.length > 0) {
            for (const toolCall of chunk.stepResult.toolCalls) {
              onToolCall?.(toolCall);
            }
          }
        }
      }

      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: accumulatedContent,
      };
      history.push(assistantMessage);

      // Update session history
      this.sessionHistories.set(sessionKey, history);

      // Notify completion
      onComplete?.(accumulatedContent);
    } catch (error) {
      console.error("Vercel AI agent error:", error);
      onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Get chat history for a session
   */
  getHistory(sessionKey: string): ChatMessage[] {
    return this.sessionHistories.get(sessionKey) || [];
  }

  /**
   * Clear session history
   */
  clearHistory(sessionKey: string): void {
    this.sessionHistories.delete(sessionKey);
  }

  /**
   * Clear all sessions
   */
  clearAllHistories(): void {
    this.sessionHistories.clear();
  }
}
