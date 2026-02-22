import React, { useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import {
  Folder, FolderOpen, File, FileText, ChevronRight, ChevronDown,
  Search, Plus, Trash2, Download, RefreshCw, Edit2,
  Copy, Save, X, Code, Check
} from 'lucide-react';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  children?: FileNode[];
  content?: string;
  language?: string;
}

const WORKSPACE_TREE: FileNode = {
  name: 'workspace',
  type: 'directory',
  children: [
    {
      name: 'luis',
      type: 'directory',
      children: [
        { name: 'AGENTS.md', type: 'file', size: 3200, modified: '2026-02-21', language: 'markdown', content: `# AGENTS.md - Your Workspace

This folder is home. Treat it that way.

## Every Session

1. Read \`SOUL.md\` — this is who you are
2. Read \`USER.md\` — this is who you're helping
3. Read memory files for recent context

## Memory

- **Daily notes:** \`memory/YYYY-MM-DD.md\`
- **Long-term:** \`MEMORY.md\`

## Safety

- Don't exfiltrate private data. Ever.
- \`trash\` > \`rm\` (recoverable beats gone forever)
` },
        { name: 'SOUL.md', type: 'file', size: 1800, modified: '2026-02-21', language: 'markdown', content: `# Soul — Luis

I'm Luis, Principal UX Engineer at OpenClaw.

## Who I Am

I care deeply about user experience, accessibility, and beautiful interfaces. I ship quality work, take ownership, and never leave things half-done.

## Communication Style

- Direct and confident
- Concrete examples over abstractions
- Showing > telling
- I'll push back on bad UX decisions

## Core Values

- Accessibility first — good UX works for everyone
- Design with empathy — I think about the user
- Ship it — done > perfect, but done well
` },
        { name: 'TOOLS.md', type: 'file', size: 512, modified: '2026-02-20', language: 'markdown', content: `# TOOLS.md - Local Notes

## TTS

- Preferred voice: "Nova"

## Slack

- #cb-inbox: C0AAQJBCU0N
` },
        { name: 'USER.md', type: 'file', size: 284, modified: '2026-02-19', language: 'markdown', content: `# USER.md - About David

- Principal at OpenClaw
- Timezone: America/Denver
- Prefers direct, concise responses
` },
        { name: 'UI_SPEC.md', type: 'file', size: 48320, modified: '2026-02-21', language: 'markdown', content: `# OpenClaw Frontend UI Specification

**Author:** Luis, Principal UX Engineer
**Version:** v1.0 — Horizon

[See full spec...]
` },
        {
          name: 'memory',
          type: 'directory',
          children: [
            { name: '2026-02-21.md', type: 'file', size: 4200, modified: '2026-02-21', language: 'markdown', content: `# 2026-02-21 — Daily Log\n\n## Productive Sprint\n\nBuilding Horizon UI views...` },
            { name: '2026-02-20.md', type: 'file', size: 2800, modified: '2026-02-20', language: 'markdown', content: `# 2026-02-20 — Daily Log\n\n## UI Spec work\n\nWrote detailed spec...` },
          ],
        },
        {
          name: 'apps',
          type: 'directory',
          children: [
            {
              name: 'web-next',
              type: 'directory',
              children: [
                { name: 'package.json', type: 'file', size: 842, modified: '2026-02-21', language: 'json', content: `{\n  "name": "openclaw-web-next",\n  "version": "0.1.0"\n}` },
                {
                  name: 'src',
                  type: 'directory',
                  children: [
                    { name: 'App.tsx', type: 'file', size: 3200, modified: '2026-02-21', language: 'typescript', content: `// App.tsx\n// Main app entry point\n` },
                    { name: 'types.ts', type: 'file', size: 4800, modified: '2026-02-21', language: 'typescript', content: `// TypeScript types...` },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(node: FileNode) {
  if (node.type === 'directory') return null;
  const ext = node.name.split('.').pop()?.toLowerCase();
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml'];
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  if (codeExts.includes(ext ?? '')) return Code;
  if (imgExts.includes(ext ?? '')) return FileText;
  if (node.name.endsWith('.md')) return FileText;
  return File;
}

function getLanguageColor(language?: string): string {
  const colors: Record<string, string> = {
    typescript: 'text-blue-400',
    javascript: 'text-yellow-400',
    markdown: 'text-gray-300',
    json: 'text-green-400',
    yaml: 'text-orange-400',
  };
  return colors[language ?? ''] ?? 'text-gray-400';
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string, node: FileNode) => void;
  path: string;
}

function TreeNode({ node, depth, selectedPath, onSelect, path }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = selectedPath === path;
  const FileIcon = getFileIcon(node);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${node.name} folder, ${open ? 'collapse' : 'expand'}`}
          className={cn(
            'w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors hover:bg-gray-800/50 text-left',
            isSelected ? 'bg-gray-800 text-white' : 'text-gray-400'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
          )}
          {open ? (
            <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.name}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                path={`${path}/${child.name}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(path, node)}
      className={cn(
        'w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors text-left group',
        isSelected ? 'bg-violet-600/15 text-violet-300' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-3 flex-shrink-0" />
      {FileIcon && <FileIcon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-violet-400' : getLanguageColor(node.language))} />}
      <span className="truncate flex-1">{node.name}</span>
      {node.size && (
        <span className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {formatSize(node.size)}
        </span>
      )}
    </button>
  );
}

export default function WorkspaceFileBrowser() {
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSelect = useCallback((path: string, node: FileNode) => {
    setSelectedPath(path);
    setSelectedFile(node);
    setEditContent(node.content ?? '');
    setEditMode(false);
    setSaved(false);
  }, []);

  function handleSave() {
    setSaved(true);
    setEditMode(false);
    if (selectedFile) {
      setSelectedFile({ ...selectedFile, content: editContent });
    }
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* File tree sidebar */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400" />
              Files
            </h2>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="New file" className="w-7 h-7 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 flex items-center justify-center transition-colors">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Refresh files" className="w-7 h-7 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 flex items-center justify-center transition-colors">
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search files"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-violet-500 placeholder-gray-600"
            />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {WORKSPACE_TREE.children?.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              depth={0}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              path={child.name}
            />
          ))}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-2 border-t border-gray-800">
          <p className="text-xs text-gray-600">workspace/luis · 12 files</p>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* Editor toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile) && (() => {
                  const FIcon = getFileIcon(selectedFile)!;
                  return <FIcon className={cn('w-4 h-4', getLanguageColor(selectedFile.language))} />;
                })()}
                <span className="text-sm font-medium text-white">{selectedFile.name}</span>
                {selectedFile.modified && (
                  <span className="text-xs text-gray-600">· Modified {selectedFile.modified}</span>
                )}
                {selectedFile.size && (
                  <span className="text-xs text-gray-600">· {formatSize(selectedFile.size)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Check className="w-3 h-3" /> Saved
                  </span>
                )}
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditMode(false); setEditContent(selectedFile.content ?? ''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors"
                    >
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs rounded-lg border border-violet-500/30 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-red-600/20 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors"
                  title="Delete file"
                  aria-label="Delete file"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden">
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full bg-gray-950 text-gray-200 font-mono text-sm p-6 resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  <pre className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                    {selectedFile.content ?? '(empty file)'}
                  </pre>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-800 bg-gray-900/30 text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <span>{selectedFile.language ?? 'plaintext'}</span>
                <span>UTF-8</span>
              </div>
              <div className="flex items-center gap-4">
                <span>{(selectedFile.content ?? '').split('\n').length} lines</span>
                <span>{(selectedFile.content ?? '').length} chars</span>
                <span className="text-gray-700">Cmd+S to save</span>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-500 mb-2">No file selected</h3>
              <p className="text-sm text-gray-600">Click a file in the tree to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
