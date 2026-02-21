"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Loader2,
  ArrowRight,
  RefreshCw,
  X,
  FileText,
  Brain,
  Wrench,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { AgentFileEntry } from "@/hooks/queries/useAgentFiles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoReviewPanelProps {
  agentId: string;
  agentName: string;
  files: AgentFileEntry[];
  config?: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
  /** Callback to apply a suggested fix */
  onApplyFix?: (fix: ReviewFix) => void;
}

export interface ReviewResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  items: ReviewItem[];
  generatedAt: number;
}

interface ReviewItem {
  id: string;
  level: "good" | "warning" | "error" | "info";
  category: "identity" | "personality" | "model" | "tools" | "files" | "security";
  title: string;
  detail: string;
  fix?: ReviewFix;
}

interface ReviewFix {
  id: string;
  label: string;
  type: "file_change" | "config_change";
  fileName?: string;
  newContent?: string;
  configPatch?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Review Logic (placeholder — will be replaced with LLM call)
// ---------------------------------------------------------------------------

function generateReview(
  agentName: string,
  files: AgentFileEntry[],
  _config?: Record<string, unknown>,
): ReviewResult {
  const items: ReviewItem[] = [];

  const existingFiles = files.filter((f) => !f.missing);
  const _missingFiles = files.filter((f) => f.missing);
  const hasSoul = existingFiles.some((f) => f.name === "SOUL.md");
  const hasAgents = existingFiles.some((f) => f.name === "AGENTS.md");
  const hasTools = existingFiles.some((f) => f.name === "TOOLS.md");
  const hasUser = existingFiles.some((f) => f.name === "USER.md");
  const _hasHeartbeat = existingFiles.some((f) => f.name === "HEARTBEAT.md");

  // Identity checks
  if (agentName && agentName !== "undefined") {
    items.push({
      id: "identity-name",
      level: "good",
      category: "identity",
      title: "Agent has a name",
      detail: `Agent is named "${agentName}" which helps with identification.`,
    });
  } else {
    items.push({
      id: "identity-name",
      level: "error",
      category: "identity",
      title: "Agent needs a name",
      detail: "Setting a descriptive name helps you identify this agent and makes it easier to work with.",
    });
  }

  // Soul file check
  if (hasSoul) {
    const soulFile = existingFiles.find((f) => f.name === "SOUL.md");
    if (soulFile && soulFile.size && soulFile.size > 200) {
      items.push({
        id: "soul-exists",
        level: "good",
        category: "personality",
        title: "SOUL.md is well-developed",
        detail: `At ${((soulFile.size ?? 0) / 1024).toFixed(1)} KB, the personality file has good depth.`,
      });
    } else {
      items.push({
        id: "soul-thin",
        level: "warning",
        category: "personality",
        title: "SOUL.md could be more detailed",
        detail: "A more detailed SOUL.md will give the agent a stronger, more consistent personality.",
      });
    }
  } else {
    items.push({
      id: "soul-missing",
      level: "error",
      category: "personality",
      title: "Missing SOUL.md",
      detail: "SOUL.md defines the agent's personality, voice, and values. Without it, the agent will have a generic personality.",
      fix: {
        id: "fix-soul",
        label: "Generate a SOUL.md",
        type: "file_change",
        fileName: "SOUL.md",
        newContent: `# SOUL.md — ${agentName}\n\n## Core Identity\n\nYou are ${agentName}, a helpful AI assistant.\n\n## Communication Style\n\n- Clear and concise\n- Professional but approachable\n- Evidence-based recommendations\n\n## What Drives You\n\n- Helping users accomplish their goals\n- Providing accurate, reliable information\n- Continuous improvement\n`,
      },
    });
  }

  // AGENTS.md check
  if (hasAgents) {
    items.push({
      id: "agents-exists",
      level: "good",
      category: "files",
      title: "AGENTS.md configured",
      detail: "Agent behavior and session rules are defined.",
    });
  } else {
    items.push({
      id: "agents-missing",
      level: "warning",
      category: "files",
      title: "Missing AGENTS.md",
      detail: "AGENTS.md defines how the agent behaves in sessions. Consider adding one for better control.",
      fix: {
        id: "fix-agents",
        label: "Generate an AGENTS.md",
        type: "file_change",
        fileName: "AGENTS.md",
        newContent: `# AGENTS.md — ${agentName}\n\n## Your Role\n\nDescribe the agent's role here.\n\n## Every Session\n\n1. Read SOUL.md\n2. Read USER.md\n\n## Working Style\n\n- Be helpful and proactive\n- Ask clarifying questions when needed\n`,
      },
    });
  }

  // TOOLS.md check
  if (hasTools) {
    items.push({
      id: "tools-exists",
      level: "good",
      category: "tools",
      title: "TOOLS.md configured",
      detail: "Environment-specific tool notes are in place.",
    });
  } else {
    items.push({
      id: "tools-missing",
      level: "info",
      category: "tools",
      title: "Consider adding TOOLS.md",
      detail: "TOOLS.md provides environment-specific tool configuration. Useful if the agent needs SSH hosts, voice preferences, etc.",
    });
  }

  // USER.md check
  if (hasUser) {
    items.push({
      id: "user-exists",
      level: "good",
      category: "files",
      title: "USER.md configured",
      detail: "Agent knows about who it's serving.",
    });
  } else {
    items.push({
      id: "user-missing",
      level: "info",
      category: "files",
      title: "Consider adding USER.md",
      detail: "USER.md helps the agent understand who it's working with — name, preferences, timezone, etc.",
    });
  }

  // File count check
  if (existingFiles.length >= 4) {
    items.push({
      id: "files-good-coverage",
      level: "good",
      category: "files",
      title: "Good file coverage",
      detail: `${existingFiles.length} configuration files present. This agent is well-configured.`,
    });
  }

  // Security suggestion
  items.push({
    id: "security-review",
    level: "info",
    category: "security",
    title: "Review tool permissions",
    detail: "Periodically review which tools this agent can access to maintain security.",
  });

  // Calculate score
  const goodCount = items.filter((i) => i.level === "good").length;
  const warningCount = items.filter((i) => i.level === "warning").length;
  const _errorCount = items.filter((i) => i.level === "error").length;
  const totalChecks = items.length;
  const score = Math.round(
    ((goodCount * 1 + warningCount * 0.5) / Math.max(totalChecks - items.filter((i) => i.level === "info").length, 1)) * 100,
  );

  let grade: ReviewResult["grade"] = "A";
  if (score < 30) {grade = "F";}
  else if (score < 50) {grade = "D";}
  else if (score < 70) {grade = "C";}
  else if (score < 85) {grade = "B";}

  return {
    score: Math.min(100, Math.max(0, score)),
    grade,
    items,
    generatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutoReviewPanel({
  agentId: _agentId,
  agentName,
  files,
  config,
  open,
  onClose,
  onApplyFix,
}: AutoReviewPanelProps) {
  const [review, setReview] = React.useState<ReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [appliedFixes, setAppliedFixes] = React.useState<Set<string>>(new Set());

  const runReview = React.useCallback(async () => {
    setIsAnalyzing(true);
    // Simulate analysis time
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = generateReview(agentName, files, config);
    setReview(result);
    setIsAnalyzing(false);
  }, [agentName, files, config]);

  // Auto-run review when opened
  React.useEffect(() => {
    if (open && !review && !isAnalyzing) {
      void runReview();
    }
  }, [open, review, isAnalyzing, runReview]);

  const handleApplyFix = (fix: ReviewFix) => {
    onApplyFix?.(fix);
    setAppliedFixes((prev) => new Set(prev).add(fix.id));
  };

  if (!open) {return null;}

  const gradeColors: Record<string, string> = {
    A: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    B: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    C: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    D: "text-orange-400 border-orange-400/30 bg-orange-400/10",
    F: "text-red-400 border-red-400/30 bg-red-400/10",
  };

  const levelIcons = {
    good: <CheckCircle2 className="size-4 text-emerald-500" />,
    warning: <AlertTriangle className="size-4 text-amber-500" />,
    error: <XCircle className="size-4 text-red-500" />,
    info: <Shield className="size-4 text-blue-400" />,
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    identity: <FileText className="size-3.5" />,
    personality: <Sparkles className="size-3.5" />,
    model: <Brain className="size-3.5" />,
    tools: <Wrench className="size-3.5" />,
    files: <FileText className="size-3.5" />,
    security: <Shield className="size-3.5" />,
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <CardTitle className="text-base">Configuration Review</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReview(null);
                void runReview();
              }}
              disabled={isAnalyzing}
              className="gap-1.5 h-7 text-xs"
            >
              <RefreshCw className={`size-3 ${isAnalyzing ? "animate-spin" : ""}`} />
              Re-analyze
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing configuration…</p>
            <Progress value={65} className="w-48 h-1.5" />
          </div>
        ) : review ? (
          <div className="space-y-4">
            {/* Score Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 text-xl font-bold ${gradeColors[review.grade]}`}
                >
                  {review.grade}
                </div>
                <div>
                  <p className="text-sm font-medium">Configuration Score</p>
                  <p className="text-xs text-muted-foreground">{review.score}/100</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {review.items.filter((i) => i.level === "good").length} passed •{" "}
                {review.items.filter((i) => i.level === "warning").length} warnings •{" "}
                {review.items.filter((i) => i.level === "error").length} issues
              </Badge>
            </div>

            <Separator />

            {/* Review Items */}
            <div className="space-y-3">
              {/* Errors first, then warnings, then good */}
              {["error", "warning", "info", "good"].map((level) => {
                const levelItems = review.items.filter((i) => i.level === level);
                if (levelItems.length === 0) {return null;}
                return levelItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex-shrink-0 mt-0.5">{levelIcons[item.level]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{item.title}</span>
                        <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0">
                          {categoryIcons[item.category]}
                          {item.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                      {item.fix && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyFix(item.fix!)}
                          disabled={appliedFixes.has(item.fix.id)}
                          className="mt-2 h-7 text-xs gap-1"
                        >
                          {appliedFixes.has(item.fix.id) ? (
                            <>
                              <CheckCircle2 className="size-3 text-emerald-500" />
                              Applied
                            </>
                          ) : (
                            <>
                              <ArrowRight className="size-3" />
                              {item.fix.label}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ));
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
