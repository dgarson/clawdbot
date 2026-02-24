# Router Feedback Loop System and Analytics Mapping

This document defines the router feedback loop implementation outside the metrics dashboard UI.

## Scope

The implementation covers these four shipped components:

1. **Decision logging**: every routing decision is persisted in a durable JSONL event stream.
2. **Feedback capture**: explicit, reaction-driven, and implicit correction signals are normalized and linked to decisions.
3. **Review queue**: mismatches and uncertain feedback are converted into durable review items.
4. **Calibration summaries**: operational rollups provide the model and routing signals needed for continuous improvement.

Dashboard rendering is intentionally excluded from this delivery, but this document maps exactly how dashboards should query the new data.

## Event model

### Router decisions (`router-decisions.jsonl`)

| Field              | Type                                 | Description                                                                 |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------------- |
| `decisionId`       | string                               | Stable identifier (`rd_*`) for cross-linking feedback and review artifacts. |
| `createdAt`        | ISO timestamp                        | Decision creation time.                                                     |
| `channelId`        | string                               | Channel source (for example `slack`).                                       |
| `conversationId`   | string?                              | Channel conversation identifier.                                            |
| `threadId`         | string?                              | Thread identifier for nearest-decision linking.                             |
| `inputMessageId`   | string?                              | Original inbound message identifier.                                        |
| `predictedTier`    | `T1..T4`                             | Router-assigned severity/tier.                                              |
| `predictedAction`  | `handle / escalate / defer / ignore` | Router action selection.                                                    |
| `confidence`       | number?                              | Optional model confidence for threshold tuning.                             |
| `reasonTags`       | string[]                             | Compact explanation tags for later slicing.                                 |
| `outcomeMessageId` | string?                              | Message id for the outbound router result.                                  |

### Router feedback (`router-feedback.jsonl`)

| Field                         | Type                             | Description                                             |
| ----------------------------- | -------------------------------- | ------------------------------------------------------- |
| `feedbackId`                  | string                           | Stable identifier (`rf_*`).                             |
| `createdAt`                   | ISO timestamp                    | Feedback capture timestamp.                             |
| `decisionId`                  | string?                          | Explicit decision reference when provided by caller.    |
| `linkedDecisionId`            | string?                          | Automatically resolved nearest decision in same thread. |
| `source`                      | `explicit / reaction / implicit` | Signal type.                                            |
| `actorId`                     | string?                          | Who supplied the feedback.                              |
| `channelId`                   | string                           | Channel source.                                         |
| `conversationId` / `threadId` | string?                          | Context for matching and analysis.                      |
| `feedbackMessageId`           | string?                          | Correction message identifier.                          |
| `expectedTier`                | `T1..T4`?                        | Human-expected tier.                                    |
| `expectedAction`              | action enum?                     | Human-expected action.                                  |
| `reaction`                    | string?                          | Raw reaction token when source is reaction-based.       |
| `freeText`                    | string?                          | Full correction text for reviewer context.              |
| `latencyFromDecisionSec`      | number?                          | Time-to-feedback metric.                                |
| `needsReview`                 | boolean                          | Queue creation gate.                                    |

### Review queue (`router-review-queue.jsonl`)

| Field              | Type                  | Description                      |
| ------------------ | --------------------- | -------------------------------- |
| `reviewId`         | string                | Stable identifier (`rv_*`).      |
| `createdAt`        | ISO timestamp         | Queue insertion time.            |
| `linkedDecisionId` | string                | Decision under review.           |
| `feedbackId`       | string                | Triggering feedback record.      |
| `severity`         | `low / medium / high` | Triage priority.                 |
| `reason`           | string                | Human-readable mismatch summary. |
| `status`           | `open / resolved`     | Review lifecycle state.          |

## Dashboard mapping (for future metrics UI)

## 1) Routing Quality Overview

**Primary questions**

- Are we improving tier/action accuracy over time?
- Is false escalation decreasing?

**Views**

- Time-series: `mismatchCount / totalFeedback`
- Time-series: `falseEscalationCount / totalDecisions`
- Breakdown by `channelId`, `predictedTier`, `predictedAction`

**Data sources**

- `router-decisions.jsonl`
- `router-feedback.jsonl`
- derived summary from `summarizeCalibrationWindow()`

## 2) Feedback Operations View

**Primary questions**

- Where is feedback coming from?
- Which corrections wait longest before review?

**Views**

- Stacked bars by `source` (`explicit|reaction|implicit`)
- Percent linked (`linkedDecisionId != null`)
- Percent requiring manual review (`needsReview=true`)
- Latency percentile cards (`latencyFromDecisionSec`)

**Data sources**

- `router-feedback.jsonl`

## 3) Review Queue Health

**Primary questions**

- Are review items accumulating?
- Do high-severity mismatches receive prompt attention?

**Views**

- Open queue size by `severity`
- Aging buckets (`<1h`, `1-24h`, `>24h`)
- Review throughput (`resolved/open` trend)

**Data sources**

- `router-review-queue.jsonl`
- join to decisions/feedback for context panes

## 4) Calibration and Rule Tuning

**Primary questions**

- Which reason tags are linked to repeated mismatch?
- Which tier confusions are most common?

**Views**

- Heatmap: predicted tier vs expected tier
- Confusion table by `reasonTags`
- Action mismatch matrix (predicted vs expected action)

**Data sources**

- join `router-decisions.jsonl` + `router-feedback.jsonl` on decision id

## Review cadence recommendation

- **Real-time:** auto-queue all high severity mismatches.
- **Daily:** summarize mismatch clusters and top reason tags.
- **Weekly:** update routing rubric and regression examples from resolved queue items.

## Implementation notes

- JSONL files are intentionally append-only to keep ingestion/simple shipping straightforward.
- The storage layer can be migrated to SQLite later without changing external record shapes.
- Feedback without a linked decision is retained and reviewable to avoid silent data loss.
