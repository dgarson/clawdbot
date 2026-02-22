# UTEE Phase-1 Canary Thresholds & Operational Runbook

**Generated:** 2026-02-22 00:15 MST
**Owner:** Roman (Ops Lead)
**Source PR:** `sandy/utee-phase1-observability`
**Canary config:** 5% traffic / 48h minimum

---

## 1. Alert Threshold Matrix

| Signal | Warning | Critical | Window | Action |
|--------|---------|----------|--------|--------|
| **Error rate delta** | +0.5% absolute | +2% absolute | 5m rolling | Critical → immediate rollback |
| **P99 tool latency delta** | +20ms | +50ms | 5m rolling | Critical → rollback + investigate |
| **P50 tool latency delta** | +5ms | +15ms | 5m rolling | Critical → rollback |
| **Gateway memory delta** | +50MB sustained | +100MB sustained | 10m rolling | Critical → rollback |
| **Crash/panic (any)** | N/A | Any occurrence | Immediate | Critical → rollback + incident |
| **Customer-visible behavior change** | N/A | Any report | Immediate | Critical → rollback + incident |
| **Log volume increase** | >2x baseline | >5x baseline | 15m | Critical → reduce log level |
| **Tool invocation count drop** | >10% drop | >30% drop | 10m | Warning → investigate; Critical → rollback |

### Rationale

- **Error rate +2%**: UTEE is pass-through; any error increase indicates unintended side-effect
- **P99 +50ms**: UTEE overhead measured at <1ms; 50x margin accounts for measurement noise
- **Memory +100MB**: In-memory maps bounded by tool count; unbounded growth = leak
- **Crash/panic**: Zero-tolerance; pass-through must never crash host process

---

## 2. Rollback Trigger Matrix

| Condition | Severity | Owner | Action | Verification |
|-----------|----------|-------|--------|--------------|
| Critical threshold breach | P0 | On-call | Immediate rollback via config | Log shows `[UTEE] Phase 1 disabled` |
| 2+ Warning thresholds within 30min | P1 | On-call | Escalate to Roman, prepare rollback | Await decision |
| Customer complaint (any) | P0 | On-call + David | Rollback + incident | Confirm in Slack #eng-utee-canary |
| Canary end (48h) with no triggers | P0 | Roman | Promote to 25% | Update traffic allocation |
| Canary end with warnings (no critical) | P1 | Roman + Tim | Extend canary 24h, re-evaluate | Update runbook notes |

### Rollback Procedure (5-minute target)

```bash
# Step 1: Disable UTEE (no restart required)
jq '.utee.enabled = false' openclaw.config.json > tmp.json && mv tmp.json openclaw.config.json

# Step 2: Trigger config reload (if not auto-reloading)
curl -X POST http://127.0.0.1:3000/admin/reload 2>/dev/null || echo "Manual restart required"

# Step 3: Verify disabled
grep -c "\[UTEE\] Phase 1 disabled" /var/log/openclaw/gateway.log | tail -1

# Step 4: Confirm metrics stop
curl -s http://127.0.0.1:9090/metrics | grep utee_invocation_count | head -5
# Should show no new increments over 60s

# Step 5: Log incident
echo "[ROLLBACK] $(date -Iseconds) UTEE disabled due to [reason]" >> /var/log/openclaw/utee-incidents.log
```

---

## 3. On-Call Checklist (Copy-Paste Ready)

### Pre-Canary Checklist
```
[ ] Canary branch merged to observability/main
[ ] Staging environment test passed (24h soak)
[ ] Dashboard configured: grafana → UTEE Canary Overview
[ ] Alerts configured in Prometheus (thresholds above)
[ ] On-call briefed (name: ____________)
[ ] Rollback command tested in staging
[ ] Slack channel #eng-utee-canary created/pinned
```

### During-Canary Monitoring (Every 4h)
```
[ ] Error rate delta < +0.5%
[ ] P99 latency delta < +20ms
[ ] Memory stable (no >50MB increase)
[ ] No crash/panic in gateway logs
[ ] Tool invocation counts normal (no >10% drop)
[ ] No customer complaints in #support
```

### Rollback Checklist
```
[ ] Threshold breached: _______________
[ ] Time of breach: _______________
[ ] Rollback command executed
[ ] Logs confirm UTEE disabled
[ ] Metrics confirm no new invocations
[ ] Incident logged: /var/log/openclaw/utee-incidents.log
[ ] Post-mortem scheduled: _______________
```

### Promote-to-25% Checklist
```
[ ] 48h elapsed with no critical triggers
[ ] All warnings documented and resolved
[ ] Roman + Tim sign-off obtained
[ ] Traffic allocation updated to 25%
[ ] Monitoring windows reset
```

---

## 4. Telemetry Queries

### Prometheus Queries (Direct Copy)

```promql
# Error rate delta (UTEE vs baseline)
sum(rate(tool_calls_total{status="error"}[5m])) 
  / sum(rate(tool_calls_total[5m])) 
  - sum(rate(tool_calls_total{status="error",utee="false"}[5m])) 
    / sum(rate(tool_calls_total{utee="false"}[5m]))

# P99 latency delta
histogram_quantile(0.99, sum(rate(tool_call_duration_seconds_bucket[5m])) by (le))
  - histogram_quantile(0.99, sum(rate(tool_call_duration_seconds_bucket{utee="false"}[5m])) by (le))

# Memory delta (if available)
process_resident_memory_bytes{job="openclaw-gateway"} 
  - process_resident_memory_bytes{job="openclaw-gateway",baseline="true"}

# Tool invocation count (detect drops)
sum(rate(utee_invocation_count_total[10m]))
```

### Log Queries (grep)

```bash
# UTEE invocations (last hour)
grep -c "utee_tool_invocation" /var/log/openclaw/gateway.log

# UTEE errors (last hour)
grep -c 'utee_tool_result.*status="error"' /var/log/openclaw/gateway.log

# Memory growth indicator (if logging allocation)
grep "UTEE.*alloc" /var/log/openclaw/gateway.log | tail -100

# Crash detection
grep -i "panic\|fatal\|crash" /var/log/openclaw/gateway.log | grep -i utee
```

### In-Process Metrics (if admin API available)

```bash
# Get current UTEE metrics snapshot
curl -s http://127.0.0.1:3000/admin/metrics/utee | jq .

# Expected output:
# {
#   "invocationCount": {"browser": 42, "exec": 31, ...},
#   "errorCount": {},
#   "avgDurationMs": {"browser": 1.2, "exec": 0.8},
#   "maxDurationMs": {"browser": 5, "exec": 3}
# }
```

---

## 5. Escalation Path

| Level | Who | When | Contact |
|-------|-----|------|---------|
| L1 | On-call | All alerts | PagerDuty/Slack |
| L2 | Roman | Warning threshold, pre-promote | Slack @roman |
| L3 | Tim + Xavier | Critical breach, promote decision | Slack @tim @xavier |
| L4 | David | Customer impact, rollback decision | Slack @david |

---

## 6. File References

| Artifact | Absolute Path |
|----------|---------------|
| Canary runbook (Sandy) | `/Users/openclaw/.openclaw/workspace/sandy/utee-phase1-canary-readiness.md` |
| UTEE adapter source | `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/utee-adapter.ts` |
| Config types | `/Users/openclaw/openclaw/worktrees/utee-phase1/src/config/types.utee.ts` |
| Test suite | `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/utee-adapter.test.ts` |
| **This document** | `/Users/openclaw/.openclaw/workspace/_shared/ops/utee-canary-thresholds.md` |

---

**Document version:** 1.0
**Last updated:** 2026-02-22 00:15 MST
**Next review:** Post-canary (48h+)
