# Cost Tracker Extension

Per-agent cost tracking aggregation layer for OpenClaw.

## Features

- **Per-agent API spend tracking** - Tracks token counts × model pricing per agent
- **Per-run cost aggregation** - Calculates cost per agent × wave
- **Daily/weekly rollups** - Aggregates costs over configurable time windows
- **Budget guardrail alerts** - Logs warnings when spending exceeds thresholds

## Installation

This extension is included in the OpenClaw workspace. To enable it, add to your config:

```json
{
  "costTracker": {
    "telemetryPath": "/path/to/telemetry/jsonl",
    "outputPath": "/path/to/output/daily-costs.jsonl",
    "budget": {
      "dailyLimit": 100,
      "agentDailyLimit": 20,
      "enabled": true
    }
  }
}
```

## Configuration

| Field                    | Type    | Description                                       |
| ------------------------ | ------- | ------------------------------------------------- |
| `telemetryPath`          | string  | Path to telemetry JSONL directory                 |
| `outputPath`             | string  | Optional path for daily cost summary JSONL output |
| `budget.dailyLimit`      | number  | Daily budget threshold (USD)                      |
| `budget.agentDailyLimit` | number  | Per-agent daily budget threshold (USD)            |
| `budget.enabled`         | boolean | Enable budget alerts (default: true)              |

## CLI Usage

Generate a cost report for the last 24 hours:

```bash
npx tsx scripts/cost-report.ts --telemetryPath /path/to/telemetry
```

Options:

- `--hours <n>` - Hours to look back (default: 24)
- `--from <iso>` - Start time (ISO string, overrides --hours)
- `--to <iso>` - End time (ISO string, default: now)
- `--json` - Output JSON instead of human-readable

## Supported Models

The extension includes pricing for:

- MiniMax M2.5, M2, Text-01
- GLM-5, GLM-4, GLM-4-Flash
- Grok 4, 4-mini, 3, 3-mini, 2
- Claude Sonnet 4.6, Opus 4.6, Haiku 3.5
- GPT-4o, 4o-mini, 4-turbo
- DeepSeek Chat, Coder
- Gemini 2.0 Pro, Flash, 1.5 Pro, Flash
- Mistral Large, Small, Medium

## Architecture

```
extensions/cost-tracker/
├── index.ts           # Plugin entry point
├── package.json       # Extension manifest
└── src/
    ├── types.ts       # TypeScript interfaces
    ├── pricing.ts    # Model pricing table
    └── cost-aggregator.ts  # Cost computation logic
```
