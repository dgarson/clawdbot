import type { AlertDiagnosticsView } from "./AlertRuleConfigDialog";

export const ALERT_DIAGNOSTICS_ROUTE_MAP: Record<AlertDiagnosticsView, string> = {
  tracer: "tracer",
  analytics: "agent-insights",
  metrics: "usage",
};

export function resolveAlertDiagnosticsRoute(view: AlertDiagnosticsView): string {
  return ALERT_DIAGNOSTICS_ROUTE_MAP[view];
}

export function resolveAlertWorkspaceRoute(params?: { ruleId?: string; alertId?: string }): string {
  const query = new URLSearchParams();
  if (params?.ruleId) {query.set("rule", params.ruleId);}
  if (params?.alertId) {query.set("alert", params.alertId);}
  const suffix = query.toString();
  return suffix ? `agent-insights?${suffix}` : "agent-insights";
}

