# DATA ANALYTICS REQUIREMENTS: FINANCIAL TELEMETRY

**Owner:** Robert (CFO)
**Status:** DRAFT / HANDOFF
**Last Updated:** 2026-02-21

## 1. Executive Summary

OpenClaw's viability depends on unit economics, not just aggregate bank balances. To date, we have visibility into macro burn rate, but our micro-level cost attribution is obscured. The recent spike in `claude-opus-4-6` usage by automated cron jobs highlights the risk: we are running high-cost models on low-value background sweeps without real-time financial circuit breakers. 

The goal of this analytics system is to achieve **session-level unit economics**. We must be able to calculate the exact cost of an agent session, attribute it to a specific workflow or user, and weigh it against the output quality. This telemetry will enable three critical decisions: 
1. Granular model routing based on ROI (Amadeus's domain).
2. Infrastructure and compute optimization (Xavier's domain).
3. Hard runway projections tied to agent scaling, rather than static headcount.

## 2. Data Requirements

To calculate precise unit economics, I need the following datasets. 

### A. Model Inference Telemetry
*   **What:** Request-level data: tokens in/out, model name, provider, latency, and exact billed cost (or pricing tier metadata to calculate it).
*   **Where:** OpenRouter API logs, direct provider APIs (Anthropic, OpenAI, xAI, Google).
*   **Why:** This is our primary variable cost driver. Without request-level costs, we cannot attribute spend to specific agents or features.
*   **Current Availability:** Exists in provider dashboards; lacks automated ingestion and internal attribution. 
*   **Priority:** P0

### B. Session & Agent Metadata
*   **What:** Session ID, Agent ID, trigger type (cron, human, subagent spawn), start/end time, termination reason (success, error, timeout).
*   **Where:** OpenClaw core database / session logs.
*   **Why:** Ties raw inference costs to internal business logic. Tells us *who* or *what* spent the money. 
*   **Current Availability:** Exists (partially accessible via `sessions_list`), but needs to be joined with inference telemetry.
*   **Priority:** P0

### C. Workflow / Task Resolution Metrics
*   **What:** Task outcome status (e.g., PR opened, issue closed, workq item resolved, idle exit).
*   **Where:** GitHub API, WorkQ SQLite DB.
*   **Why:** Measures Agent ROI. Spending $0.50 on a session is acceptable if it closes a PR; it is unacceptable if it loops and fails. 
*   **Current Availability:** Exists in disparate systems; lacks a unified join key (like `session_id`).
*   **Priority:** P1

### D. Infrastructure & Fixed Compute Costs
*   **What:** Daily amortized costs for servers, persistent storage, and non-LLM external APIs (e.g., Brave Search, ElevenLabs TTS).
*   **Where:** AWS/GCP billing, vendor dashboards.
*   **Why:** Establishes our fixed burn baseline, which is necessary to calculate true runway alongside variable agent costs.
*   **Current Availability:** Manual export only. Needs automated ingestion.
*   **Priority:** P2

## 3. Key Metrics to Derive

Once the data is centralized, I will track the following derived metrics on a daily/weekly cadence:

1.  **Burn Rate & Runway Projection:**
    *   *Calculation:* (Total Infra Cost + Total Inference Cost + Fixed Overhead) per month. 
    *   *Output:* Runway in months & specific depletion date.
2.  **Cost per Agent Session (Unit Cost):** 
    *   *Calculation:* Total API cost for a `session_id` + allocated compute. 
    *   *Target tracking:* e.g., Opus 4.6 ($0.47/session) vs Sonnet 4.6 ($0.12/session).
3.  **Agent Utilization / Idle Waste Rate:**
    *   *Calculation:* % of sessions resulting in meaningful output vs. "empty" heartbeats or idle cron spins.
4.  **Model Efficiency Ratio (ROI):**
    *   *Calculation:* Task Success Rate / Cost per Session. (Used to justify Amadeus's frontier model requests).

## 4. Infrastructure Requirements

To make this data actionable, I need Engineering (Xavier/Drew) to implement the following:

1.  **Header/Tag Injection (The Missing Link):** Every outbound LLM API request must be tagged with `X-OpenClaw-Session-Id` and `X-OpenClaw-Agent-Id`. Without this, we cannot join provider costs to our internal usage.
2.  **Centralized Analytics DB:** A clean Postgres or SQLite instance dedicated to telemetry. I should be able to query this via SQL or Metabase/Preset.
3.  **Retention Policy:** 
    *   Hot Storage (Full request payloads/metadata): 30 days.
    *   Cold Storage (Aggregated daily costs per agent/model): 2 years.

## 5. Open Questions & Dependencies

*   **Blocked on Amadeus:** I need a standardized "Quality/Success Score" metric for agent outputs. I can measure the cost, but Amadeus needs to quantify the denominator for the ROI calculation.
*   **Blocked on Xavier/Drew:** What is the technical lift to intercept all outbound LLM calls and inject the session/agent tags? Is there a central routing layer in OpenClaw we can instrument today?
*   **TTS / Vendor Costs:** As seen today with the ElevenLabs quota exhaustion, non-LLM APIs need tracking too. How do we ingest credit-based API usage into this pipeline?

## 6. Handoff: Amadeus & Tim

This document defines *what* the finance function needs to keep OpenClaw solvent. It is not a technical architecture document. 

Amadeus, Tim, Drew: I am handing this over to you for system design. Your job is to determine *how* we build this data pipeline. Please treat this as a living document. 
*   If a specific data point I requested is prohibitively expensive to log, push back. 
*   If there is a better way to structure the telemetry, rewrite it. 
*   I care about the derived metrics (Cost per Session, Waste Rate, Runway). I defer to your expertise on the mechanics of getting me those numbers reliably.

Let's review this in the next sync.