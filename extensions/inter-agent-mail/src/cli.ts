/**
 * CLI registrar for inter-agent-mail.
 *
 * Commands:
 *   openclaw mail list   --mailbox <id> [--include-read] [--include-deleted]
 *   openclaw mail delete --mailbox <id> <message-id...>
 *
 * The delete command performs a soft delete: messages are hidden from all tool
 * calls and CLI listings (unless --include-deleted is passed) but remain on
 * disk for operator recovery.
 */

import type { OpenClawPluginCliContext } from "../../../src/plugins/types.js";
import { mailboxPath, readMailbox, softDeleteMessages, type MailMessage } from "./store.js";

type ListOptions = {
  includeRead?: boolean;
  includeDeleted?: boolean;
};

async function cliListMailbox(
  stateDir: string,
  agentId: string,
  opts: ListOptions,
): Promise<MailMessage[]> {
  const filePath = mailboxPath(stateDir, agentId);
  const messages = await readMailbox(filePath);
  return messages.filter((m) => {
    if (m.status === "deleted" && !opts.includeDeleted) return false;
    if (m.status === "read" && !opts.includeRead) return false;
    return true;
  });
}

async function cliDeleteMessages(
  stateDir: string,
  agentId: string,
  messageIds: string[],
): Promise<{ updated: number }> {
  const filePath = mailboxPath(stateDir, agentId);
  return softDeleteMessages(filePath, new Set(messageIds), Date.now());
}

export async function registerMailCli(ctx: OpenClawPluginCliContext): Promise<void> {
  const { program } = ctx;

  const mail = program
    .command("mail")
    .description("Manage inter-agent mail mailboxes (operator commands).");

  // ── list ──────────────────────────────────────────────────────────────────

  mail
    .command("list")
    .description("List messages in an agent mailbox.")
    .requiredOption("--mailbox <agent-id>", "Agent id whose mailbox to inspect.")
    .option("--include-read", "Also show already-read messages (default: shown).")
    .option("--no-read", "Exclude already-read messages.")
    .option("--include-deleted", "Also show soft-deleted messages (hidden by default).")
    .option("--json", "Output raw JSON instead of formatted table.")
    .action(
      async (opts: {
        mailbox: string;
        includeRead?: boolean;
        read: boolean;
        includeDeleted?: boolean;
        json?: boolean;
      }) => {
        const stateDir = resolvePluginStateDir(
          ctx.config.agents?.defaults?.workspace ?? process.cwd(),
        );
        const messages = await cliListMailbox(stateDir, opts.mailbox, {
          includeRead: opts.read !== false,
          includeDeleted: opts.includeDeleted === true,
        });

        if (opts.json) {
          process.stdout.write(`${JSON.stringify(messages, null, 2)}\n`);
          return;
        }

        if (messages.length === 0) {
          process.stdout.write(`Mailbox '${opts.mailbox}' is empty.\n`);
          return;
        }

        for (const m of messages) {
          const urgencyLabel =
            m.urgency === "urgent" ? " [URGENT]" : m.urgency === "high" ? " [HIGH]" : "";
          const statusLabel =
            m.status === "deleted"
              ? " [DELETED]"
              : m.status === "processing"
                ? " [PROCESSING]"
                : m.status === "read"
                  ? " [read]"
                  : " [UNREAD]";
          const chain = m.lineage.length > 0 ? ` (fwd chain: ${m.lineage.length} hops)` : "";
          const tags = m.tags.filter((t) => !t.startsWith("_"));
          const tagLabel = tags.length > 0 ? ` tags=[${tags.join(",")}]` : "";
          const bounceLabel = m.tags.includes("_bounce") ? " [BOUNCE]" : "";
          const processingLabel =
            m.status === "processing" && m.processing_expires_at
              ? ` (expires ${new Date(m.processing_expires_at).toISOString()})`
              : "";
          process.stdout.write(
            `${m.id}${statusLabel}${urgencyLabel}${bounceLabel}${chain}${tagLabel}${processingLabel}\n` +
              `  from: ${m.from}  subject: ${m.subject}\n` +
              `  created: ${new Date(m.created_at).toISOString()}\n`,
          );
        }
      },
    );

  // ── delete ─────────────────────────────────────────────────────────────────

  mail
    .command("delete <message-ids...>")
    .description(
      "Soft-delete one or more messages from an agent mailbox. " +
        "Deleted messages are hidden from all tool calls and CLI listings " +
        "but remain on disk for operator recovery.",
    )
    .requiredOption("--mailbox <agent-id>", "Agent id whose mailbox to modify.")
    .action(async (messageIds: string[], opts: { mailbox: string }) => {
      const stateDir = resolvePluginStateDir(
        ctx.config.agents?.defaults?.workspace ?? process.cwd(),
      );
      const { updated } = await cliDeleteMessages(stateDir, opts.mailbox, messageIds);
      process.stdout.write(
        updated > 0
          ? `Soft-deleted ${updated} message(s) from mailbox '${opts.mailbox}'.\n`
          : `No matching undeleted messages found in mailbox '${opts.mailbox}'.\n`,
      );
    });
}

function resolvePluginStateDir(workspaceDir: string): string {
  const env = process.env.OPENCLAW_STATE_DIR?.trim();
  if (env) return env;
  return workspaceDir;
}
