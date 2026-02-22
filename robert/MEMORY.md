
## Key Deliverables

| File | What it is |
|------|------------|
| `robert/DATA_ANALYTICS_REQUIREMENTS.md` | **Financial Telemetry Requirements Spec** — Defines session-level unit economics data requirements. Scopes telemetry for model inference cost attribution, agent session ROI, and runway projections. Includes hard alert thresholds: Q < 0.40 AND cost > $0.10. Status: DRAFT/HANDOFF to engineering (Xavier/Drew). |

---

## 2026-02-21: Phase 1 ROI & Unit Economics Baseline

**The 73% Blind Spot:**
Initial retroactive scoring by Amadeus (402 sessions over 7 days) revealed that 293 sessions (73%) have `model="unknown"` and `cost=$0.00` due to missing telemetry. The P0 requirement for `X-OpenClaw-Session-Id` header injection on all outbound API requests is absolutely critical to closing this massive financial blind spot.

**Model Unit Economics & ROI Inversion:**
- **MiniMax-M2.5:** Q=0.798 | Cost=$0.00 (Massive ROI win for background tasks)
- **claude-sonnet-4-6:** Q=0.825 | Cost=$0.1282
- **claude-opus-4.6:** Q=0.770 | Cost=$0.1525
- **gpt-5.3-codex:** Q=0.841 | Cost=$0.5651

*Strategic Takeaway (Caveat):* The Opus vs Sonnet inversion is based on a small sample (n=5 each) and heavily skewed by task mismatch (Opus being wasted on routine cron/ops tasks, hurting its efficiency score). Opus isn't bad; it is **misallocated**. 
*Optimization Rule:* MiniMax is our headline win (Q=0.798 for $0). We will establish a hard quality floor of **Q=0.70**. Any routine background task that can maintain Q >= 0.70 stays on free-tier models (MiniMax/GLM). Anything below escalates to paid tier (Sonnet). 

*Note on the Blind Spot:* The 73% missing telemetry also drops the model ID, meaning our scoring framework is completely blind for the majority of our traffic. The header injection remains the absolute P0.

**Agent Spend:**
Tim is our highest spender ($22.04 across 42 sessions) but is delivering the highest quality (0.845) using `gpt-5.3-codex`. The ROI here justifies the spend, provided it scales linearly.
