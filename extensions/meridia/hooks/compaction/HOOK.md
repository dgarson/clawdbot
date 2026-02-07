---
name: compaction
description: "Consolidate experiences and build synthesized episodes for Graphiti"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧩",
        "events":
          [
            "agent:precompact",
            "agent:compaction:end",
            "agent:compaction:scheduled",
            "agent:compaction:manual",
          ],
        "requires": { "config": ["hooks.internal.entries.compaction.enabled"] },
        "install": [{ "id": "meridia", "kind": "plugin", "label": "Meridia plugin" }],
      },
  }
---

# Compaction (Meridia)

Memory consolidation and episode merging hook. Creates snapshots before auto-compaction and consolidates experiences into synthesized Graphiti episodes.

## Purpose

1. **Pre-compaction Snapshots**: Captures state before embedded-agent auto-compaction
2. **Experience Consolidation**: Merges similar experiences into synthesized records
3. **Graphiti Episode Building**: Creates consolidated episodes for knowledge graph ingestion
4. **Archive Management**: Archives or deletes compacted source records

## Compaction Strategies

### Scheduled (Default)

Runs on a schedule (e.g., hourly, daily) to consolidate accumulated experiences.

### On-Demand

Triggered manually via CLI or programmatic invocation for immediate consolidation.

### Session-Based

Consolidates experiences when a session ends or reaches a threshold.

## Configuration

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "compaction": {
          "enabled": true,
          "strategy": "scheduled",
          "scheduleIntervalHours": 4,
          "minExperiencesForCompaction": 5,
          "similarityThreshold": 0.7,
          "maxExperiencesPerEpisode": 20,
          "archiveCompactedRecords": true,
          "graphiti": {
            "enabled": true,
            "groupId": "meridia-experiences"
          }
        }
      }
    }
  }
}
```

### Options

| Option                        | Type    | Default               | Description                                                    |
| ----------------------------- | ------- | --------------------- | -------------------------------------------------------------- |
| `enabled`                     | boolean | false                 | Enable the compaction hook                                     |
| `strategy`                    | string  | "scheduled"           | Compaction strategy: "scheduled", "on_demand", "session_based" |
| `scheduleIntervalHours`       | number  | 4                     | Hours between scheduled compactions                            |
| `minExperiencesForCompaction` | number  | 5                     | Minimum experiences before triggering compaction               |
| `similarityThreshold`         | number  | 0.7                   | Threshold for grouping similar experiences (0-1)               |
| `maxExperiencesPerEpisode`    | number  | 20                    | Maximum experiences merged into single episode                 |
| `archiveCompactedRecords`     | boolean | true                  | Archive records after compaction (false = delete)              |
| `graphiti.enabled`            | boolean | true                  | Enable Graphiti episode creation                               |
| `graphiti.groupId`            | string  | "meridia-experiences" | Graphiti group ID for episodes                                 |

## Compaction Process

1. **Gather Candidates**: Query experiences eligible for compaction
   - Age > lookback window
   - Not previously compacted
   - Score >= minimum threshold

2. **Group by Similarity**: Cluster related experiences
   - By tool/topic affinity
   - By session proximity
   - By semantic similarity (when available)

3. **Synthesize Episodes**: Create consolidated records
   - Merge topics and summaries
   - Aggregate statistics
   - Preserve key anchors and facets

4. **Push to Graphiti**: Create episodes in knowledge graph
   - Structured episode format
   - Rich metadata and provenance
   - Cross-references to source records

5. **Archive/Delete Sources**: Clean up compacted records
   - Archive mode: mark as compacted, retain for audit
   - Delete mode: remove after successful push

## Events

| Event                        | Description                         |
| ---------------------------- | ----------------------------------- |
| `agent:precompact`           | Claude SDK auto-compaction starting |
| `agent:compaction:end`       | Claude SDK auto-compaction complete |
| `agent:compaction:scheduled` | Scheduled compaction trigger        |
| `agent:compaction:manual`    | Manual/CLI compaction trigger       |

## CLI Commands

```bash
# Trigger manual compaction
openclaw meridia compact --force

# View compaction status
openclaw meridia compact --status

# Dry-run to preview what would be compacted
openclaw meridia compact --dry-run
```
