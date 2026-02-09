import type { ProgressiveMemoryEntry } from "../memory/progressive-types.js";
import type { WorkQueueStore } from "./store.js";
import type { WorkItemPayload, WorkItemRef, WorkItemRefKind } from "./types.js";
import { WORK_ITEM_REF_KINDS } from "./types.js";

export type WorkItemRefResolverContext = {
  workQueueStore?: Pick<WorkQueueStore, "getItem" | "getQueue">;
  progressiveMemoryStore?: { getById(id: string): ProgressiveMemoryEntry | null };
  resolvers?: Partial<Record<WorkItemRefKind, (ref: WorkItemRef) => Promise<unknown>>>;
};

export function isWorkItemRefKind(value: string): value is WorkItemRefKind {
  return (WORK_ITEM_REF_KINDS as readonly string[]).includes(value);
}

export function formatRef(ref: WorkItemRef): string {
  return `oc://${ref.kind}/${ref.id}`;
}

export function parseRef(uri: string): WorkItemRef {
  const trimmed = uri.trim();
  const match = /^oc:\/\/([^/]+)\/(.+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid ref URI: ${uri}`);
  }
  const [, kindRaw, id] = match;
  if (!isWorkItemRefKind(kindRaw)) {
    throw new Error(`Unsupported ref kind: ${kindRaw}`);
  }
  if (!id) {
    throw new Error(`Missing ref id: ${uri}`);
  }
  return { kind: kindRaw, id, uri: trimmed };
}

/**
 * Ref kinds whose `uri` field holds an external URL instead of an `oc://` URI.
 * These represent tasks running on external platforms (Codex Web, Claude.ai/Code)
 * and are NOT counted against the host machine's concurrency limit.
 */
export const EXTERNAL_REF_KINDS = new Set<string>(["external:codex-task", "external:claude-task"]);

/** Returns true if the given ref kind is an external task kind. */
export function isExternalTaskRefKind(kind: string): boolean {
  return EXTERNAL_REF_KINDS.has(kind);
}

/**
 * Returns true if a work item has at least one external task ref in its payload.
 * Items with external task refs run on external platforms (e.g. Codex Web,
 * Claude.ai/Code) and should NOT count against the local concurrency limit.
 */
export function hasExternalTaskRef(payload?: Record<string, unknown>): boolean {
  const refs = readRefs(payload);
  return refs.some((ref) => EXTERNAL_REF_KINDS.has(ref.kind));
}

export function validateRef(ref: WorkItemRef): boolean {
  if (!ref || typeof ref !== "object") {
    return false;
  }
  if (!isWorkItemRefKind(ref.kind)) {
    return false;
  }
  if (!ref.id || typeof ref.id !== "string") {
    return false;
  }
  if (ref.label !== undefined && typeof ref.label !== "string") {
    return false;
  }
  if (ref.uri !== undefined) {
    if (typeof ref.uri !== "string") {
      return false;
    }
    // External refs carry an https:// URL rather than an oc:// URI
    if (EXTERNAL_REF_KINDS.has(ref.kind)) {
      // Accept any non-empty string (typically https://…)
      if (!ref.uri.trim()) {
        return false;
      }
    } else {
      try {
        const parsed = parseRef(ref.uri);
        if (parsed.kind !== ref.kind || parsed.id !== ref.id) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  return true;
}

export function readRefs(payload?: WorkItemPayload | Record<string, unknown>): WorkItemRef[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const refs = (payload as WorkItemPayload).refs;
  if (!Array.isArray(refs)) {
    return [];
  }
  return refs.filter((ref) => validateRef(ref));
}

export async function resolveRef(
  ref: WorkItemRef,
  context?: WorkItemRefResolverContext,
): Promise<unknown> {
  if (context?.resolvers?.[ref.kind]) {
    return context.resolvers[ref.kind]?.(ref);
  }
  if (ref.kind === "work:item") {
    return context?.workQueueStore?.getItem(ref.id) ?? null;
  }
  if (ref.kind === "work:queue") {
    return context?.workQueueStore?.getQueue(ref.id) ?? null;
  }
  if (ref.kind === "memory:entry") {
    return context?.progressiveMemoryStore?.getById(ref.id) ?? null;
  }
  return null;
}
