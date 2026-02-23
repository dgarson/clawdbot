# GLM-5 Model Upgrades — Quality Remediation

## Summary

Upgraded agent models from MiniMax-M2.5 and expensive GPT models to GLM-5 (zai provider) to address quality issues identified in the 2026-02-23 quality audit.

## Changes

### P0 — Jerry (Q score 0.659 → target 0.70+)
- **Agent:** Jerry
- **Change:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Rationale:** MiniMax-M2.5 under-powered for ops workflows requiring structured tool usage

### P1 — Main Ops Agents (14.3% below-floor rate)
- **Julia:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Stephan:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Tyler:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Claire:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Barry:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Harry:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Piper:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Quinn:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`
- **Reed:** `minimax-portal/MiniMax-M2.5` → `zai/glm-5`

### P2 — Cost Optimization (Tim & Drew heartbeat)
- **Tim:** `openai-codex/gpt-5.3-codex` → `zai/glm-5` (was $15.037/session)
- **Drew:** `openai/gpt-5.2` → `zai/glm-5` (was $1.50/session)

**Note:** openclaw.json does not have a separate heartbeat model config—changed main model which applies to all tasks including heartbeat.

## Why GLM-5?

- GLM-5 has reasoning capability (like MiniMax-M2.5) but with better structured ops performance
- Significantly lower cost than GPT-5.x models
- ZAI provider (zai/glm-5) is already configured in the auth profiles

## Success Metrics

After 5+ sessions per upgraded agent:
- **Jerry:** Q score ≥ 0.70
- **Julia, Stephan, Tyler, Claire:** Below-floor rate < 5%
- **Tim, Drew:** Session cost < $2.00 (heartbeat tasks)

## Notes

- Model definitions for MiniMax-M2.5 retained in config (may be needed for other use cases)
- Default fallback in `agents.defaults.model` unchanged (still has MiniMax-M2.5)
- Agents already on GLM-5 (Tony, Vince, Wes, Nalaa) unchanged

## Technical Note

The `openclaw.json` file is a local runtime config (`~/.openclaw/openclaw.json`) containing API secrets. It is NOT tracked in any git repository. The changes above have been applied directly to the local config file.

To version control these changes, Amadeus/Xavier should consider:
1. Creating a separate config repo for openclaw.json
2. Or using a secrets management solution

## Current GLM-5 Agents (post-upgrade)
```
julia, stephan, drew, tim, claire, tyler, tony, barry, jerry, harry, piper, quinn, reed, vince, wes, nalaa
```
