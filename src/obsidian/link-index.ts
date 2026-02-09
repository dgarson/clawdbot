import path from "node:path";
import type { VaultAccessLayer } from "./vault-access.js";
import type { VaultFileEvent } from "./watcher.js";
import { parseObsidianNote } from "./parser.js";

export type LinkIndex = {
  forward: Map<string, Set<string>>;
  backward: Map<string, Set<string>>;
  allNotes: Set<string>;
  tags: Map<string, Set<string>>;
};

export async function buildLinkIndex(vault: VaultAccessLayer): Promise<LinkIndex> {
  const index: LinkIndex = {
    forward: new Map(),
    backward: new Map(),
    allNotes: new Set(),
    tags: new Map(),
  };

  const files = await vault.listFiles();
  for (const file of files) {
    if (!file.endsWith(".md")) {
      continue;
    }
    const note = await vault.readFile(file);
    if (!note) {
      continue;
    }

    const noteName = path.basename(file, ".md");
    index.allNotes.add(noteName);

    const parsed = parseObsidianNote(note.content);
    const targets = new Set(parsed.wikiLinks.map((link) => link.target));
    index.forward.set(noteName, targets);

    for (const target of targets) {
      if (!index.backward.has(target)) {
        index.backward.set(target, new Set());
      }
      index.backward.get(target)?.add(noteName);
    }

    for (const tag of parsed.tags) {
      if (!index.tags.has(tag)) {
        index.tags.set(tag, new Set());
      }
      index.tags.get(tag)?.add(noteName);
    }
  }

  return index;
}

export function updateLinkIndex(index: LinkIndex, event: VaultFileEvent): void {
  const noteName = path.basename(event.path, ".md");

  if (event.type === "deleted") {
    const oldTargets = index.forward.get(noteName);
    if (oldTargets) {
      for (const target of oldTargets) {
        index.backward.get(target)?.delete(noteName);
      }
    }
    index.forward.delete(noteName);
    index.allNotes.delete(noteName);

    for (const [, notes] of index.tags) {
      notes.delete(noteName);
    }
    return;
  }

  if (event.content) {
    const parsed = parseObsidianNote(event.content);

    const oldTargets = index.forward.get(noteName);
    if (oldTargets) {
      for (const target of oldTargets) {
        index.backward.get(target)?.delete(noteName);
      }
    }

    const newTargets = new Set(parsed.wikiLinks.map((link) => link.target));
    index.forward.set(noteName, newTargets);
    index.allNotes.add(noteName);

    for (const target of newTargets) {
      if (!index.backward.has(target)) {
        index.backward.set(target, new Set());
      }
      index.backward.get(target)?.add(noteName);
    }

    for (const [, notes] of index.tags) {
      notes.delete(noteName);
    }
    for (const tag of parsed.tags) {
      if (!index.tags.has(tag)) {
        index.tags.set(tag, new Set());
      }
      index.tags.get(tag)?.add(noteName);
    }
  }
}
