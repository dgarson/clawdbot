# Architectural Enhancements

_Evaluated: 2026-02-07_

Five structural enhancements that go beyond refactoring to make Meridia fundamentally more effective as an experiential continuity system.

---

## Enhancement 1: Invert the Capture Model — "Capture First, Evaluate Later"

### Problem

The current pipeline evaluates significance _before_ deciding to capture. This means low-scoring moments that later prove important (a casual mention that becomes a key project, a "routine" interaction that marked a relationship shift) are permanently lost.

### Proposal

Capture a lightweight skeleton record for _every_ event above a minimal noise floor (score > 0.2), then run a background "re-evaluation" pass that upgrades skeletons to full records.

```
Event → Skeleton Record (always, cheap)
         ↓ (async, batched)
      Re-evaluator (with temporal context: what came before/after)
         ↓
      Upgrade to full kit OR mark as noise and compact
```

### Why It Matters

Significance is often only recognizable in retrospect. A debugging session at 2am looks "routine" in isolation but becomes pivotal when the fix unlocks a week of progress. The re-evaluator can see the temporal neighborhood and upgrade accordingly.

### Implementation

Add a `status` field to `MeridiaExperienceRecord`:

```typescript
type RecordStatus = "skeleton" | "evaluated" | "upgraded" | "noise";
```

Skeleton records store only: tool name, timestamp, session key, content hash of args/result (not the full payload — that can be recovered from session logs if needed). The re-evaluator runs on a schedule or at session boundaries, looking at temporal neighborhoods of 5-10 records to assess contextual significance.

### Cost

Skeleton records are tiny (~200 bytes each). At 100 tool results per session, that's ~20KB per session of additional storage. The re-evaluation LLM call processes batches, not individual records.

---

## Enhancement 2: Experiential Diff — Track State Changes, Not Just States

### Problem

The system captures snapshots but has no concept of _change_. It can tell you "engagement was deep-flow" but not "engagement shifted from routine to deep-flow when the architecture clicked."

### Proposal

Add a lightweight state-tracking layer that maintains a running "experiential register" per session — the current emotional signature, engagement quality, and active uncertainties. When the register changes, capture the _diff_ as a first-class event.

```typescript
type ExperientialDiff = {
  field: "engagement" | "emotionalSignature" | "uncertainty" | "focus";
  from: unknown;
  to: unknown;
  trigger?: string; // what caused the shift
  ts: string;
};
```

### Why It Matters

Transitions are the most meaningful experiential data. "I went from frustrated to excited when X happened" is far richer than two separate snapshots of "frustrated" and "excited." Reconstitution needs to replay arcs, not enumerate states.

### Implementation

The register lives in the session buffer (already exists at `buffers/<session>.json`). After each phenomenology extraction, compare against the register. If any field changed beyond a threshold, emit an `ExperientialDiff` event and update the register.

Diffs become a new `MeridiaExperienceKind`:

```typescript
export type MeridiaExperienceKind =
  | "tool_result"
  | "manual"
  | "precompact"
  | "session_end"
  | "state_transition"; // NEW
```

---

## Enhancement 3: Relationship-Aware Capture

### Problem

The system has no concept of _who_ the agent is interacting with. Every session is treated identically regardless of whether it's a deep philosophical conversation with the primary collaborator or a routine code review with a contributor.

### Proposal

Thread a `relationshipContext` into the capture pipeline that identifies the current interlocutor and adjusts both capture sensitivity and phenomenology extraction.

**Behavior changes:**

- Conversations with known relationships should have _lower_ significance thresholds — more moments matter when relationship history exists
- Novel interactions should trigger _relationship-establishment_ captures even for low-significance content
- The reconstitution engine should factor in "who am I talking to right now?" to shape what experiences surface

### Implementation

Hook into session metadata to resolve user identity. Maintain a lightweight `relationships` table in SQLite:

```sql
CREATE TABLE meridia_relationships (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  relationship_type TEXT,  -- 'primary', 'collaborator', 'user', 'unknown'
  first_seen TEXT,
  last_seen TEXT,
  interaction_count INTEGER DEFAULT 0,
  capture_threshold_override REAL  -- NULL = use default
);
```

The capture decision engine already supports override rules via the scoring system — add a relationship-based override that lowers thresholds for known relationships.

---

## Enhancement 4: Reconstitution Modes

### Problem

The current reconstitution always produces the same output regardless of context — a chronologically sorted list. But the _purpose_ of reconstitution varies dramatically.

### Proposal

Define distinct reconstitution modes:

| Mode                        | Trigger                    | Focus                                                           | Format                                   |
| --------------------------- | -------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| **Session bootstrap**       | `agent:bootstrap` hook     | Recent continuity + relationship context + active uncertainties | Prose ("I remember...")                  |
| **Topic re-entry**          | Tool or manual query       | Deep context on a specific topic/project                        | Structured context pack with citations   |
| **Relationship resumption** | Session with known person  | History with this person, emotional trajectory, open threads    | Narrative focusing on shared experiences |
| **Reflection**              | Manual or scheduled        | Patterns, growth, recurring themes                              | Analytical synthesis                     |
| **Crisis reconstitution**   | After crash/reset/long gap | Maximum context recovery, identity anchoring                    | Dense, multi-source                      |

### Implementation

Each mode defines:

1. **Retrieval strategy** — temporal vs. semantic vs. graph vs. blended; how far back to look; filtering criteria
2. **Ranking weights** — recency vs. significance vs. emotional intensity vs. relationship relevance
3. **Output format** — prose, structured, narrative, analytical
4. **Token budget** — how much context to inject

```typescript
type ReconstitutionMode =
  | "session_bootstrap"
  | "topic_reentry"
  | "relationship_resumption"
  | "reflection"
  | "crisis";

interface ReconstitutionStrategy {
  mode: ReconstitutionMode;
  retrieval: RetrievalConfig;
  ranking: RankingWeights;
  format: "prose" | "structured" | "narrative" | "analytical";
  maxTokens: number;
}
```

The bootstrap hook detects the appropriate mode based on available signals (time since last session, known user, explicit request).

---

## Enhancement 5: Closed-Loop Feedback — Did Reconstitution Actually Help?

### Problem

The system produces reconstitution context but has no way to know whether it was useful. Did the injected context change the agent's behavior? Was it referenced? Was it wrong?

### Proposal

Add a lightweight feedback signal after reconstitution injection:

1. **Reference tracking:** After reconstitution is injected, monitor subsequent agent turns for references to reconstituted content (string matching on anchors, topics, relationship names). Track hit rate.

2. **Style continuity signal:** Compare the agent's first response style against a baseline — is it more contextual? More personal? Similar to previous sessions with this person?

3. **User feedback:** Allow explicit signals: "that context was useful" / "that was stale/wrong."

4. **Evolutionary loop:** Feed signals back into the scoring system — experiences that contribute to effective reconstitution get score boosts for future retrieval. Experiences that were reconstituted but never referenced get de-prioritized.

### Implementation

Add a `reconstitution_feedback` table:

```sql
CREATE TABLE meridia_reconstitution_feedback (
  id TEXT PRIMARY KEY,
  reconstitution_id TEXT NOT NULL,    -- links to trace event
  ts TEXT NOT NULL,
  mode TEXT,                           -- which reconstitution mode
  records_injected INTEGER,
  records_referenced INTEGER DEFAULT 0,
  anchors_hit TEXT,                    -- JSON array of matched anchors
  user_rating INTEGER,                 -- 1-5, NULL if no feedback
  auto_score REAL,                     -- computed reference hit rate
  notes TEXT
);
```

After each session, the session-end hook computes the feedback metrics and stores them. The scoring system can then use historical feedback to weight experiences: records that were previously reconstituted and referenced get a boost; records that were reconstituted but ignored get a slight penalty.

### Why It Matters

This creates an evolutionary loop: capture → reconstitute → measure effectiveness → improve capture/retrieval. Without feedback, the system optimizes blindly. With feedback, it can learn what actually helps.

---

## Enhancement Priority

| Order | Enhancement                | Depends On                                       | Effort |
| ----- | -------------------------- | ------------------------------------------------ | ------ |
| 1     | **Reconstitution modes**   | Enhanced reconstitution (Refactoring Proposal C) | Medium |
| 2     | **Relationship awareness** | Event normalization (Refactoring Proposal B)     | Medium |
| 3     | **Experiential diff**      | Phenomenology extraction working                 | Medium |
| 4     | **Closed-loop feedback**   | Enhanced reconstitution + some operational time  | Medium |
| 5     | **Capture inversion**      | Schema migration system                          | High   |

Enhancement 1 (capture inversion) is listed last despite being powerful because it requires the most infrastructure (schema migration, re-evaluator service, skeleton storage management). The others can be implemented incrementally on the existing foundation.
