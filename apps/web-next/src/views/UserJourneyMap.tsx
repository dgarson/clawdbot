import React, { useState } from "react"
import { cn } from "../lib/utils"

interface StepDetail {
  actions: string[]
  painPoints: string[]
  suggestions: string[]
}

interface Step {
  id: string
  name: string
  description: string
  avgTime: string
  dropOffRate: number
  satisfaction: number
  trafficWeight: number
  detail: StepDetail
}

interface Journey {
  id: string
  name: string
  completionRate: number
  avgTotalTime: string
  commonExitPoint: string
  steps: Step[]
}

function makeStep(id: string, name: string, description: string, avgTime: string, dropOffRate: number, satisfaction: number, trafficWeight: number, detail: StepDetail): Step {
  return { id, name, description, avgTime, dropOffRate, satisfaction, trafficWeight, detail }
}

const journeys: Journey[] = [
  {
    id: "new-agent", name: "New Agent Setup", completionRate: 72, avgTotalTime: "14m 30s", commonExitPoint: "Configure Tools",
    steps: [
      makeStep("na-1", "Landing Page", "User arrives and views onboarding prompt", "12s", 5, 4, 100,
        { actions: ["View welcome modal", "Read feature highlights", "Click 'Create Agent'"], painPoints: ["CTA below the fold on mobile", "No skip option for returning users"], suggestions: ["Add persistent top-bar CTA", "Detect returning users and bypass intro"] }),
      makeStep("na-2", "Name & Persona", "Define agent identity and personality traits", "1m 45s", 8, 4, 95,
        { actions: ["Enter agent name", "Select persona template", "Customize voice tone"], painPoints: ["Too many persona options cause decision fatigue", "No preview of persona behavior"], suggestions: ["Reduce templates to 5 curated options", "Add live persona preview chat"] }),
      makeStep("na-3", "Configure Tools", "Select and authorize tool integrations", "4m 20s", 22, 2, 87,
        { actions: ["Browse tool catalog", "Toggle tool access", "Authorize OAuth connections"], painPoints: ["OAuth flows open new tabs and lose context", "Error messages are cryptic", "Too many tools displayed"], suggestions: ["Inline OAuth with iframe fallback", "Categorize tools with search", "Show recommended tools first"] }),
      makeStep("na-4", "Test Run", "Send first message and validate agent behavior", "3m 10s", 12, 3, 68,
        { actions: ["Type test prompt", "Review agent response", "Adjust settings if needed"], painPoints: ["Slow first response due to cold start", "No suggested test prompts"], suggestions: ["Pre-warm agent on creation", "Provide 3 starter prompts"] }),
      makeStep("na-5", "Deploy", "Finalize and activate the agent", "45s", 3, 5, 60,
        { actions: ["Review summary", "Click deploy", "Share agent link"], painPoints: ["No confirmation of successful deploy besides a toast"], suggestions: ["Full-screen success state with next steps"] }),
    ],
  },
  {
    id: "debug-session", name: "Debug Session", completionRate: 58, avgTotalTime: "22m 15s", commonExitPoint: "Trace Analysis",
    steps: [
      makeStep("ds-1", "Error Alert", "User receives notification of agent failure", "5s", 2, 3, 100,
        { actions: ["View error notification", "Click through to debug view"], painPoints: ["Alert lacks context on severity", "No direct link to relevant logs"], suggestions: ["Include error severity badge", "Deep-link to filtered log view"] }),
      makeStep("ds-2", "Log Explorer", "Browse and filter execution logs", "6m 30s", 15, 2, 98,
        { actions: ["Apply time range filter", "Search log text", "Expand log entries"], painPoints: ["Logs load slowly for large time ranges", "No syntax highlighting", "Search is substring only"], suggestions: ["Paginate with virtual scroll", "Add regex search", "Highlight JSON and stack traces"] }),
      makeStep("ds-3", "Trace Analysis", "Inspect execution trace and tool call chain", "8m 45s", 28, 2, 83,
        { actions: ["View call graph", "Inspect individual tool calls", "Check latency breakdown"], painPoints: ["Trace visualization is hard to read", "No way to compare traces", "Missing timestamps on nodes"], suggestions: ["Redesign trace as horizontal timeline", "Add trace diff tool", "Show wall-clock time on each node"] }),
      makeStep("ds-4", "Fix & Retry", "Apply configuration fix and re-run", "4m 20s", 10, 3, 60,
        { actions: ["Edit agent config", "Save changes", "Trigger retry"], painPoints: ["No inline editing — must leave debug view", "Retry resets log filters"], suggestions: ["Add inline config editor in debug panel", "Persist filter state across retries"] }),
      makeStep("ds-5", "Verify", "Confirm the fix resolved the issue", "2m 35s", 5, 4, 54,
        { actions: ["Check new execution result", "Compare before/after", "Mark issue resolved"], painPoints: ["No side-by-side comparison view"], suggestions: ["Add before/after diff panel", "Auto-suggest marking resolved on success"] }),
    ],
  },
  {
    id: "deploy-release", name: "Deploy Release", completionRate: 85, avgTotalTime: "8m 50s", commonExitPoint: "Review Changes",
    steps: [
      makeStep("dr-1", "Select Version", "Choose agent version to deploy", "30s", 3, 4, 100,
        { actions: ["View version list", "Compare version diffs", "Select target version"], painPoints: ["Version names are auto-generated hashes", "No changelog summary"], suggestions: ["Allow custom version labels", "Auto-generate changelog from commits"] }),
      makeStep("dr-2", "Review Changes", "Inspect diff between current and target version", "3m 15s", 12, 3, 97,
        { actions: ["Read config diff", "Check tool permission changes", "Review prompt modifications"], painPoints: ["Diff view is plain text with no highlighting", "Large diffs have no collapse"], suggestions: ["Add syntax-highlighted diff viewer", "Collapsible diff sections by category"] }),
      makeStep("dr-3", "Run Checks", "Execute pre-deploy validation suite", "2m 40s", 8, 4, 85,
        { actions: ["Watch check progress", "Review check results", "Dismiss warnings"], painPoints: ["Checks run sequentially — slow", "Warning vs error distinction unclear"], suggestions: ["Parallelize checks", "Use color-coded severity badges"] }),
      makeStep("dr-4", "Confirm Deploy", "Final confirmation and rollout", "20s", 2, 5, 78,
        { actions: ["Review deployment summary", "Select rollout strategy", "Click deploy"], painPoints: ["No rollback plan shown upfront"], suggestions: ["Show one-click rollback option on confirmation screen"] }),
      makeStep("dr-5", "Monitor", "Watch post-deploy health metrics", "2m 05s", 4, 4, 76,
        { actions: ["Monitor error rate", "Check response latency", "Watch user satisfaction trend"], painPoints: ["Metrics update interval too slow (30s)", "No auto-rollback threshold"], suggestions: ["Real-time metric streaming", "Configurable auto-rollback on error spike"] }),
    ],
  },
]

function SatisfactionDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full",
            i < score ? "bg-primary" : "bg-[var(--color-surface-3)]"
          )}
        />
      ))}
    </div>
  )
}

function PercentBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-[var(--color-text-primary)] font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export default function UserJourneyMap() {
  const [activeJourneyId, setActiveJourneyId] = useState<string>(journeys[0].id)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const activeJourney = journeys.find((j) => j.id === activeJourneyId) ?? journeys[0]
  const selectedStep = selectedStepId
    ? activeJourney.steps.find((s) => s.id === selectedStepId) ?? null
    : null

  const maxTraffic = Math.max(...activeJourney.steps.map((s) => s.trafficWeight))

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Journey Map</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Visualize how users move through key application flows
          </p>
        </div>

        {/* Journey Tabs */}
        <div className="flex items-center gap-1 bg-[var(--color-surface-1)] rounded-lg p-1 w-fit border border-[var(--color-border)]">
          {journeys.map((journey) => (
            <button
              key={journey.id}
              onClick={() => {
                setActiveJourneyId(journey.id)
                setSelectedStepId(null)
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeJourneyId === journey.id
                  ? "bg-primary text-[var(--color-text-primary)] shadow-lg shadow-indigo-500/20"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {journey.name}
            </button>
          ))}
        </div>

        {/* Main Content: Flow + Sidebar */}
        <div className="flex gap-6">
          {/* Flow Area */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Steps Row */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 overflow-x-auto">
              <div className="flex items-stretch gap-0 min-w-max">
                {activeJourney.steps.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    {/* Step Card */}
                    <button
                      onClick={() =>
                        setSelectedStepId(
                          selectedStepId === step.id ? null : step.id
                        )
                      }
                      className={cn(
                        "flex-shrink-0 w-48 rounded-lg border p-4 text-left transition-all duration-200",
                        selectedStepId === step.id
                          ? "border-primary bg-primary/10 shadow-lg shadow-indigo-500/10"
                          : "border-[var(--color-border)] bg-[var(--color-surface-2)]/50 hover:border-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)]"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {step.name}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2 leading-relaxed">
                        {step.description}
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--color-text-muted)]">Avg time</span>
                          <span className="text-[var(--color-text-primary)] font-medium">{step.avgTime}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--color-text-muted)]">Drop-off</span>
                          <span
                            className={cn(
                              "font-medium",
                              step.dropOffRate > 20
                                ? "text-red-400"
                                : step.dropOffRate > 10
                                ? "text-amber-400"
                                : "text-emerald-400"
                            )}
                          >
                            {step.dropOffRate}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--color-text-muted)]">Satisfaction</span>
                          <SatisfactionDots score={step.satisfaction} />
                        </div>
                      </div>
                    </button>

                    {/* Arrow Connector */}
                    {idx < activeJourney.steps.length - 1 && (
                      <div className="flex items-center flex-shrink-0 px-1">
                        <div className="w-6 h-px bg-[var(--color-surface-3)]" />
                        <span className="text-[var(--color-text-muted)] text-sm leading-none">→</span>
                        <div className="w-6 h-px bg-[var(--color-surface-3)]" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Heatmap Row */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                Relative Traffic Heatmap
              </h3>
              <div className="flex items-end gap-3 min-w-max">
                {activeJourney.steps.map((step) => {
                  const ratio = step.trafficWeight / maxTraffic
                  const height = Math.max(16, Math.round(ratio * 56))
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-1 w-48">
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                        {step.trafficWeight}%
                      </span>
                      <div
                        className={cn(
                          "w-full rounded transition-all duration-500",
                          ratio > 0.8
                            ? "bg-primary"
                            : ratio > 0.6
                            ? "bg-primary/70"
                            : ratio > 0.4
                            ? "bg-primary/50"
                            : "bg-primary/30"
                        )}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[10px] text-[var(--color-text-muted)] truncate w-full text-center">
                        {step.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detail Panel */}
            {selectedStep && (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {selectedStep.name}
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {selectedStep.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedStepId(null)}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm px-2 py-1 rounded hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-5">
                  {/* Actions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
                      What Users Do Here
                    </h3>
                    <ul className="space-y-2">
                      {selectedStep.detail.actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pain Points */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                      Pain Points
                    </h3>
                    <ul className="space-y-2">
                      {selectedStep.detail.painPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Suggestions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Improvement Suggestions
                    </h3>
                    <ul className="space-y-2">
                      {selectedStep.detail.suggestions.map((suggestion, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metrics Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 space-y-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Journey Metrics</h3>

              <PercentBar
                value={activeJourney.completionRate}
                label="Completion Rate"
              />

              <div className="space-y-1">
                <span className="text-xs text-[var(--color-text-secondary)]">Avg Time to Complete</span>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {activeJourney.avgTotalTime}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-[var(--color-text-secondary)]">Most Common Exit</span>
                <p className="text-sm font-medium text-amber-400">
                  {activeJourney.commonExitPoint}
                </p>
              </div>
            </div>

            {/* Per-Step Drop-off Breakdown */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Drop-off by Step</h3>
              {activeJourney.steps.map((step) => (
                <div key={step.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)] truncate mr-2">{step.name}</span>
                    <span
                      className={cn(
                        "font-medium flex-shrink-0",
                        step.dropOffRate > 20
                          ? "text-red-400"
                          : step.dropOffRate > 10
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {step.dropOffRate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        step.dropOffRate > 20
                          ? "bg-red-500"
                          : step.dropOffRate > 10
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(step.dropOffRate * 3, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Satisfaction Overview */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Satisfaction</h3>
              {activeJourney.steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-secondary)] truncate mr-2">
                    {step.name}
                  </span>
                  <SatisfactionDots score={step.satisfaction} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
