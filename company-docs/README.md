# Company Knowledge Directory

Shared repository for significant analyses, braindumps, design docs, proposals, feedback, and other substantive documents produced by agents and collaborators.

## Structure

```
company-docs/
├── README.md           ← This file
├── REGISTRY.md         ← Top-level index of ALL documents
└── MM-DD-YY/           ← Per-day directory (two-digit year)
    ├── REGISTRY.md     ← Daily index
    └── <documents>     ← Filed docs or summaries with source references
```

## Filing Guidelines

- Use the `company-docs` skill when filing documents (trigger words: braindump, brainstorm, analysis, design, proposal, feedback, collaborate, research, memo, etc.)
- Concise/self-contained documents → file directly
- Long documents living elsewhere → file a summary with a `## Source` block referencing the original
- Update **both** registries (daily + top-level) on every filing
- Use kebab-case filenames and common tags (see SKILL.md)

## Date Format

Directories use `MM-DD-YY` (e.g., `02-22-26` for February 22, 2026).

## Finding Documents

```bash
grep -i "keyword" /Users/openclaw/.openclaw/workspace/company-docs/REGISTRY.md
```
