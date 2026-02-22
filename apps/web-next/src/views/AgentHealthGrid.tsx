import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";

type AgentStatus = "ACTIVE" | "IDLE" | "ERROR" | "COMPLETE";

interface Agent {
  id: string;
  name: string;
  wave: "W1" | "W2" | "W3";
  status: AgentStatus;
  heartbeat: number[];
  errorRate: number;
  tokenVelocity: number;
  progress: number;
}

const generateInitialAgents = (): Agent[] => {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `agent-${(i + 1).toString().padStart(2, "0")}`,
    name: `Agent-${(i + 1).toString().padStart(2, "0")}`,
    wave: i < 5 ? "W1" : i < 10 ? "W2" : "W3",
    status: ["ACTIVE", "ACTIVE", "IDLE", "ERROR", "COMPLETE"][Math.floor(Math.random() * 5)] as AgentStatus,
    heartbeat: Array.from({ length: 10 }, () => Math.random() * 100),
    errorRate: Math.random() * 8,
    tokenVelocity: Math.floor(Math.random() * 2000),
    progress: Math.floor(Math.random() * 100),
  }));
};

const Sparkline = ({ data }: { data: number[] }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 60;
      const y = 20 - ((val - min) / range) * 15;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="60" height="20" className="overflow-visible">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default function AgentHealthGrid() {
  const [agents, setAgents] = useState<Agent[]>(generateInitialAgents());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [filter, setFilter] = useState<AgentStatus | "ALL">("ALL");

  const refreshData = () => {
    setAgents((prev) =>
      prev.map((agent) => ({
        ...agent,
        status: agent.status === "COMPLETE" ? "COMPLETE" : ["ACTIVE", "ACTIVE", "IDLE", "ERROR"][Math.floor(Math.random() * 4)] as AgentStatus,
        heartbeat: [...agent.heartbeat.slice(1), Math.random() * 100],
        errorRate: Math.max(0, agent.errorRate + (Math.random() - 0.5)),
        tokenVelocity: Math.max(0, agent.tokenVelocity + Math.floor((Math.random() - 0.5) * 200)),
        progress: agent.status === "COMPLETE" ? 100 : Math.min(100, agent.progress + Math.random() * 5),
      }))
    );
    setLastUpdated(new Date());
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredAgents = agents.filter((a) => filter === "ALL" || a.status === filter);

  const stats = {
    active: agents.filter((a) => a.status === "ACTIVE").length,
    idle: agents.filter((a) => a.status === "IDLE").length,
    error: agents.filter((a) => a.status === "ERROR").length,
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case "ACTIVE": return "text-green-400";
      case "IDLE": return "text-amber-400";
      case "ERROR": return "text-red-400";
      case "COMPLETE": return "text-gray-400";
    }
  };

  const getWaveColor = (wave: string) => {
    switch (wave) {
      case "W1": return "bg-blue-500/20 text-blue-400";
      case "W2": return "bg-violet-500/20 text-violet-400";
      case "W3": return "bg-indigo-500/20 text-indigo-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="p-6 bg-gray-900/950 min-h-full text-gray-100 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Agent Health Grid
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={refreshData}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm transition-colors"
        >
          Refresh
        </button>
      </header>

      <div className="flex flex-col gap-6">
        {/* Summary Bar */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-400">{agents.length}</div>
            <div className="text-xs text-gray-500 uppercase">Total Agents</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <div className="text-xs text-gray-500 uppercase">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.idle}</div>
            <div className="text-xs text-gray-500 uppercase">Idle</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.error}</div>
            <div className="text-xs text-gray-500 uppercase">Errors</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "IDLE", "ERROR"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-md text-sm font-medium transition-all border",
                filter === f
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
              )}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="p-4 bg-gray-950 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm">{agent.name}</div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold mt-1 inline-block", getWaveColor(agent.wave))}>
                    {agent.wave}
                  </span>
                </div>
                <div className={cn("text-[10px] font-bold flex items-center gap-1", getStatusColor(agent.status))}>
                  {agent.status === "ACTIVE" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                  {agent.status}
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="text-indigo-400">
                  <Sparkline data={agent.heartbeat} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase">Errors</div>
                  <div className={cn("text-xs font-bold", 
                    agent.errorRate < 1 ? "text-green-400" : agent.errorRate < 5 ? "text-amber-400" : "text-red-400"
                  )}>
                    {agent.errorRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500">Velocity</span>
                <span className="font-mono text-gray-300">{agent.tokenVelocity.toLocaleString()} tok/s</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Task Progress</span>
                  <span>{Math.round(agent.progress)}%</span>
                </div>
                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${agent.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
