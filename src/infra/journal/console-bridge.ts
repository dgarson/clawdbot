import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  formatJournalExpanded,
  formatJournalSummary,
  shouldExpandOnConsole,
  shouldShowOnConsole,
} from "./console-formatter.js";
import type { JournalEntry } from "./types.js";

const journalLog = createSubsystemLogger("journal");

let consoleSummaryEnabled = false;

/**
 * Enable journal console summary mode.
 * When active, diagnostic events emit compact 1-line summaries for info-level events
 * and expanded output for warn/error events. Trace/debug events are suppressed.
 */
export function enableJournalConsoleSummary(): void {
  consoleSummaryEnabled = true;
}

/** Disable journal console summary mode, reverting to normal diagnostic output. */
export function disableJournalConsoleSummary(): void {
  consoleSummaryEnabled = false;
}

/** Check if journal console summary mode is active. */
export function isJournalConsoleSummaryEnabled(): boolean {
  return consoleSummaryEnabled;
}

/**
 * Emit a journal entry to the console using the summary/expanded format.
 * Only emits when journal console summary mode is enabled.
 */
export function emitJournalConsoleEntry(entry: JournalEntry): void {
  if (!consoleSummaryEnabled) {
    return;
  }
  if (!shouldShowOnConsole(entry)) {
    return;
  }
  if (shouldExpandOnConsole(entry)) {
    const formatted = formatJournalExpanded(entry);
    if (entry.severity === "error") {
      journalLog.error(formatted);
    } else {
      journalLog.warn(formatted);
    }
  } else {
    journalLog.info(formatJournalSummary(entry));
  }
}
