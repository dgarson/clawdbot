export type AlertCenterQueryState = {
  tab?: string;
  status?: string;
  severity?: string;
  category?: string;
  alertId?: string;
  ruleId?: string;
  fromAlertId?: string;
};

const QUERY_KEY_MAP = {
  tab: "tab",
  status: "status",
  severity: "severity",
  category: "category",
  alertId: "alert",
  ruleId: "rule",
  fromAlertId: "fromAlert",
} as const;

export const ALERT_STATUS_LABELS = {
  firing: "Firing",
  acknowledged: "Ack'd",
  resolved: "Resolved",
  suppressed: "Suppressed",
} as const;

export function getAlertStatusLabel(status: string): string {
  return ALERT_STATUS_LABELS[status as keyof typeof ALERT_STATUS_LABELS] ?? status;
}

export function parseAlertCenterQuery(search: string): AlertCenterQueryState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const state: AlertCenterQueryState = {};
  for (const [stateKey, queryKey] of Object.entries(QUERY_KEY_MAP)) {
    const value = params.get(queryKey);
    if (value) {
      state[stateKey as keyof AlertCenterQueryState] = value;
    }
  }
  return state;
}

export function buildAlertCenterQuery(currentSearch: string, nextState: AlertCenterQueryState): string {
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  for (const [stateKey, queryKey] of Object.entries(QUERY_KEY_MAP)) {
    const value = nextState[stateKey as keyof AlertCenterQueryState];
    if (value === undefined || value === null || value === "") {
      params.delete(queryKey);
      continue;
    }
    params.set(queryKey, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getRovingTargetIndex(currentIndex: number, key: string, total: number): number | null {
  if (total <= 0) {return null;}
  if (key === "ArrowRight" || key === "ArrowDown") {
    return (currentIndex + 1 + total) % total;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return (currentIndex - 1 + total) % total;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return total - 1;
  }
  return null;
}

export function resolveRuleJump(currentAlertId: string | null, ruleId: string) {
  return { tab: "rules" as const, focusedRuleId: ruleId, originAlertId: currentAlertId };
}

export function resolveBackToAlert(originAlertId: string | null, alertIds: string[]) {
  const canReturn = Boolean(originAlertId && alertIds.includes(originAlertId));
  return {
    tab: "alerts" as const,
    selectedAlertId: canReturn ? originAlertId : null,
    originAlertId: null,
    focusedRuleId: null,
  };
}
