import { emitDiagnosticEvent } from "../infra/diagnostic-events.js";

export type VaultMetricEventType = "created" | "modified" | "deleted" | "renamed";

export function recordVaultEvent(
  eventType: VaultMetricEventType,
  processed: boolean,
  reason?: string,
): void {
  emitDiagnosticEvent({
    type: "vault.watcher.event",
    eventType,
    processed,
    reason,
  });
}

export function recordVaultToolCall(toolName: string, durationMs: number): void {
  emitDiagnosticEvent({
    type: "vault.tool.call",
    toolName,
    durationMs,
  });
}
