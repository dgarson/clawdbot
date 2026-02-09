import type { CoreConfig } from "./core-bridge.js";

type DebugProps = {
  verbose?: unknown;
  debug?: unknown;
  trace?: unknown;
  suppressLogging?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getDebugFeature(raw: unknown, featureId: string): DebugProps | null {
  const root = asRecord(raw);
  if (!root) {
    return null;
  }
  const debugging = asRecord(root.debugging);
  const features = asRecord(debugging?.features);
  const feature = asRecord(features?.[featureId]);
  return feature as DebugProps | null;
}

/**
 * Voice diagnostics are opt-in and controlled via:
 *   debugging.features.voice.{verbose|debug|trace}
 *
 * suppressLogging=true always disables diagnostics.
 */
export function isVoiceDiagnosticsVerbose(coreConfig: CoreConfig | null | undefined): boolean {
  const voice = getDebugFeature(coreConfig, "voice");
  if (!voice) {
    return false;
  }
  if (voice.suppressLogging === true) {
    return false;
  }
  return voice.verbose === true || voice.debug === true || voice.trace === true;
}
