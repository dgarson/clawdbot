/**
 * Conversation export utilities.
 *
 * Supports exporting conversations in JSON and Markdown formats.
 */

import type { Conversation, Message } from "@/stores/useConversationStore";
import { formatConversationAsMarkdown } from "./markdown-formatter";

export type ConversationExportFormat = "json" | "markdown";

export interface ExportedMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ExportedConversation {
  id: string;
  title: string;
  agentId?: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
  messages: ExportedMessage[];
}

export interface ConversationExport {
  version: "1.0";
  exportedAt: string;
  conversations: ExportedConversation[];
}

export interface ConversationExportOptions {
  includeTimestamps?: boolean;
  includeAgentNames?: boolean;
}

export interface ExportConversationsParams {
  conversations: Conversation[];
  getMessages: (conversationId: string) => Message[];
  getAgentName?: (agentId: string) => string | undefined;
  options?: ConversationExportOptions;
}

/**
 * Convert internal message to export format
 */
function toExportedMessage(message: Message): ExportedMessage {
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  };
}

/**
 * Convert internal conversation to export format
 */
function toExportedConversation(
  conversation: Conversation,
  messages: Message[],
  agentName?: string
): ExportedConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    agentId: conversation.agentId,
    agentName,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: messages.map(toExportedMessage),
  };
}

/**
 * Export multiple conversations as JSON
 */
export function exportConversations({
  conversations,
  getMessages,
  getAgentName,
}: ExportConversationsParams): ConversationExport {
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    conversations: conversations.map((conv) => {
      const messages = getMessages(conv.id);
      const agentName = conv.agentId ? getAgentName?.(conv.agentId) : undefined;
      return toExportedConversation(conv, messages, agentName);
    }),
  };
}

export interface ExportSingleConversationParams {
  conversation: Conversation;
  messages: Message[];
  agentName?: string;
  format: ConversationExportFormat;
  options?: ConversationExportOptions;
}

export interface SingleConversationExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

/**
 * Export a single conversation in the specified format
 */
export function exportSingleConversation({
  conversation,
  messages,
  agentName,
  format,
  options = {},
}: ExportSingleConversationParams): SingleConversationExportResult {
  const { includeTimestamps = true, includeAgentNames = true } = options;

  // Sanitize title for filename
  const sanitizedTitle = (conversation.title || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);

  const date = new Date().toISOString().split("T")[0];

  if (format === "markdown") {
    const content = formatConversationAsMarkdown(conversation, messages, {
      includeTimestamps,
      includeAgentNames,
      agentName,
    });

    return {
      content,
      filename: `${sanitizedTitle}-${date}.md`,
      mimeType: "text/markdown",
    };
  }

  // JSON format
  const exportData: ConversationExport = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    conversations: [toExportedConversation(conversation, messages, agentName)],
  };

  return {
    content: JSON.stringify(exportData, null, 2),
    filename: `${sanitizedTitle}-${date}.json`,
    mimeType: "application/json",
  };
}
