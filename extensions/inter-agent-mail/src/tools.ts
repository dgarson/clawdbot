/**
 * Agent tools for the inter-agent mail system.
 *
 * Tool surface:
 *   mail        — unified inbox/ack/send/forward/recipients (always enabled when allowlisted)
 *   bounce_mail — opt-in return-to-sender with reason + confidence (separate allowlist entry)
 *
 * Security invariants:
 *  - Sender identity always comes from ctx.agentId — never from params.
 *  - Agents can never read mail content without the message entering "processing" state.
 *  - Routing rules are enforced before any write.
 *  - Mailbox ACLs are enforced before any read.
 *  - Deleted messages are never returned regardless of caller or params.
 *  - "peek" delegates get a read-only view; no status is changed.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawPluginToolContext } from "../../../src/plugins/types.js";
import {
  DEFAULT_PROCESSING_TTL_MS,
  MAIL_URGENCY_LEVELS,
  type MailUrgency,
  type ResolvedInterAgentMailConfig,
  isRoutingAllowed,
  resolveDeliveryPolicy,
  resolveMailboxAcl,
} from "./config.js";
import { formatContacts, resolveContacts } from "./contacts.js";
import { setLastInboxClaimedCount } from "./enforcement.js";
import {
  ackMessages,
  appendMessage,
  claimUnread,
  mailboxPath,
  newMessageId,
  peekMessages,
  readMailbox,
  softDeleteMessages,
  type MailMessage,
  type MessageStatus,
} from "./store.js";

// ============================================================================
// Shared schema helpers (self-contained — no core imports)
// ============================================================================

function urgencyEnum() {
  return Type.Unsafe<MailUrgency>({
    type: "string",
    enum: [...MAIL_URGENCY_LEVELS],
    description: "Message urgency level. 'urgent' wakes the recipient immediately if enabled.",
  });
}

function requireAgentId(ctx: OpenClawPluginToolContext): string {
  const id = ctx.agentId?.trim();
  if (!id) {
    throw new Error(
      "inter-agent-mail: agent identity not available in this context. " +
        "This tool can only be used by an active agent session.",
    );
  }
  return id;
}

/** Optional string param — null when absent or blank. */
function readStr(params: Record<string, unknown>, key: string): string | null {
  const raw = params[key];
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

/** Required string param — throws when absent or blank. */
function requireStr(params: Record<string, unknown>, key: string): string {
  const val = readStr(params, key);
  if (!val) throw new Error(`${key} is required`);
  return val;
}

function readStringArray(params: Record<string, unknown>, key: string): string[] | null {
  const raw = params[key];
  if (!Array.isArray(raw)) return null;
  const items = raw.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return items.length > 0 ? items : null;
}

function readBool(params: Record<string, unknown>, key: string, def: boolean): boolean {
  const raw = params[key];
  return typeof raw === "boolean" ? raw : def;
}

// ============================================================================
// Shared wakeup helper
// ============================================================================

type ApiRuntime = {
  system?: {
    enqueueSystemEvent?: (opts: {
      agentId: string;
      event: string;
      wakeMode?: string;
    }) => Promise<void>;
  };
};

async function maybeWakeRecipient(
  api: { runtime?: ApiRuntime },
  agentId: string,
  urgency: MailUrgency,
  config: ResolvedInterAgentMailConfig,
): Promise<void> {
  if (urgency !== "urgent") return;
  const policy = resolveDeliveryPolicy(config, agentId);
  if (!policy.wakeOnUrgent) return;
  try {
    await api.runtime?.system?.enqueueSystemEvent?.({
      agentId,
      event: "mail.urgent",
      wakeMode: "now",
    });
  } catch {
    // Non-fatal — delivery still succeeded, wake is best-effort
  }
}

// ============================================================================
// Unified "mail" tool
// ============================================================================

const MAIL_ACTIONS = ["inbox", "ack", "send", "forward", "recipients"] as const;
type MailAction = (typeof MAIL_ACTIONS)[number];

const MailToolSchema = Type.Object({
  action: Type.Unsafe<MailAction>({
    type: "string",
    enum: [...MAIL_ACTIONS],
    description:
      "inbox: claim unread messages as in-progress (must ack when done). " +
      "ack: mark in-progress messages as fully processed (provide message_ids). " +
      "send: send a new message (requires to_agent_id, subject, body). " +
      "forward: route a message with lineage chain preserved (requires message_id, to_agent_id). " +
      "recipients: list agents you can send to with optional fuzzy search.",
  }),

  // inbox params
  filter_urgency: Type.Optional(
    Type.Array(urgencyEnum(), {
      description: "Only claim messages matching these urgency levels.",
    }),
  ),
  filter_tags: Type.Optional(
    Type.Array(Type.String(), {
      description: "Only claim messages containing at least one of these tags.",
    }),
  ),
  include_stale: Type.Optional(
    Type.Boolean({
      description:
        "Also return messages already in 'processing' state (from a prior run that hasn't yet expired). " +
        "Does not re-claim them. Useful after a crash to see what was being handled.",
    }),
  ),

  // ack params
  message_ids: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "IDs of messages to ack (action='ack') or forward (action='forward' uses message_id instead).",
    }),
  ),

  // send / forward params
  to_agent_id: Type.Optional(Type.String({ description: "Recipient agent id." })),
  subject: Type.Optional(Type.String({ description: "Message subject line." })),
  body: Type.Optional(Type.String({ description: "Message body." })),
  urgency: Type.Optional(urgencyEnum()),
  tags: Type.Optional(
    Type.Array(Type.String(), { description: "Classification tags for filtering and routing." }),
  ),

  // forward params
  message_id: Type.Optional(
    Type.String({ description: "ID of the message to forward (action='forward')." }),
  ),
  notes: Type.Optional(
    Type.String({ description: "Context note prepended to the forwarded message." }),
  ),

  // mailbox_id — used for delegate access; defaults to caller's own mailbox
  mailbox_id: Type.Optional(
    Type.String({
      description:
        "Mailbox owner agent id. Defaults to your own. Requires an ACL grant from the owner.",
    }),
  ),

  // recipients params
  search: Type.Optional(
    Type.String({ description: "Fuzzy substring search on agent id or display name." }),
  ),
});

export function createMailTool(deps: {
  stateDir: string;
  config: ResolvedInterAgentMailConfig;
  api: { runtime?: ApiRuntime };
}) {
  const { stateDir, config, api } = deps;

  return {
    name: "mail",
    description:
      "Manage your inter-agent mail inbox and communicate with other agents.\n" +
      "action='inbox'  — Claim unread messages as in-progress; you MUST ack them when done.\n" +
      "action='ack'    — Mark in-progress messages as fully processed. Requires message_ids.\n" +
      "action='send'   — Send a new message. Requires to_agent_id, subject, body.\n" +
      "action='forward'— Route a message to another agent with the lineage chain preserved. Requires message_id, to_agent_id.\n" +
      "action='recipients' — List agents you can send mail to; fuzzy-search by name or id with search.",
    schema: MailToolSchema,
    async execute(
      params: Record<string, unknown>,
      ctx: OpenClawPluginToolContext,
    ): Promise<string> {
      const callerAgentId = requireAgentId(ctx);
      const action = requireStr(params, "action") as MailAction;

      switch (action) {
        case "inbox":
          return handleInbox(params, callerAgentId, stateDir, config, ctx);
        case "ack":
          return handleAck(params, callerAgentId, stateDir, config);
        case "send":
          return handleSend(params, callerAgentId, stateDir, config, api);
        case "forward":
          return handleForward(params, callerAgentId, stateDir, config, api);
        case "recipients":
          return handleRecipients(params, callerAgentId, config, ctx);
        default:
          throw new Error(
            `Unknown action: ${String(action)}. Must be one of: ${MAIL_ACTIONS.join(", ")}`,
          );
      }
    },
  };
}

// ============================================================================
// action="inbox" — claim unread messages
// ============================================================================

async function handleInbox(
  params: Record<string, unknown>,
  callerAgentId: string,
  stateDir: string,
  config: ResolvedInterAgentMailConfig,
  ctx: OpenClawPluginToolContext,
): Promise<string> {
  const mailboxId = readStr(params, "mailbox_id") ?? callerAgentId;
  const isOwner = mailboxId === callerAgentId;
  const filterUrgency = readStringArray(params, "filter_urgency") as MailUrgency[] | null;
  const filterTags = readStringArray(params, "filter_tags");
  const includeStale = readBool(params, "include_stale", false);

  const acl = resolveMailboxAcl(config, mailboxId, callerAgentId);
  if (!acl) {
    throw new Error(`Access denied: you do not have access to mailbox '${mailboxId}'.`);
  }

  const policy = resolveDeliveryPolicy(config, callerAgentId);
  const ttlMs = policy.processing_ttl_ms ?? DEFAULT_PROCESSING_TTL_MS;
  const filePath = mailboxPath(stateDir, mailboxId);

  // "peek" delegates see without claiming — no status change
  if (acl === "peek") {
    const messages = await readMailbox(filePath);
    const visible = peekMessages(messages, {
      filterUrgency: filterUrgency ?? undefined,
      filterTags: filterTags ?? undefined,
    });
    if (visible.length === 0) {
      return isOwner ? "Your inbox is empty." : `Mailbox '${mailboxId}' is empty.`;
    }
    return formatInboxResult(visible, false, `Peek into mailbox '${mailboxId}'`);
  }

  // Owners and read_mark/read_write delegates claim messages (unread → processing)
  const result = await claimUnread(filePath, {
    ttlMs,
    filterUrgency: filterUrgency ?? undefined,
    filterTags: filterTags ?? undefined,
    includeStale,
  });

  // Record claimed count via side-channel for enforcement tracking
  const sessionKey = ctx.sessionKey?.trim();
  if (sessionKey) {
    setLastInboxClaimedCount(callerAgentId, sessionKey, result.messages.length);
  }

  if (result.messages.length === 0) {
    const recoveryNote =
      result.recovered > 0 ? ` (${result.recovered} expired leases reset to unread)` : "";
    return isOwner
      ? `Your inbox is empty.${recoveryNote}`
      : `Mailbox '${mailboxId}' is empty.${recoveryNote}`;
  }

  const recoveryNote =
    result.recovered > 0 ? `\n(${result.recovered} expired leases recovered)` : "";
  const staleNote =
    includeStale && result.messages.some((m) => m.status === "processing")
      ? "\n(includes stale in-progress messages from a prior run)"
      : "";

  return (
    formatInboxResult(result.messages, true, isOwner ? "Your inbox" : `Mailbox '${mailboxId}'`) +
    recoveryNote +
    staleNote
  );
}

// ============================================================================
// action="ack" — mark processing messages as read
// ============================================================================

async function handleAck(
  params: Record<string, unknown>,
  callerAgentId: string,
  stateDir: string,
  config: ResolvedInterAgentMailConfig,
): Promise<string> {
  const mailboxId = readStr(params, "mailbox_id") ?? callerAgentId;
  const messageIds = readStringArray(params, "message_ids");

  if (!messageIds || messageIds.length === 0) {
    throw new Error(
      "message_ids is required for action='ack'. Provide the IDs of messages you've finished processing.",
    );
  }

  const acl = resolveMailboxAcl(config, mailboxId, callerAgentId);
  if (!acl || acl === "peek") {
    throw new Error(
      acl === "peek"
        ? `Access denied: peek access to mailbox '${mailboxId}' is read-only.`
        : `Access denied: you do not have access to mailbox '${mailboxId}'.`,
    );
  }

  const filePath = mailboxPath(stateDir, mailboxId);
  const { updated } = await ackMessages(filePath, new Set(messageIds), Date.now());

  if (updated === 0) {
    return `No in-progress messages matched the provided IDs. They may have already been acked or the TTL expired and they were re-queued.`;
  }
  return `Acked ${updated} message${updated !== 1 ? "s" : ""}.`;
}

// ============================================================================
// action="send" — compose and deliver a new message
// ============================================================================

async function handleSend(
  params: Record<string, unknown>,
  callerAgentId: string,
  stateDir: string,
  config: ResolvedInterAgentMailConfig,
  api: { runtime?: ApiRuntime },
): Promise<string> {
  const toAgentId = requireStr(params, "to_agent_id");
  const subject = requireStr(params, "subject");
  const body = requireStr(params, "body");
  const urgency =
    (readStr(params, "urgency") as MailUrgency | null) ??
    resolveDeliveryPolicy(config, toAgentId).defaultUrgency;
  const tags = readStringArray(params, "tags") ?? [];

  if (!isRoutingAllowed(config, callerAgentId, toAgentId)) {
    throw new Error(`Routing denied: you are not permitted to send mail to '${toAgentId}'.`);
  }

  const now = Date.now();
  const message: MailMessage = {
    id: newMessageId(),
    from: callerAgentId,
    to: toAgentId,
    subject,
    body,
    urgency,
    tags,
    status: "unread",
    created_at: now,
    read_at: null,
    deleted_at: null,
    processing_at: null,
    processing_expires_at: null,
    forwarded_from: null,
    lineage: [],
  };

  const filePath = mailboxPath(stateDir, toAgentId);
  await appendMessage(filePath, message);
  await maybeWakeRecipient(api, toAgentId, urgency, config);

  return `Message sent to '${toAgentId}' (id: ${message.id}, urgency: ${urgency}).`;
}

// ============================================================================
// action="forward" — route a message preserving lineage
// ============================================================================

async function handleForward(
  params: Record<string, unknown>,
  callerAgentId: string,
  stateDir: string,
  config: ResolvedInterAgentMailConfig,
  api: { runtime?: ApiRuntime },
): Promise<string> {
  const messageId = requireStr(params, "message_id");
  const toAgentId = requireStr(params, "to_agent_id");
  const mailboxId = readStr(params, "mailbox_id") ?? callerAgentId;
  const notes = readStr(params, "notes");
  const urgencyParam = readStr(params, "urgency") as MailUrgency | null;
  const tags = readStringArray(params, "tags");

  // Validate ACL on source mailbox
  const acl = resolveMailboxAcl(config, mailboxId, callerAgentId);
  if (!acl || acl === "peek") {
    throw new Error(
      acl === "peek"
        ? `Access denied: peek access to mailbox '${mailboxId}' is read-only (cannot forward).`
        : `Access denied: you do not have access to mailbox '${mailboxId}'.`,
    );
  }

  // Validate routing to destination
  if (!isRoutingAllowed(config, callerAgentId, toAgentId)) {
    throw new Error(`Routing denied: you are not permitted to send mail to '${toAgentId}'.`);
  }

  // Find source message
  const srcPath = mailboxPath(stateDir, mailboxId);
  const srcMessages = await readMailbox(srcPath);
  const src = srcMessages.find((m) => m.id === messageId);

  if (!src) {
    throw new Error(`Message '${messageId}' not found in mailbox '${mailboxId}'.`);
  }
  if (src.status === "deleted") {
    throw new Error(`Message '${messageId}' has been deleted and cannot be forwarded.`);
  }

  const now = Date.now();
  const urgency = urgencyParam ?? src.urgency;

  // Build forwarded message with reverse lineage
  const forwardedBody = [
    notes
      ? `[Forwarded by ${callerAgentId}${notes ? `: ${notes}` : ""}]`
      : `[Forwarded by ${callerAgentId}]`,
    "",
    `--- Original from ${src.from} (${new Date(src.created_at).toISOString()}) ---`,
    `Subject: ${src.subject}`,
    "",
    src.body,
  ].join("\n");

  const forwarded: MailMessage = {
    id: newMessageId(),
    from: callerAgentId,
    to: toAgentId,
    subject: `Fwd: ${src.subject}`,
    body: forwardedBody,
    urgency,
    tags: tags ?? src.tags,
    status: "unread",
    created_at: now,
    read_at: null,
    deleted_at: null,
    processing_at: null,
    processing_expires_at: null,
    forwarded_from: src.id,
    lineage: [...src.lineage, src.id],
  };

  const dstPath = mailboxPath(stateDir, toAgentId);
  await appendMessage(dstPath, forwarded);

  // Ack the source message (forwarding = you processed it)
  await ackMessages(srcPath, new Set([messageId]), now);

  await maybeWakeRecipient(api, toAgentId, urgency, config);

  return (
    `Forwarded message '${messageId}' to '${toAgentId}' as new message '${forwarded.id}'. ` +
    `Lineage depth: ${forwarded.lineage.length}.`
  );
}

// ============================================================================
// action="recipients" — contact book
// ============================================================================

async function handleRecipients(
  params: Record<string, unknown>,
  callerAgentId: string,
  config: ResolvedInterAgentMailConfig,
  ctx: OpenClawPluginToolContext,
): Promise<string> {
  const search = readStr(params, "search");
  const contacts = resolveContacts(ctx.config, config, callerAgentId, search ?? undefined);
  return formatContacts(contacts);
}

// ============================================================================
// Opt-in "bounce_mail" tool
// ============================================================================

const BounceToolSchema = Type.Object({
  message_id: Type.String({ description: "ID of the message to return to its sender." }),
  reason: Type.String({
    description:
      "Why you are returning this message. Be specific so the sender can improve routing.",
  }),
  confidence: Type.Number({
    minimum: 0,
    maximum: 1,
    description:
      "Your confidence (0–1) that this message was incorrectly routed or irrelevant to you. " +
      "1.0 = certain misdirection. 0.0 = unsure but returning anyway.",
  }),
  mailbox_id: Type.Optional(
    Type.String({ description: "Mailbox to read from. Defaults to your own." }),
  ),
});

export function createBounceMailTool(deps: {
  stateDir: string;
  config: ResolvedInterAgentMailConfig;
  api: { runtime?: ApiRuntime };
}) {
  const { stateDir, config, api } = deps;

  return {
    name: "bounce_mail",
    description:
      "Return a received message to its original sender with a reason and confidence score (0–1). " +
      "Use this when a message appears to be incorrectly routed or outside your domain. " +
      "The bounce creates a tagged reply so the sender can learn from routing failures and improve " +
      "their context engineering. The source message is marked as processed.",
    schema: BounceToolSchema,
    async execute(
      params: Record<string, unknown>,
      ctx: OpenClawPluginToolContext,
    ): Promise<string> {
      const callerAgentId = requireAgentId(ctx);
      const messageId = requireStr(params, "message_id");
      const reason = requireStr(params, "reason");
      const rawConfidence = params["confidence"];
      if (typeof rawConfidence !== "number" || rawConfidence < 0 || rawConfidence > 1) {
        throw new Error("confidence must be a number between 0 and 1.");
      }
      const confidence = rawConfidence;
      const mailboxId = readStr(params, "mailbox_id") ?? callerAgentId;

      const acl = resolveMailboxAcl(config, mailboxId, callerAgentId);
      if (!acl || acl === "peek") {
        throw new Error(
          acl === "peek"
            ? `Access denied: peek access to mailbox '${mailboxId}' is read-only.`
            : `Access denied: you do not have access to mailbox '${mailboxId}'.`,
        );
      }

      // Find source message
      const srcPath = mailboxPath(stateDir, mailboxId);
      const srcMessages = await readMailbox(srcPath);
      const src = srcMessages.find((m) => m.id === messageId);

      if (!src) {
        throw new Error(`Message '${messageId}' not found in mailbox '${mailboxId}'.`);
      }
      if (src.status === "deleted") {
        throw new Error(`Message '${messageId}' has been deleted and cannot be bounced.`);
      }

      const originalSenderId = src.from;

      // Enforce routing from caller to original sender (no special bypass for bounces)
      if (!isRoutingAllowed(config, callerAgentId, originalSenderId)) {
        throw new Error(
          `Routing denied: cannot send bounce reply to '${originalSenderId}'. ` +
            `Check routing rules or contact an operator.`,
        );
      }

      const now = Date.now();
      const bounceBody = [
        `[BOUNCE] From: ${callerAgentId}`,
        `Confidence this was misrouted: ${(confidence * 100).toFixed(0)}%`,
        `Reason: ${reason}`,
        "",
        `--- Original message (${src.id}) ---`,
        `Subject: ${src.subject}`,
        `Sent: ${new Date(src.created_at).toISOString()}`,
        "",
        src.body,
      ].join("\n");

      const bounce: MailMessage = {
        id: newMessageId(),
        from: callerAgentId,
        to: originalSenderId,
        subject: `Bounce: ${src.subject}`,
        body: bounceBody,
        urgency: "normal",
        // _bounce is a reserved system tag (underscore prefix convention)
        tags: ["_bounce"],
        status: "unread",
        created_at: now,
        read_at: null,
        deleted_at: null,
        processing_at: null,
        processing_expires_at: null,
        forwarded_from: src.id,
        lineage: [...src.lineage, src.id],
      };

      const dstPath = mailboxPath(stateDir, originalSenderId);
      await appendMessage(dstPath, bounce);

      // Mark source as read — bouncing = you've processed it (even if by rejecting it)
      await ackMessages(srcPath, new Set([messageId]), now);

      await maybeWakeRecipient(api, originalSenderId, "normal", config);

      return (
        `Bounced message '${messageId}' back to '${originalSenderId}' (bounce id: ${bounce.id}). ` +
        `The original message is now marked as processed.`
      );
    },
  };
}

// ============================================================================
// Formatting helpers
// ============================================================================

function formatInboxResult(messages: MailMessage[], showAckHint: boolean, label: string): string {
  const lines: string[] = [
    `${label} — ${messages.length} message${messages.length !== 1 ? "s" : ""}:`,
  ];

  for (const m of messages) {
    const statusBadge = m.status === "processing" ? " [in-progress]" : "";
    const bounceTag = m.tags.includes("_bounce") ? " [BOUNCE]" : "";
    const forwardedTag = m.forwarded_from ? ` [fwd from ${m.forwarded_from}]` : "";
    lines.push(`\n[${m.id}]${bounceTag}${forwardedTag}${statusBadge}`);
    lines.push(`From: ${m.from}  |  Subject: ${m.subject}`);
    lines.push(
      `Urgency: ${m.urgency}  |  Tags: ${m.tags.filter((t) => !t.startsWith("_")).join(", ") || "none"}`,
    );
    lines.push(`Sent: ${new Date(m.created_at).toISOString()}`);
    lines.push(m.body);
  }

  if (showAckHint) {
    lines.push(
      "\nIMPORTANT: Call mail(action='ack', message_ids=[...]) when you have fully processed each message.",
    );
  }

  return lines.join("\n");
}

// Re-export softDeleteMessages for the CLI command
export { softDeleteMessages };
