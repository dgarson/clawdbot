import type { WorkItemPriority } from "../work-queue/types.js";

export type EscalationIntent =
  | "prioritize"
  | "deep-dive"
  | "ingest"
  | "bookmark"
  | "summarize"
  | "urgent"
  | "evaluate";

export type SignalReaction = {
  emoji: string;
  aliases?: string[];
  intent: EscalationIntent;
  description: string;
  spawnsSession: boolean;
  defaultPriority: WorkItemPriority;
  agentPrompt?: string;
};

export type ReactionMessageContext = {
  text: string;
  authorId?: string;
  authorName?: string;
  channelId: string;
  channelName?: string;
  messageTs: string;
  threadTs?: string;
  permalink?: string;
  attachments?: Array<{ type: string; url?: string; text?: string }>;
};

export type EscalationWorkRef =
  | { kind: "session"; sessionKey: string; runId?: string }
  | { kind: "workItem"; itemId: string }
  | { kind: "memory"; entryId?: string }
  | { kind: "inline"; result: string };

export type EscalationOutcome = {
  id: string;
  intent: EscalationIntent;
  sourceChannel: string;
  sourceChannelId: string;
  sourceMessageTs: string;
  sourceThreadTs?: string;
  reactorUserId: string;
  reactorName?: string;
  dispatchedAt: number;
  workRef: EscalationWorkRef;
  completedAt?: number;
  status: "pending" | "processing" | "completed" | "failed";
  summary?: string;
  outcomePermalink?: string;
  outcomeMessageTs?: string;
  error?: string;
};

export type ReactionEscalationDispatch = {
  reaction: string;
  reactorUserId?: string;
  reactorName?: string;
  channelId: string;
  channelName?: string;
  messageTs: string;
  threadTs?: string;
  botUserId?: string;
};

export type ReactionEscalationAdapter = {
  fetchReactedMessage?: (params: {
    channelId: string;
    messageTs: string;
    threadTs?: string;
  }) => Promise<ReactionMessageContext | null>;
  postDigest?: (params: {
    channelId: string;
    summary: string;
    outcomeUrl?: string;
  }) => Promise<{ messageId: string } | null>;
  postOutcome?: (params: {
    channelId: string;
    messageTs: string;
    threadTs?: string;
    summary: string;
    outcomeUrl?: string;
  }) => Promise<{ messageId: string } | null>;
  buildPermalink?: (params: {
    channelId: string;
    messageTs: string;
    threadTs?: string;
  }) => Promise<string | null>;
  normalizeReaction?: (platformReaction: string) => string;
  addReaction?: (params: {
    channelId: string;
    messageTs: string;
    reaction: string;
  }) => Promise<void>;
  removeReaction?: (params: {
    channelId: string;
    messageTs: string;
    reaction: string;
  }) => Promise<void>;
};
