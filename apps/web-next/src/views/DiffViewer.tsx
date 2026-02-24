import React, { useState } from "react";
import { cn } from "../lib/utils";

type DiffMode = "side-by-side" | "unified";
type ChangeType = "added" | "removed" | "modified" | "unchanged";

interface DiffLine {
  type: ChangeType;
  leftNum: number | null;
  rightNum: number | null;
  content: string;
}

interface FileDiff {
  id: string;
  filename: string;
  language: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffSet {
  id: string;
  title: string;
  description: string;
  author: string;
  date: string;
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
}

const langColor = (lang: string) => {
  if (lang === "tsx" || lang === "ts")  {return "text-blue-400";}
  if (lang === "json")                  {return "text-amber-400";}
  if (lang === "sh" || lang === "bash") {return "text-emerald-400";}
  if (lang === "md")                    {return "text-purple-400";}
  return "text-[var(--color-text-secondary)]";
};

const DIFF_SETS: DiffSet[] = [
  {
    id: "ds1",
    title: "feat(ui): Add ChatRoomView",
    description: "Multi-channel chat interface with threads, reactions, and presence indicators",
    author: "Luis 🎨",
    date: "2026-02-22 07:15",
    totalAdditions: 412,
    totalDeletions: 0,
    files: [
      {
        id: "f1",
        filename: "src/views/ChatRoomView.tsx",
        language: "tsx",
        additions: 380,
        deletions: 0,
        hunks: [
          {
            header: "@@ -0,0 +1,380 @@",
            lines: [
              { type: "added", leftNum: null, rightNum: 1,  content: `import React, { useState } from "react";` },
              { type: "added", leftNum: null, rightNum: 2,  content: `import { cn } from "../lib/utils";` },
              { type: "added", leftNum: null, rightNum: 3,  content: `` },
              { type: "added", leftNum: null, rightNum: 4,  content: `type MessageStatus = "sent" | "delivered" | "read";` },
              { type: "added", leftNum: null, rightNum: 5,  content: `type PresenceStatus = "online" | "away" | "offline" | "dnd";` },
              { type: "added", leftNum: null, rightNum: 6,  content: `` },
              { type: "added", leftNum: null, rightNum: 7,  content: `interface ChatMessage {` },
              { type: "added", leftNum: null, rightNum: 8,  content: `  id: string;` },
              { type: "added", leftNum: null, rightNum: 9,  content: `  authorId: string;` },
              { type: "added", leftNum: null, rightNum: 10, content: `  content: string;` },
              { type: "added", leftNum: null, rightNum: 11, content: `  timestamp: string;` },
              { type: "added", leftNum: null, rightNum: 12, content: `  reactions: Reaction[];` },
              { type: "added", leftNum: null, rightNum: 13, content: `}` },
            ],
          },
        ],
      },
      {
        id: "f2",
        filename: "src/App.tsx",
        language: "tsx",
        additions: 4,
        deletions: 0,
        hunks: [
          {
            header: "@@ -122,3 +122,7 @@",
            lines: [
              { type: "unchanged", leftNum: 122, rightNum: 122, content: `const HealthChecklist = React.lazy(() => import("./views/HealthChecklist"));` },
              { type: "unchanged", leftNum: 123, rightNum: 123, content: `const BudgetTracker   = React.lazy(() => import("./views/BudgetTracker"));` },
              { type: "added",    leftNum: null, rightNum: 124, content: `const ChatRoomView    = React.lazy(() => import("./views/ChatRoomView"));` },
              { type: "unchanged", leftNum: 124, rightNum: 125, content: `` },
              { type: "unchanged", leftNum: 125, rightNum: 126, content: `const NAV_ITEMS: NavItem[] = [` },
            ],
          },
        ],
      },
      {
        id: "f3",
        filename: "package.json",
        language: "json",
        additions: 0,
        deletions: 2,
        hunks: [
          {
            header: "@@ -14,8 +14,6 @@",
            lines: [
              { type: "unchanged", leftNum: 14, rightNum: 14, content: `  "dependencies": {` },
              { type: "unchanged", leftNum: 15, rightNum: 15, content: `    "react": "^18.3.0",` },
              { type: "removed",   leftNum: 16, rightNum: null, content: `    "lucide-react": "^0.460.0",` },
              { type: "removed",   leftNum: 17, rightNum: null, content: `    "@radix-ui/react-icons": "^1.3.0",` },
              { type: "unchanged", leftNum: 18, rightNum: 16, content: `    "tailwind-merge": "^2.5.4"` },
              { type: "unchanged", leftNum: 19, rightNum: 17, content: `  }` },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ds2",
    title: "fix(ui): Resolve MetricsDrilldown TS error",
    description: "Remove invalid CSS property ringColor from style attribute",
    author: "Luis 🎨",
    date: "2026-02-22 05:40",
    totalAdditions: 1,
    totalDeletions: 1,
    files: [
      {
        id: "f4",
        filename: "src/views/MetricsDrilldown.tsx",
        language: "tsx",
        additions: 1,
        deletions: 1,
        hunks: [
          {
            header: "@@ -184,3 +184,3 @@",
            lines: [
              { type: "unchanged", leftNum: 183, rightNum: 183, content: `              className={cn("text-sm font-semibold", isSelected && "text-indigo-400")}` },
              { type: "removed",   leftNum: 184, rightNum: null, content: `              style={isSelected ? { ringColor: "currentColor" } : {}}` },
              { type: "added",    leftNum: null, rightNum: 184, content: `              style={isSelected ? {} : {}}` },
              { type: "unchanged", leftNum: 185, rightNum: 185, content: `            >` },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ds3",
    title: "feat(ui): views #86-89 agent-spawned + telemetry",
    description: "EmbeddingExplorer, RuleEngine (agents); TelemetryViewer, ModelHealthDashboard (Luis)",
    author: "Luis 🎨 + Squad",
    date: "2026-02-22 04:55",
    totalAdditions: 1622,
    totalDeletions: 0,
    files: [
      { id: "f5", filename: "src/views/EmbeddingExplorer.tsx", language: "tsx", additions: 418, deletions: 0, hunks: [] },
      { id: "f6", filename: "src/views/RuleEngine.tsx",        language: "tsx", additions: 391, deletions: 0, hunks: [] },
      { id: "f7", filename: "src/views/TelemetryViewer.tsx",   language: "tsx", additions: 680, deletions: 0, hunks: [] },
      { id: "f8", filename: "src/views/ModelHealthDashboard.tsx", language: "tsx", additions: 524, deletions: 0, hunks: [] },
    ],
  },
];

export default function DiffViewer() {
  const [selectedSetId, setSelectedSetId] = useState<string>("ds1");
  const [selectedFileId, setSelectedFileId] = useState<string>("f1");
  const [mode, setMode] = useState<DiffMode>("side-by-side");
  const [collapsedHunks, setCollapsedHunks] = useState<Set<string>>(new Set());
  const [showWhitespace, setShowWhitespace] = useState<boolean>(false);

  const selectedSet = DIFF_SETS.find(d => d.id === selectedSetId) ?? DIFF_SETS[0];
  const selectedFile = selectedSet.files.find(f => f.id === selectedFileId) ?? selectedSet.files[0];

  function toggleHunk(key: string) {
    setCollapsedHunks(prev => {
      const next = new Set(prev);
      if (next.has(key)) {next.delete(key);} else {next.add(key);}
      return next;
    });
  }

  const lineClass = (type: ChangeType) => {
    if (type === "added")   {return "bg-emerald-500/10 border-l-2 border-emerald-500";}
    if (type === "removed") {return "bg-rose-500/10 border-l-2 border-rose-500";}
    return "";
  };

  const linePrefix = (type: ChangeType) => {
    if (type === "added")   {return <span className="text-emerald-400 select-none mr-2">+</span>;}
    if (type === "removed") {return <span className="text-rose-400 select-none mr-2">-</span>;}
    return <span className="text-[var(--color-text-muted)] select-none mr-2"> </span>;
  };

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] overflow-hidden">
      {/* Left sidebar: diff sets + files */}
      <div className="w-64 flex-shrink-0 bg-[var(--color-surface-1)] border-r border-[var(--color-border)] flex flex-col">
        {/* Diff set list */}
        <div className="p-3 border-b border-[var(--color-border)]">
          <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Commits</div>
          <div className="space-y-1">
            {DIFF_SETS.map(ds => (
              <button
                key={ds.id}
                onClick={() => { setSelectedSetId(ds.id); setSelectedFileId(ds.files[0]?.id ?? ""); }}
                className={cn(
                  "w-full text-left p-2 rounded text-xs transition-colors",
                  selectedSetId === ds.id ? "bg-indigo-500/20 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <div className="font-medium truncate">{ds.title}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2">
                  <span className="text-emerald-400">+{ds.totalAdditions}</span>
                  <span className="text-rose-400">-{ds.totalDeletions}</span>
                  <span className="ml-auto">{ds.date.split(" ")[1]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Files in selected set */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Files ({selectedSet.files.length})
          </div>
          <div className="space-y-0.5">
            {selectedSet.files.map(file => (
              <button
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                  selectedFileId === file.id ? "bg-indigo-500/20 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <div className={cn("font-mono truncate text-[10px]", langColor(file.language))}>
                  {file.filename.split("/").pop()}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {file.additions > 0 && <span className="text-[9px] text-emerald-400">+{file.additions}</span>}
                  {file.deletions > 0 && <span className="text-[9px] text-rose-400">-{file.deletions}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Author info */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="text-[10px] text-[var(--color-text-muted)]">{selectedSet.author}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{selectedSet.date}</div>
        </div>
      </div>

      {/* Main diff area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Diff toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-1)] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className={cn("font-mono text-sm font-semibold", langColor(selectedFile.language))}>
              {selectedFile.filename}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedSet.description}</div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats */}
            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">+{selectedFile.additions}</span>
            <span className="text-xs text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">-{selectedFile.deletions}</span>

            {/* Mode toggle */}
            <div className="flex rounded border border-[var(--color-border)] overflow-hidden">
              {(["side-by-side", "unified"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "text-xs px-3 py-1 transition-colors",
                    mode === m ? "bg-indigo-500 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {m === "side-by-side" ? "⏮⏭" : "≡"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowWhitespace(v => !v)}
              className={cn("text-xs px-3 py-1 rounded border transition-colors", showWhitespace ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)]")}
            >
              ¶ Space
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {selectedFile.hunks.length === 0 ? (
            <div className="p-6 text-center text-[var(--color-text-muted)]">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-sm">New file added — {selectedFile.additions} lines</p>
              <p className="text-[10px] mt-1 text-[var(--color-text-muted)]">Full content not shown in this preview</p>
            </div>
          ) : (
            <div className="font-mono text-xs">
              {selectedFile.hunks.map((hunk, hi) => {
                const hunkKey = `${selectedFileId}-${hi}`;
                const isCollapsed = collapsedHunks.has(hunkKey);
                return (
                  <div key={hi}>
                    {/* Hunk header */}
                    <button
                      onClick={() => toggleHunk(hunkKey)}
                      className="w-full text-left bg-indigo-500/10 border-y border-indigo-500/20 px-4 py-1.5 text-[10px] text-indigo-400 hover:bg-indigo-500/20 transition-colors flex items-center gap-2"
                    >
                      <span>{isCollapsed ? "▶" : "▼"}</span>
                      <span>{hunk.header}</span>
                    </button>

                    {!isCollapsed && (
                      mode === "unified" ? (
                        /* Unified diff */
                        <table className="w-full border-collapse">
                          <tbody>
                            {hunk.lines.map((line, li) => (
                              <tr key={li} className={cn("group", lineClass(line.type))}>
                                <td className="w-10 text-right text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 select-none border-r border-[var(--color-border)]">
                                  {line.leftNum ?? ""}
                                </td>
                                <td className="w-10 text-right text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 select-none border-r border-[var(--color-border)]">
                                  {line.rightNum ?? ""}
                                </td>
                                <td className="px-4 py-0.5 whitespace-pre">
                                  {linePrefix(line.type)}
                                  <span className={cn(
                                    line.type === "added" ? "text-emerald-100" : line.type === "removed" ? "text-rose-200" : "text-[var(--color-text-primary)]"
                                  )}>
                                    {showWhitespace ? line.content.replace(/ /g, "·").replace(/\t/g, "→") : line.content}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        /* Side-by-side diff */
                        <div className="flex">
                          {/* Left (old) */}
                          <div className="flex-1 border-r border-[var(--color-border)]">
                            <table className="w-full border-collapse">
                              <tbody>
                                {hunk.lines.map((line, li) => {
                                  if (line.type === "added") {
                                    return (
                                      <tr key={li}>
                                        <td className="w-8 text-right text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 select-none" />
                                        <td className="px-3 py-0.5 bg-[var(--color-surface-0)]/50" />
                                      </tr>
                                    );
                                  }
                                  return (
                                    <tr key={li} className={line.type === "removed" ? "bg-rose-500/10 border-l-2 border-rose-500" : ""}>
                                      <td className="w-8 text-right text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 select-none border-r border-[var(--color-border)]">
                                        {line.leftNum ?? ""}
                                      </td>
                                      <td className="px-3 py-0.5 whitespace-pre text-xs">
                                        {line.type === "removed" && <span className="text-rose-400 mr-2">-</span>}
                                        {line.type === "unchanged" && <span className="text-[var(--color-text-muted)] mr-2"> </span>}
                                        <span className={cn(line.type === "removed" ? "text-rose-200" : "text-[var(--color-text-primary)]")}>
                                          {showWhitespace ? line.content.replace(/ /g, "·") : line.content}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Right (new) */}
                          <div className="flex-1">
                            <table className="w-full border-collapse">
                              <tbody>
                                {hunk.lines.map((line, li) => {
                                  if (line.type === "removed") {
                                    return (
                                      <tr key={li}>
                                        <td className="w-8 text-right text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 select-none" />
                                        <td className="px-3 py-0.5 bg-[var(--color-surface-0)]/50" />
                                      </tr>
                                    );
                                  }
                                  return (
                                    <tr key={li} className={line.type === "added" ? "bg-emerald-500/10 border-l-2 border-emerald-500" : ""}>
                                      <td className="w-8 text-right text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 select-none border-r border-[var(--color-border)]">
                                        {line.rightNum ?? ""}
                                      </td>
                                      <td className="px-3 py-0.5 whitespace-pre text-xs">
                                        {line.type === "added" && <span className="text-emerald-400 mr-2">+</span>}
                                        {line.type === "unchanged" && <span className="text-[var(--color-text-muted)] mr-2"> </span>}
                                        <span className={cn(line.type === "added" ? "text-emerald-100" : "text-[var(--color-text-primary)]")}>
                                          {showWhitespace ? line.content.replace(/ /g, "·") : line.content}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
