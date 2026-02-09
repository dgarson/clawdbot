/**
 * Telegram Rich Pattern Renderer
 *
 * Maps semantic UI patterns (multiple_choice, confirmation, task_proposal, etc.)
 * into Telegram InlineKeyboardMarkup + HTML-formatted text.
 *
 * This is the Telegram equivalent of Slack Block Kit patterns.
 * Patterns are rendered as HTML text + inline keyboard buttons.
 *
 * Telegram constraints:
 * - callback_data max = 64 bytes
 * - Max 8 buttons per row
 * - InlineKeyboardMarkup for interactive elements
 * - HTML parse_mode for formatting
 */

import { toPrimitiveString, toPrimitiveStringOr } from "../shared/text/coerce.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TelegramPatternType =
  | "multiple_choice"
  | "confirmation"
  | "task_proposal"
  | "action_items"
  | "status"
  | "progress"
  | "info_grid";

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramPatternResult {
  /** HTML-formatted text for the message body. */
  html: string;
  /** Inline keyboard rows (empty if pattern is text-only). */
  keyboard: TelegramInlineButton[][];
  /** Plain text fallback for non-interactive contexts. */
  plainText: string;
}

// ─── Callback Data Encoding ─────────────────────────────────────────────────

/**
 * Encode callback_data within Telegram's 64-byte limit.
 * Format: `{prefix}:{id}` — prefix is a short action identifier,
 * id is truncated/hashed if needed.
 */
export function encodeCallbackData(prefix: string, id: string): string {
  const separator = ":";
  const maxBytes = 64;
  const overhead = Buffer.byteLength(prefix + separator, "utf8");
  const available = maxBytes - overhead;

  if (available <= 0) {
    // Prefix alone exceeds limit — truncate it
    return prefix.slice(0, 60);
  }

  const idBytes = Buffer.byteLength(id, "utf8");
  if (idBytes <= available) {
    return `${prefix}${separator}${id}`;
  }

  // Hash the id to fit within the budget
  const hash = simpleHash(id);
  return `${prefix}${separator}${hash}`;
}

/**
 * Simple deterministic hash for callback data compaction.
 * Returns a short hex string (8 chars / 4 bytes).
 */
export function simpleHash(input: string): string {
  let hash = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ─── HTML Helpers ────────────────────────────────────────────────────────────

/** Escape HTML special characters for Telegram HTML parse mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bold(text: string): string {
  return `<b>${escapeHtml(text)}</b>`;
}

function italic(text: string): string {
  return `<i>${escapeHtml(text)}</i>`;
}

// ─── Pattern Renderers ───────────────────────────────────────────────────────

/** Status emoji mapping. */
const STATUS_EMOJI: Record<string, string> = {
  success: "✅",
  warning: "⚠️",
  error: "❌",
  info: "ℹ️",
};

/**
 * Render a semantic pattern into Telegram HTML + inline keyboard.
 */
export function renderPattern(
  pattern: TelegramPatternType,
  params: Record<string, unknown>,
): TelegramPatternResult {
  switch (pattern) {
    case "multiple_choice":
      return renderMultipleChoice(params);
    case "confirmation":
      return renderConfirmation(params);
    case "task_proposal":
      return renderTaskProposal(params);
    case "action_items":
      return renderActionItems(params);
    case "status":
      return renderStatus(params);
    case "progress":
      return renderProgress(params);
    case "info_grid":
      return renderInfoGrid(params);
    default:
      return {
        html: escapeHtml(`Unknown pattern: ${String(pattern)}`),
        keyboard: [],
        plainText: `Unknown pattern: ${String(pattern)}`,
      };
  }
}

// ─── Multiple Choice ─────────────────────────────────────────────────────────

function renderMultipleChoice(params: Record<string, unknown>): TelegramPatternResult {
  const question = toPrimitiveStringOr(params.question, "");
  const options = (params.options ?? []) as Array<{
    text: string;
    value: string;
    description?: string;
  }>;
  const actionIdPrefix = toPrimitiveStringOr(params.actionIdPrefix, "mc");
  const allowMultiple = params.allowMultiple === true;

  const html = bold(question);
  const plainText = `${question}\n\nOptions:\n${options.map((opt, i) => `${i + 1}. ${opt.text}${opt.description ? ` — ${opt.description}` : ""}`).join("\n")}`;

  // Build inline keyboard — one button per option, max 2 per row for readability
  const keyboard: TelegramInlineButton[][] = [];
  const buttonsPerRow = Math.min(options.length <= 4 ? 1 : 2, 8);

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const prefix = allowMultiple ? `${actionIdPrefix}_chk` : `${actionIdPrefix}_sel`;
    const btn: TelegramInlineButton = {
      text: opt.text,
      callback_data: encodeCallbackData(prefix, opt.value),
    };

    const rowIndex = Math.floor(i / buttonsPerRow);
    if (!keyboard[rowIndex]) {
      keyboard[rowIndex] = [];
    }
    keyboard[rowIndex].push(btn);
  }

  // For multi-select, add a "Done" button
  if (allowMultiple && options.length > 0) {
    keyboard.push([
      {
        text: "✅ Done",
        callback_data: encodeCallbackData(`${actionIdPrefix}_done`, "submit"),
      },
    ]);
  }

  return { html, keyboard, plainText };
}

// ─── Confirmation ────────────────────────────────────────────────────────────

function renderConfirmation(params: Record<string, unknown>): TelegramPatternResult {
  const title = toPrimitiveStringOr(params.title, "Confirm");
  const message = toPrimitiveStringOr(params.message, "");
  const actionIdPrefix = toPrimitiveStringOr(params.actionIdPrefix, "cfm");
  const confirmLabel = toPrimitiveStringOr(params.confirmLabel, "Confirm");
  const cancelLabel = toPrimitiveStringOr(params.cancelLabel, "Cancel");
  const style = toPrimitiveStringOr(params.style, "primary");

  const confirmEmoji = style === "danger" ? "🔴" : "✅";
  const html = `${bold(title)}\n\n${escapeHtml(message)}`;
  const plainText = `**${title}**\n\n${message}`;

  const keyboard: TelegramInlineButton[][] = [
    [
      {
        text: `${confirmEmoji} ${confirmLabel}`,
        callback_data: encodeCallbackData(`${actionIdPrefix}_yes`, "confirm"),
      },
      {
        text: `❌ ${cancelLabel}`,
        callback_data: encodeCallbackData(`${actionIdPrefix}_no`, "cancel"),
      },
    ],
  ];

  return { html, keyboard, plainText };
}

// ─── Task Proposal ───────────────────────────────────────────────────────────

function renderTaskProposal(params: Record<string, unknown>): TelegramPatternResult {
  const title = toPrimitiveStringOr(params.title, "");
  const description = toPrimitiveStringOr(params.description, "");
  const details = (params.details ?? []) as Array<{ label: string; value: string }>;
  const actionIdPrefix = toPrimitiveStringOr(params.actionIdPrefix, "task");
  const acceptLabel = toPrimitiveStringOr(params.acceptLabel, "Accept");
  const rejectLabel = toPrimitiveStringOr(params.rejectLabel, "Reject");
  const modifyLabel = toPrimitiveString(params.modifyLabel);

  let html = `📋 ${bold(title)}\n\n${escapeHtml(description)}`;
  let plainText = `📋 **${title}**\n\n${description}`;

  if (details.length > 0) {
    html += "\n\n" + details.map((d) => `${bold(d.label)}: ${escapeHtml(d.value)}`).join("\n");
    plainText += "\n\n" + details.map((d) => `${d.label}: ${d.value}`).join("\n");
  }

  const keyboard: TelegramInlineButton[][] = [
    [
      {
        text: `✅ ${acceptLabel}`,
        callback_data: encodeCallbackData(`${actionIdPrefix}_accept`, "accept"),
      },
      {
        text: `❌ ${rejectLabel}`,
        callback_data: encodeCallbackData(`${actionIdPrefix}_reject`, "reject"),
      },
    ],
  ];

  if (modifyLabel) {
    keyboard[0].push({
      text: `✏️ ${modifyLabel}`,
      callback_data: encodeCallbackData(`${actionIdPrefix}_modify`, "modify"),
    });
  }

  return { html, keyboard, plainText };
}

// ─── Action Items ────────────────────────────────────────────────────────────

function renderActionItems(params: Record<string, unknown>): TelegramPatternResult {
  const title = toPrimitiveStringOr(params.title, "Action Items");
  const items = (params.items ?? []) as Array<{
    id: string;
    text: string;
    completed?: boolean;
    details?: string;
  }>;
  const actionIdPrefix = toPrimitiveStringOr(params.actionIdPrefix, "ai");
  const showCheckboxes = params.showCheckboxes !== false;

  const lines = items.map((item) => {
    const check = item.completed ? "✅" : "⬜";
    const detail = item.details ? ` — ${italic(item.details)}` : "";
    return `${check} ${escapeHtml(item.text)}${detail}`;
  });

  const html = `${bold(title)}\n\n${lines.join("\n")}`;
  const plainText = `**${title}**\n\n${items.map((item) => `${item.completed ? "✓" : "○"} ${item.text}${item.details ? ` — ${item.details}` : ""}`).join("\n")}`;

  const keyboard: TelegramInlineButton[][] = [];

  if (showCheckboxes) {
    // Build toggle buttons — max 4 per row to stay within limits
    const ITEMS_PER_ROW = 4;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowIndex = Math.floor(i / ITEMS_PER_ROW);
      if (!keyboard[rowIndex]) {
        keyboard[rowIndex] = [];
      }
      keyboard[rowIndex].push({
        text: `${item.completed ? "✅" : "⬜"} ${(i + 1).toString()}`,
        callback_data: encodeCallbackData(`${actionIdPrefix}_toggle`, item.id),
      });
    }
  }

  return { html, keyboard, plainText };
}

// ─── Status ──────────────────────────────────────────────────────────────────

function renderStatus(params: Record<string, unknown>): TelegramPatternResult {
  const title = toPrimitiveStringOr(params.title, "Status");
  const message = toPrimitiveStringOr(params.message, "");
  const status = toPrimitiveStringOr(params.status, "info") as
    | "success"
    | "warning"
    | "error"
    | "info";
  const details = (params.details ?? []) as string[];
  const timestamp = toPrimitiveString(params.timestamp);

  const emoji = STATUS_EMOJI[status] ?? "ℹ️";
  let html = `${emoji} ${bold(title)}\n\n${escapeHtml(message)}`;
  let plainText = `${emoji} **${title}**\n\n${message}`;

  if (details.length > 0) {
    const detailLines = details.map((d) => `• ${escapeHtml(d)}`).join("\n");
    html += `\n\n${detailLines}`;
    plainText += `\n\n${details.map((d) => `• ${d}`).join("\n")}`;
  }

  if (timestamp) {
    html += `\n\n<i>${escapeHtml(timestamp)}</i>`;
    plainText += `\n\n${timestamp}`;
  }

  // Status is text-only — no interactive buttons
  return { html, keyboard: [], plainText };
}

// ─── Progress ────────────────────────────────────────────────────────────────

/**
 * Build a text-based progress bar.
 * Uses filled/empty block characters for visual representation.
 */
function buildProgressBar(current: number, total: number, width: number = 20): string {
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function renderProgress(params: Record<string, unknown>): TelegramPatternResult {
  const title = toPrimitiveStringOr(params.title, "Progress");
  const current = Number(params.current ?? 0);
  const total = Number(params.total ?? 100);
  const description = toPrimitiveString(params.description);
  const showPercentage = params.showPercentage !== false;

  const bar = buildProgressBar(current, total);
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const pctText = showPercentage ? ` ${pct}%` : "";

  let html = `${bold(title)}\n\n${bar}${pctText}\n${escapeHtml(`${current}/${total}`)}`;
  let plainText = `**${title}**\n\n${bar}${pctText}\n${current}/${total}`;

  if (description) {
    html += `\n\n${escapeHtml(description)}`;
    plainText += `\n\n${description}`;
  }

  // Progress is text-only — no interactive buttons
  return { html, keyboard: [], plainText };
}

// ─── Info Grid ───────────────────────────────────────────────────────────────

function renderInfoGrid(params: Record<string, unknown>): TelegramPatternResult {
  const title = toPrimitiveStringOr(params.title, "");
  const items = (params.items ?? []) as Array<{ label: string; value: string }>;

  const lines = items.map((item) => `${bold(item.label)}: ${escapeHtml(item.value)}`);
  const html = `${bold(title)}\n\n${lines.join("\n")}`;
  const plainText = `**${title}**\n\n${items.map((item) => `${item.label}: ${item.value}`).join("\n")}`;

  // Info grid is text-only — no interactive buttons
  return { html, keyboard: [], plainText };
}
