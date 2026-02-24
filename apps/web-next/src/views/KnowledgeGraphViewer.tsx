import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * KnowledgeGraphViewer
 * 
 * A knowledge graph and entity relationship explorer for the Horizon UI dashboard.
 * Built with a focus on robust state management, clean data flow, and 
 * accessible dark-themed design.
 * 
 * Includes:
 * - Interactive Graph view with focus filtering
 * - Comprehensive Entities registry
 * - Detailed Relations table
 * - Real-time unified search
 */

// --- Types ---

type EntityType = "person" | "organization" | "concept" | "event" | "location";

type RelationType = 
  | "knows" 
  | "works_for" 
  | "related_to" 
  | "created" 
  | "member_of" 
  | "located_in";

interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  firstSeen: string;
  properties: Record<string, string>;
}

interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  weight: number; // 0.1 to 1.0
  createdDate: string;
}

// --- Sample Data ---

const INITIAL_ENTITIES: Entity[] = [
  { id: "e1", name: "Alexander Vance", type: "person", description: "Lead architect of the Horizon neural interface.", firstSeen: "2024-03-12", properties: { level: "L8", clearance: "Omega", station: "Orbital-7" } },
  { id: "e2", name: "Elena Kostic", type: "person", description: "Specialist in quantum-state synchronization.", firstSeen: "2024-05-20", properties: { level: "L7", specialty: "Quantum", status: "Active" } },
  { id: "e3", name: "Marcus Thorne", type: "person", description: "Director of operations at Aetheric Research.", firstSeen: "2023-11-02", properties: { role: "Director", background: "Military" } },
  { id: "e4", name: "Sarah Chen", type: "person", description: "Chief Data Scientist for Project Chimera.", firstSeen: "2025-01-15", properties: { expertise: "ML/AI", office: "Neo-Tokyo" } },
  { id: "e5", name: "Aetheric Research", type: "organization", description: "Foundational research firm for sub-space communication.", firstSeen: "2022-08-10", properties: { sector: "R&D", valuation: "T4" } },
  { id: "e6", name: "Horizon Corp", type: "organization", description: "Primary contractor for the global mesh network.", firstSeen: "2021-12-05", properties: { HQ: "Berlin", employees: "15,000+" } },
  { id: "e7", name: "Vanguard Systems", type: "organization", description: "Security and encryption layer providers.", firstSeen: "2024-02-14", properties: { focus: "Security", tier: "Gold" } },
  { id: "e8", name: "Neural Synchronization", type: "concept", description: "The process of aligning human brainwaves with digital signal buffers.", firstSeen: "2024-01-10", properties: { status: "Proven", risk: "Medium" } },
  { id: "e9", name: "Sub-space Tunneling", type: "concept", description: "A method of bypassing fiber-optic latency via higher dimensional planes.", firstSeen: "2023-06-22", properties: { efficiency: "98%", difficulty: "Extreme" } },
  { id: "e10", name: "Quantum Entanglement Link", type: "concept", description: "Instantaneous state transfer over planetary distances.", firstSeen: "2025-02-01", properties: { phase: "Beta", stability: "Low" } },
  { id: "e11", name: "Project Chimera Launch", type: "event", description: "The first successful test of the sub-space mesh.", firstSeen: "2025-02-18", properties: { outcome: "Success", attendees: "400" } },
  { id: "e12", name: "The Great Decoupling", type: "event", description: "A system-wide failure event caused by temporal drift.", firstSeen: "2024-09-30", properties: { duration: "4h", severity: "Critical" } },
  { id: "e13", name: "Neo-Tokyo Precinct", type: "location", description: "Technological hub for the Pacific Rim.", firstSeen: "2020-01-01", properties: { density: "High", grid: "A1" } },
  { id: "e14", name: "Orbital-7 Station", type: "location", description: "Research facility positioned in L5 Lagrange point.", firstSeen: "2023-04-12", properties: { capacity: "50", orbit: "GEO" } },
  { id: "e15", name: "Berlin Central Hub", type: "location", description: "European infrastructure backbone.", firstSeen: "2021-05-15", properties: { power: "Nuclear", uptime: "99.99%" } },
  { id: "e16", name: "Jordan Brooks", type: "person", description: "Protocol designer for sub-space security.", firstSeen: "2025-02-20", properties: { role: "Engineer", clearance: "Alpha" } },
];

const INITIAL_RELATIONS: Relation[] = [
  { id: "r1", sourceId: "e1", targetId: "e6", type: "works_for", weight: 0.9, createdDate: "2024-03-15" },
  { id: "r2", sourceId: "e2", targetId: "e6", type: "works_for", weight: 0.85, createdDate: "2024-05-22" },
  { id: "r3", sourceId: "e3", targetId: "e5", type: "works_for", weight: 0.95, createdDate: "2023-11-05" },
  { id: "r4", sourceId: "e4", targetId: "e5", type: "works_for", weight: 0.8, createdDate: "2025-01-16" },
  { id: "r5", sourceId: "e1", targetId: "e2", type: "knows", weight: 0.7, createdDate: "2024-06-01" },
  { id: "r6", sourceId: "e1", targetId: "e8", type: "created", weight: 1.0, createdDate: "2024-01-15" },
  { id: "r7", sourceId: "e4", targetId: "e11", type: "created", weight: 0.9, createdDate: "2025-02-18" },
  { id: "r8", sourceId: "e5", targetId: "e9", type: "related_to", weight: 0.6, createdDate: "2023-07-01" },
  { id: "r9", sourceId: "e6", targetId: "e10", type: "related_to", weight: 0.75, createdDate: "2025-02-05" },
  { id: "r10", sourceId: "e5", targetId: "e13", type: "located_in", weight: 1.0, createdDate: "2022-09-01" },
  { id: "r11", sourceId: "e6", targetId: "e15", type: "located_in", weight: 1.0, createdDate: "2021-12-10" },
  { id: "r12", sourceId: "e1", targetId: "e14", type: "located_in", weight: 0.5, createdDate: "2024-03-20" },
  { id: "r13", sourceId: "e7", targetId: "e6", type: "related_to", weight: 0.4, createdDate: "2024-03-01" },
  { id: "r14", sourceId: "e16", targetId: "e7", type: "works_for", weight: 0.9, createdDate: "2025-02-21" },
  { id: "r15", sourceId: "e16", targetId: "e1", type: "knows", weight: 0.3, createdDate: "2025-02-22" },
  { id: "r16", sourceId: "e8", targetId: "e10", type: "related_to", weight: 0.8, createdDate: "2025-02-02" },
  { id: "r17", sourceId: "e12", targetId: "e6", type: "related_to", weight: 0.9, createdDate: "2024-10-01" },
  { id: "r18", sourceId: "e3", targetId: "e4", type: "knows", weight: 0.65, createdDate: "2025-01-20" },
  { id: "r19", sourceId: "e7", targetId: "e13", type: "located_in", weight: 0.8, createdDate: "2024-02-15" },
  { id: "r20", sourceId: "e11", targetId: "e9", type: "related_to", weight: 0.95, createdDate: "2025-02-18" },
  { id: "r21", sourceId: "e1", targetId: "e5", type: "member_of", weight: 0.2, createdDate: "2024-12-01" },
];

// --- Components ---

/**
 * Badge Component
 */
const Badge = ({ type, children }: { type: EntityType | "relation"; children: React.ReactNode }) => {
  const styles: Record<string, string> = {
    person: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    organization: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    concept: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    event: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    location: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]/20",
    relation: "bg-white/5 text-[var(--color-text-secondary)] border-white/10",
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", styles[type])}>
      {children}
    </span>
  );
};

/**
 * Card Component
 */
const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 transition-all",
      onClick && "cursor-pointer hover:border-[var(--color-border)] active:scale-[0.98]",
      className
    )}
  >
    {children}
  </div>
);

/**
 * EntityDetail Component (Sidebar content)
 */
const EntityDetail = ({ 
  entity, 
  connections, 
  onClose,
  onFocus 
}: { 
  entity: Entity; 
  connections: { entity: Entity; rel: Relation }[]; 
  onClose: () => void;
  onFocus: (id: string) => void;
}) => {
  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">{entity.name}</h3>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">✕</button>
      </div>

      <div className="mb-6">
        <Badge type={entity.type}>{entity.type}</Badge>
        <p className="mt-3 text-[var(--color-text-secondary)] text-sm leading-relaxed">{entity.description}</p>
      </div>

      <div className="mb-6">
        <h4 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">Properties</h4>
        <div className="space-y-2">
          {Object.entries(entity.properties).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs py-1 border-b border-[var(--color-border)]/50">
              <span className="text-[var(--color-text-muted)] capitalize">{key}</span>
              <span className="text-[var(--color-text-primary)] font-medium">{val}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs py-1 border-b border-[var(--color-border)]/50">
            <span className="text-[var(--color-text-muted)]">First Seen</span>
            <span className="text-[var(--color-text-primary)] font-medium">{entity.firstSeen}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <h4 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3 sticky top-0 bg-[var(--color-surface-1)] py-1">
          Connections ({connections.length})
        </h4>
        <div className="space-y-2">
          {connections.map(({ entity: target, rel }) => (
            <div key={rel.id} className="p-2 rounded bg-white/5 border border-[var(--color-border)] group">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-mono">{rel.type}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{(rel.weight * 100).toFixed(0)}%</span>
              </div>
              <div className="text-xs text-[var(--color-text-primary)] font-medium">{target.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
        <button 
          onClick={() => onFocus(entity.id)}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] rounded font-medium text-sm transition-colors"
        >
          Focus on {entity.name}
        </button>
      </div>
    </div>
  );
};

// --- Main View ---

export default function KnowledgeGraphViewer() {
  // State
  const [activeTab, setActiveTab] = useState<"graph" | "entities" | "relations" | "search">("graph");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [focusEntityId, setFocusEntityId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<EntityType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Derived Data
  const getConnections = (id: string) => {
    return INITIAL_RELATIONS
      .filter(r => r.sourceId === id || r.targetId === id)
      .map(r => {
        const targetId = r.sourceId === id ? r.targetId : r.sourceId;
        const entity = INITIAL_ENTITIES.find(e => e.id === targetId)!;
        return { entity, rel: r };
      });
  };

  const selectedEntity = selectedEntityId ? INITIAL_ENTITIES.find(e => e.id === selectedEntityId) : null;
  const selectedConnections = selectedEntityId ? getConnections(selectedEntityId) : [];

  const filteredEntities = INITIAL_ENTITIES.filter(e => {
    if (entityFilter === "all") {return true;}
    return e.type === entityFilter;
  });

  const searchResults = {
    entities: searchQuery.length > 0 ? INITIAL_ENTITIES.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) : [],
    relations: searchQuery.length > 0 ? INITIAL_RELATIONS.filter(r => {
      const source = INITIAL_ENTITIES.find(e => e.id === r.sourceId)?.name.toLowerCase() || "";
      const target = INITIAL_ENTITIES.find(e => e.id === r.targetId)?.name.toLowerCase() || "";
      return source.includes(searchQuery.toLowerCase()) || 
             target.includes(searchQuery.toLowerCase()) || 
             r.type.toLowerCase().includes(searchQuery.toLowerCase());
    }) : []
  };

  // Graph Logic (Columns)
  const graphEntities = focusEntityId 
    ? [
        INITIAL_ENTITIES.find(e => e.id === focusEntityId)!,
        ...getConnections(focusEntityId).map(c => c.entity)
      ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
    : INITIAL_ENTITIES;

  const people = graphEntities.filter(e => e.type === "person");
  const orgs = graphEntities.filter(e => e.type === "organization");
  const others = graphEntities.filter(e => e.type === "concept" || e.type === "event" || e.type === "location");

  // Renderers

  const renderTabs = () => (
    <div className="flex space-x-1 mb-8 bg-[var(--color-surface-1)] p-1 rounded-lg self-start border border-[var(--color-border)]">
      {(["graph", "entities", "relations", "search"] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={cn(
            "px-6 py-2 rounded-md text-sm font-medium transition-all capitalize",
            activeTab === tab ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-8 font-sans selection:bg-indigo-500/30">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Knowledge Graph</h1>
        <p className="text-[var(--color-text-muted)] max-w-2xl">
          Explore entities, relationships, and metadata across the Horizon network.
          Visualize system connections and trace data lineages.
        </p>
      </header>

      {renderTabs()}

      {/* --- GRAPH TAB --- */}
      {activeTab === "graph" && (
        <div className="flex gap-8 h-[calc(100vh-320px)] min-h-[600px]">
          <div className="flex-1 overflow-auto bg-[var(--color-surface-1)]/30 border border-[var(--color-border)]/50 rounded-xl p-8 relative">
            {focusEntityId && (
              <div className="absolute top-4 left-4 z-10">
                <button 
                  onClick={() => setFocusEntityId(null)}
                  className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-xs py-1 px-3 rounded-full border border-[var(--color-border)] flex items-center gap-2"
                >
                  <span className="text-indigo-400">↺</span> Reset Focus
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-8 min-w-[800px]">
              {/* Column 1: People */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-6 text-center">People</h2>
                {people.map(e => (
                  <Card 
                    key={e.id} 
                    onClick={() => setSelectedEntityId(e.id)}
                    className={cn(
                      selectedEntityId === e.id && "ring-2 ring-indigo-500 border-transparent",
                      focusEntityId === e.id && "bg-indigo-500/10 border-indigo-500/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm truncate pr-2">{e.name}</div>
                      <Badge type={e.type}>{e.type[0]}</Badge>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {getConnections(e.id).length} connections
                    </div>
                  </Card>
                ))}
              </div>

              {/* Column 2: Organizations */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-6 text-center">Organizations</h2>
                {orgs.map(e => (
                  <Card 
                    key={e.id} 
                    onClick={() => setSelectedEntityId(e.id)}
                    className={cn(
                      selectedEntityId === e.id && "ring-2 ring-indigo-500 border-transparent",
                      focusEntityId === e.id && "bg-indigo-500/10 border-indigo-500/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm truncate pr-2">{e.name}</div>
                      <Badge type={e.type}>{e.type[0]}</Badge>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {getConnections(e.id).length} connections
                    </div>
                  </Card>
                ))}
              </div>

              {/* Column 3: Concepts / Events / Locations */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-6 text-center">Context</h2>
                {others.map(e => (
                  <Card 
                    key={e.id} 
                    onClick={() => setSelectedEntityId(e.id)}
                    className={cn(
                      selectedEntityId === e.id && "ring-2 ring-indigo-500 border-transparent",
                      focusEntityId === e.id && "bg-indigo-500/10 border-indigo-500/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm truncate pr-2">{e.name}</div>
                      <Badge type={e.type}>{e.type[0]}</Badge>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {getConnections(e.id).length} connections
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="w-80 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl overflow-hidden">
            {selectedEntity ? (
              <EntityDetail 
                entity={selectedEntity} 
                connections={selectedConnections}
                onClose={() => setSelectedEntityId(null)}
                onFocus={(id) => setFocusEntityId(id)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-50">
                <div className="w-12 h-12 rounded-full border border-dashed border-[var(--color-border)] flex items-center justify-center mb-4 text-xl">
                  🔍
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">Select an entity in the graph to view detailed properties and connections.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ENTITIES TAB --- */}
      {activeTab === "entities" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-wrap gap-2">
            {(["all", "person", "organization", "concept", "event", "location"] as const).map(type => (
              <button
                key={type}
                onClick={() => setEntityFilter(type)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize",
                  entityFilter === type 
                    ? "bg-white text-[var(--color-text-primary)] border-white" 
                    : "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-0)]/50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Connections</th>
                  <th className="px-6 py-4">First Seen</th>
                  <th className="px-6 py-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {filteredEntities.map(e => (
                  <tr 
                    key={e.id} 
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelectedEntityId(e.id);
                      setActiveTab("graph");
                    }}
                  >
                    <td className="px-6 py-4 font-medium text-[var(--color-text-primary)] group-hover:text-indigo-400">{e.name}</td>
                    <td className="px-6 py-4"><Badge type={e.type}>{e.type}</Badge></td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)] font-mono">{getConnections(e.id).length}</td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)]">{e.firstSeen}</td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)] text-xs truncate max-w-xs">{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- RELATIONS TAB --- */}
      {activeTab === "relations" && (
        <div className="animate-in fade-in duration-500">
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-0)]/50 border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Relation</th>
                  <th className="px-6 py-4">Target</th>
                  <th className="px-6 py-4">Strength</th>
                  <th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {INITIAL_RELATIONS.map(r => {
                  const source = INITIAL_ENTITIES.find(e => e.id === r.sourceId)!;
                  const target = INITIAL_ENTITIES.find(e => e.id === r.targetId)!;
                  return (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                        <span className="text-[var(--color-text-muted)] mr-2 text-[10px]">{source.type[0]}</span>
                        {source.name}
                      </td>
                      <td className="px-6 py-4"><Badge type="relation">{r.type.replace("_", " ")}</Badge></td>
                      <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                        <span className="text-[var(--color-text-muted)] mr-2 text-[10px]">{target.type[0]}</span>
                        {target.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${r.weight * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{(r.weight * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-text-muted)] text-xs font-mono">{r.createdDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SEARCH TAB --- */}
      {activeTab === "search" && (
        <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
          <div className="relative">
            <input 
              type="text"
              autoFocus
              placeholder="Search entities by name, description, or relations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-12 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-[var(--color-text-muted)]"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40">🔍</span>
          </div>

          {searchQuery.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Entity Results */}
              <div>
                <h3 className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-widest mb-4 flex justify-between">
                  Entities <span>{searchResults.entities.length} results</span>
                </h3>
                <div className="space-y-3">
                  {searchResults.entities.length > 0 ? searchResults.entities.map(e => (
                    <Card 
                      key={e.id} 
                      onClick={() => {
                        setSelectedEntityId(e.id);
                        setActiveTab("graph");
                      }}
                      className="group"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-[var(--color-text-primary)] font-medium group-hover:text-indigo-400 transition-colors">{e.name}</span>
                        <Badge type={e.type}>{e.type}</Badge>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">{e.description}</p>
                    </Card>
                  )) : (
                    <div className="text-[var(--color-text-muted)] text-sm italic py-4">No entities matching "{searchQuery}"</div>
                  )}
                </div>
              </div>

              {/* Relation Results */}
              <div>
                <h3 className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-widest mb-4 flex justify-between">
                  Relations <span>{searchResults.relations.length} results</span>
                </h3>
                <div className="space-y-3">
                  {searchResults.relations.length > 0 ? searchResults.relations.map(r => {
                    const source = INITIAL_ENTITIES.find(e => e.id === r.sourceId)!;
                    const target = INITIAL_ENTITIES.find(e => e.id === r.targetId)!;
                    return (
                      <div key={r.id} className="p-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-[var(--color-text-secondary)] font-medium truncate">{source.name}</span>
                          <span className="px-2 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-muted)] rounded text-[9px] uppercase font-bold shrink-0">
                            {r.type.replace("_", " ")}
                          </span>
                          <span className="text-[var(--color-text-secondary)] font-medium truncate">{target.name}</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-[var(--color-text-muted)] text-sm italic py-4">No relations matching "{searchQuery}"</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
              <div className="text-4xl mb-4">⌨️</div>
              <p className="max-w-xs">Start typing to search across the entire Horizon knowledge base.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
