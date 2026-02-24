import * as React from "react";
import { Bot, LineChart, FileText, AlertCircle } from "lucide-react";

export interface IntentResult {
  label: string;
  suggestion: string;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  icon: React.ComponentType<{ className?: string }>;
}

export function getPaletteIntent(query: string): IntentResult | null {
  if (query.length <= 3) {return null;}

  const q = query.toLowerCase();

  // "github monitor" → suggest Create Agent at /agents/new
  if (q.includes("github") || q.includes("monitor")) {
    return {
      label: "Create Agent",
      suggestion: "Create a new agent (e.g., GitHub monitor)",
      to: "/agents/new",
      icon: Bot,
    };
  }

  // "cost" / "spending" → suggest Analytics
  if (q.includes("cost") || q.includes("spending") || q.includes("price") || q.includes("budget")) {
    return {
      label: "View Analytics",
      suggestion: "Check costs and spending in Analytics",
      to: "/analytics",
      icon: LineChart,
    };
  }

  // "stalled" → suggest Agent Status filtered to stalled
  if (q.includes("stalled") || q.includes("stuck") || q.includes("stopped")) {
    return {
      label: "Agent Status",
      suggestion: "View stalled agents in status dashboard",
      to: "/agent-status",
      search: { filter: "stalled" },
      icon: AlertCircle,
    };
  }

  // "logs" → suggest Logs route
  if (q.includes("log") || q.includes("debug") || q.includes("history")) {
    return {
      label: "View Logs",
      suggestion: "Check system and gateway logs",
      to: "/logs",
      icon: FileText,
    };
  }

  return null;
}
