import React, { useState, useMemo } from "react";
import { cn } from "../lib/utils";
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  FileSearch,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Expand,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RunStatus = "completed" | "failed" | "partial";

interface AgentSummary {
  id: string;
  name: string;
  domain: string;
  status: "completed" | "failed" | "partial";
  findingsCount: number;
  tokensUsed: number;
  cost: number;
  duration: number; // seconds
}

interface Finding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  agent: string;
  timestamp: string;
}

interface DiscoveryRun {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  duration: number; // seconds
  status: RunStatus;
  agentCount: number;
  agents: AgentSummary[];
  findingsCount: number;
  findings: Finding[];
  totalCost: number;
  waveBreakdown: {
    wave: 1 | 2 | 3;
    agents: number;
    findings: number;
    cost: number;
  }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const generateMockRuns = (): DiscoveryRun[] => {
  const runs: DiscoveryRun[] = [];
  const statuses: RunStatus[] = ["completed", "completed", "completed", "partial", "failed", "completed"];
  const domains = [
    "AI Infrastructure",
    "Developer Tooling",
    "Workflow Automation",
    "Observability & Monitoring",
    "Security & Compliance",
    "Data Platforms",
    "Cost Optimization",
    "ML/AI Platform",
    "Product Analytics",
    "API Design",
  ];
  const agentNames = [
    "Atlas",
    "Beacon",
    "Carta",
    "Delphi",
    "Echo",
    "Fenix",
    "Gust",
    "Helix",
    "Iris",
    "Jade",
    "Kilo",
    "Luna",
    "Mosaic",
    "Nova",
    "Orbit",
  ];

  // Generate 18 runs over the past 6 weeks
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const daysAgo = Math.floor(i * 2.3 + Math.random() * 2); // Spaced out over ~6 weeks
    const startTime = new Date(now);
    startTime.setDate(startTime.getDate() - daysAgo);
    startTime.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

    const duration = 1800 + Math.floor(Math.random() * 7200); // 30 min to 2.5 hours
    const endTime = new Date(startTime.getTime() + duration * 1000);

    const status = statuses[i % statuses.length];
    const agentCount = 10 + Math.floor(Math.random() * 6); // 10-15 agents

    const agents: AgentSummary[] = [];
    const findings: Finding[] = [];
    let totalCost = 0;

    for (let j = 0; j < agentCount; j++) {
      const agentStatus = status === "completed"
        ? "completed"
        : status === "failed"
        ? "failed"
        : Math.random() > 0.3
        ? "completed"
        : "failed";

      const findingsCount = agentStatus === "completed" ? Math.floor(Math.random() * 15) + 1 : 0;
      const tokensUsed = Math.floor(50000 + Math.random() * 150000);
      const cost = (tokensUsed / 1_000_000) * 15; // Approximate cost
      const agentDuration = Math.floor(duration / agentCount) + Math.floor(Math.random() * 300);

      agents.push({
        id: `disc-${String(j + 1).padStart(2, "0")}`,
        name: agentNames[j % agentNames.length],
        domain: domains[j % domains.length],
        status: agentStatus,
        findingsCount,
        tokensUsed,
        cost,
        duration: agentDuration,
      });

      totalCost += cost;

      // Generate findings for this agent
      if (findingsCount > 0) {
        const severities: Finding["severity"][] = ["critical", "high", "medium", "low"];
        for (let k = 0; k < Math.min(findingsCount, 5); k++) {
          findings.push({
            id: `finding-${i}-${j}-${k}`,
            title: `${domains[j % domains.length]} ${["optimization", "issue", "recommendation", "risk", "improvement"][k]}`,
            severity: severities[Math.floor(Math.random() * severities.length)],
            agent: agentNames[j % agentNames.length],
            timestamp: startTime.toISOString(),
          });
        }
      }
    }

    // Wave breakdown
    const waveBreakdown = [
      {
        wave: 1 as const,
        agents: Math.floor(agentCount * 0.4),
        findings: Math.floor(findings.length * 0.4),
        cost: totalCost * 0.4,
      },
      {
        wave: 2 as const,
        agents: Math.floor(agentCount * 0.35),
        findings: Math.floor(findings.length * 0.35),
        cost: totalCost * 0.35,
      },
      {
        wave: 3 as const,
        agents: agentCount - Math.floor(agentCount * 0.4) - Math.floor(agentCount * 0.35),
        findings: findings.length - Math.floor(findings.length * 0.4) - Math.floor(findings.length * 0.35),
        cost: totalCost * 0.25,
      },
    ];

    runs.push({
      id: `run-${String(18 - i).padStart(4, "0")}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      status,
      agentCount,
      agents,
      findingsCount: findings.length,
      findings,
      totalCost,
      waveBreakdown,
    });
  }

  return runs;
};

const MOCK_RUNS = generateMockRuns();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m ${s}s`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function statusBadge(status: RunStatus): { bg: string; text: string; icon: React.ReactNode } {
  switch (status) {
    case "completed":
      return {
        bg: "bg-emerald-900/50 border-emerald-700",
        text: "text-emerald-400",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    case "failed":
      return {
        bg: "bg-red-900/50 border-red-700",
        text: "text-red-400",
        icon: <XCircle className="w-3 h-3" />,
      };
    case "partial":
      return {
        bg: "bg-amber-900/50 border-amber-700",
        text: "text-amber-400",
        icon: <AlertCircle className="w-3 h-3" />,
      };
  }
}

function severityBadge(severity: Finding["severity"]): string {
  switch (severity) {
    case "critical":
      return "text-red-400 bg-red-950";
    case "high":
      return "text-orange-400 bg-orange-950";
    case "medium":
      return "text-amber-400 bg-amber-950";
    case "low":
      return "text-zinc-400 bg-zinc-800";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type SortField = "startTime" | "duration" | "totalCost" | "findingsCount";
type SortDirection = "asc" | "desc";

const DiscoveryRunHistory: React.FC = () => {
  const [runs] = useState<DiscoveryRun[]>(MOCK_RUNS);

  // Filters
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [costMin, setCostMin] = useState<string>("");
  const [costMax, setCostMax] = useState<string>("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("startTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const runsPerPage = 10;

  // Expanded row
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  // Filtered and sorted runs
  const filteredRuns = useMemo(() => {
    let result = runs;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(query) ||
          r.agents.some((a) => a.name.toLowerCase().includes(query) || a.domain.toLowerCase().includes(query))
      );
    }

    // Cost range filter
    if (costMin) {
      const min = parseFloat(costMin);
      result = result.filter((r) => r.totalCost >= min);
    }
    if (costMax) {
      const max = parseFloat(costMax);
      result = result.filter((r) => r.totalCost <= max);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "startTime":
          comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          break;
        case "duration":
          comparison = a.duration - b.duration;
          break;
        case "totalCost":
          comparison = a.totalCost - b.totalCost;
          break;
        case "findingsCount":
          comparison = a.findingsCount - b.findingsCount;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [runs, statusFilter, searchQuery, costMin, costMax, sortField, sortDirection]);

  // Paginated runs
  const totalPages = Math.ceil(filteredRuns.length / runsPerPage);
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * runsPerPage;
    return filteredRuns.slice(start, start + runsPerPage);
  }, [filteredRuns, currentPage]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, costMin, costMax, sortField, sortDirection]);

  // Summary stats
  const totalRuns = runs.length;
  const avgCost = runs.reduce((acc, r) => acc + r.totalCost, 0) / runs.length;
  const totalFindings = runs.reduce((acc, r) => acc + r.findingsCount, 0);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline" />
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 font-mono">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📋</span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Discovery Run History</h1>
        </div>
        <p className="text-sm text-gray-400 ml-12">
          Past discovery runs · {totalRuns} total runs
        </p>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Total Runs</div>
          <div className="text-3xl font-bold tabular-nums text-white">{totalRuns}</div>
          <div className="text-xs text-gray-500 mt-1">past 6 weeks</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Avg Cost</div>
          <div className="text-3xl font-bold tabular-nums text-emerald-400">${avgCost.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">per run</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Total Findings</div>
          <div className="text-3xl font-bold tabular-nums text-amber-400">{totalFindings}</div>
          <div className="text-xs text-gray-500 mt-1">across all runs</div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search runs, agents, domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RunStatus | "all")}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Cost range */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Cost:</span>
            <input
              type="number"
              placeholder="Min"
              value={costMin}
              onChange={(e) => setCostMin(e.target.value)}
              className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
            />
            <span className="text-gray-500">—</span>
            <input
              type="number"
              placeholder="Max"
              value={costMax}
              onChange={(e) => setCostMax(e.target.value)}
              className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
            />
          </div>

          {/* Clear filters */}
          {(statusFilter !== "all" || searchQuery || costMin || costMax) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
                setCostMin("");
                setCostMax("");
              }}
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Results Count ── */}
      <div className="text-xs text-gray-500 mb-3">
        Showing {paginatedRuns.length} of {filteredRuns.length} runs
        {filteredRuns.length !== runs.length && ` (filtered from ${runs.length} total)`}
      </div>

      {/* ── Table ── */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 text-xs uppercase tracking-widest text-gray-500 font-medium">
          <button
            onClick={() => handleSort("startTime")}
            className="col-span-3 text-left hover:text-gray-300 transition-colors flex items-center"
          >
            Run <SortIcon field="startTime" />
          </button>
          <button
            onClick={() => handleSort("duration")}
            className="col-span-2 text-left hover:text-gray-300 transition-colors flex items-center"
          >
            Duration <SortIcon field="duration" />
          </button>
          <div className="col-span-2 text-left">Status</div>
          <div className="col-span-1 text-center">Agents</div>
          <button
            onClick={() => handleSort("findingsCount")}
            className="col-span-2 text-right hover:text-gray-300 transition-colors flex items-center justify-end"
          >
            Findings <SortIcon field="findingsCount" />
          </button>
          <button
            onClick={() => handleSort("totalCost")}
            className="col-span-2 text-right hover:text-gray-300 transition-colors flex items-center justify-end"
          >
            Cost <SortIcon field="totalCost" />
          </button>
          <div className="col-span-1 text-center"></div>
        </div>

        {/* Table Body */}
        {paginatedRuns.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <div className="text-gray-400 mb-2">No runs found</div>
            <div className="text-sm text-gray-600">
              Try adjusting your filters or search query
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/30">
            {paginatedRuns.map((run) => {
              const badge = statusBadge(run.status);
              const isExpanded = expandedRun === run.id;

              return (
                <div key={run.id}>
                  {/* Row */}
                  <div
                    className={cn(
                      "grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-800/30 transition-colors cursor-pointer",
                      isExpanded && "bg-gray-800/50"
                    )}
                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  >
                    {/* Run ID + Time */}
                    <div className="col-span-3">
                      <div className="font-semibold text-sm text-white">{run.id}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatTime(run.startTime)}</div>
                    </div>

                    {/* Duration */}
                    <div className="col-span-2 flex items-center gap-1.5 text-sm text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      {formatDuration(run.duration)}
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border",
                          badge.bg,
                          badge.text
                        )}
                      >
                        {badge.icon}
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </div>

                    {/* Agents */}
                    <div className="col-span-1 text-center">
                      <div className="inline-flex items-center gap-1 text-sm text-gray-300">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        {run.agentCount}
                      </div>
                    </div>

                    {/* Findings */}
                    <div className="col-span-2 text-right">
                      <div className="inline-flex items-center gap-1.5 text-sm text-amber-400">
                        <FileSearch className="w-3.5 h-3.5" />
                        {run.findingsCount}
                      </div>
                    </div>

                    {/* Cost */}
                    <div className="col-span-2 text-right">
                      <div className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                        <DollarSign className="w-3.5 h-3.5" />
                        {run.totalCost.toFixed(2)}
                      </div>
                    </div>

                    {/* Expand */}
                    <div className="col-span-1 text-center">
                      <Expand
                        className={cn(
                          "w-4 h-4 text-gray-500 mx-auto transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-700/50 bg-gray-800/20 p-4">
                      {/* Wave Breakdown */}
                      <div className="mb-4">
                        <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Wave Breakdown</div>
                        <div className="grid grid-cols-3 gap-3">
                          {run.waveBreakdown.map((wave) => (
                            <div
                              key={wave.wave}
                              className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3"
                            >
                              <div className="text-xs font-medium text-gray-300 mb-1">Wave {wave.wave}</div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <div className="text-gray-600">Agents</div>
                                  <div className="text-gray-300">{wave.agents}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Findings</div>
                                  <div className="text-amber-400">{wave.findings}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Cost</div>
                                  <div className="text-emerald-400">${wave.cost.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Agent Summary */}
                      <div className="mb-4">
                        <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Agent Summary</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                          {run.agents.map((agent) => (
                            <div
                              key={agent.id}
                              className={cn(
                                "bg-gray-900/50 border rounded-lg p-2 text-xs",
                                agent.status === "completed"
                                  ? "border-emerald-800/50"
                                  : agent.status === "failed"
                                  ? "border-red-800/50"
                                  : "border-amber-800/50"
                              )}
                            >
                              <div className="font-medium text-gray-200 truncate">{agent.name}</div>
                              <div className="text-gray-500 truncate">{agent.domain}</div>
                              <div className="mt-1 flex justify-between">
                                <span
                                  className={cn(
                                    "text-xs",
                                    agent.status === "completed"
                                      ? "text-emerald-400"
                                      : agent.status === "failed"
                                      ? "text-red-400"
                                      : "text-amber-400"
                                  )}
                                >
                                  {agent.findingsCount} findings
                                </span>
                                <span className="text-gray-600">${agent.cost.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Top Findings */}
                      {run.findings.length > 0 && (
                        <div>
                          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">
                            Top Findings ({run.findings.length})
                          </div>
                          <div className="space-y-2">
                            {run.findings.slice(0, 8).map((finding) => (
                              <div
                                key={finding.id}
                                className="flex items-center justify-between bg-gray-900/30 border border-gray-700/30 rounded-lg px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase flex-shrink-0",
                                      severityBadge(finding.severity)
                                    )}
                                  >
                                    {finding.severity}
                                  </span>
                                  <span className="text-gray-300 truncate">{finding.title}</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-500 flex-shrink-0 ml-4">
                                  <span>{finding.agent}</span>
                                </div>
                              </div>
                            ))}
                            {run.findings.length > 8 && (
                              <div className="text-xs text-gray-500 text-center py-1">
                                +{run.findings.length - 8} more findings
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "p-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                currentPage === 1 ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                    currentPage === pageNum
                      ? "bg-sky-600 text-white"
                      : "text-gray-400 hover:bg-gray-800"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "p-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                currentPage === totalPages ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-8 pt-4 border-t border-gray-700/50 text-xs text-gray-600 flex justify-between">
        <span>DiscoveryRunHistory v1.0 — OpenClaw Horizon UI</span>
        <span className="tabular-nums">Last updated: {formatTime(new Date().toISOString())}</span>
      </div>
    </div>
  );
};

export default DiscoveryRunHistory;
