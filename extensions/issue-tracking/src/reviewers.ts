import type {
  ClassificationDimension,
  IssueTicket,
  ReviewerAssignment,
  TicketStatus,
} from "./types.js";

export type ReviewerTriggerEvent = "create" | TicketStatus;

export type ReviewerFilterConfig = {
  labels?: string[];
  classifications?: Array<{ dimension: ClassificationDimension; value: string }>;
};

export type ReviewerRuleConfig = {
  kind: "agent" | "model";
  id: string;
  label?: string;
  triggerOn?: ReviewerTriggerEvent[];
  filter?: ReviewerFilterConfig;
};

function matchesFilter(ticket: IssueTicket, filter: ReviewerFilterConfig): boolean {
  if (filter.labels && filter.labels.length > 0) {
    const hasLabel = filter.labels.some((label) => ticket.labels.includes(label));
    if (!hasLabel) return false;
  }
  if (filter.classifications && filter.classifications.length > 0) {
    const hasClassification = filter.classifications.some((fc) =>
      ticket.classifications.some((tc) => tc.dimension === fc.dimension && tc.value === fc.value),
    );
    if (!hasClassification) return false;
  }
  return true;
}

export function evaluateReviewers(
  rules: ReviewerRuleConfig[],
  ticket: IssueTicket,
  event: ReviewerTriggerEvent,
): ReviewerAssignment[] {
  const result: ReviewerAssignment[] = [];
  for (const rule of rules) {
    if (rule.triggerOn && rule.triggerOn.length > 0) {
      if (!rule.triggerOn.includes(event)) continue;
    }
    if (rule.filter && !matchesFilter(ticket, rule.filter)) continue;
    result.push({ kind: rule.kind, id: rule.id, label: rule.label });
  }
  return result;
}
