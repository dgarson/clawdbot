# OpenClaw Observability Stack

Docker Compose stack providing full observability for OpenClaw: metrics, traces, and logs.

## Quick Start

```bash
docker compose -f observability/docker-compose.observability.yml up -d
```

## Services

| Service          | URL                                              | Purpose                               |
| ---------------- | ------------------------------------------------ | ------------------------------------- |
| **Grafana**      | [http://localhost:3000](http://localhost:3000)   | Unified dashboards (no auth required) |
| **Jaeger**       | [http://localhost:16686](http://localhost:16686) | Distributed tracing UI                |
| **Prometheus**   | [http://localhost:9090](http://localhost:9090)   | Metrics storage and queries           |
| **Loki**         | [http://localhost:3100](http://localhost:3100)   | Log aggregation                       |
| **Alertmanager** | [http://localhost:9093](http://localhost:9093)   | Alert routing                         |

## Prerequisites

1. **Docker** and **Docker Compose** v2+ installed
2. **OpenClaw gateway** running with OTel enabled:
   ```bash
   openclaw config set diagnostics.otel.enabled true
   ```
3. Gateway metrics endpoint active (`/metrics` on gateway port, default `18789`)

## Grafana Dashboards

Five dashboards are auto-provisioned on startup:

| Dashboard             | Description                                          |
| --------------------- | ---------------------------------------------------- |
| **OpenClaw Overview** | Gateway health, active sessions, request rates       |
| **Agent Metrics**     | Per-agent token usage, cost, and latency             |
| **Model Performance** | Model error rates, p50/p95/p99 latency distributions |
| **Cost Analysis**     | USD cost breakdown by model, provider, and agent     |
| **A/B Experiments**   | Side-by-side experiment variant comparison           |

## Architecture

```
┌─────────────┐     OTLP (gRPC/HTTP)     ┌─────────┐
│  OpenClaw   │ ──────────────────────── → │  Jaeger  │
│  Gateway    │                            └─────────┘
│             │     /metrics (HTTP)        ┌────────────┐
│             │ ──────────────────────── → │ Prometheus │
│             │                            └────────────┘
│  Log files  │                            ┌──────────┐     ┌──────┐
│ ~/.openclaw │ ← ─── tail ─────────────── │ Promtail │ ──→ │ Loki │
│   /logs/    │                            └──────────┘     └──────┘
└─────────────┘
                                           ┌─────────┐
                     All datasources ────→ │ Grafana  │
                                           └─────────┘
```

## Configuration

### Prometheus Scrape Target

By default, Prometheus scrapes the gateway at `host.docker.internal:18789`. If your gateway runs on a different port, update `prometheus/prometheus.yml`:

```yaml
static_configs:
  - targets: ["host.docker.internal:YOUR_PORT"]
```

### Log Directory

Promtail mounts `~/.openclaw/logs` read-only. If your logs are in a different location, update the volume mount in `docker-compose.observability.yml`.

### Alertmanager

Alertmanager starts with default config. To configure alert routing (Slack, PagerDuty, email), add an `alertmanager/alertmanager.yml` configuration file and mount it in the compose file.

## Stopping

```bash
docker compose -f observability/docker-compose.observability.yml down
```

To also remove stored data:

```bash
docker compose -f observability/docker-compose.observability.yml down -v
```
