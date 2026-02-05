/**
 * Recall conversation tool for voice calls.
 *
 * Enables progressive disclosure when conversation history is truncated.
 * The agent can search earlier parts of the call that were dropped from context.
 */

export type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string | unknown;
};

export type RecallConversationParams = {
  query: string;
  limit?: number;
};

export type RecallToolContext = {
  /** Full session history (not truncated) */
  fullHistory: AgentMessage[];
};

/**
 * Search conversation history for relevant context.
 * Returns matching turns based on keyword/phrase matching.
 */
export function searchConversationHistory(
  history: AgentMessage[],
  query: string,
  limit = 5,
): AgentMessage[] {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(Boolean);

  if (keywords.length === 0) {
    return [];
  }

  // Score each message by keyword matches
  const scored = history.map((msg, index) => {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const contentLower = content.toLowerCase();

    let score = 0;
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        score += 1;
      }
    }
    return { msg, score, index };
  });

  // Filter, sort by score (descending), then by position (ascending)
  const results = scored
    .filter((item) => item.score > 0)
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);

  return results.map((item) => item.msg);
}

/**
 * Format matched messages for agent context.
 */
export function formatMatchesForContext(matches: AgentMessage[]): string {
  if (matches.length === 0) {
    return "No relevant information found in earlier conversation.";
  }

  const formatted = matches.map((msg, i) => {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const truncated = content.length > 500 ? content.slice(0, 500) + "..." : content;
    return `[${i + 1}] ${msg.role}: ${truncated}`;
  });

  return `Found ${matches.length} relevant turn(s) from earlier in the call:\n\n${formatted.join("\n\n")}`;
}

/**
 * Tool definition for recall_conversation.
 */
export const recallConversationToolDefinition = {
  name: "recall_conversation",
  description:
    "Search earlier parts of this phone call for specific topics or information " +
    "that may have been truncated from your immediate context. Use this when the " +
    "caller references something you don't have context for.",
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string" as const,
        description:
          "What to search for in the conversation history (e.g., 'account number', " +
          "'address mentioned', 'the issue they described')",
      },
      limit: {
        type: "number" as const,
        description: "Maximum number of matching turns to return (default: 5)",
      },
    },
    required: ["query"] as const,
  },
};

/**
 * Create the recall_conversation tool executor.
 * Returns a function that accepts unknown params (for interface compatibility)
 * and handles type validation internally.
 */
export function createRecallConversationExecutor(context: RecallToolContext) {
  return async (params: unknown): Promise<string> => {
    // Validate and extract params
    const p = params as RecallConversationParams;
    const query = typeof p?.query === "string" ? p.query : "";
    const limit = typeof p?.limit === "number" ? p.limit : 5;

    if (!query) {
      return "No query provided. Please specify what to search for.";
    }

    const matches = searchConversationHistory(context.fullHistory, query, limit);
    return formatMatchesForContext(matches);
  };
}
