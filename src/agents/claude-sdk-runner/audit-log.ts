/**
 * SDK session audit logging: write-only session history for audit/UI purposes.
 *
 * The Claude Agent SDK manages conversation context internally via session_id.
 * This module writes a parallel audit log in OpenClaw's session format for:
 * - UI display of conversation history
 * - Debugging and audit trails
 * - Session analytics
 *
 * IMPORTANT: This is write-only and never used for resumption.
 * The SDK handles all conversation state via its own session_id.
 */

import fs from "node:fs";
import path from "node:path";

import { CURRENT_SESSION_VERSION, SessionManager } from "@mariozechner/pi-coding-agent";

type AuditLogParams = {
  sessionFile: string;
  sessionId: string;
  prompt: string;
  assistantTexts: string[];
  model: string;
  provider: string;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

/**
 * Ensure the session file has a header if it doesn't exist.
 */
async function ensureSessionHeader(params: {
  sessionFile: string;
  sessionId: string;
}): Promise<void> {
  if (fs.existsSync(params.sessionFile)) {
    return;
  }
  await fs.promises.mkdir(path.dirname(params.sessionFile), { recursive: true });
  const header = {
    type: "session",
    version: CURRENT_SESSION_VERSION,
    id: params.sessionId,
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
  };
  await fs.promises.writeFile(params.sessionFile, `${JSON.stringify(header)}\n`, "utf-8");
}

/**
 * Append SDK session messages to the audit log.
 *
 * Writes user prompt and assistant responses to the session file.
 * This is fire-and-forget; errors are logged but don't fail the run.
 */
export async function appendSdkSessionAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const { sessionFile, sessionId, prompt, assistantTexts, model, provider, usage } = params;

    if (!sessionFile || !prompt) {
      return;
    }

    await ensureSessionHeader({ sessionFile, sessionId });

    const sessionManager = SessionManager.open(sessionFile);

    // Append user message
    // Note: appendMessage accepts partial messages at runtime; cast to bypass strict types
    (sessionManager as { appendMessage: (msg: unknown) => void }).appendMessage({
      role: "user",
      content: [{ type: "text", text: prompt }],
      timestamp: Date.now(),
    });

    // Append assistant message(s)
    const combinedText = assistantTexts.join("\n\n").trim();
    if (combinedText) {
      (sessionManager as { appendMessage: (msg: unknown) => void }).appendMessage({
        role: "assistant",
        content: [{ type: "text", text: combinedText }],
        api: "claude-sdk",
        provider,
        model,
        usage: {
          input: usage?.input ?? 0,
          output: usage?.output ?? 0,
          cacheRead: usage?.cacheRead ?? 0,
          cacheWrite: usage?.cacheWrite ?? 0,
          totalTokens: usage?.total ?? 0,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
          },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    // Audit logging is best-effort; don't fail the run on errors
    // eslint-disable-next-line no-console
    console.error("[claude-sdk-runner] audit log error:", err);
  }
}
