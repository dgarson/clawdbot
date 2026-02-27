import { describe, expect, it } from "vitest";
import {
  createAttachmentManifest,
  isAlreadyAttached,
  recordAttachment,
  serializeManifest,
  loadManifestFromEntries,
  getThreadAttachments,
} from "./attachment-manifest.js";

const ENTRY_KEY = "openclaw:claude-sdk-attachment-manifest";

describe("AttachmentManifest", () => {
  it("creates an empty manifest", () => {
    const m = createAttachmentManifest();
    expect(Object.keys(m.entries).length).toBe(0);
  });

  it("records a new attachment", () => {
    const m = createAttachmentManifest();
    recordAttachment(m, {
      artifactId: "A1",
      displayName: "photo.png",
      mediaType: "image/png",
      contentHash: "abc123",
      sourceMessageId: "msg1",
      sourceThreadId: "thread1",
      turn: 1,
    });
    expect(m.entries["A1"]).toBeDefined();
    expect(m.entries["A1"].display_name).toBe("photo.png");
  });

  it("detects already-attached by artifact_id", () => {
    const m = createAttachmentManifest();
    recordAttachment(m, {
      artifactId: "A1",
      displayName: "photo.png",
      mediaType: "image/png",
      contentHash: "abc123",
      sourceMessageId: "msg1",
      sourceThreadId: null,
      turn: 1,
    });
    expect(isAlreadyAttached(m, "A1", "abc123")).toBe(true);
    expect(isAlreadyAttached(m, "A2", "abc123")).toBe(false);
  });

  it("round-trips through serialize/load", () => {
    const m = createAttachmentManifest();
    recordAttachment(m, {
      artifactId: "A1",
      displayName: "photo.png",
      mediaType: "image/png",
      contentHash: "abc123",
      sourceMessageId: "msg1",
      sourceThreadId: "t1",
      turn: 2,
    });
    const serialized = serializeManifest(m);
    const entries = [{ type: "custom", customType: ENTRY_KEY, data: serialized }];
    const loaded = loadManifestFromEntries(entries);
    expect(loaded.entries["A1"].content_hash).toBe("abc123");
  });

  it("filters attachments by source thread ID for post-compaction", () => {
    const m = createAttachmentManifest();
    recordAttachment(m, {
      artifactId: "A1",
      displayName: "a.png",
      mediaType: "image/png",
      contentHash: "h1",
      sourceMessageId: "m1",
      sourceThreadId: "thread1",
      turn: 1,
    });
    recordAttachment(m, {
      artifactId: "A2",
      displayName: "b.png",
      mediaType: "image/png",
      contentHash: "h2",
      sourceMessageId: "m2",
      sourceThreadId: "thread2",
      turn: 1,
    });
    const threadAttachments = getThreadAttachments(m, "thread1");
    expect(threadAttachments.length).toBe(1);
    expect(threadAttachments[0].artifact_id).toBe("A1");
  });
});
