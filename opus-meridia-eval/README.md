# Meridia Evaluation — Opus Review (2026-02-07)

Independent architectural review and validation framework for the Meridia experiential continuity system.

## Documents

| Document                                                     | Contents                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [STATE-OF-SYSTEM.md](STATE-OF-SYSTEM.md)                     | Current implementation vs. architecture scorecard, what works, what's missing   |
| [DIVERGENCES.md](DIVERGENCES.md)                             | Where implementation departed from design intent, with code references          |
| [GAP-ANALYSIS.md](GAP-ANALYSIS.md)                           | Prioritized gap inventory mapped to long-term viability                         |
| [REFACTORING-PROPOSALS.md](REFACTORING-PROPOSALS.md)         | Concrete simplification and restructuring suggestions                           |
| [ARCHITECTURE-ENHANCEMENTS.md](ARCHITECTURE-ENHANCEMENTS.md) | Five structural enhancements to make the system fundamentally more effective    |
| [VALIDATION-EXPERIMENTS.md](VALIDATION-EXPERIMENTS.md)       | Six falsifiable experiments to determine whether Meridia is working as intended |

## Source Material Reviewed

### Implementation (47 files)

- `extensions/meridia/` — full source tree including hooks, tools, CLI, DB, scoring, search adapter

### Design Documents

- `extensions/meridia/ARCH.md` — canonical architecture
- `extensions/meridia/COMPONENT-MAP.md` — 14-component reference model
- `docs/design/MERIDIA-V2-PROPOSAL.md` — phenomenology activation proposal
- `docs/design/meridia-graph-memory.md` — graph memory design
- `docs/experiential-engine/EXPERIENTIAL-CONTINUITY-PROJECT.md` — foundational project document
- `docs/experiential-engine/architecture/DATA-PERSISTENCE-ARCHITECTURE.md` — storage analysis
- `docs/experiential-engine/architecture/EVENT-SYSTEM-DESIGN.md` — event-driven capture design
- `docs/experiential-engine/architecture/MEMORY-AUDIT.md` — persistence systems audit
- `docs/experiential-engine/architecture/MEMORY-CLASSIFICATION.md` — three memory types framework
- `docs/experiential-engine/SKILL.md` — tool documentation
- 7 component deep-dive docs under `extensions/meridia/docs/components/`
- 3 JSON schemas, 5 tool prototypes, 3 hook prototypes under `docs/experiential-engine/`

## Key Finding

Meridia has a solid capture-and-search foundation (SQLite, hooks, scoring) but the core thesis — experiential continuity through phenomenological capture and state-restoration reconstitution — is designed but not implemented. The system currently functions as a scored tool-result log, not an experiential memory system. The gap is addressable; the foundation is sound.
