export type SharedRuleState = "firing" | "ok" | "pending" | "disabled" | "error";

export function getRuleStateTextClass(state: SharedRuleState): string {
  if (state === "firing") {return "text-rose-400";}
  if (state === "ok") {return "text-emerald-400";}
  if (state === "pending") {return "text-amber-400";}
  if (state === "error") {return "text-rose-400";}
  return "text-[var(--color-text-secondary)]";
}

export function getRuleStateBadgeClass(state: SharedRuleState): string {
  if (state === "firing") {return "bg-rose-400/10 text-rose-400";}
  if (state === "ok") {return "bg-emerald-400/10 text-emerald-400";}
  if (state === "pending") {return "bg-amber-400/10 text-amber-400";}
  if (state === "error") {return "bg-rose-400/10 text-rose-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}

