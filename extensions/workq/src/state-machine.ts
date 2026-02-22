import type { WorkItemStatus } from "./types.js";

export const WORKQ_TRANSITIONS: Readonly<Record<WorkItemStatus, readonly WorkItemStatus[]>> = {
  claimed: ["in-progress"],
  "in-progress": ["blocked", "in-review"],
  blocked: ["in-progress"],
  "in-review": ["in-progress", "done"],
  done: [],
  dropped: [],
};

export function getValidTransitions(from: WorkItemStatus): WorkItemStatus[] {
  return [...WORKQ_TRANSITIONS[from]];
}

export function isValidTransition(from: WorkItemStatus, to: WorkItemStatus): boolean {
  return WORKQ_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: WorkItemStatus, to: WorkItemStatus): void {
  if (isValidTransition(from, to)) {
    return;
  }

  const valid = getValidTransitions(from);
  throw new Error(
    `Invalid status transition: ${from} -> ${to}. Valid transitions: ${
      valid.length ? valid.join(", ") : "none"
    }`,
  );
}
