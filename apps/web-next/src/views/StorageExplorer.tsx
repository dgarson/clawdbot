import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type FileKind = "file" | "directory" | "symlink";
type FileCategory = "document" | "image" | "code" | "data" | "archive" | "audio" | "video" | "other";

interface FSNode {
  id: string;
  name: string;
  kind: FileKind;
  path: string;
  size?: number; // bytes, undefined for dirs
  category?: FileCategory;
  ext?: string;
  modifiedAt: string;
  createdAt: string;
  owner: string; // agentId
  permissions: string; // "rwxr-xr-x"
  children?: FSNode[];
  preview?: string; // text preview snippet
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const ROOT: FSNode = {
  id: "root",
  name: "workspace",
  kind: "directory",
  path: "/Users/openclaw/.openclaw/workspace",
  modifiedAt: "2026-02-22T01:00:00Z",
  createdAt: "2025-06-01T00:00:00Z",
  owner: "system",
  permissions: "rwxr-xr-x",
  children: [
    {
      id: "dir-luis",
      name: "luis",
      kind: "directory",
      path: "/Users/openclaw/.openclaw/workspace/luis",
      modifiedAt: "2026-02-22T01:18:00Z",
      createdAt: "2025-08-10T12:00:00Z",
      owner: "luis",
      permissions: "rwxr-xr-x",
      children: [
        {
          id: "file-agents",
          name: "AGENTS.md",
          kind: "file",
          path: "/Users/openclaw/.openclaw/workspace/luis/AGENTS.md",
          size: 4821,
          category: "document",
          ext: "md",
          modifiedAt: "2026-02-15T08:30:00Z",
          createdAt: "2025-08-10T12:00:00Z",
          owner: "luis",
          permissions: "rw-r--r--",
          preview: "# AGENTS.md — Luis (Principal UX Engineer)\n\n## Role\n\n**Principal UX Engineer** — bridge between design intent and production code.",
        },
        {
          id: "file-ux-roadmap",
          name: "UX_ROADMAP.md",
          kind: "file",
          path: "/Users/openclaw/.openclaw/workspace/luis/UX_ROADMAP.md",
          size: 3215,
          category: "document",
          ext: "md",
          modifiedAt: "2026-02-22T01:00:00Z",
          createdAt: "2025-09-01T00:00:00Z",
          owner: "luis",
          permissions: "rw-r--r--",
          preview: "# UX Roadmap — Feb-Mar 2026\n\n## Sprint: Horizon UI — 40 Views\n\nGoal: Ship 40 production-ready views for the OpenClaw Horizon UI.",
        },
        {
          id: "dir-apps",
          name: "apps",
          kind: "directory",
          path: "/Users/openclaw/.openclaw/workspace/luis/apps",
          modifiedAt: "2026-02-22T01:18:00Z",
          createdAt: "2025-10-01T00:00:00Z",
          owner: "luis",
          permissions: "rwxr-xr-x",
          children: [
            {
              id: "dir-web-next",
              name: "web-next",
              kind: "directory",
              path: "/Users/openclaw/.openclaw/workspace/luis/apps/web-next",
              modifiedAt: "2026-02-22T01:18:00Z",
              createdAt: "2025-10-15T00:00:00Z",
              owner: "luis",
              permissions: "rwxr-xr-x",
              children: [
                {
                  id: "file-pkg",
                  name: "package.json",
                  kind: "file",
                  path: "/Users/openclaw/.openclaw/workspace/luis/apps/web-next/package.json",
                  size: 892,
                  category: "data",
                  ext: "json",
                  modifiedAt: "2026-02-10T09:00:00Z",
                  createdAt: "2025-10-15T00:00:00Z",
                  owner: "luis",
                  permissions: "rw-r--r--",
                  preview: '{\n  "name": "horizon-ui",\n  "version": "2.4.1",\n  "type": "module",\n  "scripts": { "build": "vite build", "dev": "vite" }',
                },
                {
                  id: "file-app",
                  name: "App.tsx",
                  kind: "file",
                  path: "/Users/openclaw/.openclaw/workspace/luis/apps/web-next/src/App.tsx",
                  size: 18420,
                  category: "code",
                  ext: "tsx",
                  modifiedAt: "2026-02-22T01:18:00Z",
                  createdAt: "2025-10-15T00:00:00Z",
                  owner: "luis",
                  permissions: "rw-r--r--",
                  preview: "import React, { Suspense, lazy, useState, useCallback } from 'react';\n// Main application shell — 39 views registered",
                },
              ],
            },
          ],
        },
        {
          id: "dir-memory",
          name: "memory",
          kind: "directory",
          path: "/Users/openclaw/.openclaw/workspace/luis/memory",
          modifiedAt: "2026-02-22T01:10:00Z",
          createdAt: "2026-01-01T00:00:00Z",
          owner: "luis",
          permissions: "rwxr-xr-x",
          children: [
            {
              id: "file-mem-today",
              name: "2026-02-22.md",
              kind: "file",
              path: "/Users/openclaw/.openclaw/workspace/luis/memory/2026-02-22.md",
              size: 5130,
              category: "document",
              ext: "md",
              modifiedAt: "2026-02-22T01:10:00Z",
              createdAt: "2026-02-22T00:00:00Z",
              owner: "luis",
              permissions: "rw-r--r--",
              preview: "# 2026-02-22\n\n## Session Notes\n\n**Goal:** Horizon UI sprint — 40 views by 7:30 AM MST\n**Status:** 39 views committed, 1 AM session ongoing.",
            },
          ],
        },
      ],
    },
    {
      id: "dir-shared",
      name: "_shared",
      kind: "directory",
      path: "/Users/openclaw/.openclaw/workspace/_shared",
      modifiedAt: "2026-02-21T18:00:00Z",
      createdAt: "2025-06-01T00:00:00Z",
      owner: "system",
      permissions: "rwxr-xr-x",
      children: [
        {
          id: "dir-scripts",
          name: "scripts",
          kind: "directory",
          path: "/Users/openclaw/.openclaw/workspace/_shared/scripts",
          modifiedAt: "2026-02-20T10:00:00Z",
          createdAt: "2025-06-01T00:00:00Z",
          owner: "system",
          permissions: "rwxr-xr-x",
          children: [
            {
              id: "file-tts",
              name: "openai-tts.sh",
              kind: "file",
              path: "/Users/openclaw/.openclaw/workspace/_shared/scripts/openai-tts.sh",
              size: 1024,
              category: "code",
              ext: "sh",
              modifiedAt: "2026-01-15T00:00:00Z",
              createdAt: "2025-08-01T00:00:00Z",
              owner: "system",
              permissions: "rwxr-xr-x",
              preview: "#!/usr/bin/env bash\n# OpenAI TTS script — generates audio via tts-1-hd model\n# Usage: ./openai-tts.sh <text> <output_path> [voice]",
            },
            {
              id: "file-mail",
              name: "agent-mail.sh",
              kind: "file",
              path: "/Users/openclaw/.openclaw/workspace/_shared/scripts/agent-mail.sh",
              size: 2048,
              category: "code",
              ext: "sh",
              modifiedAt: "2026-02-01T00:00:00Z",
              createdAt: "2025-09-01T00:00:00Z",
              owner: "system",
              permissions: "rwxr-xr-x",
              preview: "#!/usr/bin/env bash\n# Agent mail utility — read, send, drain agent inbox messages",
            },
          ],
        },
        {
          id: "dir-audio",
          name: "audio",
          kind: "directory",
          path: "/Users/openclaw/.openclaw/workspace/_shared/audio",
          modifiedAt: "2026-02-20T14:30:00Z",
          createdAt: "2025-07-01T00:00:00Z",
          owner: "system",
          permissions: "rwxr-xr-x",
          children: [
            {
              id: "file-audio-report",
              name: "daily-report-2026-02-21.mp3",
              kind: "file",
              path: "/Users/openclaw/.openclaw/workspace/_shared/audio/daily-report-2026-02-21.mp3",
              size: 1843200,
              category: "audio",
              ext: "mp3",
              modifiedAt: "2026-02-21T20:00:00Z",
              createdAt: "2026-02-21T20:00:00Z",
              owner: "luis",
              permissions: "rw-r--r--",
            },
          ],
        },
      ],
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes?: number): string {
  if (bytes === undefined) {return "—";}
  if (bytes >= 1024 * 1024) {return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;}
  if (bytes >= 1024) {return `${(bytes / 1024).toFixed(0)} KB`;}
  return `${bytes} B`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ago`;}
  return `${Math.floor(hrs / 24)}d ago`;
}

const CATEGORY_EMOJIS: Record<FileCategory, string> = {
  document: "📄",
  image:    "🖼️",
  code:     "💻",
  data:     "📊",
  archive:  "📦",
  audio:    "🎵",
  video:    "🎬",
  other:    "📎",
};

function fileEmoji(node: FSNode): string {
  if (node.kind === "directory") {return "📁";}
  if (node.kind === "symlink") {return "🔗";}
  return CATEGORY_EMOJIS[node.category ?? "other"];
}

function totalSize(node: FSNode): number {
  if (node.kind === "file") {return node.size ?? 0;}
  return (node.children ?? []).reduce((acc, child) => acc + totalSize(child), 0);
}

function flatFiles(node: FSNode): FSNode[] {
  if (node.kind === "file") {return [node];}
  return (node.children ?? []).flatMap(flatFiles);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: FSNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: FSNode) => void;
  openIds: Set<string>;
  onToggle: (id: string) => void;
}

function TreeNode({ node, depth, selectedId, onSelect, openIds, onToggle }: TreeNodeProps) {
  const isOpen = openIds.has(node.id);
  const isDir = node.kind === "directory";

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) {onToggle(node.id);}
          onSelect(node);
        }}
        aria-expanded={isDir ? isOpen : undefined}
        aria-selected={selectedId === node.id}
        className={cn(
          "w-full text-left flex items-center gap-1.5 py-1 pr-3 rounded transition-colors text-sm",
          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
          selectedId === node.id
            ? "bg-indigo-950/40 text-[var(--color-text-primary)]"
            : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/40"
        )}
        style={{ paddingLeft: `${(depth * 16) + 8}px` }}
      >
        {isDir && (
          <span
            className={cn("text-[var(--color-text-muted)] text-xs transition-transform", isOpen && "rotate-90")}
            aria-hidden="true"
          >
            ▶
          </span>
        )}
        <span aria-hidden="true">{fileEmoji(node)}</span>
        <span className="truncate flex-1">{node.name}</span>
        {isDir && (
          <span className="text-[var(--color-text-muted)] text-xs shrink-0">{fmtSize(totalSize(node))}</span>
        )}
      </button>

      {isDir && isOpen && node.children && (
        <div role="group">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              openIds={openIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function StorageExplorer() {
  const [selectedNode, setSelectedNode] = useState<FSNode | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["root", "dir-luis", "dir-shared"]));
  const [search, setSearch] = useState("");

  const toggleDir = useCallback((id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);} else {next.add(id);}
      return next;
    });
  }, []);

  const allFiles = useMemo(() => flatFiles(ROOT), []);

  const searchResults = useMemo(() => {
    if (!search.trim()) {return [];}
    const q = search.toLowerCase();
    return allFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  }, [search, allFiles]);

  const totalWorkspaceSize = useMemo(() => totalSize(ROOT), []);

  return (
    <main className="flex h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden" role="main" aria-label="Storage Explorer">
      {/* Left: Tree + search */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Storage</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Workspace: {fmtSize(totalWorkspaceSize)} used</p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[var(--color-border)]">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files…"
            aria-label="Search files"
            className={cn(
              "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            )}
          />
        </div>

        {/* Tree or search results */}
        <div className="flex-1 overflow-y-auto p-2" role="tree" aria-label="File system tree">
          {search.trim() ? (
            searchResults.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-8">No files found</p>
            ) : (
              searchResults.map(node => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  aria-selected={selectedNode?.id === node.id}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2",
                    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                    selectedNode?.id === node.id
                      ? "bg-indigo-950/40 text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/40"
                  )}
                >
                  <span aria-hidden="true">{fileEmoji(node)}</span>
                  <span className="truncate flex-1 text-xs">{node.name}</span>
                  <span className="text-[var(--color-text-muted)] text-[10px] shrink-0">{fmtSize(node.size)}</span>
                </button>
              ))
            )
          ) : (
            <TreeNode
              node={ROOT}
              depth={0}
              selectedId={selectedNode?.id ?? null}
              onSelect={setSelectedNode}
              openIds={openIds}
              onToggle={toggleDir}
            />
          )}
        </div>
      </div>

      {/* Right: Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          <div className="p-6 space-y-5">
            {/* File header */}
            <div className="flex items-start gap-4">
              <span className="text-5xl" aria-hidden="true">{fileEmoji(selectedNode)}</span>
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedNode.name}</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 font-mono break-all">{selectedNode.path}</p>
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Kind",     value: selectedNode.kind },
                { label: "Size",     value: fmtSize(selectedNode.kind === "directory" ? totalSize(selectedNode) : selectedNode.size) },
                { label: "Owner",    value: selectedNode.owner },
                { label: "Modified", value: relTime(selectedNode.modifiedAt) },
                { label: "Created",  value: relTime(selectedNode.createdAt) },
                { label: "Perms",    value: selectedNode.permissions },
              ].map(m => (
                <div key={m.label} className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] p-3">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">{m.label}</p>
                  <p className="text-sm font-mono text-[var(--color-text-primary)] capitalize">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Directory contents */}
            {selectedNode.kind === "directory" && selectedNode.children && (
              <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Contents</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedNode.children.length} items · {fmtSize(totalSize(selectedNode))}</p>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {selectedNode.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => {
                        setSelectedNode(child);
                        if (child.kind === "directory") {toggleDir(child.id);}
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-2)]/40 transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none"
                      )}
                    >
                      <span aria-hidden="true">{fileEmoji(child)}</span>
                      <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">{child.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">
                        {fmtSize(child.kind === "directory" ? totalSize(child) : child.size)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">{relTime(child.modifiedAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File preview */}
            {selectedNode.kind === "file" && selectedNode.preview && (
              <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Preview</h3>
                  <button
                    className={cn(
                      "text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    )}
                    aria-label="Copy file content"
                    onClick={() => navigator.clipboard.writeText(selectedNode.preview ?? "")}
                  >
                    Copy
                  </button>
                </div>
                <pre className="p-4 text-xs text-[var(--color-text-primary)] overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedNode.preview}
                </pre>
              </div>
            )}

            {/* Audio player placeholder */}
            {selectedNode.category === "audio" && (
              <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] p-6 text-center">
                <p className="text-3xl mb-2">🎵</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Audio playback not available in browser preview</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-5xl mb-4">📂</p>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">Select a file or folder</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Browse the workspace tree on the left</p>
          </div>
        )}
      </div>
    </main>
  );
}
