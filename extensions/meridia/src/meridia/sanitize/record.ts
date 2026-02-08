import type { MeridiaExperienceRecord } from "../types.js";
import { redactValue } from "../sanitize.js";
import {
  DEFAULT_SANITIZE_CONFIG,
  sanitizeForPersistence as sanitizePayloadFields,
  sanitizePayload,
  sanitizeText,
  truncate,
  type SanitizeConfig,
} from "./redact.js";

export type RecordSanitizeOptions = {
  maxTextChars?: number;
  maxSummaryChars?: number;
  maxSnapshotChars?: number;
  payload?: Partial<SanitizeConfig>;
};

const DEFAULT_MAX_TEXT_CHARS = 4_000;
const DEFAULT_MAX_SUMMARY_CHARS = 8_000;
const DEFAULT_MAX_SNAPSHOT_CHARS = 8_000;

function sanitizeTextField(
  text: string | undefined,
  maxChars: number,
  cfg: SanitizeConfig,
): string | undefined {
  if (!text) {
    return text;
  }
  const redacted = sanitizeText(text, cfg) ?? text;
  return truncate(redacted, maxChars);
}

function sanitizeFreeformValue(value: unknown, maxChars: number, cfg: SanitizeConfig): unknown {
  const redacted = sanitizePayload(value, maxChars, cfg);
  try {
    return JSON.parse(redacted);
  } catch {
    return redacted;
  }
}

/**
 * Canonical Meridia record sanitizer.
 * Apply before persistence and before graph/vector fanout.
 */
export function sanitizeExperienceRecord(
  record: MeridiaExperienceRecord,
  options?: RecordSanitizeOptions,
): MeridiaExperienceRecord {
  const payloadCfg: SanitizeConfig = {
    ...DEFAULT_SANITIZE_CONFIG,
    ...(options?.payload ?? {}),
  };
  const maxTextChars = options?.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS;
  const maxSummaryChars = options?.maxSummaryChars ?? DEFAULT_MAX_SUMMARY_CHARS;
  const maxSnapshotChars = options?.maxSnapshotChars ?? DEFAULT_MAX_SNAPSHOT_CHARS;

  const redacted = redactValue(record) as MeridiaExperienceRecord;
  const sanitized: MeridiaExperienceRecord = { ...redacted };

  if (sanitized.tool) {
    sanitized.tool = {
      ...sanitized.tool,
      meta: sanitizeTextField(sanitized.tool.meta, maxTextChars, payloadCfg),
    };
  }

  sanitized.capture = {
    ...sanitized.capture,
    evaluation: {
      ...sanitized.capture.evaluation,
      reason: sanitizeTextField(sanitized.capture.evaluation.reason, maxTextChars, payloadCfg),
      error: sanitizeTextField(sanitized.capture.evaluation.error, maxTextChars, payloadCfg),
    },
  };

  if (sanitized.content) {
    sanitized.content = {
      ...sanitized.content,
      topic: sanitizeTextField(sanitized.content.topic, maxTextChars, payloadCfg),
      summary: sanitizeTextField(sanitized.content.summary, maxSummaryChars, payloadCfg),
      context: sanitizeTextField(sanitized.content.context, maxSummaryChars, payloadCfg),
      anchors: sanitized.content.anchors?.map((anchor) =>
        sanitizeTextField(anchor, maxTextChars, payloadCfg),
      ) as string[] | undefined,
    };
  }

  if (sanitized.phenomenology) {
    sanitized.phenomenology = {
      ...sanitized.phenomenology,
      anchors: sanitized.phenomenology.anchors?.map((a) => ({
        ...a,
        phrase: sanitizeTextField(a.phrase, maxTextChars, payloadCfg) ?? a.phrase,
        significance: sanitizeTextField(a.significance, maxTextChars, payloadCfg) ?? a.significance,
        sensoryChannel: sanitizeTextField(a.sensoryChannel, 256, payloadCfg),
      })),
      uncertainties: sanitized.phenomenology.uncertainties?.map((u) =>
        sanitizeTextField(u, maxTextChars, payloadCfg),
      ) as string[] | undefined,
      reconstitutionHints: sanitized.phenomenology.reconstitutionHints?.map((hint) =>
        sanitizeTextField(hint, maxTextChars, payloadCfg),
      ) as string[] | undefined,
    };
  }

  if (sanitized.data) {
    const payload = sanitizePayloadFields(
      {
        args: sanitized.data.args,
        result: sanitized.data.result,
      },
      payloadCfg,
    );

    sanitized.data = {
      ...sanitized.data,
      args: payload.args,
      result: payload.result,
      summary:
        sanitized.data.summary === undefined
          ? undefined
          : sanitizeFreeformValue(sanitized.data.summary, maxSummaryChars, payloadCfg),
      snapshot:
        sanitized.data.snapshot === undefined
          ? undefined
          : sanitizeFreeformValue(sanitized.data.snapshot, maxSnapshotChars, payloadCfg),
    };
  }

  if (sanitized.classification?.reasons) {
    sanitized.classification = {
      ...sanitized.classification,
      reasons: sanitized.classification.reasons.map(
        (reason) => sanitizeTextField(reason, 256, payloadCfg) ?? "",
      ),
    };
  }

  return sanitized;
}
