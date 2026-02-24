# Horizon UI operator review and remediation plan

## Top UX misses (sorted by confidence and impact)

| Rank | UX miss                                                                                             | Confidence | Impact | Implemented now                                                |
| ---- | --------------------------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------- |
| 1    | No dedicated operator entrypoint; operators must hunt across many disconnected views                | High       | High   | ✅                                                             |
| 2    | No cohesive command-center workflow for budget + model + routing + tools in one place               | High       | High   | ✅                                                             |
| 3    | Event visibility fragmented; no unified tail-style stream with filtering for journals/routing/tools | High       | High   | ✅                                                             |
| 4    | AI-assisted operator actions missing (autosuggest/fix workflows are manual)                         | High       | High   | ✅                                                             |
| 5    | Operator knobs lack a single consolidated control panel for guardrails and runtime controls         | High       | High   | ✅                                                             |
| 6    | Inconsistent IA: too many equal-weight nav items with little role-based prioritization              | High       | Medium | ✅ (partial via new default entrypoint)                        |
| 7    | Weak decision-provenance readability in day-to-day operations workflows                             | Medium     | High   | ✅ (surface-level in command center + feedback telemetry work) |
| 8    | Poor transition from "detect" to "act" (few actionable shortcuts from insight surfaces)             | High       | Medium | ✅                                                             |
| 9    | Missing confidence cues for critical KPIs (warning/critical emphasis)                               | Medium     | Medium | ✅                                                             |
| 10   | Non-operator users and operators share the same default UX even when goals differ                   | Medium     | Medium | ✅ (operator alternate/default entrypoint)                     |

## Top 5 implemented in this change set

1. **Operator Command Center default entrypoint**
   - Added a dedicated `operator-dashboard` route entry in navigation.
   - Set the app default view/history to the operator command center.

2. **Cohesive operator dashboard**
   - Added one integrated view for live sessions, spend, model utilization, routing mismatch, and tool errors.
   - Added focus modes (`overview`, `budget`, `models`, `events`, `routing`, `copilot`) for role-oriented scanning.

3. **Specialized event viewer**
   - Added a tail-style event feed with source/type/severity metadata and live filtering.
   - Designed for journals, routing feedback, budget anomalies, and self-eval event categories.

4. **AI copilot + smart actions**
   - Added an in-dashboard copilot panel with pre-built smart actions:
     - routing threshold suggestions
     - budget anomaly investigation
     - incident summarization
     - tool reliability fix suggestions
   - Supports editable prompt + run/dry-run action affordances.

5. **Operator knobs panel**
   - Added consolidated controls for budget throttle, routing confidence floor, self-eval cadence, and event tail mode.
   - Keeps key operator guardrails in one location to reduce context switching.

## Remaining opportunities after this pass

- Role-based navigation pruning for non-operator personas.
- Real backend binding for event tails and knob writes (currently UX-ready surface).
- Per-card provenance drill-down drawers with direct links to logs and traces.
