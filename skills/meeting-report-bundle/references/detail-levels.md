# Detail Levels (Deterministic)

Use `--detail auto|brief|standard|deep`. Default: `auto`.

## Auto scoring rubric

Compute score:

- meeting type `incident` => +3
- audience `exec` => +2
- audience `mixed` => +1
- risk `high` => +2
- risk `medium` => +1
- decisions >= 4 => +1
- blockers >= 1 => +1

Map score:

- 0-2 => `brief`
- 3-5 => `standard`
- 6+ => `deep`

## Word targets

- `brief`
  - markdown: 400-700 words
  - audio script: 90-120 words
- `standard`
  - markdown: 800-1400 words
  - audio script: 140-220 words
- `deep`
  - markdown: 1600-2800 words
  - audio script: 180-300 words

## Quality constraints

- Audio script includes only: key decisions, blockers/risks, and owner-bound next actions.
- Markdown includes rationale and context, not just bullet summaries.
- If user explicitly requests a different depth, honor user request over rubric.
