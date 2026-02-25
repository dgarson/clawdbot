import React, { useState } from "react";
import { cn } from "../lib/utils";

type TransitionTab = "W1W2" | "W2W3";

interface WaveData {
  id: string;
  name: string;
  agents: number;
  findings: number;
  status: "COMPLETE" | "ACTIVE" | "PENDING";
  startTime: string;
  duration: string;
  cost: string;
}

const mockWaves: Record<string, WaveData> = {
  W1: {
    id: "W1",
    name: "Wave 1",
    agents: 5,
    findings: 47,
    status: "COMPLETE",
    startTime: "1:00 AM",
    duration: "32m",
    cost: "$1.24",
  },
  W2: {
    id: "W2",
    name: "Wave 2",
    agents: 5,
    findings: 12,
    status: "ACTIVE",
    startTime: "1:32 AM",
    duration: "Running",
    cost: "$0.45",
  },
  W3: {
    id: "W3",
    name: "Wave 3",
    agents: 5,
    findings: 0,
    status: "PENDING",
    startTime: "TBD",
    duration: "-",
    cost: "-",
  },
};

const HandoffArrow = ({ active }: { active?: boolean }) => (
  <div className="flex flex-col items-center justify-center px-4">
    <div className={cn(
      "h-0.5 w-12 bg-gradient-to-r from-violet-500 to-transparent relative",
      active && "animate-pulse"
    )}>
      <div className="absolute right-0 -top-1 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-8 border-l-violet-500" />
    </div>
  </div>
);

export default function WaveTransitionView() {
  const [activeTab, setActiveTab] = useState<TransitionTab>("W1W2");

  const isW1W2 = activeTab === "W1W2";
  
  return (
    <div className="p-6 bg-[var(--color-surface-1)]/950 min-h-full text-[var(--color-text-primary)] font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Wave Transition</h1>
        <p className="text-sm text-primary mt-1 font-medium">
          {isW1W2 ? "Wave 1 → Wave 2 Handoff" : "Wave 2 → Wave 3 Handoff"}
        </p>
      </header>

      {/* Selector Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg w-fit mb-8">
        <button
          onClick={() => setActiveTab("W1W2")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            isW1W2 ? "bg-primary text-[var(--color-text-primary)] shadow-lg shadow-violet-500/20" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          )}
        >
          W1 → W2
        </button>
        <button
          onClick={() => setActiveTab("W2W3")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            !isW1W2 ? "bg-primary text-[var(--color-text-primary)] shadow-lg shadow-violet-500/20" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          )}
        >
          W2 → W3
        </button>
      </div>

      {/* Main Diagram */}
      <div className="bg-[var(--color-surface-0)]/50 border border-[var(--color-border)] rounded-2xl p-12 mb-8 flex items-center justify-center">
        <div className="flex items-center gap-4">
          {/* Wave 1 */}
          <div className={cn(
            "w-48 p-6 rounded-xl border-2 transition-all duration-500",
            isW1W2 ? "bg-[var(--color-surface-1)]/50 border-[var(--color-border)] opacity-50" : "bg-[var(--color-surface-1)]/50 border-[var(--color-border)] opacity-30"
          )}>
            <div className="text-xs text-[var(--color-text-muted)] font-bold uppercase mb-2">Wave 1</div>
            <div className="text-xl font-bold mb-1">Complete</div>
            <div className="text-xs text-[var(--color-text-secondary)]">47 Findings</div>
          </div>

          <HandoffArrow active={isW1W2} />

          {/* Wave 2 */}
          <div className={cn(
            "w-56 p-8 rounded-xl border-2 transition-all duration-500 flex flex-col items-center text-center",
            isW1W2 
              ? "bg-violet-950/20 border-primary ring-4 ring-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.3)] scale-110" 
              : "bg-[var(--color-surface-1)]/50 border-[var(--color-border)] opacity-50"
          )}>
            <div className="text-xs text-primary font-bold uppercase mb-2">Wave 2</div>
            <div className="text-2xl font-black mb-1">Active</div>
            <div className="text-xs text-violet-300/70">5 Agents Initialized</div>
            {isW1W2 && (
              <div className="mt-4 flex gap-1">
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>

          <HandoffArrow active={!isW1W2} />

          {/* Wave 3 */}
          <div className={cn(
            "w-48 p-6 rounded-xl border-2 transition-all duration-500",
            !isW1W2 
              ? "bg-violet-950/20 border-primary ring-4 ring-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.3)] scale-110"
              : "bg-[var(--color-surface-0)] border-[var(--color-border)] opacity-50"
          )}>
            <div className="text-xs text-[var(--color-text-muted)] font-bold uppercase mb-2">Wave 3</div>
            <div className="text-xl font-bold mb-1 flex items-center gap-2">
              {!isW1W2 ? "Kickoff" : <span className="flex items-center gap-2">Pending <span className="text-lg">🔒</span></span>}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">Wait for W2 signal</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Handoff Events */}
        <section>
          <h2 className="text-lg font-bold mb-4">Handoff Events</h2>
          <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--color-surface-2)]">
            <div className="pl-8 relative">
              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-green-500 border-4 border-[var(--color-border)]" />
              <div className="text-sm font-bold">Wave 1 completed at 1:32 AM</div>
              <div className="text-xs text-[var(--color-text-secondary)]">5 agents, 47 findings confirmed</div>
            </div>
            <div className="pl-8 relative">
              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary border-4 border-[var(--color-border)]" />
              <div className="text-sm font-bold">Wave 2 started at 1:32 AM</div>
              <div className="text-xs text-[var(--color-text-secondary)]">5 agents initialized, context propagated</div>
            </div>
            <div className="pl-8 relative">
              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary/30 border-4 border-[var(--color-border)] animate-pulse" />
              <div className="text-sm font-bold">Wave 2 findings rolling in...</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Target identified: /api/v2/legacy_endpoints</div>
            </div>
            <div className="pl-8 relative opacity-50">
              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-[var(--color-surface-3)] border-4 border-[var(--color-border)] flex items-center justify-center text-[8px]">🔒</div>
              <div className="text-sm font-bold">Wave 3 pending</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Awaiting Wave 2 saturation signal</div>
            </div>
          </div>
        </section>

        {/* Wave Stats Table */}
        <section>
          <h2 className="text-lg font-bold mb-4">Wave Stats</h2>
          <div className="bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Wave</th>
                  <th className="px-4 py-3">Agents</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {Object.values(mockWaves).map((wave) => (
                  <tr key={wave.id} className={cn("hover:bg-[var(--color-surface-1)]/50 transition-colors", wave.status === "ACTIVE" && "bg-violet-900/5")}>
                    <td className="px-4 py-3 font-bold">{wave.id}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wave.agents}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wave.startTime}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{wave.duration}</td>
                    <td className="px-4 py-3">
                      <span className={cn(wave.findings > 0 ? "text-green-400" : "text-[var(--color-text-muted)]")}>
                        {wave.findings}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-primary font-mono">{wave.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
