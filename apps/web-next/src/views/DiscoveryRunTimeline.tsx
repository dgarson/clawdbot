import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface AgentDetail {
  id: string;
  name: string;
  wave: 1 | 2 | 3;
  start: number; // minutes from start
  end: number;   // minutes from start
  findings: number;
  model: string;
  cost: number;
}

const agents: AgentDetail[] = [
  // Wave 1: 0-90 min
  { id: 'Agent-01', name: 'Agent-01', wave: 1, start: 5, end: 45, findings: 12, model: 'GPT-4o', cost: 0.85 },
  { id: 'Agent-02', name: 'Agent-02', wave: 1, start: 10, end: 70, findings: 8, model: 'Claude 3.5 Sonnet', cost: 1.20 },
  { id: 'Agent-03', name: 'Agent-03', wave: 1, start: 15, end: 55, findings: 15, model: 'GPT-4o', cost: 0.95 },
  { id: 'Agent-04', name: 'Agent-04', wave: 1, start: 20, end: 85, findings: 5, model: 'Grok-1', cost: 0.45 },
  { id: 'Agent-05', name: 'Agent-05', wave: 1, start: 25, end: 65, findings: 22, model: 'Claude 3.5 Sonnet', cost: 1.10 },
  // Wave 2: 60-150 min
  { id: 'Agent-06', name: 'Agent-06', wave: 2, start: 65, end: 110, findings: 4, model: 'GPT-4o', cost: 0.65 },
  { id: 'Agent-07', name: 'Agent-07', wave: 2, start: 70, end: 130, findings: 19, model: 'Claude 3.5 Sonnet', cost: 1.45 },
  { id: 'Agent-08', name: 'Agent-08', wave: 2, start: 75, end: 120, findings: 11, model: 'GPT-4o', cost: 0.80 },
  { id: 'Agent-09', name: 'Agent-09', wave: 2, start: 80, end: 145, findings: 7, model: 'Grok-1', cost: 0.55 },
  { id: 'Agent-10', name: 'Agent-10', wave: 2, start: 85, end: 125, findings: 14, model: 'Claude 3.5 Sonnet', cost: 1.05 },
  // Wave 3: 120-220 min
  { id: 'Agent-11', name: 'Agent-11', wave: 3, start: 125, end: 180, findings: 25, model: 'GPT-4o', cost: 1.25 },
  { id: 'Agent-12', name: 'Agent-12', wave: 3, start: 130, end: 210, findings: 3, model: 'Claude 3.5 Sonnet', cost: 1.60 },
  { id: 'Agent-13', name: 'Agent-13', wave: 3, start: 140, end: 195, findings: 18, model: 'GPT-4o', cost: 0.90 },
  { id: 'Agent-14', name: 'Agent-14', wave: 3, start: 150, end: 215, findings: 9, model: 'Grok-1', cost: 0.75 },
  { id: 'Agent-15', name: 'Agent-15', wave: 3, start: 160, end: 220, findings: 13, model: 'Claude 3.5 Sonnet', cost: 1.15 },
];

const DiscoveryRunTimeline: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<AgentDetail | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const totalDuration = 240;
  const padding = 40;
  const rowHeight = 35;
  const chartHeight = (agents.length * rowHeight) + padding * 2;
  const chartWidth = 900;
  const timeScale = (chartWidth - padding * 2) / totalDuration;

  const getWaveColor = (wave: number) => {
    switch (wave) {
      case 1: return 'fill-indigo-500 hover:fill-indigo-400';
      case 2: return 'fill-violet-500 hover:fill-violet-400';
      case 3: return 'fill-emerald-500 hover:fill-emerald-400';
      default: return 'fill-gray-500';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold tracking-tight">Discovery Run Timeline</h1>
          <span className="px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded text-xs font-mono border border-[var(--color-border)]">RUN-2026-02-22-001</span>
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold border border-emerald-500/20">COMPLETE</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-sm text-[var(--color-text-secondary)]">Wave 1</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-sm text-[var(--color-text-secondary)]">Wave 2</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-[var(--color-text-secondary)]">Wave 3</span>
          </div>
        </div>
      </div>

      {/* SVG Gantt Chart */}
      <div className="relative bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4 overflow-x-auto shadow-2xl" onMouseMove={handleMouseMove}>
        <svg width={chartWidth} height={chartHeight} className="overflow-visible">
          {/* Grid Lines (X-axis) */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240].map((min) => (
            <g key={min} transform={`translate(${padding + min * timeScale}, 0)`}>
              <line y1={padding} y2={chartHeight - padding} stroke="#1f2937" strokeWidth="1" strokeDasharray="4 4" />
              <text y={chartHeight - padding + 20} textAnchor="middle" className="text-[10px] fill-gray-500 font-mono">
                {min}m
              </text>
            </g>
          ))}

          {/* Grid Lines (Y-axis labels) */}
          {agents.map((agent, i) => (
            <text key={agent.id} x={padding - 10} y={padding + i * rowHeight + rowHeight / 2} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-gray-400 font-mono">
              {agent.id}
            </text>
          ))}

          {/* Now Marker (at 100% complete) */}
          <line x1={padding + totalDuration * timeScale} y1={padding} x2={padding + totalDuration * timeScale} y2={chartHeight - padding} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
          <text x={padding + totalDuration * timeScale} y={padding - 10} textAnchor="middle" className="text-[10px] fill-red-500 font-bold">FINISH</text>

          {/* Agent Bars */}
          {agents.map((agent, i) => (
            <rect
              key={agent.id}
              x={padding + agent.start * timeScale}
              y={padding + i * rowHeight + 5}
              width={(agent.end - agent.start) * timeScale}
              height={rowHeight - 10}
              rx="4"
              className={cn("cursor-pointer transition-all duration-200", getWaveColor(agent.wave))}
              onMouseEnter={() => setHoveredAgent(agent)}
              onMouseLeave={() => setHoveredAgent(null)}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredAgent && (
          <div 
            className="fixed z-50 pointer-events-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-3 shadow-xl text-xs space-y-1"
            style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
          >
            <div className="font-bold text-[var(--color-text-primary)]">{hoveredAgent.name}</div>
            <div className="flex justify-between space-x-4">
              <span className="text-[var(--color-text-secondary)]">Wave:</span>
              <span className={cn("font-semibold", hoveredAgent.wave === 1 ? 'text-indigo-400' : hoveredAgent.wave === 2 ? 'text-violet-400' : 'text-emerald-400')}>
                {hoveredAgent.wave}
              </span>
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-[var(--color-text-secondary)]">Duration:</span>
              <span className="text-[var(--color-text-primary)] font-mono">{hoveredAgent.start}m - {hoveredAgent.end}m</span>
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-[var(--color-text-secondary)]">Findings:</span>
              <span className="text-[var(--color-text-primary)] font-bold">{hoveredAgent.findings}</span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-4 bg-[var(--color-surface-1)]/50 border border-[var(--color-border)] rounded-xl p-6">
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-text-secondary)]">Total Duration</div>
          <div className="text-2xl font-bold text-indigo-400">3h 47m</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-text-secondary)]">Agents Deployed</div>
          <div className="text-2xl font-bold text-violet-400">15</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-text-secondary)]">Discovery Waves</div>
          <div className="text-2xl font-bold text-emerald-400">3</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-[var(--color-text-secondary)]">Completion Status</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">100%</div>
        </div>
      </div>

      {/* Detail Popover */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedAgent(null)}>
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedAgent.name} Details</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Execution profile for this discovery run</p>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--color-surface-0)] rounded-xl border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">Findings</div>
                <div className="text-2xl font-bold text-emerald-400">{selectedAgent.findings}</div>
              </div>
              <div className="p-4 bg-[var(--color-surface-0)] rounded-xl border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">Cost</div>
                <div className="text-2xl font-bold text-indigo-400">${selectedAgent.cost.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-[var(--color-surface-0)] rounded-xl border border-[var(--color-border)] col-span-2">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">Model</div>
                <div className="text-lg font-bold text-[var(--color-text-primary)]">{selectedAgent.model}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">Wave Assignment</div>
              <div className="flex items-center space-x-2">
                <div className={cn("w-3 h-3 rounded-full", selectedAgent.wave === 1 ? 'bg-indigo-500' : selectedAgent.wave === 2 ? 'bg-violet-500' : 'bg-emerald-500')} />
                <span className="text-[var(--color-text-secondary)]">Wave {selectedAgent.wave}</span>
              </div>
            </div>

            <button 
              onClick={() => setSelectedAgent(null)}
              className="w-full py-3 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] rounded-xl font-bold transition-colors border border-[var(--color-border)]"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryRunTimeline;
