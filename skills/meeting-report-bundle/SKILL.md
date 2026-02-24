---
name: meeting-report-bundle
description: Generate a full meeting report markdown file plus a concise audio follow-up, with automatic detail-level selection and Slack DM delivery via the report-audio-dm script. Use for standups, planning, retros, incident reviews, stakeholder updates, and decision-heavy meetings.
---

# Meeting Report Bundle

Create two artifacts for each meeting:

1. `report.md` (comprehensive)
2. `audio-summary.mp3` (concise executive follow-up)

Use this skill for meeting outputs that need both deep documentation and quick audio distribution.

## Core rules

- Default `detail` is `auto` (deterministic rubric).
- Always produce both markdown and audio unless user explicitly asks otherwise.
- Audio must be generated and delivered through the existing script:
  `skills/report-audio-dm/scripts/generate-report-audio.sh`
- Archive meeting bundles under a shared meeting root.

## Detail selection

Use rubric and targets in:

- `references/detail-levels.md`

Use output structures in:

- `references/templates.md`

## Canonical script

Use:

`{baseDir}/scripts/create-meeting-report-bundle.sh`

Example:

```bash
{baseDir}/scripts/create-meeting-report-bundle.sh \
  --topic "Weekly engineering sync" \
  --meeting-type planning \
  --audience mixed \
  --risk medium \
  --decisions 3 \
  --blockers 1 \
  --detail auto \
  --report-file /tmp/meeting-report.md \
  --audio-file /tmp/meeting-audio-script.txt
```
