import React, { useState } from "react";
import { cn } from "../lib/utils";

type Category = "agent" | "tool" | "memory" | "task" | "config";
type Model = "text-embedding-3-small" | "all-MiniLM";

interface Embedding {
  id: string;
  text: string;
  category: Category;
  model: Model;
  dimensions: 1536 | 384;
  x: number;
  y: number;
  similarity: number;
  tags: string[];
  vector: number[];
}

const CATEGORY_COLORS: Record<Category, { dot: string; text: string; label: string }> = {
  agent: { dot: "bg-indigo-400", text: "text-indigo-400", label: "Agent" },
  tool: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Tool" },
  memory: { dot: "bg-purple-400", text: "text-purple-400", label: "Memory" },
  task: { dot: "bg-amber-400", text: "text-amber-400", label: "Task" },
  config: { dot: "bg-blue-400", text: "text-blue-400", label: "Config" },
};

function makeVector(): number[] {
  return Array.from({ length: 8 }, () => parseFloat((Math.random() * 2 - 1).toFixed(4)));
}

const SEED_EMBEDDINGS: Embedding[] = [
  { id: "emb-001", text: "Agent initialization routine", category: "agent", model: "text-embedding-3-small", dimensions: 1536, x: 12, y: 23, similarity: 0.94, tags: ["init", "startup"], vector: makeVector() },
  { id: "emb-002", text: "Web search tool invocation", category: "tool", model: "text-embedding-3-small", dimensions: 1536, x: 45, y: 67, similarity: 0.87, tags: ["search", "web"], vector: makeVector() },
  { id: "emb-003", text: "Long-term memory retrieval", category: "memory", model: "all-MiniLM", dimensions: 384, x: 78, y: 34, similarity: 0.91, tags: ["retrieval", "ltm"], vector: makeVector() },
  { id: "emb-004", text: "Schedule daily heartbeat task", category: "task", model: "text-embedding-3-small", dimensions: 1536, x: 34, y: 82, similarity: 0.72, tags: ["cron", "heartbeat"], vector: makeVector() },
  { id: "emb-005", text: "Gateway configuration update", category: "config", model: "all-MiniLM", dimensions: 384, x: 62, y: 15, similarity: 0.68, tags: ["gateway", "settings"], vector: makeVector() },
  { id: "emb-006", text: "Multi-agent orchestration flow", category: "agent", model: "text-embedding-3-small", dimensions: 1536, x: 18, y: 45, similarity: 0.89, tags: ["orchestration", "multi"], vector: makeVector() },
  { id: "emb-007", text: "File read and write operations", category: "tool", model: "all-MiniLM", dimensions: 384, x: 53, y: 58, similarity: 0.76, tags: ["file", "io"], vector: makeVector() },
  { id: "emb-008", text: "Conversation context window", category: "memory", model: "text-embedding-3-small", dimensions: 1536, x: 71, y: 42, similarity: 0.83, tags: ["context", "window"], vector: makeVector() },
  { id: "emb-009", text: "PR review and merge workflow", category: "task", model: "text-embedding-3-small", dimensions: 1536, x: 28, y: 71, similarity: 0.65, tags: ["pr", "review"], vector: makeVector() },
  { id: "emb-010", text: "Model temperature parameter", category: "config", model: "all-MiniLM", dimensions: 384, x: 88, y: 20, similarity: 0.58, tags: ["model", "temperature"], vector: makeVector() },
  { id: "emb-011", text: "Subagent spawn and delegation", category: "agent", model: "all-MiniLM", dimensions: 384, x: 22, y: 38, similarity: 0.92, tags: ["spawn", "delegate"], vector: makeVector() },
  { id: "emb-012", text: "Browser automation actions", category: "tool", model: "text-embedding-3-small", dimensions: 1536, x: 41, y: 53, similarity: 0.81, tags: ["browser", "automation"], vector: makeVector() },
  { id: "emb-013", text: "Episodic memory encoding", category: "memory", model: "all-MiniLM", dimensions: 384, x: 66, y: 48, similarity: 0.77, tags: ["episodic", "encoding"], vector: makeVector() },
  { id: "emb-014", text: "Build and deploy pipeline", category: "task", model: "text-embedding-3-small", dimensions: 1536, x: 37, y: 90, similarity: 0.62, tags: ["build", "deploy"], vector: makeVector() },
  { id: "emb-015", text: "API rate limit settings", category: "config", model: "text-embedding-3-small", dimensions: 1536, x: 82, y: 8, similarity: 0.55, tags: ["api", "ratelimit"], vector: makeVector() },
  { id: "emb-016", text: "Agent persona and voice config", category: "agent", model: "text-embedding-3-small", dimensions: 1536, x: 15, y: 60, similarity: 0.85, tags: ["persona", "voice"], vector: makeVector() },
  { id: "emb-017", text: "Shell command execution", category: "tool", model: "all-MiniLM", dimensions: 384, x: 50, y: 75, similarity: 0.79, tags: ["shell", "exec"], vector: makeVector() },
  { id: "emb-018", text: "Working memory buffer flush", category: "memory", model: "text-embedding-3-small", dimensions: 1536, x: 74, y: 55, similarity: 0.88, tags: ["buffer", "flush"], vector: makeVector() },
  { id: "emb-019", text: "Code review checklist task", category: "task", model: "all-MiniLM", dimensions: 384, x: 30, y: 65, similarity: 0.71, tags: ["checklist", "review"], vector: makeVector() },
  { id: "emb-020", text: "Logging verbosity level", category: "config", model: "all-MiniLM", dimensions: 384, x: 92, y: 30, similarity: 0.52, tags: ["logging", "verbosity"], vector: makeVector() },
];

export default function EmbeddingExplorer() {
  const [embeddings, setEmbeddings] = useState<Embedding[]>(SEED_EMBEDDINGS);
  const [query, setQuery] = useState("");
  const [threshold, setThreshold] = useState(0.6);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<"all" | Model>("all");
  const [isEmbedding, setIsEmbedding] = useState(false);

  const filtered = embeddings.filter(
    (e) => modelFilter === "all" || e.model === modelFilter
  );

  const selected = selectedId
    ? embeddings.find((e) => e.id === selectedId) ?? null
    : null;

  const hovered = hoveredId
    ? embeddings.find((e) => e.id === hoveredId) ?? null
    : null;

  const similarToSelected = selected
    ? [...filtered]
        .filter((e) => e.id !== selected.id)
        .toSorted((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
    : [];

  function handleEmbedQuery() {
    if (!query.trim() || isEmbedding) {return;}
    setIsEmbedding(true);
    setTimeout(() => {
      const newEmb: Embedding = {
        id: `emb-q-${Date.now()}`,
        text: query.trim(),
        category: "agent",
        model: modelFilter === "all" ? "text-embedding-3-small" : modelFilter,
        dimensions: modelFilter === "all-MiniLM" ? 384 : 1536,
        x: Math.round(Math.random() * 80 + 10),
        y: Math.round(Math.random() * 80 + 10),
        similarity: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)),
        tags: query.trim().toLowerCase().split(/\s+/).slice(0, 3),
        vector: makeVector(),
      };
      setEmbeddings((prev) => [...prev, newEmb]);
      setSelectedId(newEmb.id);
      setIsEmbedding(false);
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Embedding Explorer</h1>
        <div className="flex items-center gap-3">
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value as "all" | Model)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded px-3 py-2 text-sm"
          >
            <option value="all">All Models</option>
            <option value="text-embedding-3-small">text-embedding-3-small</option>
            <option value="all-MiniLM">all-MiniLM</option>
          </select>
          <button
            onClick={handleEmbedQuery}
            disabled={!query.trim() || isEmbedding}
            className={cn(
              "px-3 py-1.5 rounded text-sm font-medium transition-colors",
              !query.trim() || isEmbedding
                ? "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)]"
            )}
          >
            {isEmbedding ? "Embedding..." : "Embed Query"}
          </button>
        </div>
      </div>

      {/* Search bar + threshold */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Enter a query to find similar embeddings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEmbedQuery()}
          className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded px-3 py-2 text-sm placeholder:text-[var(--color-text-muted)]"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[var(--color-text-secondary)] text-xs whitespace-nowrap">
            Threshold: {threshold.toFixed(2)}
          </span>
          <input
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-28 accent-indigo-500"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-5">
        {/* Scatter plot panel */}
        <div className="w-[60%]">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-2">
              2D Projection &middot; {filtered.length} embeddings
            </div>
            <div className="relative h-[420px] bg-[var(--color-surface-0)] rounded border border-[var(--color-border)] overflow-hidden">
              {/* Grid lines */}
              {[25, 50, 75].map((p) => (
                <React.Fragment key={p}>
                  <div
                    className="absolute top-0 bottom-0 border-l border-[var(--color-border)]/50"
                    style={{ left: `${p}%` }}
                  />
                  <div
                    className="absolute left-0 right-0 border-t border-[var(--color-border)]/50"
                    style={{ top: `${p}%` }}
                  />
                </React.Fragment>
              ))}

              {/* Shimmer overlay during embedding */}
              {isEmbedding && (
                <div className="absolute inset-0 z-20 flex items-center justify-center">
                  <div className="bg-[var(--color-surface-1)]/80 rounded-lg px-4 py-2 text-sm text-indigo-400 animate-pulse">
                    Computing embedding vector...
                  </div>
                </div>
              )}

              {/* Dots */}
              {filtered.map((emb) => {
                const aboveThreshold = emb.similarity >= threshold;
                const isSelected = emb.id === selectedId;
                const isHovered = emb.id === hoveredId;
                const colors = CATEGORY_COLORS[emb.category];

                return (
                  <div key={emb.id}>
                    <div
                      className={cn(
                        "absolute w-3 h-3 rounded-full cursor-pointer transition-all duration-200 -translate-x-1/2 -translate-y-1/2",
                        colors.dot,
                        aboveThreshold ? "opacity-100" : "opacity-20",
                        isSelected && "ring-2 ring-white ring-offset-1 ring-offset-zinc-950 w-4 h-4",
                        isHovered && !isSelected && "scale-150"
                      )}
                      style={{ left: `${emb.x}%`, top: `${emb.y}%`, zIndex: isSelected ? 10 : isHovered ? 5 : 1 }}
                      onClick={() => setSelectedId(emb.id === selectedId ? null : emb.id)}
                      onMouseEnter={() => setHoveredId(emb.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    />
                    {/* Tooltip */}
                    {isHovered && (
                      <div
                        className="absolute z-30 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-3 py-2 text-xs pointer-events-none shadow-lg max-w-[220px]"
                        style={{
                          left: `${emb.x}%`,
                          top: `${emb.y}%`,
                          transform: `translate(${emb.x > 70 ? "-100%" : "8px"}, -110%)`,
                        }}
                      >
                        <div className="text-[var(--color-text-primary)] font-medium mb-1 truncate">{emb.text}</div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", colors.text)}>{emb.category}</span>
                          <span className="text-[var(--color-text-muted)]">&middot;</span>
                          <span className="text-[var(--color-text-secondary)]">sim: {emb.similarity.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {(Object.entries(CATEGORY_COLORS) as [Category, typeof CATEGORY_COLORS[Category]][]).map(
                ([cat, colors]) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded-full", colors.dot)} />
                    <span className="text-xs text-[var(--color-text-secondary)]">{colors.label}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right detail panel */}
        <div className="w-[40%] space-y-4">
          {/* Selected embedding detail */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              Selected Embedding
            </h3>
            {selected ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[var(--color-text-primary)] font-medium text-sm">{selected.text}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{selected.id}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Category</span>
                    <div className={cn("font-medium mt-0.5", CATEGORY_COLORS[selected.category].text)}>
                      {selected.category}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Model</span>
                    <div className="text-[var(--color-text-primary)] font-medium mt-0.5 truncate">{selected.model}</div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Dimensions</span>
                    <div className="text-[var(--color-text-primary)] font-medium mt-0.5">{selected.dimensions}</div>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Similarity</span>
                    <div className={cn(
                      "font-medium mt-0.5",
                      selected.similarity >= 0.8 ? "text-emerald-400" :
                      selected.similarity >= 0.6 ? "text-amber-400" : "text-rose-400"
                    )}>
                      {selected.similarity.toFixed(3)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {/* Similarity bar */}
                <div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                    <span>Similarity</span>
                    <span>{(selected.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        selected.similarity >= 0.8 ? "bg-emerald-400" :
                        selected.similarity >= 0.6 ? "bg-amber-400" : "bg-rose-400"
                      )}
                      style={{ width: `${selected.similarity * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[var(--color-text-muted)] text-sm py-6 text-center">
                Click an embedding point to view details
              </div>
            )}
          </div>

          {/* Similar embeddings */}
          {selected && (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                Similar Embeddings
              </h3>
              <div className="space-y-2.5">
                {similarToSelected.map((emb) => (
                  <div
                    key={emb.id}
                    className={cn(
                      "p-2 rounded cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]",
                      emb.id === hoveredId && "bg-[var(--color-surface-2)]"
                    )}
                    onClick={() => setSelectedId(emb.id)}
                    onMouseEnter={() => setHoveredId(emb.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-[var(--color-text-primary)] truncate flex-1">{emb.text}</div>
                      <span className={cn(
                        "text-xs font-mono shrink-0",
                        emb.similarity >= 0.8 ? "text-emerald-400" :
                        emb.similarity >= 0.6 ? "text-amber-400" : "text-rose-400"
                      )}>
                        {emb.similarity.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--color-surface-2)] rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${emb.similarity * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vector preview */}
          {selected && (
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                Vector Preview
                <span className="text-[var(--color-text-muted)] font-normal ml-1">
                  (first 8 of {selected.dimensions})
                </span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {selected.vector.map((val, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "font-mono text-xs px-2 py-1 rounded border",
                      val >= 0
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}
                  >
                    {val >= 0 ? "+" : ""}{val.toFixed(4)}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-4 flex-1 flex gap-px">
                  {selected.vector.map((val, idx) => {
                    const magnitude = Math.abs(val);
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col justify-end"
                      >
                        <div
                          className={cn(
                            "w-full rounded-sm",
                            val >= 0 ? "bg-emerald-400" : "bg-rose-400"
                          )}
                          style={{ height: `${magnitude * 100}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="text-[var(--color-text-muted)] text-xs">magnitude</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
