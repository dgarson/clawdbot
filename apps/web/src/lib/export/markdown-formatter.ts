/**
 * Markdown formatting utilities for conversation export.
 */

import type { Message, Conversation } from "@/stores/useConversationStore";

export interface MarkdownFormatOptions {
  includeTimestamps?: boolean;
  includeAgentNames?: boolean;
  agentName?: string;
}

/**
 * Format a timestamp as a human-readable date string
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get the display label for a message role
 */
function getRoleLabel(role: Message["role"], agentName?: string): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return agentName || "Assistant";
    case "system":
      return "System";
    default:
      return role;
  }
}

/**
 * Format a single message as markdown
 */
function formatMessage(
  message: Message,
  options: MarkdownFormatOptions
): string {
  const { includeTimestamps = true, includeAgentNames = true, agentName } = options;

  const roleLabel = includeAgentNames
    ? getRoleLabel(message.role, agentName)
    : message.role === "user" ? "User" : "Response";

  const lines: string[] = [];
  lines.push(`### ${roleLabel}`);
  lines.push("");
  lines.push(message.content);

  if (includeTimestamps && message.timestamp) {
    lines.push("");
    lines.push(`*${formatTimestamp(message.timestamp)}*`);
  }

  return lines.join("\n");
}

/**
 * Format an array of messages as markdown
 */
export function formatMessagesAsMarkdown(
  messages: Message[],
  options: MarkdownFormatOptions = {}
): string {
  return messages.map((msg) => formatMessage(msg, options)).join("\n\n---\n\n");
}

/**
 * Format a complete conversation as markdown
 */
export function formatConversationAsMarkdown(
  conversation: Conversation,
  messages: Message[],
  options: MarkdownFormatOptions = {}
): string {
  const { agentName } = options;

  const lines: string[] = [];

  // Header
  lines.push(`# ${conversation.title || "Conversation"}`);
  lines.push("");

  // Metadata
  const metadata: string[] = [];
  if (agentName) {
    metadata.push(`**Agent:** ${agentName}`);
  }
  if (conversation.createdAt) {
    metadata.push(`**Created:** ${formatTimestamp(conversation.createdAt)}`);
  }
  if (metadata.length > 0) {
    lines.push(metadata.join(" | "));
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Messages
  lines.push(formatMessagesAsMarkdown(messages, options));

  lines.push("");
  lines.push("---");
  lines.push("*Exported from Clawdbrain*");

  return lines.join("\n");
}
