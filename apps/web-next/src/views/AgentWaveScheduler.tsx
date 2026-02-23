import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ModelType = "Claude" | "MiniMax" | "Grok";

interface Agent {
  id: string;
  name: string;
  domain: string;
  preferredModel: ModelType;
  estTokenCost: number;
  estTokens: number;
}

interface WaveConfig {
  id: string;
  name: string;
  startTime: string;
  staggerInterval: number; // in minutes
}

// ─── Constants & Seed Data ───────────────────────────────────────────────────

const MODELS: Record<ModelType, { color: string; bg: string; border: string }> = {
  Claude: {
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
  },
  MiniMax: {
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
  },
  Grok: {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
};

const SEED_AGENTS: Agent[] = [
  { id: "a1", name: "Xavier", domain: "Strategy", preferredModel: "Claude", estTokenCost: 1.2, estTokens: 15000 },
  { id: "a2", name: "Luis", domain: "UX/UI", preferredModel: "MiniMax", estTokenCost: 0.8, estTokens: 12000 },
  { id: "a3", name: "Tim", domain: "Architecture", preferredModel: "Grok", estTokenCost: 0.5, estTokens: 8000 },
  { id: "a4", name: "Piper", domain: "Components", preferredModel: "Claude", estTokenCost: 0.9, estTokens: 10000 },
  { id: "a5", name: "Quinn", domain: "Interactions", preferredModel: "MiniMax", estTokenCost: 1.1, estTokens: 14000 },
  { id: "a6", name: "Reed", domain: "Accessibility", preferredModel: "Grok", estTokenCost: 0.4, estTokens: 6000 },
  { id: "a7", name: "Wes", domain: "Performance", preferredModel: "Claude", estTokenCost: 1.5, estTokens: 20000 },
  { id: "a8", name: "Sam", domain: "Networking", preferredModel: "MiniMax", estTokenCost: 0.7, estTokens: 9000 },
  { id: "a9", name: "Roman", domain: "Platform", preferredModel: "Grok", estTokenCost: 0.6, estTokens: 7500 },
  { id: "a10", name: "Claire", domain: "Features", preferredModel: "Claude", estTokenCost: 1.3, estTokens: 18000 },
  { id: "a11", name: "Joey", domain: "TPM", preferredModel: "MiniMax", estTokenCost: 0.9, estTokens: 11000 },
  { id: "a12", name: "Stephan", domain: "Brand", preferredModel: "Grok", estTokenCost: 0.5, estTokens: 7000 },
  { id: "a13", name: "Amadeus", domain: "Executive", preferredModel: "Claude", estTokenCost: 2.0, estTokens: 25000 },
  { id: "a14", name: "David", domain: "Founder", preferredModel: "MiniMax", estTokenCost: 1.8, estTokens: 22000 },
  { id: "a15", name: "Nova", domain: "Security", preferredModel: "Grok", estTokenCost: 0.7, estTokens: 8500 },
];

const INITIAL_WAVES: WaveConfig[] = [
  { id: "wave-1", name: "Wave 1", startTime: "09:00", staggerInterval: 5 },
  { id: "wave-2", name: "Wave 2", startTime: "10:30", staggerInterval: 10 },
  { id: "wave-3", name: "Wave 3", startTime: "13:00", staggerInterval: 15 },
];

const CAPACITY_TARGET = 5;

// ─── Components ──────────────────────────────────────────────────────────────

export default function AgentWaveScheduler() {
  const [waveAssignments, setWaveAssignments] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    SEED_AGENTS.forEach((a) => (initial[a.id] = null));
    return initial;
  });

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [waves, setWaves] = useState<WaveConfig[]>(INITIAL_WAVES);

  // Derived state
  const unassignedAgents = useMemo(
    () => SEED_AGENTS.filter((a) => !waveAssignments[a.id]),
    [waveAssignments]
  );

  const getAgentsInWave = (waveId: string) => {
    return SEED_AGENTS.filter((a) => waveAssignments[a.id] === waveId);
  };

  // Actions
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(selectedAgentId === agentId ? null : agentId);
  };

  const handleAssignToWave = (waveId: string | null) => {
    if (!selectedAgentId) {return;}
    setWaveAssignments((prev) => ({
      ...prev,
      [selectedAgentId]: waveId,
    }));
    setSelectedAgentId(null);
  };

  const handleAutoBalance = () => {
    const newAssignments: Record<string, string | null> = {};
    SEED_AGENTS.forEach((agent, index) => {
      const waveIndex = index % waves.length;
      newAssignments[agent.id] = waves[waveIndex].id;
    });
    setWaveAssignments(newAssignments);
    setSelectedAgentId(null);
  };

  const handleReset = () => {
    const resetAssignments: Record<string, string | null> = {};
    SEED_AGENTS.forEach((a) => (resetAssignments[a.id] = null));
    setWaveAssignments(resetAssignments);
    setSelectedAgentId(null);
  };

  const updateWaveConfig = (waveId: string, updates: Partial<WaveConfig>) => {
    setWaves((prev) =>
      prev.map((w) => (w.id === waveId ? { ...w, ...updates } : w))
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 p-6 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Discovery Wave Scheduler</h1>
          <p className="text-sm text-gray-500 mt-1">Assign agents to sequential discovery waves and monitor capacity.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAutoBalance}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Auto-balance
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg border border-gray-800 hover:bg-gray-900 text-gray-400 text-sm font-medium transition-colors"
          >
            Reset All
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        {/* Unassigned Pool */}
        <section
          className={cn(
            "flex flex-col rounded-xl bg-gray-900/50 border border-gray-800 p-4 transition-all",
            selectedAgentId && "ring-1 ring-indigo-500/30"
          )}
        >
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="font-semibold text-white">Unassigned Pool</h2>
            <span className="text-xs text-gray-500">{unassignedAgents.length} agents</span>
          </div>

          <div
            onClick={() => handleAssignToWave(null)}
            className={cn(
              "flex-1 space-y-3 p-1 rounded-lg transition-colors cursor-pointer",
              selectedAgentId && waveAssignments[selectedAgentId] !== null && "bg-indigo-500/5 hover:bg-indigo-500/10"
            )}
          >
            {unassignedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgentId === agent.id}
                onSelect={() => handleSelectAgent(agent.id)}
              />
            ))}
            {unassignedAgents.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                <p className="text-gray-700 text-sm italic">No unassigned agents</p>
              </div>
            )}
          </div>
        </section>

        {/* Waves */}
        {waves.map((wave) => {
          const agentsInWave = getAgentsInWave(wave.id);
          const isFull = agentsInWave.length >= CAPACITY_TARGET;
          const totalCost = agentsInWave.reduce((acc, a) => acc + a.estTokenCost, 0);
          const totalTokens = agentsInWave.reduce((acc, a) => acc + a.estTokens, 0);
          const modelMix = agentsInWave.reduce((acc, a) => {
            acc[a.preferredModel] = (acc[a.preferredModel] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <section
              key={wave.id}
              className={cn(
                "flex flex-col rounded-xl bg-gray-900/50 border border-gray-800 p-4 transition-all overflow-hidden",
                selectedAgentId && waveAssignments[selectedAgentId] !== wave.id && "ring-1 ring-indigo-500/20"
              )}
            >
              {/* Wave Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-white">{wave.name}</h2>
                  <div className={cn(
                    "text-xs px-2 py-0.5 rounded-full border",
                    isFull ? "bg-amber-400/10 border-amber-400/20 text-amber-400" : "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
                  )}>
                    {agentsInWave.length} / {CAPACITY_TARGET}
                  </div>
                </div>

                {/* Wave Config */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">Start Time</label>
                    <input
                      type="time"
                      value={wave.startTime}
                      onChange={(e) => updateWaveConfig(wave.id, { startTime: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">Stagger (m)</label>
                    <input
                      type="number"
                      value={wave.staggerInterval}
                      onChange={(e) => updateWaveConfig(wave.id, { staggerInterval: parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Assignment Zone */}
              <div
                onClick={() => handleAssignToWave(wave.id)}
                className={cn(
                  "flex-1 min-h-[100px] space-y-3 p-1 rounded-lg transition-colors cursor-pointer mb-4",
                  selectedAgentId && waveAssignments[selectedAgentId] !== wave.id && "bg-indigo-500/5 hover:bg-indigo-500/10 border-2 border-dashed border-indigo-500/20"
                )}
              >
                {agentsInWave.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgentId === agent.id}
                    onSelect={() => handleSelectAgent(agent.id)}
                  />
                ))}
                {agentsInWave.length === 0 && !selectedAgentId && (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-800 rounded-lg">
                    <p className="text-gray-700 text-xs">No agents assigned</p>
                  </div>
                )}
                {selectedAgentId && waveAssignments[selectedAgentId] !== wave.id && agentsInWave.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-indigo-400/60 text-xs animate-pulse">Click to assign</p>
                  </div>
                )}
              </div>

              {/* Wave Summary Footer */}
              <div className="mt-auto pt-4 border-t border-gray-800 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Est. Cost</span>
                  <span className="text-white font-mono">${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Tokens</span>
                  <span className="text-white font-mono">{totalTokens.toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(modelMix).map(([model, count]) => (
                    <div
                      key={model}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1",
                        MODELS[model as ModelType].bg,
                        MODELS[model as ModelType].border,
                        MODELS[model as ModelType].color
                      )}
                    >
                      <span>{model}</span>
                      <span className="opacity-60">×</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      
      {/* Selection Overlay (Mobile) */}
      {selectedAgentId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200 z-50">
          <span className="text-sm font-medium">Assigning {SEED_AGENTS.find(a => a.id === selectedAgentId)?.name}</span>
          <div className="w-px h-4 bg-white/20" />
          <button 
            onClick={() => setSelectedAgentId(null)}
            className="text-xs uppercase tracking-widest font-bold hover:text-white/80"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function AgentCard({
  agent,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const modelStyle = MODELS[agent.preferredModel];

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "group relative rounded-xl border p-3 transition-all cursor-pointer",
        isSelected
          ? "bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 translate-y-[-2px]"
          : "bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800/80"
      )}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className={cn("text-sm font-semibold", isSelected ? "text-white" : "text-gray-200")}>
            {agent.name}
          </h3>
          <p className={cn("text-[10px] mt-0.5", isSelected ? "text-indigo-200" : "text-gray-500")}>
            {agent.domain}
          </p>
        </div>
        <div
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded border transition-colors",
            isSelected ? "bg-white/10 border-white/20 text-white" : cn(modelStyle.bg, modelStyle.border, modelStyle.color)
          )}
        >
          {agent.preferredModel}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono mt-3">
        <span className={isSelected ? "text-indigo-200" : "text-gray-500"}>
          ${agent.estTokenCost.toFixed(2)}
        </span>
        <span className={isSelected ? "text-indigo-200" : "text-gray-500"}>
          {agent.estTokens.toLocaleString()} tkn
        </span>
      </div>
      
      {/* Active selection pulse */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl border-2 border-white/30 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
