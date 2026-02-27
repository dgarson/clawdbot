export const ATTACHMENT_MANIFEST_KEY = "openclaw:claude-sdk-attachment-manifest";

export interface AttachmentRecord {
  artifact_id: string;
  display_name: string;
  media_type: string;
  content_hash: string;
  source_message_id: string;
  source_thread_id: string | null;
  included_at_turn: number;
}

export interface AttachmentManifest {
  entries: Record<string, AttachmentRecord>;
}

export function createAttachmentManifest(): AttachmentManifest {
  return { entries: {} };
}

export function isAlreadyAttached(
  manifest: AttachmentManifest,
  artifactId: string,
  _contentHash: string,
): boolean {
  // Exact artifact_id match — content_hash is stored for informational/auditing purposes only
  return Boolean(manifest.entries[artifactId]);
}

export function recordAttachment(
  manifest: AttachmentManifest,
  params: {
    artifactId: string;
    displayName: string;
    mediaType: string;
    contentHash: string;
    sourceMessageId: string;
    sourceThreadId: string | null;
    turn: number;
  },
): void {
  manifest.entries[params.artifactId] = {
    artifact_id: params.artifactId,
    display_name: params.displayName,
    media_type: params.mediaType,
    content_hash: params.contentHash,
    source_message_id: params.sourceMessageId,
    source_thread_id: params.sourceThreadId,
    included_at_turn: params.turn,
  };
}

export function getThreadAttachments(
  manifest: AttachmentManifest,
  threadId: string,
): AttachmentRecord[] {
  return Object.values(manifest.entries).filter((e) => e.source_thread_id === threadId);
}

export function serializeManifest(manifest: AttachmentManifest): string {
  return JSON.stringify(manifest);
}

export function loadManifestFromEntries(
  entries: Array<{ type: string; customType?: string; data?: unknown }>,
): AttachmentManifest {
  const latest = [...entries]
    .toReversed()
    .find((e) => e.type === "custom" && e.customType === ATTACHMENT_MANIFEST_KEY);
  if (!latest || typeof latest.data !== "string") {
    return createAttachmentManifest();
  }
  try {
    const parsed = JSON.parse(latest.data) as unknown;
    if (parsed && typeof parsed === "object" && "entries" in parsed) {
      return parsed as AttachmentManifest;
    }
  } catch {
    // Malformed — start fresh
  }
  return createAttachmentManifest();
}
