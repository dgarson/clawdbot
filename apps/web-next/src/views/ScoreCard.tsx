import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreGrade = "A+" | "A" | "B+" | "B" | "C" | "D" | "F";
type TrendDir = "up" | "down" | "flat";
type PillarId = "quality" | "velocity" | "reliability" | "security" | "efficiency" | "collaboration";

interface ScoreMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  weight: number;
  trend: TrendDir;
  trendDelta: number;
  description: string;
  history: number[]; // last 8 weeks
}

interface ScorePillar {
  id: PillarId;
  name: string;
  emoji: string;
  score: number; // 0-100
  grade: ScoreGrade;
  trend: TrendDir;
  trendDelta: number;
  metrics: ScoreMetric[];
  recommendation: string;
}

interface AgentScore {
  agent: string;
  emoji: string;
  squad: string;
  overallScore: number;
  grade: ScoreGrade;
  pillars: Record<PillarId, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 97) {return "A+";}
  if (score >= 93) {return "A";}
  if (score >= 88) {return "B+";}
  if (score >= 80) {return "B";}
  if (score >= 70) {return "C";}
  if (score >= 60) {return "D";}
  return "F";
}

function gradeColor(grade: ScoreGrade): string {
  const map: Record<ScoreGrade, string> = {
    "A+": "text-emerald-400", "A": "text-emerald-400",
    "B+": "text-blue-400", "B": "text-blue-400",
    "C": "text-amber-400", "D": "text-orange-400", "F": "text-rose-400",
  };
  return map[grade];
}

function gradeBg(grade: ScoreGrade): string {
  const map: Record<ScoreGrade, string> = {
    "A+": "bg-emerald-900/30 border-emerald-700/50", "A": "bg-emerald-900/30 border-emerald-700/50",
    "B+": "bg-blue-900/30 border-blue-700/50", "B": "bg-blue-900/30 border-blue-700/50",
    "C": "bg-amber-900/30 border-amber-700/50", "D": "bg-orange-900/30 border-orange-700/50", "F": "bg-rose-900/30 border-rose-700/50",
  };
  return map[grade];
}

function scoreBarColor(score: number): string {
  if (score >= 90) {return "bg-emerald-500";}
  if (score >= 75) {return "bg-blue-500";}
  if (score >= 60) {return "bg-amber-500";}
  return "bg-rose-500";
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const PILLARS: ScorePillar[] = [
  {
    id: "quality",
    name: "Quality",
    emoji: "✨",
    score: 88,
    grade: "B+",
    trend: "up",
    trendDelta: 3.2,
    recommendation: "Increase test coverage to 85%+ and reduce TypeScript 'any' usage to <0.5%",
    metrics: [
      { id: "test-coverage", name: "Test Coverage", value: 74, target: 85, unit: "%", weight: 30, trend: "up", trendDelta: 2, description: "% of code covered by automated tests", history: [68, 69, 70, 71, 72, 72, 73, 74] },
      { id: "ts-strict", name: "TS Strictness", value: 96, target: 100, unit: "%", weight: 25, trend: "up", trendDelta: 1, description: "% of files with no 'any' types", history: [90, 91, 93, 94, 95, 95, 96, 96] },
      { id: "lint-pass", name: "Lint Pass Rate", value: 99.2, target: 100, unit: "%", weight: 20, trend: "flat", trendDelta: 0, description: "% of commits passing lint checks", history: [99, 99, 99.1, 99.2, 99.2, 99.2, 99.2, 99.2] },
      { id: "pr-review", name: "PR Review Rate", value: 94, target: 100, unit: "%", weight: 25, trend: "up", trendDelta: 4, description: "% of PRs with at least one review", history: [80, 83, 86, 88, 90, 91, 93, 94] },
    ],
  },
  {
    id: "velocity",
    name: "Velocity",
    emoji: "🚀",
    score: 92,
    grade: "A",
    trend: "up",
    trendDelta: 8.1,
    recommendation: "Maintain current sprint pace. Consider breaking down tasks >16h to prevent blocking.",
    metrics: [
      { id: "views-per-sprint", name: "Views / Sprint", value: 89, target: 60, unit: "", weight: 40, trend: "up", trendDelta: 12, description: "UI views built in current sprint", history: [12, 18, 24, 32, 41, 56, 74, 89] },
      { id: "cycle-time", name: "Cycle Time", value: 4.2, target: 6, unit: "h", weight: 30, trend: "down", trendDelta: 1.4, description: "Avg hours from start to merge", history: [8.1, 7.2, 6.8, 6.4, 5.8, 5.2, 4.8, 4.2] },
      { id: "deploy-freq", name: "Deploy Freq", value: 12, target: 10, unit: "/day", weight: 30, trend: "up", trendDelta: 3, description: "Deployments per day", history: [6, 7, 8, 8, 9, 10, 11, 12] },
    ],
  },
  {
    id: "reliability",
    name: "Reliability",
    emoji: "🛡️",
    score: 96,
    grade: "A",
    trend: "up",
    trendDelta: 1.4,
    recommendation: "Excellent uptime. Focus on MTTR reduction — target <5min for P1 incidents.",
    metrics: [
      { id: "uptime", name: "Uptime", value: 99.91, target: 99.9, unit: "%", weight: 40, trend: "flat", trendDelta: 0, description: "System availability", history: [99.8, 99.85, 99.87, 99.89, 99.9, 99.91, 99.91, 99.91] },
      { id: "error-rate", name: "Error Rate", value: 1.4, target: 1, unit: "%", weight: 30, trend: "down", trendDelta: 0.7, description: "% of requests resulting in error", history: [3.2, 2.8, 2.4, 2.1, 1.9, 1.7, 1.5, 1.4] },
      { id: "mttr", name: "MTTR", value: 8.2, target: 5, unit: "min", weight: 30, trend: "down", trendDelta: 2.4, description: "Mean time to recover from incidents", history: [18, 16, 14, 12, 11, 10, 9, 8.2] },
    ],
  },
  {
    id: "security",
    name: "Security",
    emoji: "🔒",
    score: 97,
    grade: "A+",
    trend: "flat",
    trendDelta: 0,
    recommendation: "Outstanding security posture. Schedule quarterly penetration test.",
    metrics: [
      { id: "vuln-open", name: "Open Vulns", value: 0, target: 0, unit: "", weight: 50, trend: "flat", trendDelta: 0, description: "Critical/High vulnerabilities open", history: [2, 2, 1, 1, 0, 0, 0, 0] },
      { id: "secret-scan", name: "Secret Scan", value: 100, target: 100, unit: "%", weight: 30, trend: "flat", trendDelta: 0, description: "% of commits scanned for secrets", history: [100, 100, 100, 100, 100, 100, 100, 100] },
      { id: "audit-trail", name: "Audit Trail", value: 100, target: 100, unit: "%", weight: 20, trend: "flat", trendDelta: 0, description: "% of actions captured in audit log", history: [98, 99, 99, 100, 100, 100, 100, 100] },
    ],
  },
  {
    id: "efficiency",
    name: "Efficiency",
    emoji: "⚡",
    score: 81,
    grade: "B",
    trend: "up",
    trendDelta: 5.2,
    recommendation: "Token costs trending up 15% MoM. Implement context pruning and model tiering.",
    metrics: [
      { id: "cost-per-task", name: "Cost / Task", value: 0.042, target: 0.03, unit: "$", weight: 40, trend: "up", trendDelta: 0.008, description: "Avg LLM cost per completed task", history: [0.028, 0.029, 0.031, 0.033, 0.036, 0.038, 0.040, 0.042] },
      { id: "token-eff", name: "Token Efficiency", value: 78, target: 90, unit: "%", weight: 35, trend: "up", trendDelta: 4, description: "% of tokens that contribute to output", history: [65, 67, 70, 72, 74, 75, 77, 78] },
      { id: "cache-hit", name: "Cache Hit Rate", value: 42, target: 60, unit: "%", weight: 25, trend: "up", trendDelta: 8, description: "% of requests served from cache", history: [20, 24, 28, 32, 35, 38, 40, 42] },
    ],
  },
  {
    id: "collaboration",
    name: "Collaboration",
    emoji: "🤝",
    score: 89,
    grade: "B+",
    trend: "up",
    trendDelta: 4.0,
    recommendation: "PR review turnaround is excellent. Improve cross-squad documentation sharing.",
    metrics: [
      { id: "pr-turnaround", name: "PR Turnaround", value: 2.1, target: 4, unit: "h", weight: 35, trend: "down", trendDelta: 0.8, description: "Avg hours to first review", history: [6, 5.2, 4.8, 4.2, 3.8, 3.2, 2.6, 2.1] },
      { id: "doc-coverage", name: "Doc Coverage", value: 68, target: 80, unit: "%", weight: 30, trend: "up", trendDelta: 5, description: "% of APIs and flows documented", history: [55, 57, 60, 62, 64, 65, 67, 68] },
      { id: "cross-squad", name: "Cross-Squad PRs", value: 14, target: 20, unit: "/mo", weight: 35, trend: "up", trendDelta: 3, description: "PRs reviewed across squad boundaries", history: [6, 7, 8, 9, 10, 11, 13, 14] },
    ],
  },
];

const AGENT_SCORES: AgentScore[] = [
  { agent: "Luis", emoji: "🎨", squad: "Product & UI", overallScore: 94, grade: "A", pillars: { quality: 88, velocity: 98, reliability: 96, security: 97, efficiency: 80, collaboration: 91 } },
  { agent: "Xavier", emoji: "⚡", squad: "Leadership", overallScore: 92, grade: "A", pillars: { quality: 94, velocity: 88, reliability: 97, security: 99, efficiency: 86, collaboration: 90 } },
  { agent: "Roman", emoji: "⚙️", squad: "Platform Core", overallScore: 89, grade: "B+", pillars: { quality: 92, velocity: 84, reliability: 94, security: 98, efficiency: 82, collaboration: 84 } },
  { agent: "Claire", emoji: "🌟", squad: "Feature Dev", overallScore: 86, grade: "B+", pillars: { quality: 90, velocity: 82, reliability: 88, security: 92, efficiency: 78, collaboration: 86 } },
  { agent: "Tim", emoji: "🏗️", squad: "Platform Core", overallScore: 91, grade: "A", pillars: { quality: 95, velocity: 86, reliability: 96, security: 98, efficiency: 84, collaboration: 88 } },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoreCard() {
  const [selectedPillar, setSelectedPillar] = useState<ScorePillar>(PILLARS[0]);
  const [view, setView] = useState<"pillars" | "agents">("pillars");

  const overallScore = Math.round(PILLARS.reduce((s, p) => s + p.score, 0) / PILLARS.length);
  const overallGrade = scoreToGrade(overallScore);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Scorecard</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">Engineering health across 6 dimensions</p>
            </div>
            {/* Overall score */}
            <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border", gradeBg(overallGrade))}>
              <div className={cn("text-4xl font-black", gradeColor(overallGrade))}>{overallGrade}</div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">Overall</div>
                <div className="text-xl font-bold text-[var(--color-text-primary)]">{overallScore}/100</div>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {(["pillars", "agents"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded text-sm capitalize",
                  view === v ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {v === "pillars" ? "By Pillar" : "By Agent"}
              </button>
            ))}
          </div>
        </div>

        {/* Pillar overview */}
        <div className="grid grid-cols-6 gap-2">
          {PILLARS.map((pillar) => {
            const isSelected = selectedPillar.id === pillar.id;
            const trendColor = pillar.trend === "up" ? "text-emerald-400" : pillar.trend === "down" ? "text-rose-400" : "text-[var(--color-text-muted)]";
            const trendArrow = pillar.trend === "up" ? "↑" : pillar.trend === "down" ? "↓" : "→";
            return (
              <button
                key={pillar.id}
                onClick={() => setSelectedPillar(pillar)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all",
                  isSelected ? gradeBg(pillar.grade) + " ring-1 ring-indigo-400/30" : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                )}
              >
                <div className="text-lg mb-1">{pillar.emoji}</div>
                <div className={cn("text-2xl font-black", gradeColor(pillar.grade))}>{pillar.grade}</div>
                <div className="text-xs text-[var(--color-text-secondary)] font-medium">{pillar.name}</div>
                <div className={cn("text-xs mt-1", trendColor)}>
                  {trendArrow} {pillar.trendDelta > 0 ? `+${pillar.trendDelta}` : pillar.trendDelta}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {view === "pillars" && (
          <>
            {/* Pillar detail */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{selectedPillar.emoji} {selectedPillar.name}</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{selectedPillar.recommendation}</p>
                </div>
                <div className={cn("px-4 py-2 rounded-xl border", gradeBg(selectedPillar.grade))}>
                  <span className={cn("text-3xl font-black", gradeColor(selectedPillar.grade))}>{selectedPillar.grade}</span>
                  <span className="text-[var(--color-text-secondary)] text-sm ml-2">{selectedPillar.score}/100</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-4">
                {selectedPillar.metrics.map((metric) => {
                  const atTarget = metric.unit === "%" ? metric.value >= metric.target :
                    metric.unit === "h" || metric.unit === "min" || metric.unit === "$" ? metric.value <= metric.target :
                    metric.value >= metric.target;
                  const pct = metric.unit === "%" ? metric.value :
                    metric.unit === "h" || metric.unit === "min" || metric.unit === "$" ? Math.min((metric.target / metric.value) * 100, 100) :
                    Math.min((metric.value / metric.target) * 100, 100);
                  const barColor = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
                  const trendColor = metric.trend === "up" ? "text-emerald-400" : metric.trend === "down" ? "text-rose-400" : "text-[var(--color-text-muted)]";
                  const maxHistory = Math.max(...metric.history);

                  return (
                    <div key={metric.id} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{metric.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{metric.description}</div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-xl font-bold", atTarget ? "text-emerald-400" : "text-amber-400")}>
                            {metric.value}{metric.unit}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">Target: {metric.target}{metric.unit}</div>
                        </div>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden mb-3">
                        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      {/* Mini trend sparkline */}
                      <div className="flex items-end gap-0.5 h-8">
                        {metric.history.map((v, i) => {
                          const h = maxHistory > 0 ? (v / maxHistory) * 100 : 0;
                          const isLast = i === metric.history.length - 1;
                          return (
                            <div
                              key={i}
                              className={cn("flex-1 rounded-sm", isLast ? barColor : "bg-[var(--color-surface-3)]")}
                              style={{ height: `${h}%`, minHeight: 1 }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[var(--color-text-muted)]">8 weeks ago</span>
                        <span className={cn("text-xs", trendColor)}>
                          {metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→"} {Math.abs(metric.trendDelta)}{metric.unit} this period
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">Now</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {view === "agents" && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-3">
              {AGENT_SCORES.toSorted((a, b) => b.overallScore - a.overallScore).map((agent) => (
                <div key={agent.agent} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-2xl">{agent.emoji}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--color-text-primary)]">{agent.agent}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{agent.squad}</div>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border", gradeBg(agent.grade))}>
                      <span className={cn("text-2xl font-black", gradeColor(agent.grade))}>{agent.grade}</span>
                      <span className="text-[var(--color-text-primary)] font-bold">{agent.overallScore}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {PILLARS.map((pillar) => {
                      const score = agent.pillars[pillar.id];
                      return (
                        <div key={pillar.id} className="text-center">
                          <div className="text-sm mb-0.5">{pillar.emoji}</div>
                          <div className={cn("text-sm font-bold", score >= 90 ? "text-emerald-400" : score >= 75 ? "text-blue-400" : score >= 60 ? "text-amber-400" : "text-rose-400")}>{score}</div>
                          <div className="h-1 bg-[var(--color-surface-2)] rounded-full mt-0.5">
                            <div className={cn("h-full rounded-full", scoreBarColor(score))} style={{ width: `${score}%` }} />
                          </div>
                          <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{pillar.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
