import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronDown,
  ChevronUp,
  Play,
  Search,
  Calendar,
  Filter,
} from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type RunStatus = "Completed" | "Failed" | "Cancelled";
type DateRangeFilter = "Today" | "Last 7 days" | "Last 30 days";
type StatusFilter = "All" | "Completed" | "Failed" | "Cancelled";
type FindingSeverity = "Critical" | "High" | "Medium" | "Low" | "Info";

interface AgentEntry {
  name: string;
  role: string;
}

interface FindingSummary {
  severity: FindingSeverity;
  count: number;
}

interface DiscoveryRun {
  id: string;
  status: RunStatus;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  agentCount: number;
  findingCount: number;
  agents: AgentEntry[];
  findings: FindingSummary[];
  config: Record<string, unknown>;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RUNS: DiscoveryRun[] = [
  {
    id: "run-7f3a2b",
    status: "Completed",
    startedAt: "2026-02-23T14:00:00Z",
    endedAt: "2026-02-23T14:47:00Z",
    durationMin: 47,
    agentCount: 5,
    findingCount: 12,
    agents: [
      { name: "Atlas", role: "AI Infrastructure" },
      { name: "Beacon", role: "Developer Tooling" },
      { name: "Carta", role: "Workflow Automation" },
      { name: "Delphi", role: "Observability" },
      { name: "Echo", role: "Security & Compliance" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 3 },
      { severity: "Medium", count: 4 },
      { severity: "Low", count: 3 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["AI Infrastructure", "Developer Tooling", "Workflow Automation", "Observability", "Security"],
    },
  },
  {
    id: "run-a1c9e4",
    status: "Failed",
    startedAt: "2026-02-23T10:00:00Z",
    endedAt: "2026-02-23T10:18:00Z",
    durationMin: 18,
    agentCount: 3,
    findingCount: 2,
    agents: [
      { name: "Fenix", role: "Data Platforms" },
      { name: "Gust", role: "Cost Optimization" },
      { name: "Helix", role: "ML/AI Platform" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 1 },
      { severity: "Medium", count: 1 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "partial",
      maxAgents: 3,
      waveCount: 1,
      timeoutMin: 30,
      domains: ["Data Platforms", "Cost Optimization", "ML/AI Platform"],
      error: "Agent timeout — Gust exceeded 30m limit",
    },
  },
  {
    id: "run-b82d1f",
    status: "Completed",
    startedAt: "2026-02-22T18:30:00Z",
    endedAt: "2026-02-22T19:24:00Z",
    durationMin: 54,
    agentCount: 6,
    findingCount: 19,
    agents: [
      { name: "Iris", role: "Product Analytics" },
      { name: "Jade", role: "API Design" },
      { name: "Kestrel", role: "Frontend Platform" },
      { name: "Luna", role: "Auth & Identity" },
      { name: "Mira", role: "Notifications" },
      { name: "Nova", role: "Search & Discovery" },
    ],
    findings: [
      { severity: "Critical", count: 2 },
      { severity: "High", count: 5 },
      { severity: "Medium", count: 7 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 6,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Product Analytics", "API Design", "Frontend Platform", "Auth & Identity", "Notifications", "Search"],
    },
  },
  {
    id: "run-c34f78",
    status: "Cancelled",
    startedAt: "2026-02-22T09:00:00Z",
    endedAt: "2026-02-22T09:11:00Z",
    durationMin: 11,
    agentCount: 4,
    findingCount: 0,
    agents: [
      { name: "Orion", role: "Billing & Payments" },
      { name: "Pulse", role: "Infrastructure" },
      { name: "Quest", role: "Onboarding" },
      { name: "Raze", role: "Experiments" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 0 },
      { severity: "Medium", count: 0 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "targeted",
      maxAgents: 4,
      waveCount: 2,
      timeoutMin: 45,
      domains: ["Billing & Payments", "Infrastructure", "Onboarding", "Experiments"],
      cancelledBy: "david@example.com",
      cancelReason: "Manual stop — config error detected",
    },
  },
  {
    id: "run-d5e912",
    status: "Completed",
    startedAt: "2026-02-21T20:00:00Z",
    endedAt: "2026-02-21T21:02:00Z",
    durationMin: 62,
    agentCount: 7,
    findingCount: 24,
    agents: [
      { name: "Sigma", role: "Storage & Databases" },
      { name: "Terra", role: "Compute" },
      { name: "Umbra", role: "Networking" },
      { name: "Vega", role: "Logging & Tracing" },
      { name: "Wren", role: "CDN & Caching" },
      { name: "Xero", role: "Rate Limiting" },
      { name: "Yarn", role: "Queue Systems" },
    ],
    findings: [
      { severity: "Critical", count: 3 },
      { severity: "High", count: 6 },
      { severity: "Medium", count: 8 },
      { severity: "Low", count: 5 },
      { severity: "Info", count: 2 },
    ],
    config: {
      mode: "full",
      maxAgents: 7,
      waveCount: 3,
      timeoutMin: 90,
      domains: ["Storage & Databases", "Compute", "Networking", "Logging & Tracing", "CDN & Caching", "Rate Limiting", "Queue Systems"],
    },
  },
  {
    id: "run-e7a031",
    status: "Completed",
    startedAt: "2026-02-21T14:15:00Z",
    endedAt: "2026-02-21T14:58:00Z",
    durationMin: 43,
    agentCount: 5,
    findingCount: 9,
    agents: [
      { name: "Atlas", role: "AI Infrastructure" },
      { name: "Beacon", role: "Developer Tooling" },
      { name: "Carta", role: "Workflow Automation" },
      { name: "Delphi", role: "Observability" },
      { name: "Echo", role: "Security & Compliance" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 2 },
      { severity: "Medium", count: 4 },
      { severity: "Low", count: 2 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "incremental",
      maxAgents: 5,
      waveCount: 2,
      timeoutMin: 60,
      domains: ["AI Infrastructure", "Developer Tooling", "Workflow Automation"],
    },
  },
  {
    id: "run-f1b563",
    status: "Failed",
    startedAt: "2026-02-20T16:00:00Z",
    endedAt: "2026-02-20T16:09:00Z",
    durationMin: 9,
    agentCount: 2,
    findingCount: 0,
    agents: [
      { name: "Fenix", role: "Data Platforms" },
      { name: "Gust", role: "Cost Optimization" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 0 },
      { severity: "Medium", count: 0 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "partial",
      maxAgents: 2,
      waveCount: 1,
      timeoutMin: 20,
      domains: ["Data Platforms", "Cost Optimization"],
      error: "Auth token expired mid-run",
    },
  },
  {
    id: "run-g3d847",
    status: "Completed",
    startedAt: "2026-02-20T10:30:00Z",
    endedAt: "2026-02-20T11:22:00Z",
    durationMin: 52,
    agentCount: 5,
    findingCount: 16,
    agents: [
      { name: "Helix", role: "ML/AI Platform" },
      { name: "Iris", role: "Product Analytics" },
      { name: "Jade", role: "API Design" },
      { name: "Kestrel", role: "Frontend Platform" },
      { name: "Luna", role: "Auth & Identity" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 4 },
      { severity: "Medium", count: 6 },
      { severity: "Low", count: 3 },
      { severity: "Info", count: 2 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["ML/AI Platform", "Product Analytics", "API Design", "Frontend Platform", "Auth & Identity"],
    },
  },
  // Page 2
  {
    id: "run-h9f213",
    status: "Completed",
    startedAt: "2026-02-19T19:00:00Z",
    endedAt: "2026-02-19T19:55:00Z",
    durationMin: 55,
    agentCount: 6,
    findingCount: 21,
    agents: [
      { name: "Mira", role: "Notifications" },
      { name: "Nova", role: "Search & Discovery" },
      { name: "Orion", role: "Billing & Payments" },
      { name: "Pulse", role: "Infrastructure" },
      { name: "Quest", role: "Onboarding" },
      { name: "Raze", role: "Experiments" },
    ],
    findings: [
      { severity: "Critical", count: 2 },
      { severity: "High", count: 5 },
      { severity: "Medium", count: 8 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 2 },
    ],
    config: {
      mode: "full",
      maxAgents: 6,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Notifications", "Search & Discovery", "Billing & Payments", "Infrastructure", "Onboarding", "Experiments"],
    },
  },
  {
    id: "run-i2c590",
    status: "Cancelled",
    startedAt: "2026-02-19T09:45:00Z",
    endedAt: "2026-02-19T09:52:00Z",
    durationMin: 7,
    agentCount: 3,
    findingCount: 0,
    agents: [
      { name: "Sigma", role: "Storage & Databases" },
      { name: "Terra", role: "Compute" },
      { name: "Umbra", role: "Networking" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 0 },
      { severity: "Medium", count: 0 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "targeted",
      maxAgents: 3,
      waveCount: 2,
      timeoutMin: 30,
      domains: ["Storage & Databases", "Compute", "Networking"],
      cancelledBy: "ops-bot",
      cancelReason: "Scheduled maintenance window",
    },
  },
  {
    id: "run-j4e876",
    status: "Completed",
    startedAt: "2026-02-18T17:00:00Z",
    endedAt: "2026-02-18T17:49:00Z",
    durationMin: 49,
    agentCount: 5,
    findingCount: 13,
    agents: [
      { name: "Vega", role: "Logging & Tracing" },
      { name: "Wren", role: "CDN & Caching" },
      { name: "Xero", role: "Rate Limiting" },
      { name: "Yarn", role: "Queue Systems" },
      { name: "Zeta", role: "Event Streaming" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 3 },
      { severity: "Medium", count: 5 },
      { severity: "Low", count: 3 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Logging & Tracing", "CDN & Caching", "Rate Limiting", "Queue Systems", "Event Streaming"],
    },
  },
  {
    id: "run-k6b142",
    status: "Failed",
    startedAt: "2026-02-17T11:00:00Z",
    endedAt: "2026-02-17T11:23:00Z",
    durationMin: 23,
    agentCount: 4,
    findingCount: 3,
    agents: [
      { name: "Atlas", role: "AI Infrastructure" },
      { name: "Beacon", role: "Developer Tooling" },
      { name: "Carta", role: "Workflow Automation" },
      { name: "Delphi", role: "Observability" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 1 },
      { severity: "Medium", count: 2 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "incremental",
      maxAgents: 4,
      waveCount: 2,
      timeoutMin: 45,
      domains: ["AI Infrastructure", "Developer Tooling", "Workflow Automation", "Observability"],
      error: "Carta agent crashed — unhandled exception in wave 2",
    },
  },
  {
    id: "run-l8f304",
    status: "Completed",
    startedAt: "2026-02-16T20:30:00Z",
    endedAt: "2026-02-16T21:27:00Z",
    durationMin: 57,
    agentCount: 6,
    findingCount: 18,
    agents: [
      { name: "Echo", role: "Security & Compliance" },
      { name: "Fenix", role: "Data Platforms" },
      { name: "Gust", role: "Cost Optimization" },
      { name: "Helix", role: "ML/AI Platform" },
      { name: "Iris", role: "Product Analytics" },
      { name: "Jade", role: "API Design" },
    ],
    findings: [
      { severity: "Critical", count: 2 },
      { severity: "High", count: 4 },
      { severity: "Medium", count: 7 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 6,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Security & Compliance", "Data Platforms", "Cost Optimization", "ML/AI Platform", "Product Analytics", "API Design"],
    },
  },
  {
    id: "run-m0a561",
    status: "Completed",
    startedAt: "2026-02-15T14:00:00Z",
    endedAt: "2026-02-15T14:44:00Z",
    durationMin: 44,
    agentCount: 4,
    findingCount: 10,
    agents: [
      { name: "Kestrel", role: "Frontend Platform" },
      { name: "Luna", role: "Auth & Identity" },
      { name: "Mira", role: "Notifications" },
      { name: "Nova", role: "Search & Discovery" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 2 },
      { severity: "Medium", count: 5 },
      { severity: "Low", count: 2 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "targeted",
      maxAgents: 4,
      waveCount: 2,
      timeoutMin: 60,
      domains: ["Frontend Platform", "Auth & Identity", "Notifications", "Search & Discovery"],
    },
  },
  {
    id: "run-n2d789",
    status: "Cancelled",
    startedAt: "2026-02-14T09:00:00Z",
    endedAt: "2026-02-14T09:06:00Z",
    durationMin: 6,
    agentCount: 5,
    findingCount: 0,
    agents: [
      { name: "Orion", role: "Billing & Payments" },
      { name: "Pulse", role: "Infrastructure" },
      { name: "Quest", role: "Onboarding" },
      { name: "Raze", role: "Experiments" },
      { name: "Sigma", role: "Storage & Databases" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 0 },
      { severity: "Medium", count: 0 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Billing & Payments", "Infrastructure", "Onboarding", "Experiments", "Storage & Databases"],
      cancelledBy: "david@example.com",
      cancelReason: "Replacing with updated config",
    },
  },
  // Page 3
  {
    id: "run-o4c012",
    status: "Completed",
    startedAt: "2026-02-13T17:30:00Z",
    endedAt: "2026-02-13T18:22:00Z",
    durationMin: 52,
    agentCount: 5,
    findingCount: 15,
    agents: [
      { name: "Terra", role: "Compute" },
      { name: "Umbra", role: "Networking" },
      { name: "Vega", role: "Logging & Tracing" },
      { name: "Wren", role: "CDN & Caching" },
      { name: "Xero", role: "Rate Limiting" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 3 },
      { severity: "Medium", count: 6 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Compute", "Networking", "Logging & Tracing", "CDN & Caching", "Rate Limiting"],
    },
  },
  {
    id: "run-p6e234",
    status: "Completed",
    startedAt: "2026-02-12T11:00:00Z",
    endedAt: "2026-02-12T11:51:00Z",
    durationMin: 51,
    agentCount: 6,
    findingCount: 20,
    agents: [
      { name: "Yarn", role: "Queue Systems" },
      { name: "Zeta", role: "Event Streaming" },
      { name: "Atlas", role: "AI Infrastructure" },
      { name: "Beacon", role: "Developer Tooling" },
      { name: "Carta", role: "Workflow Automation" },
      { name: "Delphi", role: "Observability" },
    ],
    findings: [
      { severity: "Critical", count: 2 },
      { severity: "High", count: 6 },
      { severity: "Medium", count: 7 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 6,
      waveCount: 3,
      timeoutMin: 75,
      domains: ["Queue Systems", "Event Streaming", "AI Infrastructure", "Developer Tooling", "Workflow Automation", "Observability"],
    },
  },
  {
    id: "run-q8a456",
    status: "Failed",
    startedAt: "2026-02-11T14:30:00Z",
    endedAt: "2026-02-11T14:41:00Z",
    durationMin: 11,
    agentCount: 3,
    findingCount: 1,
    agents: [
      { name: "Echo", role: "Security & Compliance" },
      { name: "Fenix", role: "Data Platforms" },
      { name: "Gust", role: "Cost Optimization" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 1 },
      { severity: "Medium", count: 0 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "targeted",
      maxAgents: 3,
      waveCount: 1,
      timeoutMin: 30,
      domains: ["Security & Compliance", "Data Platforms", "Cost Optimization"],
      error: "Network partition — agents lost coordination",
    },
  },
  {
    id: "run-r0b678",
    status: "Completed",
    startedAt: "2026-02-10T09:00:00Z",
    endedAt: "2026-02-10T09:58:00Z",
    durationMin: 58,
    agentCount: 5,
    findingCount: 17,
    agents: [
      { name: "Helix", role: "ML/AI Platform" },
      { name: "Iris", role: "Product Analytics" },
      { name: "Jade", role: "API Design" },
      { name: "Kestrel", role: "Frontend Platform" },
      { name: "Luna", role: "Auth & Identity" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 4 },
      { severity: "Medium", count: 7 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["ML/AI Platform", "Product Analytics", "API Design", "Frontend Platform", "Auth & Identity"],
    },
  },
  {
    id: "run-s2d901",
    status: "Completed",
    startedAt: "2026-02-09T18:00:00Z",
    endedAt: "2026-02-09T18:46:00Z",
    durationMin: 46,
    agentCount: 4,
    findingCount: 11,
    agents: [
      { name: "Mira", role: "Notifications" },
      { name: "Nova", role: "Search & Discovery" },
      { name: "Orion", role: "Billing & Payments" },
      { name: "Pulse", role: "Infrastructure" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 3 },
      { severity: "Medium", count: 5 },
      { severity: "Low", count: 2 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "incremental",
      maxAgents: 4,
      waveCount: 2,
      timeoutMin: 60,
      domains: ["Notifications", "Search & Discovery", "Billing & Payments", "Infrastructure"],
    },
  },
  {
    id: "run-t4f123",
    status: "Cancelled",
    startedAt: "2026-02-08T10:15:00Z",
    endedAt: "2026-02-08T10:20:00Z",
    durationMin: 5,
    agentCount: 6,
    findingCount: 0,
    agents: [
      { name: "Quest", role: "Onboarding" },
      { name: "Raze", role: "Experiments" },
      { name: "Sigma", role: "Storage & Databases" },
      { name: "Terra", role: "Compute" },
      { name: "Umbra", role: "Networking" },
      { name: "Vega", role: "Logging & Tracing" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 0 },
      { severity: "Medium", count: 0 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "full",
      maxAgents: 6,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Onboarding", "Experiments", "Storage & Databases", "Compute", "Networking", "Logging & Tracing"],
      cancelledBy: "ops-bot",
      cancelReason: "Emergency config rollback",
    },
  },
  {
    id: "run-u6a345",
    status: "Completed",
    startedAt: "2026-02-07T14:00:00Z",
    endedAt: "2026-02-07T14:53:00Z",
    durationMin: 53,
    agentCount: 5,
    findingCount: 14,
    agents: [
      { name: "Wren", role: "CDN & Caching" },
      { name: "Xero", role: "Rate Limiting" },
      { name: "Yarn", role: "Queue Systems" },
      { name: "Zeta", role: "Event Streaming" },
      { name: "Atlas", role: "AI Infrastructure" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 3 },
      { severity: "Medium", count: 6 },
      { severity: "Low", count: 3 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["CDN & Caching", "Rate Limiting", "Queue Systems", "Event Streaming", "AI Infrastructure"],
    },
  },
  {
    id: "run-v8c567",
    status: "Failed",
    startedAt: "2026-02-06T09:30:00Z",
    endedAt: "2026-02-06T09:47:00Z",
    durationMin: 17,
    agentCount: 3,
    findingCount: 2,
    agents: [
      { name: "Beacon", role: "Developer Tooling" },
      { name: "Carta", role: "Workflow Automation" },
      { name: "Delphi", role: "Observability" },
    ],
    findings: [
      { severity: "Critical", count: 0 },
      { severity: "High", count: 1 },
      { severity: "Medium", count: 1 },
      { severity: "Low", count: 0 },
      { severity: "Info", count: 0 },
    ],
    config: {
      mode: "partial",
      maxAgents: 3,
      waveCount: 1,
      timeoutMin: 30,
      domains: ["Developer Tooling", "Workflow Automation", "Observability"],
      error: "Delphi agent OOM — exceeded 8GB memory limit",
    },
  },
  {
    id: "run-w0e789",
    status: "Completed",
    startedAt: "2026-02-05T16:30:00Z",
    endedAt: "2026-02-05T17:21:00Z",
    durationMin: 51,
    agentCount: 5,
    findingCount: 16,
    agents: [
      { name: "Echo", role: "Security & Compliance" },
      { name: "Fenix", role: "Data Platforms" },
      { name: "Gust", role: "Cost Optimization" },
      { name: "Helix", role: "ML/AI Platform" },
      { name: "Iris", role: "Product Analytics" },
    ],
    findings: [
      { severity: "Critical", count: 1 },
      { severity: "High", count: 4 },
      { severity: "Medium", count: 6 },
      { severity: "Low", count: 4 },
      { severity: "Info", count: 1 },
    ],
    config: {
      mode: "full",
      maxAgents: 5,
      waveCount: 3,
      timeoutMin: 60,
      domains: ["Security & Compliance", "Data Platforms", "Cost Optimization", "ML/AI Platform", "Product Analytics"],
    },
  },
];

const RUNS_PER_PAGE = 8;
const TOTAL_PAGES = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RunStatus }) {
  const cfg: Record<RunStatus, { cls: string; Icon: React.ElementType; label: string }> = {
    Completed: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", Icon: CheckCircle2, label: "Completed" },
    Failed: { cls: "bg-red-500/15 text-red-400 border-red-500/30", Icon: XCircle, label: "Failed" },
    Cancelled: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", Icon: Ban, label: "Cancelled" },
  };
  const { cls, Icon, label } = cfg[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity, count }: { severity: FindingSeverity; count: number }) {
  const cfg: Record<FindingSeverity, string> = {
    Critical: "bg-red-500/15 text-red-400 border-red-500/30",
    High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    Info: "bg-zinc-700/60 text-zinc-400 border-zinc-600",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">{severity}</span>
      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", cfg[severity])}>
        {count}
      </span>
    </div>
  );
}

// ─── Run List Row ─────────────────────────────────────────────────────────────

function RunRow({
  run,
  selected,
  onClick,
}: {
  run: DiscoveryRun;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-zinc-800 transition-colors",
        selected
          ? "bg-violet-600/10 border-l-2 border-l-violet-500"
          : "hover:bg-zinc-800/50 border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-sm text-white font-medium">{run.id}</span>
        <StatusBadge status={run.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatShortTime(run.startedAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(run.durationMin)}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {run.agentCount}
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {run.findingCount} findings
        </span>
      </div>
    </button>
  );
}

// ─── Run Detail Panel ─────────────────────────────────────────────────────────

function RunDetailPanel({ run }: { run: DiscoveryRun }) {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-mono text-lg font-semibold text-white mb-1">{run.id}</h2>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              onClick={() => {/* nav to DiscoveryFindings */}}
            >
              View Findings
            </button>
            <div className="relative group">
              <button
                disabled
                className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-500 text-sm font-medium cursor-not-allowed flex items-center gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                Replay This Run
              </button>
              <div className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block w-64 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-300 shadow-xl">
                Replay requires active discovery configuration
              </div>
            </div>
          </div>
        </div>

        {/* Timestamps + Duration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Started</p>
            <p className="text-sm text-zinc-300">{formatTimestamp(run.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Ended</p>
            <p className="text-sm text-zinc-300">{formatTimestamp(run.endedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Duration</p>
            <p className="text-sm text-zinc-300">{formatDuration(run.durationMin)}</p>
          </div>
        </div>
      </div>

      {/* Agents */}
      <div className="p-6 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-400" />
          Agents ({run.agentCount})
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {run.agents.map((agent) => (
            <div key={agent.name} className="flex items-center gap-2 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-violet-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{agent.name}</p>
                <p className="text-xs text-zinc-400 truncate">{agent.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Finding Summary */}
      <div className="p-6 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-zinc-400" />
          Findings by Severity
        </h3>
        <div className="rounded-md bg-zinc-800 border border-zinc-700 divide-y divide-zinc-700/60 overflow-hidden">
          {run.findings.map((f) => (
            <div key={f.severity} className="px-4 py-2.5">
              <SeverityBadge severity={f.severity} count={f.count} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Total: {run.findingCount} finding{run.findingCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Raw Config */}
      <div className="p-6">
        <button
          onClick={() => setConfigOpen((o) => !o)}
          className="flex w-full items-center justify-between text-sm font-semibold text-white mb-3 hover:text-zinc-300 transition-colors"
        >
          <span>Raw Configuration</span>
          {configOpen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </button>
        {configOpen && (
          <pre className="rounded-md bg-zinc-950 border border-zinc-700 p-4 text-xs text-zinc-300 overflow-x-auto leading-relaxed">
            {JSON.stringify(run.config, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="h-12 w-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
        <Search className="h-6 w-6 text-zinc-500" />
      </div>
      <p className="text-white font-medium mb-1">Select a run</p>
      <p className="text-sm text-zinc-500">Click any run in the list to view its details</p>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function DiscoveryRunHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("Last 30 days");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Filter
  const filtered = MOCK_RUNS.filter((r) => {
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (dateFilter === "Today") {
      const today = new Date("2026-02-23");
      const start = new Date(r.startedAt);
      return start.toDateString() === today.toDateString();
    }
    if (dateFilter === "Last 7 days") {
      const cutoff = new Date("2026-02-16T00:00:00Z");
      return new Date(r.startedAt) >= cutoff;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / RUNS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRuns = filtered.slice((safePage - 1) * RUNS_PER_PAGE, safePage * RUNS_PER_PAGE);
  const selectedRun = MOCK_RUNS.find((r) => r.id === selectedRunId) ?? null;

  // Reset page when filter changes
  const handleStatusFilter = (f: StatusFilter) => {
    setStatusFilter(f);
    setPage(1);
    setSelectedRunId(null);
  };

  const handleDateFilter = (f: DateRangeFilter) => {
    setDateFilter(f);
    setPage(1);
    setSelectedRunId(null);
  };

  const statusOptions: StatusFilter[] = ["All", "Completed", "Failed", "Cancelled"];
  const dateOptions: DateRangeFilter[] = ["Today", "Last 7 days", "Last 30 days"];

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Page Header */}
      <div className="px-6 py-5 border-b border-zinc-800 flex-shrink-0">
        <h1 className="text-xl font-semibold text-white">Discovery Run History</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Audit, compare, and replay past discovery runs — {MOCK_RUNS.length} runs total
        </p>
      </div>

      {/* Body: master-detail */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Panel ── */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-zinc-800">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-zinc-800 space-y-2 flex-shrink-0">
            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              <div className="flex gap-1 flex-wrap">
                {statusOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleStatusFilter(opt)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      statusFilter === opt
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            {/* Date range filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              <div className="flex gap-1 flex-wrap">
                {dateOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleDateFilter(opt)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      dateFilter === opt
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Run list */}
          <div className="flex-1 overflow-y-auto">
            {pageRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <p className="text-sm text-zinc-500">No runs match your filters</p>
              </div>
            ) : (
              pageRuns.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  selected={run.id === selectedRunId}
                  onClick={() => setSelectedRunId(run.id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 flex-shrink-0">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                safePage <= 1
                  ? "text-zinc-600 cursor-not-allowed"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-xs text-zinc-500">
              Page {safePage} of {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                safePage >= totalPages
                  ? "text-zinc-600 cursor-not-allowed"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800"
              )}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 min-w-0">
          {selectedRun ? (
            <RunDetailPanel run={selectedRun} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
