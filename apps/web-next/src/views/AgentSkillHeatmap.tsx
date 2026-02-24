import React, { useState, useMemo, useCallback } from "react";
import {
  Grid3X3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Trophy,
  Filter,
  Info,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Award,
  ChevronDown,
  X,
} from "lucide-react";
import { useToast } from "../components/Toast";

// ============================================================================
// Types
// ============================================================================

interface AgentSkillData {
  agentId: string;
  agentName: string;
  model: string;
  totalRuns: number;
  avgSuccessRate: number;
  skills: Record<string, SkillMetric>;
}

interface SkillMetric {
  category: string;
  successRate: number;
  sampleCount: number;
  avgDurationMs: number;
}

interface FindingCategory {
  id: string;
  name: string;
  totalFindings: number;
  severity: "critical" | "high" | "medium" | "low";
}

interface TooltipData {
  agentName: string;
  category: string;
  successRate: number;
  sampleCount: number;
  avgDuration: number;
  x: number;
  y: number;
}

type RowSortMode = "average" | "alphabetical" | "runs";
type ColumnSortMode = "findings" | "alphabetical";

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_CATEGORIES: FindingCategory[] = [
  { id: "sql-injection", name: "SQL Injection", totalFindings: 847, severity: "critical" },
  { id: "xss", name: "XSS", totalFindings: 1243, severity: "high" },
  { id: "auth-bypass", name: "Auth Bypass", totalFindings: 412, severity: "critical" },
  { id: "priv-escalation", name: "Privilege Escalation", totalFindings: 289, severity: "high" },
  { id: "info-disclosure", name: "Info Disclosure", totalFindings: 1876, severity: "medium" },
  { id: "csrf", name: "CSRF", totalFindings: 634, severity: "medium" },
  { id: "ssrf", name: "SSRF", totalFindings: 423, severity: "high" },
  { id: "rce", name: "RCE", totalFindings: 198, severity: "critical" },
  { id: "crypto-flaw", name: "Crypto Flaw", totalFindings: 156, severity: "high" },
  { id: "dos", name: "DoS Vector", totalFindings: 312, severity: "medium" },
];

const MOCK_AGENTS: AgentSkillData[] = [
  {
    agentId: "recon-7",
    agentName: "ReconAgent-7",
    model: "claude-sonnet-4",
    totalRuns: 1842,
    avgSuccessRate: 87.3,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 94, sampleCount: 234, avgDurationMs: 12400 },
      "xss": { category: "xss", successRate: 91, sampleCount: 312, avgDurationMs: 9800 },
      "auth-bypass": { category: "auth-bypass", successRate: 88, sampleCount: 156, avgDurationMs: 15200 },
      "priv-escalation": { category: "priv-escalation", successRate: 72, sampleCount: 98, avgDurationMs: 18900 },
      "info-disclosure": { category: "info-disclosure", successRate: 96, sampleCount: 445, avgDurationMs: 6200 },
      "csrf": { category: "csrf", successRate: 89, sampleCount: 201, avgDurationMs: 8400 },
      "ssrf": { category: "ssrf", successRate: 85, sampleCount: 134, avgDurationMs: 11200 },
      "rce": { category: "rce", successRate: 78, sampleCount: 67, avgDurationMs: 22100 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 65, sampleCount: 42, avgDurationMs: 19800 },
      "dos": { category: "dos", successRate: 83, sampleCount: 153, avgDurationMs: 10100 },
    },
  },
  {
    agentId: "pentest-alpha",
    agentName: "PentestAlpha",
    model: "claude-opus-4",
    totalRuns: 2156,
    avgSuccessRate: 91.2,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 98, sampleCount: 312, avgDurationMs: 14200 },
      "xss": { category: "xss", successRate: 95, sampleCount: 445, avgDurationMs: 10100 },
      "auth-bypass": { category: "auth-bypass", successRate: 94, sampleCount: 234, avgDurationMs: 17800 },
      "priv-escalation": { category: "priv-escalation", successRate: 89, sampleCount: 167, avgDurationMs: 21200 },
      "info-disclosure": { category: "info-disclosure", successRate: 93, sampleCount: 534, avgDurationMs: 7800 },
      "csrf": { category: "csrf", successRate: 91, sampleCount: 298, avgDurationMs: 9200 },
      "ssrf": { category: "ssrf", successRate: 92, sampleCount: 201, avgDurationMs: 13400 },
      "rce": { category: "rce", successRate: 96, sampleCount: 145, avgDurationMs: 24600 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 88, sampleCount: 89, avgDurationMs: 22100 },
      "dos": { category: "dos", successRate: 87, sampleCount: 231, avgDurationMs: 11800 },
    },
  },
  {
    agentId: "vuln-scanner",
    agentName: "VulnScanner-X",
    model: "claude-sonnet-4",
    totalRuns: 3421,
    avgSuccessRate: 76.8,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 82, sampleCount: 567, avgDurationMs: 8900 },
      "xss": { category: "xss", successRate: 79, sampleCount: 712, avgDurationMs: 7400 },
      "auth-bypass": { category: "auth-bypass", successRate: 68, sampleCount: 234, avgDurationMs: 12400 },
      "priv-escalation": { category: "priv-escalation", successRate: 61, sampleCount: 189, avgDurationMs: 14200 },
      "info-disclosure": { category: "info-disclosure", successRate: 92, sampleCount: 876, avgDurationMs: 4800 },
      "csrf": { category: "csrf", successRate: 75, sampleCount: 412, avgDurationMs: 6200 },
      "ssrf": { category: "ssrf", successRate: 71, sampleCount: 267, avgDurationMs: 9800 },
      "rce": { category: "rce", successRate: 54, sampleCount: 123, avgDurationMs: 16400 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 48, sampleCount: 98, avgDurationMs: 13200 },
      "dos": { category: "dos", successRate: 67, sampleCount: 343, avgDurationMs: 8100 },
    },
  },
  {
    agentId: "zero-day",
    agentName: "ZeroDayHunter",
    model: "claude-opus-4",
    totalRuns: 987,
    avgSuccessRate: 94.5,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 97, sampleCount: 89, avgDurationMs: 18900 },
      "xss": { category: "xss", successRate: 92, sampleCount: 134, avgDurationMs: 14200 },
      "auth-bypass": { category: "auth-bypass", successRate: 96, sampleCount: 67, avgDurationMs: 24800 },
      "priv-escalation": { category: "priv-escalation", successRate: 95, sampleCount: 45, avgDurationMs: 28400 },
      "info-disclosure": { category: "info-disclosure", successRate: 88, sampleCount: 178, avgDurationMs: 11200 },
      "csrf": { category: "csrf", successRate: 84, sampleCount: 98, avgDurationMs: 13400 },
      "ssrf": { category: "ssrf", successRate: 93, sampleCount: 76, avgDurationMs: 17200 },
      "rce": { category: "rce", successRate: 99, sampleCount: 89, avgDurationMs: 31200 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 94, sampleCount: 56, avgDurationMs: 26400 },
      "dos": { category: "dos", successRate: 91, sampleCount: 155, avgDurationMs: 15800 },
    },
  },
  {
    agentId: "api-prober",
    agentName: "APIProber",
    model: "claude-sonnet-4",
    totalRuns: 1567,
    avgSuccessRate: 82.1,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 86, sampleCount: 178, avgDurationMs: 10200 },
      "xss": { category: "xss", successRate: 72, sampleCount: 201, avgDurationMs: 8400 },
      "auth-bypass": { category: "auth-bypass", successRate: 91, sampleCount: 234, avgDurationMs: 11200 },
      "priv-escalation": { category: "priv-escalation", successRate: 78, sampleCount: 112, avgDurationMs: 16400 },
      "info-disclosure": { category: "info-disclosure", successRate: 89, sampleCount: 289, avgDurationMs: 6800 },
      "csrf": { category: "csrf", successRate: 94, sampleCount: 267, avgDurationMs: 5600 },
      "ssrf": { category: "ssrf", successRate: 88, sampleCount: 145, avgDurationMs: 9800 },
      "rce": { category: "rce", successRate: 62, sampleCount: 78, avgDurationMs: 18200 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 71, sampleCount: 67, avgDurationMs: 14800 },
      "dos": { category: "dos", successRate: 89, sampleCount: 196, avgDurationMs: 7800 },
    },
  },
  {
    agentId: "cloud-patrol",
    agentName: "CloudPatrol",
    model: "claude-sonnet-4",
    totalRuns: 1234,
    avgSuccessRate: 79.4,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 74, sampleCount: 134, avgDurationMs: 11800 },
      "xss": { category: "xss", successRate: 68, sampleCount: 178, avgDurationMs: 9200 },
      "auth-bypass": { category: "auth-bypass", successRate: 82, sampleCount: 156, avgDurationMs: 14200 },
      "priv-escalation": { category: "priv-escalation", successRate: 86, sampleCount: 201, avgDurationMs: 12800 },
      "info-disclosure": { category: "info-disclosure", successRate: 91, sampleCount: 312, avgDurationMs: 7400 },
      "csrf": { category: "csrf", successRate: 78, sampleCount: 145, avgDurationMs: 9600 },
      "ssrf": { category: "ssrf", successRate: 94, sampleCount: 234, avgDurationMs: 8600 },
      "rce": { category: "rce", successRate: 58, sampleCount: 67, avgDurationMs: 19600 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 82, sampleCount: 112, avgDurationMs: 12100 },
      "dos": { category: "dos", successRate: 81, sampleCount: 145, avgDurationMs: 9400 },
    },
  },
  {
    agentId: "fuzzer-pro",
    agentName: "FuzzerPro",
    model: "claude-opus-4",
    totalRuns: 2876,
    avgSuccessRate: 71.3,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 78, sampleCount: 445, avgDurationMs: 16800 },
      "xss": { category: "xss", successRate: 82, sampleCount: 567, avgDurationMs: 12400 },
      "auth-bypass": { category: "auth-bypass", successRate: 65, sampleCount: 234, avgDurationMs: 21200 },
      "priv-escalation": { category: "priv-escalation", successRate: 58, sampleCount: 178, avgDurationMs: 24800 },
      "info-disclosure": { category: "info-disclosure", successRate: 74, sampleCount: 389, avgDurationMs: 11200 },
      "csrf": { category: "csrf", successRate: 69, sampleCount: 312, avgDurationMs: 13400 },
      "ssrf": { category: "ssrf", successRate: 72, sampleCount: 201, avgDurationMs: 15800 },
      "rce": { category: "rce", successRate: 62, sampleCount: 134, avgDurationMs: 28400 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 54, sampleCount: 89, avgDurationMs: 22100 },
      "dos": { category: "dos", successRate: 97, sampleCount: 527, avgDurationMs: 6200 },
    },
  },
  {
    agentId: "logic-hunter",
    agentName: "LogicHunter",
    model: "claude-sonnet-4",
    totalRuns: 1089,
    avgSuccessRate: 85.6,
    skills: {
      "sql-injection": { category: "sql-injection", successRate: 71, sampleCount: 89, avgDurationMs: 14200 },
      "xss": { category: "xss", successRate: 68, sampleCount: 112, avgDurationMs: 11800 },
      "auth-bypass": { category: "auth-bypass", successRate: 94, sampleCount: 178, avgDurationMs: 9800 },
      "priv-escalation": { category: "priv-escalation", successRate: 92, sampleCount: 145, avgDurationMs: 11400 },
      "info-disclosure": { category: "info-disclosure", successRate: 87, sampleCount: 201, avgDurationMs: 8200 },
      "csrf": { category: "csrf", successRate: 91, sampleCount: 167, avgDurationMs: 7600 },
      "ssrf": { category: "ssrf", successRate: 78, sampleCount: 98, avgDurationMs: 13400 },
      "rce": { category: "rce", successRate: 72, sampleCount: 56, avgDurationMs: 18400 },
      "crypto-flaw": { category: "crypto-flaw", successRate: 84, sampleCount: 112, avgDurationMs: 10800 },
      "dos": { category: "dos", successRate: 89, sampleCount: 131, avgDurationMs: 9600 },
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getCellColor(successRate: number | null): string {
  if (successRate === null) return "bg-[var(--color-surface-3)]";
  
  if (successRate >= 90) return "bg-emerald-500";
  if (successRate >= 80) return "bg-emerald-600";
  if (successRate >= 70) return "bg-emerald-700";
  if (successRate >= 60) return "bg-yellow-600";
  if (successRate >= 50) return "bg-orange-600";
  if (successRate >= 40) return "bg-orange-700";
  return "bg-red-700";
}

function getCellTextColor(successRate: number | null): string {
  if (successRate === null) return "text-[var(--color-text-muted)]";
  if (successRate >= 70) return "text-[var(--color-text-primary)]";
  return "text-[var(--color-text-primary)]";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getModelBadgeColor(model: string): string {
  if (model.includes("opus")) return "bg-purple-600/30 text-purple-300 border-purple-500/50";
  if (model.includes("sonnet")) return "bg-blue-600/30 text-blue-300 border-blue-500/50";
  if (model.includes("haiku")) return "bg-green-600/30 text-green-300 border-green-500/50";
  return "bg-[var(--color-surface-3)]/30 text-[var(--color-text-primary)] border-[var(--color-surface-3)]/50";
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-yellow-400";
    case "low": return "text-green-400";
    default: return "text-[var(--color-text-secondary)]";
  }
}

// ============================================================================
// Components
// ============================================================================

interface ModelBadgeProps {
  model: string;
}

function ModelBadge({ model }: ModelBadgeProps) {
  const shortModel = model.replace("claude-", "");
  return (
    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded border ${getModelBadgeColor(model)}`}>
      {shortModel}
    </span>
  );
}

interface TooltipProps {
  data: TooltipData | null;
}

function Tooltip({ data }: TooltipProps) {
  if (!data) return null;

  return (
    <div
      className="fixed z-50 bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] rounded-lg shadow-xl p-3 pointer-events-none"
      style={{
        left: data.x + 12,
        top: data.y + 12,
      }}
    >
      <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{data.agentName}</div>
      <div className="text-xs text-[var(--color-text-secondary)] mb-2">{data.category}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-[var(--color-text-muted)]">Success Rate:</span>
        <span className={`font-medium ${data.successRate >= 70 ? "text-emerald-400" : data.successRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
          {data.successRate}%
        </span>
        <span className="text-[var(--color-text-muted)]">Samples:</span>
        <span className="text-[var(--color-text-primary)]">{data.sampleCount}</span>
        <span className="text-[var(--color-text-muted)]">Avg Duration:</span>
        <span className="text-[var(--color-text-primary)]">{formatDuration(data.avgDuration)}</span>
      </div>
    </div>
  );
}

interface HeatmapCellProps {
  successRate: number | null;
  sampleCount: number;
  agentName: string;
  categoryName: string;
  avgDuration: number;
  onHover: (data: TooltipData | null) => void;
  filterThreshold: number;
}

function HeatmapCell({
  successRate,
  sampleCount,
  agentName,
  categoryName,
  avgDuration,
  onHover,
  filterThreshold,
}: HeatmapCellProps) {
  const isFiltered = sampleCount < filterThreshold;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (isFiltered || successRate === null) return;
      onHover({
        agentName,
        category: categoryName,
        successRate,
        sampleCount,
        avgDuration,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [agentName, categoryName, successRate, sampleCount, avgDuration, onHover, isFiltered]
  );

  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  if (isFiltered) {
    return (
      <div
        className="w-14 h-10 bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]"
        title={`Filtered (< ${filterThreshold} samples)`}
      >
        <X className="w-3 h-3" />
      </div>
    );
  }

  if (successRate === null) {
    return (
      <div className="w-14 h-10 bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] flex items-center justify-center text-[var(--color-text-muted)]">
        —
      </div>
    );
  }

  return (
    <div
      className={`w-14 h-10 ${getCellColor(successRate)} ${getCellTextColor(
        successRate
      )} border border-[var(--color-surface-3)] flex items-center justify-center text-xs font-medium cursor-pointer
        hover:ring-2 hover:ring-white/30 hover:z-10 transition-all`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {successRate}%
    </div>
  );
}

interface TopPerformerCardProps {
  category: string;
  agentName: string;
  successRate: number;
  model: string;
}

function TopPerformerCard({ category, agentName, successRate, model }: TopPerformerCardProps) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-[var(--color-border)] rounded-lg p-3 flex items-start gap-2">
      <Trophy className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--color-text-secondary)] mb-0.5">Best agent for {category}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{agentName}</span>
          <ModelBadge model={model} />
          <span className={`text-sm font-bold ${successRate >= 90 ? "text-emerald-400" : "text-yellow-400"}`}>
            {successRate}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AgentSkillHeatmap() {
  const { toast } = useToast();
  const [rowSortMode, setRowSortMode] = useState<RowSortMode>("average");
  const [columnSortMode, setColumnSortMode] = useState<ColumnSortMode>("findings");
  const [filterThreshold, setFilterThreshold] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Calculate top performers for each category
  const topPerformers = useMemo(() => {
    const performers: TopPerformerCardProps[] = [];
    
    MOCK_CATEGORIES.forEach((category) => {
      let best: { agent: AgentSkillData; rate: number } | null = null;
      
      MOCK_AGENTS.forEach((agent) => {
        const skill = agent.skills[category.id];
        if (skill && skill.sampleCount >= filterThreshold) {
          if (!best || skill.successRate > best.rate) {
            best = { agent, rate: skill.successRate };
          }
        }
      });
      
      const resolvedBest = best as { agent: AgentSkillData; rate: number } | null;
      if (resolvedBest) {
        performers.push({
          category: category.name,
          agentName: resolvedBest.agent.agentName,
          successRate: resolvedBest.rate,
          model: resolvedBest.agent.model,
        });
      }
    });
    
    // Return top 5 most impressive
    return performers
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);
  }, [filterThreshold]);

  // Sort agents (rows)
  const sortedAgents = useMemo(() => {
    const sorted = [...MOCK_AGENTS];
    
    switch (rowSortMode) {
      case "average":
        return sorted.sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);
      case "alphabetical":
        return sorted.sort((a, b) => a.agentName.localeCompare(b.agentName));
      case "runs":
        return sorted.sort((a, b) => b.totalRuns - a.totalRuns);
      default:
        return sorted;
    }
  }, [rowSortMode]);

  // Sort categories (columns)
  const sortedCategories = useMemo(() => {
    const sorted = [...MOCK_CATEGORIES];
    
    switch (columnSortMode) {
      case "findings":
        return sorted.sort((a, b) => b.totalFindings - a.totalFindings);
      case "alphabetical":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return sorted;
    }
  }, [columnSortMode]);

  // Calculate column averages
  const columnAverages = useMemo(() => {
    const averages: Record<string, number> = {};
    
    sortedCategories.forEach((category) => {
      let total = 0;
      let count = 0;
      
      sortedAgents.forEach((agent) => {
        const skill = agent.skills[category.id];
        if (skill && skill.sampleCount >= filterThreshold) {
          total += skill.successRate;
          count++;
        }
      });
      
      averages[category.id] = count > 0 ? Math.round(total / count) : 0;
    });
    
    return averages;
  }, [sortedCategories, sortedAgents, filterThreshold]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalRuns = MOCK_AGENTS.reduce((sum, a) => sum + a.totalRuns, 0);
    const avgSuccess = MOCK_AGENTS.reduce((sum, a) => sum + a.avgSuccessRate, 0) / MOCK_AGENTS.length;
    
    return {
      totalAgents: MOCK_AGENTS.length,
      totalCategories: MOCK_CATEGORIES.length,
      totalRuns,
      avgSuccess: avgSuccess.toFixed(1),
    };
  }, []);

  const handleExportCSV = useCallback(() => {
    // Placeholder: would generate CSV in production
    toast({ message: "CSV export is coming soon.", type: "info" });
  }, [toast]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-1)] p-6">
      {/* Header */}
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Grid3X3 className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Agent Skill Heatmap</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Performance matrix by agent and finding category</p>
              </div>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] rounded-lg text-[var(--color-text-primary)] text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Agents</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{overallStats.totalAgents}</div>
            </div>
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Categories</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{overallStats.totalCategories}</div>
            </div>
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Total Runs</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{overallStats.totalRuns.toLocaleString()}</div>
            </div>
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Avg Success</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{overallStats.avgSuccess}%</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              {/* Row Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Sort Rows:</span>
                <div className="flex gap-1">
                  {[
                    { mode: "average" as RowSortMode, label: "Avg Success", icon: TrendingUp },
                    { mode: "alphabetical" as RowSortMode, label: "A-Z", icon: ArrowUpDown },
                    { mode: "runs" as RowSortMode, label: "Most Runs", icon: BarChart3 },
                  ].map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setRowSortMode(mode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        rowSortMode === mode
                          ? "bg-blue-600/20 text-blue-300 border border-blue-500/50"
                          : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border border-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)]"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Sort Columns:</span>
                <div className="flex gap-1">
                  {[
                    { mode: "findings" as ColumnSortMode, label: "Most Findings", icon: Target },
                    { mode: "alphabetical" as ColumnSortMode, label: "A-Z", icon: ArrowUpDown },
                  ].map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setColumnSortMode(mode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        columnSortMode === mode
                          ? "bg-purple-600/20 text-purple-300 border border-purple-500/50"
                          : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border border-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)]"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                showFilters
                  ? "bg-orange-600/20 text-orange-300 border border-orange-500/50"
                  : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border border-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)]"
              }`}
            >
              <Filter className="w-3 h-3" />
              Filters
              {filterThreshold > 0 && (
                <span className="bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded text-xs">{filterThreshold}</span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Min samples to display:</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={filterThreshold}
                  onChange={(e) => setFilterThreshold(parseInt(e.target.value))}
                  className="w-48 h-2 bg-[var(--color-surface-3)] rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)] w-16">{filterThreshold}+</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                Cells with fewer than {filterThreshold} samples will be filtered out to ensure statistical significance.
              </p>
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Top Performers by Category
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {topPerformers.map((performer, i) => (
              <TopPerformerCard key={i} {...performer} />
            ))}
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] z-20"></th>
                  {sortedCategories.map((category) => (
                    <th
                      key={category.id}
                      className="px-1 py-2 border-r border-[var(--color-border)] last:border-r-0"
                    >
                      <div className="w-14 flex flex-col items-center">
                        <span className="text-xs text-[var(--color-text-primary)] text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
                          {category.name}
                        </span>
                        <span className={`text-xs ${getSeverityColor(category.severity)}`}>
                          {category.totalFindings}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 bg-[var(--color-surface-3)]/50 border-l border-[var(--color-surface-3)]">
                    <div className="w-16 text-center">
                      <span className="text-xs text-[var(--color-text-secondary)]">Avg</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent) => (
                  <tr key={agent.agentId}>
                    <td className="sticky left-0 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] z-10 px-3 py-1">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{agent.agentName}</span>
                        <ModelBadge model={agent.model} />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {agent.totalRuns.toLocaleString()} runs
                      </div>
                    </td>
                    {sortedCategories.map((category) => {
                      const skill = agent.skills[category.id];
                      return (
                        <td key={category.id} className="p-0 border-r border-[var(--color-border)] last:border-r-0">
                          <HeatmapCell
                            successRate={skill?.successRate ?? null}
                            sampleCount={skill?.sampleCount ?? 0}
                            agentName={agent.agentName}
                            categoryName={category.name}
                            avgDuration={skill?.avgDurationMs ?? 0}
                            onHover={setTooltip}
                            filterThreshold={filterThreshold}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 bg-[var(--color-surface-3)]/30 border-l border-[var(--color-surface-3)]">
                      <div className="w-16 flex items-center justify-center">
                        <span
                          className={`text-sm font-bold ${
                            agent.avgSuccessRate >= 80
                              ? "text-emerald-400"
                              : agent.avgSuccessRate >= 60
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {agent.avgSuccessRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Summary Row */}
                <tr className="bg-[var(--color-surface-3)]/50">
                  <td className="sticky left-0 bg-[var(--color-surface-3)]/50 border-r border-[var(--color-surface-3)] px-3 py-2 z-10">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Column Average</span>
                    </div>
                  </td>
                  {sortedCategories.map((category) => (
                    <td
                      key={category.id}
                      className="p-0 border-r border-[var(--color-surface-3)] last:border-r-0"
                    >
                      <div
                        className={`w-14 h-10 ${getCellColor(
                          columnAverages[category.id]
                        )} border border-[var(--color-surface-3)] flex items-center justify-center text-xs font-medium ${getCellTextColor(
                          columnAverages[category.id]
                        )}`}
                      >
                        {columnAverages[category.id]}%
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-1 bg-[var(--color-surface-3)]/30 border-l border-[var(--color-surface-3)]">
                    <div className="w-16 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-400">
                        {overallStats.avgSuccess}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">Legend</h3>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-emerald-500 rounded"></div>
              <span className="text-xs text-[var(--color-text-secondary)]">90-100% (Excellent)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-emerald-600 rounded"></div>
              <span className="text-xs text-[var(--color-text-secondary)]">80-89% (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-emerald-700 rounded"></div>
              <span className="text-xs text-[var(--color-text-secondary)]">70-79% (Fair)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-yellow-600 rounded"></div>
              <span className="text-xs text-[var(--color-text-secondary)]">60-69% (Below Avg)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-orange-600 rounded"></div>
              <span className="text-xs text-[var(--color-text-secondary)]">50-59% (Poor)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-red-700 rounded"></div>
              <span className="text-xs text-[var(--color-text-secondary)]">&lt;50% (Critical)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] rounded flex items-center justify-center">
                <span className="text-[var(--color-text-muted)] text-xs">—</span>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">No Data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded flex items-center justify-center">
                <X className="w-3 h-3 text-[var(--color-text-muted)]" />
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">Filtered</span>
            </div>
          </div>
        </div>

        {/* Model Legend */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">Model Types</h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded border bg-purple-600/30 text-purple-300 border-purple-500/50">
                opus-4
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">Highest capability, complex tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded border bg-blue-600/30 text-blue-300 border-blue-500/50">
                sonnet-4
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">Balanced performance, general tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded border bg-green-600/30 text-green-300 border-green-500/50">
                haiku
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">Fast, lightweight operations</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
          <p>Data updated in real-time • Hover over cells for detailed metrics</p>
        </div>
      </div>

      {/* Tooltip */}
      <Tooltip data={tooltip} />
    </div>
  );
}
