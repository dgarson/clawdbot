import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

type StepStatus = "not-started" | "in-progress" | "completed" | "skipped";
type StepCategory = "setup" | "agents" | "integrations" | "advanced";

interface ChecklistStep {
  id: string;
  category: StepCategory;
  title: string;
  description: string;
  emoji: string;
  status: StepStatus;
  required: boolean;
  estimatedMinutes: number;
  link?: string;
  tip?: string;
  completedAt?: string;
}

const CATEGORIES: { id: StepCategory; label: string; emoji: string }[] = [
  { id: "setup", label: "Setup", emoji: "⚙️" },
  { id: "agents", label: "Agents", emoji: "🤖" },
  { id: "integrations", label: "Integrations", emoji: "🔌" },
  { id: "advanced", label: "Advanced", emoji: "🚀" },
];

const INITIAL_STEPS: ChecklistStep[] = [
  // Setup
  { id: "s1", category: "setup", title: "Connect Anthropic API key", description: "Essential for agent intelligence.", emoji: "🔑", status: "completed", required: true, estimatedMinutes: 2 },
  { id: "s2", category: "setup", title: "Set workspace name", description: "How your workspace appears in the UI.", emoji: "🏠", status: "completed", required: true, estimatedMinutes: 1 },
  { id: "s3", category: "setup", title: "Configure timezone", description: "Ensures cron jobs run at the right time.", emoji: "🌐", status: "completed", required: true, estimatedMinutes: 1 },
  // Agents
  { id: "a1", category: "agents", title: "Create your first agent", description: "The core entity of OpenClaw.", emoji: "👤", status: "in-progress", required: true, estimatedMinutes: 5 },
  { id: "a2", category: "agents", title: "Configure agent soul", description: "Define personality and behavioral constraints.", emoji: "✨", status: "in-progress", required: true, estimatedMinutes: 10 },
  { id: "a3", category: "agents", title: "Set agent model", description: "Choose between Opus, Sonnet, or Haiku.", emoji: "🧠", status: "not-started", required: true, estimatedMinutes: 2 },
  // Integrations
  { id: "i1", category: "integrations", title: "Connect Slack", description: "Receive notifications and chat with agents.", emoji: "💬", status: "completed", required: true, estimatedMinutes: 5 },
  { id: "i2", category: "integrations", title: "Set up GitHub", description: "Allow agents to manage repositories.", emoji: "🐙", status: "not-started", required: false, estimatedMinutes: 5 },
  { id: "i3", category: "integrations", title: "Configure webhooks", description: "Trigger actions from external systems.", emoji: "🔗", status: "not-started", required: false, estimatedMinutes: 10 },
  // Advanced
  { id: "x1", category: "advanced", title: "Enable voice interface", description: "Talk to your agents directly.", emoji: "🎙️", status: "not-started", required: false, estimatedMinutes: 15 },
  { id: "x2", category: "advanced", title: "Set up cron schedules", description: "Automate recurring tasks.", emoji: "⏰", status: "not-started", required: false, estimatedMinutes: 8 },
  { id: "x3", category: "advanced", title: "Configure rate limits", description: "Control spend and API usage.", emoji: "📉", status: "skipped", required: false, estimatedMinutes: 5 },
];

export default function OnboardingChecklist() {
  const [steps, setSteps] = useState<ChecklistStep[]>(INITIAL_STEPS);
  const [activeCategory, setActiveCategory] = useState<StepCategory>("setup");
  const [celebration, setCelebration] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = steps.length;
    const completed = steps.filter((s) => s.status === "completed").length;
    const requiredTotal = steps.filter((s) => s.required).length;
    const requiredCompleted = steps.filter((s) => s.required && s.status === "completed").length;
    const percent = Math.round((completed / total) * 100);
    const allRequiredDone = requiredTotal === requiredCompleted;
    
    return { total, completed, percent, allRequiredDone, requiredTotal, requiredCompleted };
  }, [steps]);

  const categoryProgress = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      const catSteps = steps.filter((s) => s.category === cat.id);
      const done = catSteps.filter((s) => s.status === "completed").length;
      acc[cat.id] = { done, total: catSteps.length };
      return acc;
    }, {} as Record<StepCategory, { done: number; total: number }>);
  }, [steps]);

  const toggleStep = useCallback((id: string) => {
    setSteps((current) => {
      const step = current.find((s) => s.id === id);
      if (!step) {return current;}

      const newStatus: StepStatus = step.status === "completed" ? "not-started" : "completed";
      
      if (newStatus === "completed" && step.required) {
        setCelebration("🎉 Step completed!");
        setTimeout(() => setCelebration(null), 3000);
      }

      return current.map((s) => 
        s.id === id ? { ...s, status: newStatus, completedAt: newStatus === "completed" ? new Date().toISOString() : undefined } : s
      );
    });
  }, []);

  const skipStep = useCallback((id: string) => {
    setSteps((current) => current.map((s) => 
      s.id === id ? { ...s, status: s.status === "skipped" ? "not-started" : "skipped" } : s
    ));
  }, []);

  const activeSteps = useMemo(() => 
    steps.filter((s) => s.category === activeCategory),
    [steps, activeCategory]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header & Overall Progress */}
        <header className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Onboarding</h1>
              <p className="text-zinc-400 mt-1">Complete these steps to unlock your full workspace potential.</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-mono font-bold text-indigo-400">{stats.percent}%</span>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Workspace Ready</p>
            </div>
          </div>
          
          <div className="relative h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800" role="progressbar" aria-valuenow={stats.percent} aria-valuemin={0} aria-valuemax={100}>
            <div 
              className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(99,102,241,0.4)]"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm font-medium">
            <span className="text-zinc-400">{stats.completed} of {stats.total} steps finished</span>
            {stats.allRequiredDone && (
              <span className="text-emerald-400 flex items-center gap-1.5 animate-bounce">
                ✨ All required setup complete!
              </span>
            )}
          </div>
        </header>

        {/* Celebration Banner */}
        {stats.allRequiredDone && (
          <div className="bg-indigo-600/20 border border-indigo-500/50 rounded-xl p-6 text-center space-y-2 animate-in fade-in zoom-in duration-500">
            <h2 className="text-xl font-bold text-indigo-300">🎉 Mission Accomplished!</h2>
            <p className="text-indigo-200/80 max-w-lg mx-auto">Your workspace is now fully configured and ready for production. All core agents and integrations are live.</p>
            <button className="mt-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-8">
          
          {/* Sidebar */}
          <nav className="col-span-12 md:col-span-4 lg:col-span-3 space-y-2">
            {CATEGORIES.map((cat) => {
              const progress = categoryProgress[cat.id];
              const isDone = progress.done === progress.total;
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 text-left group focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                    isActive 
                      ? "bg-zinc-900 border-zinc-700 text-white shadow-lg" 
                      : "bg-transparent border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("text-lg", !isActive && "grayscale")}>{cat.emoji}</span>
                    <span className="font-medium">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className={cn(
                      isActive ? "text-indigo-400" : "text-zinc-600",
                      isDone && "text-emerald-400"
                    )}>
                      {progress.done}/{progress.total}
                    </span>
                    {isDone && <span aria-hidden="true">✅</span>}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Step List */}
          <main className="col-span-12 md:col-span-8 lg:col-span-9 space-y-4 relative">
            {celebration && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-zinc-950 px-4 py-1 rounded-full font-bold text-sm shadow-xl animate-bounce z-10">
                {celebration}
              </div>
            )}

            {activeSteps.map((step) => {
              const isCompleted = step.status === "completed";
              const isSkipped = step.status === "skipped";
              const isInProgress = step.status === "in-progress";

              return (
                <div 
                  key={step.id}
                  className={cn(
                    "group relative flex items-start gap-4 p-5 rounded-xl border bg-zinc-900 transition-all duration-300",
                    isCompleted ? "border-emerald-500/20 opacity-80" : "border-zinc-800 hover:border-zinc-700",
                    isSkipped && "opacity-50"
                  )}
                >
                  {/* Status Indicator / Checkbox */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    role="checkbox"
                    aria-checked={isCompleted}
                    className={cn(
                      "mt-1 flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      isCompleted 
                        ? "bg-emerald-400 border-emerald-400 text-zinc-950" 
                        : "border-zinc-700 hover:border-zinc-500",
                      isInProgress && "border-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    )}
                  >
                    {isCompleted && <span className="text-xs font-bold">✓</span>}
                  </button>

                  {/* Content */}
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">{step.emoji}</span>
                      <h3 className={cn(
                        "font-semibold text-lg leading-none",
                        isCompleted && "text-zinc-400 line-through decoration-zinc-500",
                        isSkipped && "text-zinc-500 line-through"
                      )}>
                        {step.title}
                      </h3>
                      {step.required && !isCompleted && !isSkipped && (
                        <span className="text-[10px] uppercase tracking-widest font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                          Required
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-zinc-400 text-sm leading-relaxed",
                      (isCompleted || isSkipped) && "text-zinc-500"
                    )}>
                      {step.description}
                    </p>
                    
                    <div className="flex items-center gap-4 pt-2 text-xs font-medium text-zinc-500">
                      <span className="flex items-center gap-1">⏱️ {step.estimatedMinutes}m</span>
                      {step.tip && <span className="text-amber-400/80 italic group-hover:text-amber-400 transition-colors">💡 Tip: {step.tip}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isCompleted && (
                    <div className="flex-shrink-0 flex items-center gap-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => skipStep(step.id)}
                        className={cn(
                          "text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                          isSkipped ? "bg-zinc-800 text-zinc-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {isSkipped ? "Unskip" : "Skip"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </main>
        </div>
      </div>
    </div>
  );
}
