import React, { useState } from "react";
import { cn } from "../lib/utils";

type Ring = "adopt" | "trial" | "assess" | "hold";
type Quadrant = "languages" | "frameworks" | "platforms" | "tools";

interface RadarItem {
  id: string;
  name: string;
  quadrant: Quadrant;
  ring: Ring;
  isNew: boolean;
  description: string;
  updatedAt: string;
  owner: string;
  pros: string[];
  cons: string[];
}

const ITEMS: RadarItem[] = [
  // Languages
  { id: "t1",  name: "TypeScript",      quadrant: "languages",  ring: "adopt",  isNew: false, updatedAt: "2026-Q1", owner: "Platform",    description: "Strongly typed superset of JavaScript. Default for all new frontend and Node.js services.",    pros: ["Type safety", "IDE support", "Ecosystem"],   cons: ["Build overhead"] },
  { id: "t2",  name: "Go",              quadrant: "languages",  ring: "adopt",  isNew: false, updatedAt: "2025-Q3", owner: "Backend",     description: "For high-performance services, CLIs, and infrastructure tooling.",    pros: ["Performance", "Concurrency", "Low latency"], cons: ["Less flexible generics"] },
  { id: "t3",  name: "Python",          quadrant: "languages",  ring: "adopt",  isNew: false, updatedAt: "2025-Q2", owner: "ML/Data",     description: "For data science, ML pipelines, and scripting.",   pros: ["Ecosystem", "ML libraries"],                 cons: ["Runtime speed"] },
  { id: "t4",  name: "Rust",            quadrant: "languages",  ring: "trial",  isNew: true,  updatedAt: "2026-Q1", owner: "Platform",    description: "Evaluating for WASM modules and performance-critical parsers.",   pros: ["Memory safety", "Performance"],              cons: ["Steep learning curve", "Build times"] },
  { id: "t5",  name: "Elixir",          quadrant: "languages",  ring: "assess", isNew: false, updatedAt: "2025-Q4", owner: "Backend",     description: "Assessing for real-time collaboration features.",   pros: ["Concurrency model", "OTP"],                  cons: ["Hiring difficulty"] },
  { id: "t6",  name: "PHP",             quadrant: "languages",  ring: "hold",   isNew: false, updatedAt: "2024-Q2", owner: "Engineering", description: "Legacy only. No new PHP services.",    pros: [],                                            cons: ["Legacy burden", "Inconsistent syntax"] },
  // Frameworks
  { id: "f1",  name: "React 18",        quadrant: "frameworks", ring: "adopt",  isNew: false, updatedAt: "2025-Q3", owner: "Frontend",    description: "Primary frontend framework. Concurrent mode, suspense, server components.",    pros: ["Ecosystem", "Concurrent features"],          cons: ["Bundle size"] },
  { id: "f2",  name: "Fastify",         quadrant: "frameworks", ring: "adopt",  isNew: false, updatedAt: "2025-Q2", owner: "Backend",     description: "Fast, low-overhead Node.js framework for APIs.",    pros: ["Performance", "Plugin system"],              cons: ["Smaller ecosystem than Express"] },
  { id: "f3",  name: "Next.js 15",      quadrant: "frameworks", ring: "trial",  isNew: true,  updatedAt: "2026-Q1", owner: "Frontend",    description: "Trialing for SSR and marketing pages.",    pros: ["SSR/SSG", "Edge runtime"],                   cons: ["Vendor lock-in risk"] },
  { id: "f4",  name: "tRPC",            quadrant: "frameworks", ring: "trial",  isNew: true,  updatedAt: "2026-Q1", owner: "Full Stack",  description: "Type-safe API layer across frontend and backend.",    pros: ["Type safety", "DX"],                         cons: ["Requires TypeScript throughout"] },
  { id: "f5",  name: "Django REST",     quadrant: "frameworks", ring: "assess", isNew: false, updatedAt: "2025-Q4", owner: "ML/Data",     description: "Evaluating for data service APIs.",    pros: ["Batteries included", "Admin UI"],            cons: ["Opinionated", "Performance"] },
  { id: "f6",  name: "Angular",         quadrant: "frameworks", ring: "hold",   isNew: false, updatedAt: "2023-Q4", owner: "Engineering", description: "Migrating existing Angular apps to React.",    pros: ["Structure"],                                 cons: ["Complexity", "Migration effort"] },
  // Platforms
  { id: "p1",  name: "Kubernetes",      quadrant: "platforms",  ring: "adopt",  isNew: false, updatedAt: "2025-Q2", owner: "Platform",    description: "Production container orchestration. EKS on AWS.",    pros: ["Scalability", "Ecosystem"],                  cons: ["Operational complexity"] },
  { id: "p2",  name: "PostgreSQL",      quadrant: "platforms",  ring: "adopt",  isNew: false, updatedAt: "2025-Q1", owner: "Data",        description: "Primary relational database.",    pros: ["JSONB", "Reliability", "Extensions"],        cons: ["Horizontal scaling"] },
  { id: "p3",  name: "Kafka",           quadrant: "platforms",  ring: "adopt",  isNew: false, updatedAt: "2025-Q3", owner: "Platform",    description: "Event streaming backbone.",    pros: ["Throughput", "Durability"],                  cons: ["Ops overhead"] },
  { id: "p4",  name: "Temporal",        quadrant: "platforms",  ring: "trial",  isNew: true,  updatedAt: "2026-Q1", owner: "Backend",     description: "Durable workflow execution engine.",    pros: ["Reliability", "Observability"],              cons: ["New team skill required"] },
  { id: "p5",  name: "Weaviate",        quadrant: "platforms",  ring: "assess", isNew: true,  updatedAt: "2026-Q1", owner: "ML",          description: "Vector database for semantic search.",    pros: ["Native vector search", "GraphQL"],           cons: ["Maturity", "Cost at scale"] },
  { id: "p6",  name: "CassandraDB",     quadrant: "platforms",  ring: "hold",   isNew: false, updatedAt: "2024-Q3", owner: "Data",        description: "Use PostgreSQL or DynamoDB instead.",    pros: [],                                            cons: ["Operational burden", "Migration needed"] },
  // Tools
  { id: "to1", name: "Vitest",          quadrant: "tools",      ring: "adopt",  isNew: false, updatedAt: "2025-Q2", owner: "Frontend",    description: "Fast unit test runner, Vite-native.",    pros: ["Speed", "ESM-native"],                       cons: ["Smaller community than Jest"] },
  { id: "to2", name: "Playwright",      quadrant: "tools",      ring: "adopt",  isNew: false, updatedAt: "2025-Q3", owner: "QA",          description: "E2E testing across browsers.",    pros: ["Multi-browser", "Codegen"],                  cons: ["Flaky on CI sometimes"] },
  { id: "to3", name: "Turborepo",       quadrant: "tools",      ring: "trial",  isNew: true,  updatedAt: "2026-Q1", owner: "Platform",    description: "Evaluating for monorepo build caching.",    pros: ["Incremental builds", "Remote cache"],        cons: ["Configuration overhead"] },
  { id: "to4", name: "Biome",           quadrant: "tools",      ring: "trial",  isNew: true,  updatedAt: "2026-Q1", owner: "Frontend",    description: "Fast linter/formatter replacing ESLint+Prettier.",    pros: ["Speed", "Unified tool"],                     cons: ["Rule parity gaps"] },
  { id: "to5", name: "OpenTelemetry",   quadrant: "tools",      ring: "assess", isNew: false, updatedAt: "2025-Q4", owner: "Platform",    description: "Standardized observability instrumentation.",    pros: ["Vendor neutral", "Unified traces/metrics"],  cons: ["Config complexity"] },
  { id: "to6", name: "Enzyme",          quadrant: "tools",      ring: "hold",   isNew: false, updatedAt: "2023-Q2", owner: "Frontend",    description: "Replaced by Vitest + Testing Library.",    pros: [],                                            cons: ["No React 18 support"] },
];

const RING_CONFIG: Record<Ring, { label: string; color: string; bg: string; desc: string }> = {
  adopt:  { label: "Adopt",  color: "text-emerald-400", bg: "bg-emerald-400/15 border-emerald-500/30", desc: "Recommended for new projects — proven and mature" },
  trial:  { label: "Trial",  color: "text-indigo-300",  bg: "bg-primary/15 border-primary/30",   desc: "Worth pursuing — use on a non-critical project first" },
  assess: { label: "Assess", color: "text-amber-400",   bg: "bg-amber-400/15 border-amber-500/30",     desc: "Worth exploring — but not yet ready for production" },
  hold:   { label: "Hold",   color: "text-rose-400",    bg: "bg-rose-400/15 border-rose-500/30",       desc: "Proceed with caution — avoid for new projects" },
};

const QUADRANT_CONFIG: Record<Quadrant, { label: string; emoji: string }> = {
  languages:  { label: "Languages & Runtimes", emoji: "💻" },
  frameworks: { label: "Frameworks & Libraries", emoji: "📦" },
  platforms:  { label: "Platforms & Databases", emoji: "🗄️" },
  tools:      { label: "Tools & Processes", emoji: "🔧" },
};

const RINGS: Ring[] = ["adopt","trial","assess","hold"];
const QUADRANTS: Quadrant[] = ["languages","frameworks","platforms","tools"];

export default function TechRadar() {
  const [selectedItem, setSelectedItem] = useState<RadarItem | null>(null);
  const [filterQuadrant, setFilterQuadrant] = useState<Quadrant | "all">("all");
  const [filterRing, setFilterRing] = useState<Ring | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<"radar" | "list" | "quadrant">("radar");

  const filteredItems = ITEMS.filter(item => {
    if (filterQuadrant !== "all" && item.quadrant !== filterQuadrant) {return false;}
    if (filterRing      !== "all" && item.ring      !== filterRing)      {return false;}
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {return false;}
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Technology Radar</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">Engineering team's view of technology adoption — {ITEMS.length} technologies assessed</p>
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">Last updated: <span className="text-[var(--color-text-primary)]">Q1 2026</span></div>
      </div>

      {/* Ring legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {RINGS.map(r => (
          <div key={r} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs", RING_CONFIG[r].bg)}>
            <span className={cn("font-semibold", RING_CONFIG[r].color)}>{RING_CONFIG[r].label}</span>
            <span className="text-[var(--color-text-secondary)]">— {RING_CONFIG[r].desc}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] p-1 rounded-lg">
          {(["radar","list","quadrant"] as const).map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md capitalize transition-colors",
                activeView === v ? "bg-primary text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {v === "radar" ? "📡 Radar" : v === "list" ? "📋 List" : "⊞ Quadrant"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search technologies..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-48 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded px-3 py-1.5 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-primary"
        />
        <select
          value={filterQuadrant}
          onChange={e => setFilterQuadrant(e.target.value as Quadrant | "all")}
          className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded px-3 py-1.5 focus:outline-none"
        >
          <option value="all">All Quadrants</option>
          {QUADRANTS.map(q => <option key={q} value={q}>{QUADRANT_CONFIG[q].label}</option>)}
        </select>
        <select
          value={filterRing}
          onChange={e => setFilterRing(e.target.value as Ring | "all")}
          className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded px-3 py-1.5 focus:outline-none"
        >
          <option value="all">All Rings</option>
          {RINGS.map(r => <option key={r} value={r}>{RING_CONFIG[r].label}</option>)}
        </select>
      </div>

      {/* Radar View — div-based concentric ring layout */}
      {activeView === "radar" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            {/* Concentric ring visual */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6 overflow-hidden">
              <div className="relative" style={{ paddingBottom: "80%" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Rings (outermost to innermost) */}
                  {[100, 75, 50, 25].map((pct, i) => {
                    const ring = ["hold","assess","trial","adopt"][i] as Ring;
                    return (
                      <div
                        key={ring}
                        className={cn(
                          "absolute rounded-full border",
                          ring === "adopt"  ? "border-emerald-500/40" :
                          ring === "trial"  ? "border-primary/30" :
                          ring === "assess" ? "border-amber-500/30" :
                                             "border-rose-500/25"
                        )}
                        style={{
                          width: `${pct}%`,
                          paddingBottom: `${pct}%`,
                          transform: "translate(-50%, -50%)",
                          left: "50%",
                          top: "50%",
                        }}
                      />
                    );
                  })}

                  {/* Quadrant dividers */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-full h-px bg-[var(--color-surface-3)]/40" />
                    <div className="absolute h-full w-px bg-[var(--color-surface-3)]/40" />
                  </div>

                  {/* Quadrant labels */}
                  {[
                    { q: "languages",  x: "left-2",   y: "top-2"    },
                    { q: "frameworks", x: "right-2",  y: "top-2"    },
                    { q: "platforms",  x: "left-2",   y: "bottom-2" },
                    { q: "tools",      x: "right-2",  y: "bottom-2" },
                  ].map(({ q, x, y }) => (
                    <div key={q} className={cn("absolute text-xs text-[var(--color-text-muted)] font-medium", x, y)}>
                      {QUADRANT_CONFIG[q as Quadrant].emoji} {QUADRANT_CONFIG[q as Quadrant].label.split(" ")[0]}
                    </div>
                  ))}

                  {/* Ring labels */}
                  {[
                    { ring: "adopt",  top: "46%",  left: "2%"  },
                    { ring: "trial",  top: "46%",  left: "14%" },
                    { ring: "assess", top: "46%",  left: "27%" },
                    { ring: "hold",   top: "46%",  left: "40%" },
                  ].map(({ ring, top, left }) => (
                    <div
                      key={ring}
                      className={cn("absolute text-xs font-semibold", RING_CONFIG[ring as Ring].color)}
                      style={{ top, left }}
                    >
                      {RING_CONFIG[ring as Ring].label}
                    </div>
                  ))}

                  {/* Items as dots */}
                  {filteredItems.map((item, idx) => {
                    const ringIdx  = RINGS.indexOf(item.ring);
                    const quadIdx  = QUADRANTS.indexOf(item.quadrant);
                    // Position based on ring and quadrant
                    const radii    = [12, 30, 55, 78]; // % from center
                    const r        = radii[ringIdx];
                    const angleBase= (quadIdx * 90) + 15;
                    const angleStep= Math.min(65, (ITEMS.filter(i=>i.quadrant===item.quadrant && i.ring===item.ring).length) > 1 ? 60 / ITEMS.filter(i=>i.quadrant===item.quadrant && i.ring===item.ring).indexOf(item) : 30);
                    const angle    = (angleBase + (ITEMS.filter(i=>i.quadrant===item.quadrant && i.ring===item.ring).indexOf(item) * 18)) * (Math.PI / 180);
                    const cx = 50 + r * Math.cos(angle);
                    const cy = 50 + r * Math.sin(angle);

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          "absolute w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-transform hover:scale-125",
                          item.ring === "adopt"  ? "bg-emerald-500 border-emerald-300 text-[var(--color-text-primary)]" :
                          item.ring === "trial"  ? "bg-primary border-indigo-300 text-[var(--color-text-primary)]" :
                          item.ring === "assess" ? "bg-amber-500 border-amber-300 text-[var(--color-text-primary)]" :
                                                   "bg-[var(--color-surface-3)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]",
                          item.isNew && "ring-2 ring-white/40"
                        )}
                        style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%, -50%)" }}
                        title={item.name}
                      >
                        {item.name.slice(0,1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="col-span-1">
            {selectedItem ? (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{selectedItem.name}</h3>
                  <button onClick={() => setSelectedItem(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">×</button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded border", RING_CONFIG[selectedItem.ring].bg, RING_CONFIG[selectedItem.ring].color)}>
                    {RING_CONFIG[selectedItem.ring].label}
                  </span>
                  <span className="text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] px-2 py-0.5 rounded">
                    {QUADRANT_CONFIG[selectedItem.quadrant].emoji} {QUADRANT_CONFIG[selectedItem.quadrant].label.split(" ")[0]}
                  </span>
                  {selectedItem.isNew && <span className="text-xs bg-primary/20 border border-primary/30 text-indigo-300 px-2 py-0.5 rounded">NEW</span>}
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{selectedItem.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--color-text-muted)]">Updated:</span> <span className="text-[var(--color-text-primary)]">{selectedItem.updatedAt}</span></div>
                  <div><span className="text-[var(--color-text-muted)]">Owner:</span> <span className="text-[var(--color-text-primary)]">{selectedItem.owner}</span></div>
                </div>

                {selectedItem.pros.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-emerald-400 mb-1.5">✓ Pros</div>
                    <div className="space-y-1">
                      {selectedItem.pros.map(p => (
                        <div key={p} className="text-xs text-[var(--color-text-primary)] flex gap-1.5"><span className="text-emerald-500">+</span>{p}</div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.cons.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-rose-400 mb-1.5">✗ Cons</div>
                    <div className="space-y-1">
                      {selectedItem.cons.map(c => (
                        <div key={c} className="text-xs text-[var(--color-text-primary)] flex gap-1.5"><span className="text-rose-500">-</span>{c}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-8 text-center text-[var(--color-text-muted)] text-sm">
                Click a dot on the radar to view details
              </div>
            )}

            {/* New this quarter */}
            <div className="mt-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="text-xs font-medium text-[var(--color-text-primary)] mb-2">🆕 New this quarter</div>
              <div className="space-y-1">
                {ITEMS.filter(i => i.isNew).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                      item.ring === "adopt"  ? "bg-emerald-500" :
                      item.ring === "trial"  ? "bg-primary" :
                      item.ring === "assess" ? "bg-amber-500"  : "bg-[var(--color-surface-3)]"
                    )} />
                    <span className="text-xs text-[var(--color-text-primary)]">{item.name}</span>
                    <span className={cn("text-xs ml-auto", RING_CONFIG[item.ring].color)}>{RING_CONFIG[item.ring].label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {activeView === "list" && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 text-left font-medium">Technology</th>
                <th className="px-4 py-3 text-left font-medium">Quadrant</th>
                <th className="px-4 py-3 text-left font-medium">Ring</th>
                <th className="px-4 py-3 text-left font-medium">Owner</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredItems.map(item => (
                <tr
                  key={item.id}
                  className="hover:bg-[var(--color-surface-2)]/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--color-text-primary)] font-medium">{item.name}</span>
                      {item.isNew && <span className="text-xs bg-primary/20 border border-primary/30 text-indigo-300 px-1.5 py-0.5 rounded">NEW</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{QUADRANT_CONFIG[item.quadrant].emoji} {QUADRANT_CONFIG[item.quadrant].label}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded border", RING_CONFIG[item.ring].bg, RING_CONFIG[item.ring].color)}>
                      {RING_CONFIG[item.ring].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{item.owner}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{item.updatedAt}</td>
                  <td className="px-4 py-3 text-right text-xs text-primary hover:text-indigo-300">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quadrant View */}
      {activeView === "quadrant" && (
        <div className="grid grid-cols-2 gap-4">
          {QUADRANTS.map(quad => (
            <div key={quad} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                {QUADRANT_CONFIG[quad].emoji} {QUADRANT_CONFIG[quad].label}
              </div>
              {RINGS.map(ring => {
                const items = ITEMS.filter(i => i.quadrant === quad && i.ring === ring);
                if (items.length === 0) {return null;}
                return (
                  <div key={ring} className="mb-3">
                    <div className={cn("text-xs font-medium mb-1.5", RING_CONFIG[ring].color)}>{RING_CONFIG[ring].label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded border transition-colors",
                            RING_CONFIG[item.ring].bg,
                            item.isNew && "ring-1 ring-white/20"
                          )}
                        >
                          {item.name} {item.isNew ? "✨" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
