# Web Next RPC and Views Map

Generated from source on 2026-02-24T14:52:22.711Z.

## Scope

- Source of truth for routed views: `apps/web-next/src/App.tsx` (`navItems` + `renderView` switch).
- RPC usage scan: `apps/web-next/src/**` for `call(...)`/`gateway.call(...)`, plus derived hook methods from `useWizard` and `useMissionControl`.
- Backend availability check: `src/gateway/server-methods-list.ts` and `src/gateway/server-methods/**`.

## Coverage Summary

- Total nav-routed views: **289**
- Views with direct/derived RPC methods: **3**
- Views that are gateway-aware only (connection status, no RPC calls): **1**
- Views with no RPC wiring (UI-only): **285**
- Nav IDs missing switch routes: **0**
- Switch routes missing nav IDs: **0**

## RPC Methods Used by Web Next

| Method | Backend Availability | Used By |
| --- | --- | --- |
| `alerts.dismiss` | Not found in gateway methods (likely missing) | `apps/web-next/src/hooks/useMissionControl.ts` |
| `alerts.list` | Not found in gateway methods (likely missing) | `apps/web-next/src/hooks/useMissionControl.ts` |
| `approvals.approve` | Not found in gateway methods (likely missing) | `apps/web-next/src/hooks/useMissionControl.ts` |
| `approvals.deny` | Not found in gateway methods (likely missing) | `apps/web-next/src/hooks/useMissionControl.ts` |
| `approvals.list` | Not found in gateway methods (likely missing) | `apps/web-next/src/hooks/useMissionControl.ts` |
| `config.get` | Declared in gateway method list | `apps/web-next/src/views/ProviderAuthManager.tsx`<br/>`apps/web-next/src/views/SettingsDashboard.tsx` |
| `sessions.list` | Declared in gateway method list | `apps/web-next/src/hooks/useMissionControl.ts` |
| `tools.history` | Not found in gateway methods (likely missing) | `apps/web-next/src/hooks/useMissionControl.ts` |
| `web.login.start` | Found in gateway code (not in base method list) | `apps/web-next/src/components/WhatsAppQrLogin.tsx` |
| `web.login.wait` | Found in gateway code (not in base method list) | `apps/web-next/src/components/WhatsAppQrLogin.tsx` |
| `wizard.cancel` | Declared in gateway method list | `apps/web-next/src/hooks/useWizard.ts` |
| `wizard.next` | Declared in gateway method list | `apps/web-next/src/hooks/useWizard.ts` |
| `wizard.start` | Declared in gateway method list | `apps/web-next/src/hooks/useWizard.ts` |
| `wizard.status` | Declared in gateway method list | `apps/web-next/src/hooks/useWizard.ts` |

## Routed View to RPC Matrix

| Route ID | Label | Component | File | Hooks | RPC Methods | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `morning-packet` | Morning Packet | `MorningPacket` | `apps/web-next/src/views/MorningPacket.tsx` | — | — | UI-only (no RPC wiring) |
| `today-command` | Today Command Center | `TodayCommandCenter` | `apps/web-next/src/views/TodayCommandCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `action-inbox` | Action Inbox | `ActionInboxView` | `apps/web-next/src/views/ActionInboxView.tsx` | — | — | UI-only (no RPC wiring) |
| `capacity-planner` | Capacity Planner | `AgentCapacityPlanner` | `apps/web-next/src/views/AgentCapacityPlanner.tsx` | — | — | UI-only (no RPC wiring) |
| `morning-packet` | Morning Packet | `MorningPacket` | `apps/web-next/src/views/MorningPacket.tsx` | — | — | UI-only (no RPC wiring) |
| `today-command` | Today Command Center | `TodayCommandCenter` | `apps/web-next/src/views/TodayCommandCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `action-inbox` | Action Inbox | `ActionInboxView` | `apps/web-next/src/views/ActionInboxView.tsx` | — | — | UI-only (no RPC wiring) |
| `capacity-planner` | Capacity Planner | `AgentCapacityPlanner` | `apps/web-next/src/views/AgentCapacityPlanner.tsx` | — | — | UI-only (no RPC wiring) |
| `handoff-planner` | Handoff Planner | `AgentHandoffPlanner` | `apps/web-next/src/views/AgentHandoffPlanner.tsx` | — | — | UI-only (no RPC wiring) |
| `compare-modes` | Compare Modes | `CompareModesDiffView` | `apps/web-next/src/views/CompareModesDiffView.tsx` | — | — | UI-only (no RPC wiring) |
| `context-budget` | Context Budget | `ContextBudgetInspector` | `apps/web-next/src/views/ContextBudgetInspector.tsx` | — | — | UI-only (no RPC wiring) |
| `discovery-run-monitor` | Discovery Monitor | `DiscoveryRunMonitor` | `apps/web-next/src/views/DiscoveryRunMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `brave-api-wizard` | Brave API Setup | `BraveAPIKeySetupWizard` | `apps/web-next/src/views/BraveAPIKeySetupWizard.tsx` | — | — | UI-only (no RPC wiring) |
| `discovery-wave-results` | Wave Results | `DiscoveryWaveResults` | `apps/web-next/src/views/DiscoveryWaveResults.tsx` | — | — | UI-only (no RPC wiring) |
| `agent-cost-tracker` | Agent Cost Tracker | `DiscoveryAgentCostTracker` | `apps/web-next/src/views/DiscoveryAgentCostTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `tool-reliability` | Tool Reliability | `ToolReliabilityDashboard` | `apps/web-next/src/views/ToolReliabilityDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `model-comparison` | Model Comparison | `ModelComparisonMatrix` | `apps/web-next/src/views/ModelComparisonMatrix.tsx` | — | — | UI-only (no RPC wiring) |
| `wave-scheduler` | Wave Scheduler | `AgentWaveScheduler` | `apps/web-next/src/views/AgentWaveScheduler.tsx` | — | — | UI-only (no RPC wiring) |
| `preflight-checklist` | Preflight Checklist | `DiscoveryPreflightChecklist` | `apps/web-next/src/views/DiscoveryPreflightChecklist.tsx` | — | — | UI-only (no RPC wiring) |
| `findings-search` | Findings Search | `DiscoveryFindingsSearch` | `apps/web-next/src/views/DiscoveryFindingsSearch.tsx` | — | — | UI-only (no RPC wiring) |
| `dashboard` | Dashboard | `AgentDashboard` | `apps/web-next/src/views/AgentDashboard.tsx` | `useGateway` | — | Gateway-aware (connection state only) |
| `chat` | Chat | `ChatInterface` | `apps/web-next/src/views/ChatInterface.tsx` | — | — | UI-only (no RPC wiring) |
| `builder` | Agent Builder | `AgentBuilderWizard` | `apps/web-next/src/views/AgentBuilderWizard.tsx` | — | — | UI-only (no RPC wiring) |
| `soul-editor` | Soul Editor | `AgentSoulEditor` | `apps/web-next/src/views/AgentSoulEditor.tsx` | — | — | UI-only (no RPC wiring) |
| `identity` | Identity Cards | `AgentIdentityCard` | `apps/web-next/src/views/AgentIdentityCard.tsx` | — | — | UI-only (no RPC wiring) |
| `models` | Models | `ModelSelector` | `apps/web-next/src/views/ModelSelector.tsx` | — | — | UI-only (no RPC wiring) |
| `providers` | Providers | `ProviderAuthManager` | `apps/web-next/src/views/ProviderAuthManager.tsx` | `useGateway`, `useWizard` | `config.get`, `wizard.cancel`, `wizard.next`, `wizard.start`, `wizard.status` | RPC-integrated |
| `cron` | Schedules | `CronScheduleBuilder` | `apps/web-next/src/views/CronScheduleBuilder.tsx` | — | — | UI-only (no RPC wiring) |
| `skills` | Skills | `SkillsMarketplace` | `apps/web-next/src/views/SkillsMarketplace.tsx` | — | — | UI-only (no RPC wiring) |
| `skill-builder` | Skill Builder | `SkillBuilderEditor` | `apps/web-next/src/views/SkillBuilderEditor.tsx` | — | — | UI-only (no RPC wiring) |
| `sessions` | Sessions | `SessionExplorer` | `apps/web-next/src/views/SessionExplorer.tsx` | — | — | UI-only (no RPC wiring) |
| `config-review` | Config Review | `AgentConfigReview` | `apps/web-next/src/views/AgentConfigReview.tsx` | — | — | UI-only (no RPC wiring) |
| `settings` | Settings | `SettingsDashboard` | `apps/web-next/src/views/SettingsDashboard.tsx` | `useGateway` | `config.get` | RPC-integrated |
| `nodes` | Nodes | `NodeManager` | `apps/web-next/src/views/NodeManager.tsx` | — | — | UI-only (no RPC wiring) |
| `usage` | Usage & Costs | `UsageDashboard` | `apps/web-next/src/views/UsageDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `files` | Files | `WorkspaceFileBrowser` | `apps/web-next/src/views/WorkspaceFileBrowser.tsx` | — | — | UI-only (no RPC wiring) |
| `onboarding` | Onboarding | `OnboardingFlow` | `apps/web-next/src/views/OnboardingFlow.tsx` | — | — | UI-only (no RPC wiring) |
| `pulse` | Agent Pulse | `AgentPulseMonitor` | `apps/web-next/src/views/AgentPulseMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `notifications` | Notifications | `NotificationCenter` | `apps/web-next/src/views/NotificationCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `api-keys` | API & Integrations | `ApiKeysManager` | `apps/web-next/src/views/ApiKeysManager.tsx` | — | — | UI-only (no RPC wiring) |
| `audit-log` | Audit Log | `AuditLog` | `apps/web-next/src/views/AuditLog.tsx` | — | — | UI-only (no RPC wiring) |
| `billing` | Billing | `BillingSubscription` | `apps/web-next/src/views/BillingSubscription.tsx` | — | — | UI-only (no RPC wiring) |
| `system-health` | System Health | `SystemHealth` | `apps/web-next/src/views/SystemHealth.tsx` | — | — | UI-only (no RPC wiring) |
| `integrations` | Integrations | `IntegrationHub` | `apps/web-next/src/views/IntegrationHub.tsx` | — | — | UI-only (no RPC wiring) |
| `team` | Team | `TeamManagement` | `apps/web-next/src/views/TeamManagement.tsx` | — | — | UI-only (no RPC wiring) |
| `search` | Search | `GlobalSearch` | `apps/web-next/src/views/GlobalSearch.tsx` | — | — | UI-only (no RPC wiring) |
| `prompts` | Prompt Library | `PromptLibrary` | `apps/web-next/src/views/PromptLibrary.tsx` | — | — | UI-only (no RPC wiring) |
| `exports` | Data Export | `DataExportManager` | `apps/web-next/src/views/DataExportManager.tsx` | — | — | UI-only (no RPC wiring) |
| `voice` | Voice | `VoiceInterface` | `apps/web-next/src/views/VoiceInterface.tsx` | — | — | UI-only (no RPC wiring) |
| `agent-insights` | Agent Insights | `AgentInsights` | `apps/web-next/src/views/AgentInsights.tsx` | — | — | UI-only (no RPC wiring) |
| `dev-console` | Dev Console | `DeveloperConsole` | `apps/web-next/src/views/DeveloperConsole.tsx` | — | — | UI-only (no RPC wiring) |
| `security` | Security | `SecurityDashboard` | `apps/web-next/src/views/SecurityDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `changelog` | What's New | `ChangelogView` | `apps/web-next/src/views/ChangelogView.tsx` | — | — | UI-only (no RPC wiring) |
| `env-vars` | Environment | `EnvironmentManager` | `apps/web-next/src/views/EnvironmentManager.tsx` | — | — | UI-only (no RPC wiring) |
| `feature-flags` | Feature Flags | `FeatureFlags` | `apps/web-next/src/views/FeatureFlags.tsx` | — | — | UI-only (no RPC wiring) |
| `agent-compare` | Agent Compare | `AgentComparison` | `apps/web-next/src/views/AgentComparison.tsx` | — | — | UI-only (no RPC wiring) |
| `knowledge` | Knowledge Base | `KnowledgeBase` | `apps/web-next/src/views/KnowledgeBase.tsx` | — | — | UI-only (no RPC wiring) |
| `crashes` | Crash Reports | `CrashReporter` | `apps/web-next/src/views/CrashReporter.tsx` | — | — | UI-only (no RPC wiring) |
| `benchmark` | Model Benchmark | `ModelBenchmark` | `apps/web-next/src/views/ModelBenchmark.tsx` | — | — | UI-only (no RPC wiring) |
| `rate-limits` | Rate Limits | `RateLimitDashboard` | `apps/web-next/src/views/RateLimitDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `task-queue` | Task Queue | `TaskQueue` | `apps/web-next/src/views/TaskQueue.tsx` | — | — | UI-only (no RPC wiring) |
| `storage` | Storage | `StorageExplorer` | `apps/web-next/src/views/StorageExplorer.tsx` | — | — | UI-only (no RPC wiring) |
| `alerts` | Alert Center | `AlertCenter` | `apps/web-next/src/views/AlertCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `mission-control` | Mission Control | `MissionControlDashboard` | `apps/web-next/src/views/MissionControlDashboard.tsx` | `useMissionControl` | `alerts.dismiss`, `alerts.list`, `approvals.approve`, `approvals.deny`, `approvals.list`, `sessions.list`, `tools.history` | RPC-integrated |
| `webhooks` | Webhooks | `WebhookManager` | `apps/web-next/src/views/WebhookManager.tsx` | — | — | UI-only (no RPC wiring) |
| `history` | Session History | `ConversationHistory` | `apps/web-next/src/views/ConversationHistory.tsx` | — | — | UI-only (no RPC wiring) |
| `scheduler` | Scheduler | `AgentScheduler` | `apps/web-next/src/views/AgentScheduler.tsx` | — | — | UI-only (no RPC wiring) |
| `token-ledger` | Token Ledger | `TokenLedger` | `apps/web-next/src/views/TokenLedger.tsx` | — | — | UI-only (no RPC wiring) |
| `theme-editor` | Theme Editor | `ThemeEditor` | `apps/web-next/src/views/ThemeEditor.tsx` | — | — | UI-only (no RPC wiring) |
| `permissions` | Permissions | `PermissionsManager` | `apps/web-next/src/views/PermissionsManager.tsx` | — | — | UI-only (no RPC wiring) |
| `activity` | Activity Feed | `ActivityFeed` | `apps/web-next/src/views/ActivityFeed.tsx` | — | — | UI-only (no RPC wiring) |
| `commands` | Commands | `CommandPalette` | `apps/web-next/src/views/CommandPalette.tsx` | — | — | UI-only (no RPC wiring) |
| `commands-v2` | Commands V2 | `CommandPaletteV2` | `apps/web-next/src/views/CommandPaletteV2.tsx` | — | — | UI-only (no RPC wiring) |
| `support` | Support | `SupportCenter` | `apps/web-next/src/views/SupportCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `releases` | Releases | `ReleasePipeline` | `apps/web-next/src/views/ReleasePipeline.tsx` | — | — | UI-only (no RPC wiring) |
| `memory` | Agent Memory | `AgentMemoryViewer` | `apps/web-next/src/views/AgentMemoryViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `network` | Network | `NetworkInspector` | `apps/web-next/src/views/NetworkInspector.tsx` | — | — | UI-only (no RPC wiring) |
| `analytics` | Analytics | `AnalyticsOverview` | `apps/web-next/src/views/AnalyticsOverview.tsx` | — | — | UI-only (no RPC wiring) |
| `setup` | Setup Guide | `OnboardingChecklist` | `apps/web-next/src/views/OnboardingChecklist.tsx` | — | — | UI-only (no RPC wiring) |
| `workload` | Agent Workload | `AgentWorkload` | `apps/web-next/src/views/AgentWorkload.tsx` | — | — | UI-only (no RPC wiring) |
| `api-playground` | API Playground | `ApiPlayground` | `apps/web-next/src/views/ApiPlayground.tsx` | — | — | UI-only (no RPC wiring) |
| `workspace` | Workspace | `WorkspaceSettings` | `apps/web-next/src/views/WorkspaceSettings.tsx` | — | — | UI-only (no RPC wiring) |
| `tracer` | Agent Tracer | `AgentTracer` | `apps/web-next/src/views/AgentTracer.tsx` | — | — | UI-only (no RPC wiring) |
| `pipelines` | Pipelines | `DataPipelineViewer` | `apps/web-next/src/views/DataPipelineViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `cost` | Cost Optimizer | `CostOptimizer` | `apps/web-next/src/views/CostOptimizer.tsx` | — | — | UI-only (no RPC wiring) |
| `plugins` | Plugins | `PluginManager` | `apps/web-next/src/views/PluginManager.tsx` | — | — | UI-only (no RPC wiring) |
| `logs` | Log Viewer | `LogViewer` | `apps/web-next/src/views/LogViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `llm-playground` | LLM Playground | `LLMPlayground` | `apps/web-next/src/views/LLMPlayground.tsx` | — | — | UI-only (no RPC wiring) |
| `ab-tests` | A/B Tests | `ABTestManager` | `apps/web-next/src/views/ABTestManager.tsx` | — | — | UI-only (no RPC wiring) |
| `quotas` | Quotas | `QuotaManager` | `apps/web-next/src/views/QuotaManager.tsx` | — | — | UI-only (no RPC wiring) |
| `agent-diff` | Agent Diff | `AgentDiffViewer` | `apps/web-next/src/views/AgentDiffViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `mcp` | MCP Inspector | `MCPInspector` | `apps/web-next/src/views/MCPInspector.tsx` | — | — | UI-only (no RPC wiring) |
| `model-router` | Model Router | `ModelRouter` | `apps/web-next/src/views/ModelRouter.tsx` | — | — | UI-only (no RPC wiring) |
| `session-replay` | Session Replay | `SessionReplay` | `apps/web-next/src/views/SessionReplay.tsx` | — | — | UI-only (no RPC wiring) |
| `config-validator` | Config Validator | `ConfigValidatorView` | `apps/web-next/src/views/ConfigValidatorView.tsx` | — | — | UI-only (no RPC wiring) |
| `context-window` | Context Window | `ContextWindowViewer` | `apps/web-next/src/views/ContextWindowViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `inbox` | Agent Inbox | `AgentInbox` | `apps/web-next/src/views/AgentInbox.tsx` | — | — | UI-only (no RPC wiring) |
| `dep-graph` | Dependency Graph | `DependencyGraph` | `apps/web-next/src/views/DependencyGraph.tsx` | — | — | UI-only (no RPC wiring) |
| `goals` | Goal Tracker | `GoalTracker` | `apps/web-next/src/views/GoalTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `resources` | Resources | `ResourceMonitor` | `apps/web-next/src/views/ResourceMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `service-map` | Service Map | `ServiceMap` | `apps/web-next/src/views/ServiceMap.tsx` | — | — | UI-only (no RPC wiring) |
| `prompt-optimizer` | Prompt Optimizer | `PromptOptimizer` | `apps/web-next/src/views/PromptOptimizer.tsx` | — | — | UI-only (no RPC wiring) |
| `directory` | Team Directory | `TeamDirectory` | `apps/web-next/src/views/TeamDirectory.tsx` | — | — | UI-only (no RPC wiring) |
| `workflows` | Workflow Builder | `WorkflowBuilder` | `apps/web-next/src/views/WorkflowBuilder.tsx` | — | — | UI-only (no RPC wiring) |
| `token-budget` | Token Budget | `TokenBudgetPlanner` | `apps/web-next/src/views/TokenBudgetPlanner.tsx` | — | — | UI-only (no RPC wiring) |
| `sandbox` | Sandbox Runner | `SandboxRunner` | `apps/web-next/src/views/SandboxRunner.tsx` | — | — | UI-only (no RPC wiring) |
| `metrics` | Metrics Drilldown | `MetricsDrilldown` | `apps/web-next/src/views/MetricsDrilldown.tsx` | — | — | UI-only (no RPC wiring) |
| `embeddings` | Embedding Explorer | `EmbeddingExplorer` | `apps/web-next/src/views/EmbeddingExplorer.tsx` | — | — | UI-only (no RPC wiring) |
| `rules` | Rule Engine | `RuleEngine` | `apps/web-next/src/views/RuleEngine.tsx` | — | — | UI-only (no RPC wiring) |
| `telemetry` | Telemetry Viewer | `TelemetryViewer` | `apps/web-next/src/views/TelemetryViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `model-health` | Model Health | `ModelHealthDashboard` | `apps/web-next/src/views/ModelHealthDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `timeline` | Activity Timeline | `ActivityTimeline` | `apps/web-next/src/views/ActivityTimeline.tsx` | — | — | UI-only (no RPC wiring) |
| `policies` | Policy Manager | `PolicyManager` | `apps/web-next/src/views/PolicyManager.tsx` | — | — | UI-only (no RPC wiring) |
| `git` | Version Control | `VersionControl` | `apps/web-next/src/views/VersionControl.tsx` | — | — | UI-only (no RPC wiring) |
| `scorecard` | Score Card | `ScoreCard` | `apps/web-next/src/views/ScoreCard.tsx` | — | — | UI-only (no RPC wiring) |
| `capacity` | Capacity Planner | `CapacityPlanner` | `apps/web-next/src/views/CapacityPlanner.tsx` | — | — | UI-only (no RPC wiring) |
| `experiments` | Experiments | `ExperimentDashboard` | `apps/web-next/src/views/ExperimentDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `search-results` | Search Results | `SearchResultsView` | `apps/web-next/src/views/SearchResultsView.tsx` | — | — | UI-only (no RPC wiring) |
| `checklist` | Health Checklist | `HealthChecklist` | `apps/web-next/src/views/HealthChecklist.tsx` | — | — | UI-only (no RPC wiring) |
| `budget-tracker` | Budget Tracker | `BudgetTracker` | `apps/web-next/src/views/BudgetTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `chat-room` | Chat Room | `ChatRoomView` | `apps/web-next/src/views/ChatRoomView.tsx` | — | — | UI-only (no RPC wiring) |
| `reports` | Report Generator | `ReportGenerator` | `apps/web-next/src/views/ReportGenerator.tsx` | — | — | UI-only (no RPC wiring) |
| `access-control` | Access Control | `AccessControlMatrix` | `apps/web-next/src/views/AccessControlMatrix.tsx` | — | — | UI-only (no RPC wiring) |
| `infra-map` | Infrastructure | `InfrastructureMap` | `apps/web-next/src/views/InfrastructureMap.tsx` | — | — | UI-only (no RPC wiring) |
| `status-page` | Status Page | `StatusPageBuilder` | `apps/web-next/src/views/StatusPageBuilder.tsx` | — | — | UI-only (no RPC wiring) |
| `diff-viewer` | Diff Viewer | `DiffViewer` | `apps/web-next/src/views/DiffViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `oncall` | On-Call Schedule | `OncallScheduler` | `apps/web-next/src/views/OncallScheduler.tsx` | — | — | UI-only (no RPC wiring) |
| `data-quality` | Data Quality | `DataQualityDashboard` | `apps/web-next/src/views/DataQualityDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `cal` | Event Scheduler | `EventScheduler` | `apps/web-next/src/views/EventScheduler.tsx` | — | — | UI-only (no RPC wiring) |
| `slack-mgr` | Slack Integration | `SlackIntegrationManager` | `apps/web-next/src/views/SlackIntegrationManager.tsx` | — | — | UI-only (no RPC wiring) |
| `user-journey` | User Journey Map | `UserJourneyMap` | `apps/web-next/src/views/UserJourneyMap.tsx` | — | — | UI-only (no RPC wiring) |
| `mem-profiler` | Memory Profiler | `MemoryProfiler` | `apps/web-next/src/views/MemoryProfiler.tsx` | — | — | UI-only (no RPC wiring) |
| `error-budget` | Error Budget | `ErrorBudgetTracker` | `apps/web-next/src/views/ErrorBudgetTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `model-compare` | Model Comparator | `MultiModelComparator` | `apps/web-next/src/views/MultiModelComparator.tsx` | — | — | UI-only (no RPC wiring) |
| `ctx-browser` | Context Browser | `ContextBrowser` | `apps/web-next/src/views/ContextBrowser.tsx` | — | — | UI-only (no RPC wiring) |
| `github` | GitHub Integration | `GitHubIntegration` | `apps/web-next/src/views/GitHubIntegration.tsx` | — | — | UI-only (no RPC wiring) |
| `funnel` | Funnel Analytics | `FunnelAnalytics` | `apps/web-next/src/views/FunnelAnalytics.tsx` | — | — | UI-only (no RPC wiring) |
| `sprint-board` | Sprint Board | `SprintBoard` | `apps/web-next/src/views/SprintBoard.tsx` | — | — | UI-only (no RPC wiring) |
| `cost-forecast` | Cost Forecast | `CostForecast` | `apps/web-next/src/views/CostForecast.tsx` | — | — | UI-only (no RPC wiring) |
| `threat-intel` | Threat Intelligence | `ThreatIntelligenceFeed` | `apps/web-next/src/views/ThreatIntelligenceFeed.tsx` | — | — | UI-only (no RPC wiring) |
| `pipeline-monitor` | Pipeline Monitor | `PipelineMonitor` | `apps/web-next/src/views/PipelineMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `a11y-audit` | A11y Audit | `A11yAuditDashboard` | `apps/web-next/src/views/A11yAuditDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `design-tokens` | Design Tokens | `DesignTokenManager` | `apps/web-next/src/views/DesignTokenManager.tsx` | — | — | UI-only (no RPC wiring) |
| `webhook-play` | Webhook Playground | `WebhookPlayground` | `apps/web-next/src/views/WebhookPlayground.tsx` | — | — | UI-only (no RPC wiring) |
| `sla-manager` | SLA Manager | `SLAManager` | `apps/web-next/src/views/SLAManager.tsx` | — | — | UI-only (no RPC wiring) |
| `docs` | Documentation | `DocumentationViewer` | `apps/web-next/src/views/DocumentationViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `gantt` | Gantt Chart | `GanttChartView` | `apps/web-next/src/views/GanttChartView.tsx` | — | — | UI-only (no RPC wiring) |
| `feedback` | Customer Feedback | `CustomerFeedbackDashboard` | `apps/web-next/src/views/CustomerFeedbackDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `sec-policy` | Security Policies | `SecurityPolicyEditor` | `apps/web-next/src/views/SecurityPolicyEditor.tsx` | — | — | UI-only (no RPC wiring) |
| `team-collab` | Team Collaboration | `TeamCollaboration` | `apps/web-next/src/views/TeamCollaboration.tsx` | — | — | UI-only (no RPC wiring) |
| `migrations` | Migrations | `MigrationManager` | `apps/web-next/src/views/MigrationManager.tsx` | — | — | UI-only (no RPC wiring) |
| `i18n` | Localization | `LocalizationManager` | `apps/web-next/src/views/LocalizationManager.tsx` | — | — | UI-only (no RPC wiring) |
| `multi-tenant` | Multi-Tenant Mgr | `MultiTenantManager` | `apps/web-next/src/views/MultiTenantManager.tsx` | — | — | UI-only (no RPC wiring) |
| `ml-registry` | ML Model Registry | `MLModelRegistry` | `apps/web-next/src/views/MLModelRegistry.tsx` | — | — | UI-only (no RPC wiring) |
| `event-stream` | Event Streams | `EventStreamViewer` | `apps/web-next/src/views/EventStreamViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `perms-matrix` | Permissions Matrix | `PermissionsMatrix` | `apps/web-next/src/views/PermissionsMatrix.tsx` | — | — | UI-only (no RPC wiring) |
| `changelog-v2` | Changelog Viewer | `ChangelogViewer` | `apps/web-next/src/views/ChangelogViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `quota-mgr` | Resource Quotas | `ResourceQuotaManager` | `apps/web-next/src/views/ResourceQuotaManager.tsx` | — | — | UI-only (no RPC wiring) |
| `db-query` | DB Query Builder | `DatabaseQueryBuilder` | `apps/web-next/src/views/DatabaseQueryBuilder.tsx` | — | — | UI-only (no RPC wiring) |
| `invoices` | Invoice Manager | `InvoiceManager` | `apps/web-next/src/views/InvoiceManager.tsx` | — | — | UI-only (no RPC wiring) |
| `net-topology` | Network Topology | `NetworkTopologyViewer` | `apps/web-next/src/views/NetworkTopologyViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `compliance` | Compliance | `ComplianceDashboard` | `apps/web-next/src/views/ComplianceDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `user-segments` | User Segmentation | `UserSegmentation` | `apps/web-next/src/views/UserSegmentation.tsx` | — | — | UI-only (no RPC wiring) |
| `deployments` | Deployment Tracker | `DeploymentTracker` | `apps/web-next/src/views/DeploymentTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `moderation` | Content Moderation | `ContentModerationQueue` | `apps/web-next/src/views/ContentModerationQueue.tsx` | — | — | UI-only (no RPC wiring) |
| `pricing-calc` | Pricing Calculator | `PricingCalculator` | `apps/web-next/src/views/PricingCalculator.tsx` | — | — | UI-only (no RPC wiring) |
| `tech-radar` | Tech Radar | `TechRadar` | `apps/web-next/src/views/TechRadar.tsx` | — | — | UI-only (no RPC wiring) |
| `postmortem` | Incident Postmortem | `IncidentPostmortem` | `apps/web-next/src/views/IncidentPostmortem.tsx` | — | — | UI-only (no RPC wiring) |
| `access-tokens` | Access Tokens | `AccessTokenManager` | `apps/web-next/src/views/AccessTokenManager.tsx` | — | — | UI-only (no RPC wiring) |
| `k8s-cluster` | K8s Cluster | `KubernetesClusterViewer` | `apps/web-next/src/views/KubernetesClusterViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `cohort-analysis` | Cohort Analysis | `CohortAnalysisDashboard` | `apps/web-next/src/views/CohortAnalysisDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `sentiment` | Sentiment Analysis | `SentimentAnalysisViewer` | `apps/web-next/src/views/SentimentAnalysisViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `graphql` | GraphQL Explorer | `GraphQLExplorer` | `apps/web-next/src/views/GraphQLExplorer.tsx` | — | — | UI-only (no RPC wiring) |
| `backups` | Backup Manager | `BackupManager` | `apps/web-next/src/views/BackupManager.tsx` | — | — | UI-only (no RPC wiring) |
| `vector-db` | Vector Database | `VectorDatabaseViewer` | `apps/web-next/src/views/VectorDatabaseViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `doc-templates` | Doc Templates | `DocumentTemplateBuilder` | `apps/web-next/src/views/DocumentTemplateBuilder.tsx` | — | — | UI-only (no RPC wiring) |
| `service-accounts` | Service Accounts | `ServiceAccountManager` | `apps/web-next/src/views/ServiceAccountManager.tsx` | — | — | UI-only (no RPC wiring) |
| `container-reg` | Container Registry | `ContainerRegistry` | `apps/web-next/src/views/ContainerRegistry.tsx` | — | — | UI-only (no RPC wiring) |
| `email-campaigns` | Email Campaigns | `EmailCampaignManager` | `apps/web-next/src/views/EmailCampaignManager.tsx` | — | — | UI-only (no RPC wiring) |
| `cdc` | Change Data Capture | `ChangeDataCapture` | `apps/web-next/src/views/ChangeDataCapture.tsx` | — | — | UI-only (no RPC wiring) |
| `fleet` | Fleet Devices | `FleetDeviceManager` | `apps/web-next/src/views/FleetDeviceManager.tsx` | — | — | UI-only (no RPC wiring) |
| `cdn` | CDN Manager | `CDNManager` | `apps/web-next/src/views/CDNManager.tsx` | — | — | UI-only (no RPC wiring) |
| `geofence` | Geofence Manager | `GeofenceManager` | `apps/web-next/src/views/GeofenceManager.tsx` | — | — | UI-only (no RPC wiring) |
| `scim` | SCIM Provisioner | `ScimUserProvisioner` | `apps/web-next/src/views/ScimUserProvisioner.tsx` | — | — | UI-only (no RPC wiring) |
| `licenses` | License Manager | `LicenseManager` | `apps/web-next/src/views/LicenseManager.tsx` | — | — | UI-only (no RPC wiring) |
| `message-queues` | Message Queues | `MessageQueueManager` | `apps/web-next/src/views/MessageQueueManager.tsx` | — | — | UI-only (no RPC wiring) |
| `tenant-usage` | Tenant Usage | `TenantUsageDashboard` | `apps/web-next/src/views/TenantUsageDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `certs` | Certificates | `CertificateManager` | `apps/web-next/src/views/CertificateManager.tsx` | — | — | UI-only (no RPC wiring) |
| `financial` | Financial Reports | `FinancialReportingDashboard` | `apps/web-next/src/views/FinancialReportingDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `openapi` | OpenAPI Explorer | `OpenAPIExplorer` | `apps/web-next/src/views/OpenAPIExplorer.tsx` | — | — | UI-only (no RPC wiring) |
| `data-lineage` | Data Lineage | `DataLineageViewer` | `apps/web-next/src/views/DataLineageViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `storage-buckets` | Storage Buckets | `StorageBucketManager` | `apps/web-next/src/views/StorageBucketManager.tsx` | — | — | UI-only (no RPC wiring) |
| `prompt-router` | AI Prompt Router | `AIPromptRouter` | `apps/web-next/src/views/AIPromptRouter.tsx` | — | — | UI-only (no RPC wiring) |
| `observability` | Observability | `ObservabilityDashboard` | `apps/web-next/src/views/ObservabilityDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `rbac` | RBAC Manager | `AccessControlManager` | `apps/web-next/src/views/AccessControlManager.tsx` | — | — | UI-only (no RPC wiring) |
| `error-tracking` | Error Tracking | `ErrorTrackingDashboard` | `apps/web-next/src/views/ErrorTrackingDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `compliance-v2` | Compliance Tracker | `ComplianceTracker` | `apps/web-next/src/views/ComplianceTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `sso` | SSO Config | `SSOConfigManager` | `apps/web-next/src/views/SSOConfigManager.tsx` | — | — | UI-only (no RPC wiring) |
| `content-cal` | Content Calendar | `ContentCalendar` | `apps/web-next/src/views/ContentCalendar.tsx` | — | — | UI-only (no RPC wiring) |
| `infra-cost` | Infra Cost Optimizer | `InfrastructureCostOptimizer` | `apps/web-next/src/views/InfrastructureCostOptimizer.tsx` | — | — | UI-only (no RPC wiring) |
| `api-gateway` | API Gateway | `APIGatewayManager` | `apps/web-next/src/views/APIGatewayManager.tsx` | — | — | UI-only (no RPC wiring) |
| `cost-anomaly` | Cost Anomaly | `CostAnomalyDetector` | `apps/web-next/src/views/CostAnomalyDetector.tsx` | — | — | UI-only (no RPC wiring) |
| `knowledge-graph` | Knowledge Graph | `KnowledgeGraphViewer` | `apps/web-next/src/views/KnowledgeGraphViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `workflow-orch` | Workflow Orchestrator | `WorkflowOrchestrator` | `apps/web-next/src/views/WorkflowOrchestrator.tsx` | — | — | UI-only (no RPC wiring) |
| `resource-tags` | Resource Tags | `ResourceTagManager` | `apps/web-next/src/views/ResourceTagManager.tsx` | — | — | UI-only (no RPC wiring) |
| `capacity-forecast` | Capacity Forecast | `CapacityForecastDashboard` | `apps/web-next/src/views/CapacityForecastDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `event-catalog` | Event Catalog | `EventCatalogBrowser` | `apps/web-next/src/views/EventCatalogBrowser.tsx` | — | — | UI-only (no RPC wiring) |
| `security-scan` | Security Scans | `SecurityScanDashboard` | `apps/web-next/src/views/SecurityScanDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `data-privacy` | Data Privacy | `DataPrivacyDashboard` | `apps/web-next/src/views/DataPrivacyDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `onboarding-flow` | Onboarding Flows | `UserOnboardingFlow` | `apps/web-next/src/views/UserOnboardingFlow.tsx` | — | — | UI-only (no RPC wiring) |
| `query-perf` | Query Performance | `QueryPerformanceAnalyzer` | `apps/web-next/src/views/QueryPerformanceAnalyzer.tsx` | — | — | UI-only (no RPC wiring) |
| `service-mesh` | Service Mesh | `ServiceMeshViewer` | `apps/web-next/src/views/ServiceMeshViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `multi-region` | Multi-Region | `MultiRegionDashboard` | `apps/web-next/src/views/MultiRegionDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `revenue` | Revenue Analytics | `RevenueAnalyticsDashboard` | `apps/web-next/src/views/RevenueAnalyticsDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `vault-secrets` | Vault Secrets | `VaultSecretsManager` | `apps/web-next/src/views/VaultSecretsManager.tsx` | — | — | UI-only (no RPC wiring) |
| `ml-pipeline` | ML Pipelines | `MLPipelineMonitor` | `apps/web-next/src/views/MLPipelineMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `incident-timeline` | Incident Timeline | `IncidentTimeline` | `apps/web-next/src/views/IncidentTimeline.tsx` | — | — | UI-only (no RPC wiring) |
| `test-results` | Test Results | `TestResultsDashboard` | `apps/web-next/src/views/TestResultsDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `customer-success` | Customer Success | `CustomerSuccessDashboard` | `apps/web-next/src/views/CustomerSuccessDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `container-logs` | Container Logs | `ContainerLogViewer` | `apps/web-next/src/views/ContainerLogViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `infra-drift` | Drift Detector | `InfrastructureDriftDetector` | `apps/web-next/src/views/InfrastructureDriftDetector.tsx` | — | — | UI-only (no RPC wiring) |
| `announcements` | Announcements | `AnnouncementCenter` | `apps/web-next/src/views/AnnouncementCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `schema-explorer` | Schema Explorer | `DatabaseSchemaExplorer` | `apps/web-next/src/views/DatabaseSchemaExplorer.tsx` | — | — | UI-only (no RPC wiring) |
| `support-tickets` | Support Tickets | `SupportTicketDashboard` | `apps/web-next/src/views/SupportTicketDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `api-changelog` | API Changelog | `APIChangelogManager` | `apps/web-next/src/views/APIChangelogManager.tsx` | — | — | UI-only (no RPC wiring) |
| `product-tour` | Product Tours | `ProductTourBuilder` | `apps/web-next/src/views/ProductTourBuilder.tsx` | — | — | UI-only (no RPC wiring) |
| `network-firewall` | Firewall Rules | `NetworkFirewallRuleManager` | `apps/web-next/src/views/NetworkFirewallRuleManager.tsx` | — | — | UI-only (no RPC wiring) |
| `observability-alerts` | Alert Manager | `ObservabilityAlertManager` | `apps/web-next/src/views/ObservabilityAlertManager.tsx` | — | — | UI-only (no RPC wiring) |
| `cloud-cost-opt` | Cloud Cost Optimizer | `CloudCostOptimizer` | `apps/web-next/src/views/CloudCostOptimizer.tsx` | — | — | UI-only (no RPC wiring) |
| `network-bw` | Network Bandwidth | `NetworkBandwidthMonitor` | `apps/web-next/src/views/NetworkBandwidthMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `service-deps` | Service Dependencies | `ServiceDependencyMap` | `apps/web-next/src/views/ServiceDependencyMap.tsx` | — | — | UI-only (no RPC wiring) |
| `feature-requests` | Feature Requests | `FeatureRequestBoard` | `apps/web-next/src/views/FeatureRequestBoard.tsx` | — | — | UI-only (no RPC wiring) |
| `data-catalog` | Data Catalog | `DataCatalog` | `apps/web-next/src/views/DataCatalog.tsx` | — | — | UI-only (no RPC wiring) |
| `oncall-rotation` | On-Call Rotation | `OnCallRotationManager` | `apps/web-next/src/views/OnCallRotationManager.tsx` | — | — | UI-only (no RPC wiring) |
| `resource-inventory` | Resource Inventory | `ResourceInventoryDashboard` | `apps/web-next/src/views/ResourceInventoryDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `webhook-debugger` | Webhook Debugger | `WebhookDebugger` | `apps/web-next/src/views/WebhookDebugger.tsx` | — | — | UI-only (no RPC wiring) |
| `cost-attribution` | Cost Attribution | `CostAttributionDashboard` | `apps/web-next/src/views/CostAttributionDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `log-aggregator` | Log Aggregator | `LogAggregatorView` | `apps/web-next/src/views/LogAggregatorView.tsx` | — | — | UI-only (no RPC wiring) |
| `user-devices` | User Devices | `UserDeviceManager` | `apps/web-next/src/views/UserDeviceManager.tsx` | — | — | UI-only (no RPC wiring) |
| `security-scanner` | Security Scanner | `SecurityScannerDashboard` | `apps/web-next/src/views/SecurityScannerDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `api-gateway-monitor` | API Gateway | `APIGatewayMonitor` | `apps/web-next/src/views/APIGatewayMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `db-migrations` | DB Migrations | `DatabaseMigrationManager` | `apps/web-next/src/views/DatabaseMigrationManager.tsx` | — | — | UI-only (no RPC wiring) |
| `release-notes` | Release Notes | `ReleaseNotesManager` | `apps/web-next/src/views/ReleaseNotesManager.tsx` | — | — | UI-only (no RPC wiring) |
| `traffic-analytics` | Traffic Analytics | `TrafficAnalyticsDashboard` | `apps/web-next/src/views/TrafficAnalyticsDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `incident-command` | Incident Command | `IncidentCommandCenter` | `apps/web-next/src/views/IncidentCommandCenter.tsx` | — | — | UI-only (no RPC wiring) |
| `env-config` | Env Config | `EnvironmentConfigManager` | `apps/web-next/src/views/EnvironmentConfigManager.tsx` | — | — | UI-only (no RPC wiring) |
| `user-perms` | User Permissions | `UserPermissionManager` | `apps/web-next/src/views/UserPermissionManager.tsx` | — | — | UI-only (no RPC wiring) |
| `infra-cost-mgr` | Infra Cost | `InfrastructureCostManager` | `apps/web-next/src/views/InfrastructureCostManager.tsx` | — | — | UI-only (no RPC wiring) |
| `db-schema-viewer` | DB Schema | `DatabaseSchemaViewer` | `apps/web-next/src/views/DatabaseSchemaViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `deploy-env-mgr` | Deploy Environments | `DeploymentEnvironmentManager` | `apps/web-next/src/views/DeploymentEnvironmentManager.tsx` | — | — | UI-only (no RPC wiring) |
| `ml-experiment` | ML Experiments | `MLExperimentTracker` | `apps/web-next/src/views/MLExperimentTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `disaster-recovery` | Disaster Recovery | `DisasterRecoveryPlanner` | `apps/web-next/src/views/DisasterRecoveryPlanner.tsx` | — | — | UI-only (no RPC wiring) |
| `data-retention` | Data Retention | `DataRetentionManager` | `apps/web-next/src/views/DataRetentionManager.tsx` | — | — | UI-only (no RPC wiring) |
| `code-review` | Code Review | `CodeReviewDashboard` | `apps/web-next/src/views/CodeReviewDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `endpoint-monitor` | Endpoint Monitor | `EndpointMonitor` | `apps/web-next/src/views/EndpointMonitor.tsx` | — | — | UI-only (no RPC wiring) |
| `integration-tests` | Integration Tests | `IntegrationTestRunner` | `apps/web-next/src/views/IntegrationTestRunner.tsx` | — | — | UI-only (no RPC wiring) |
| `session-replay-viewer` | Session Replay Viewer | `SessionReplayViewer` | `apps/web-next/src/views/SessionReplayViewer.tsx` | — | — | UI-only (no RPC wiring) |
| `chaos-engineering` | Chaos Engineering | `ChaosEngineeringDashboard` | `apps/web-next/src/views/ChaosEngineeringDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `dependency-audit` | Dependency Audit | `DependencyAuditDashboard` | `apps/web-next/src/views/DependencyAuditDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `search-analytics` | Search Analytics | `SearchAnalyticsDashboard` | `apps/web-next/src/views/SearchAnalyticsDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `change-approval` | Change Approval | `ChangeApprovalBoard` | `apps/web-next/src/views/ChangeApprovalBoard.tsx` | — | — | UI-only (no RPC wiring) |
| `queue-inspector` | Queue Inspector | `QueueInspector` | `apps/web-next/src/views/QueueInspector.tsx` | — | — | UI-only (no RPC wiring) |
| `db-query-analyzer` | DB Query Analyzer | `DatabaseQueryAnalyzer` | `apps/web-next/src/views/DatabaseQueryAnalyzer.tsx` | — | — | UI-only (no RPC wiring) |
| `feature-flag-manager` | Feature Flag Manager | `FeatureFlagManager` | `apps/web-next/src/views/FeatureFlagManager.tsx` | — | — | UI-only (no RPC wiring) |
| `token-usage` | Token Usage Optimizer | `TokenUsageOptimizer` | `apps/web-next/src/views/TokenUsageOptimizer.tsx` | — | — | UI-only (no RPC wiring) |
| `streaming-debugger` | Streaming Debugger | `StreamingDebugger` | `apps/web-next/src/views/StreamingDebugger.tsx` | — | — | UI-only (no RPC wiring) |
| `sla-compliance` | SLA Compliance | `SLAComplianceTracker` | `apps/web-next/src/views/SLAComplianceTracker.tsx` | — | — | UI-only (no RPC wiring) |
| `agent-collab-graph` | Agent Collab Graph | `AgentCollaborationGraph` | `apps/web-next/src/views/AgentCollaborationGraph.tsx` | — | — | UI-only (no RPC wiring) |
| `cost-breakdown` | Cost Breakdown | `CostBreakdownAnalyzer` | `apps/web-next/src/views/CostBreakdownAnalyzer.tsx` | — | — | UI-only (no RPC wiring) |
| `compliance-policy` | Compliance Policies | `CompliancePolicyEditor` | `apps/web-next/src/views/CompliancePolicyEditor.tsx` | — | — | UI-only (no RPC wiring) |
| `feature-gating` | Feature Gating | `FeatureGatingDashboard` | `apps/web-next/src/views/FeatureGatingDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `service-health-dashboard` | Service Health | `ServiceHealthDashboard` | `apps/web-next/src/views/ServiceHealthDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `data-masking` | Data Masking | `DataMaskingManager` | `apps/web-next/src/views/DataMaskingManager.tsx` | — | — | UI-only (no RPC wiring) |
| `obs-rules-engine` | Observability Rules | `ObservabilityRulesEngine` | `apps/web-next/src/views/ObservabilityRulesEngine.tsx` | — | — | UI-only (no RPC wiring) |
| `agent-rel-topology` | Agent Topology | `AgentRelationshipTopology` | `apps/web-next/src/views/AgentRelationshipTopology.tsx` | — | — | UI-only (no RPC wiring) |
| `tenant-provisioning` | Tenant Provisioning | `TenantProvisioningWizard` | `apps/web-next/src/views/TenantProvisioningWizard.tsx` | — | — | UI-only (no RPC wiring) |
| `billing-audit-log` | Billing Audit Log | `BillingAuditLog` | `apps/web-next/src/views/BillingAuditLog.tsx` | — | — | UI-only (no RPC wiring) |
| `api-rate-limit` | API Rate Limits | `APIRateLimitManager` | `apps/web-next/src/views/APIRateLimitManager.tsx` | — | — | UI-only (no RPC wiring) |
| `env-drift` | Env Drift Detector | `EnvironmentDriftDetector` | `apps/web-next/src/views/EnvironmentDriftDetector.tsx` | — | — | UI-only (no RPC wiring) |
| `workflow-orchestration` | Workflow Orchestration | `WorkflowOrchestrationDashboard` | `apps/web-next/src/views/WorkflowOrchestrationDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `ai-governance` | AI Governance | `AIGovernanceDashboard` | `apps/web-next/src/views/AIGovernanceDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `retention-policy` | Retention Policy Mgr | `DataRetentionPolicyManager` | `apps/web-next/src/views/DataRetentionPolicyManager.tsx` | — | — | UI-only (no RPC wiring) |
| `incident-playbook` | Incident Playbooks | `IncidentResponsePlaybook` | `apps/web-next/src/views/IncidentResponsePlaybook.tsx` | — | — | UI-only (no RPC wiring) |
| `user-journey-analytics` | User Journey Analytics | `UserJourneyAnalytics` | `apps/web-next/src/views/UserJourneyAnalytics.tsx` | — | — | UI-only (no RPC wiring) |
| `security-audit-trail` | Security Audit Trail | `SecurityAuditTrail` | `apps/web-next/src/views/SecurityAuditTrail.tsx` | — | — | UI-only (no RPC wiring) |
| `change-mgmt` | Change Management | `ChangeManagementBoard` | `apps/web-next/src/views/ChangeManagementBoard.tsx` | — | — | UI-only (no RPC wiring) |
| `multi-region-failover` | Multi-Region Failover | `MultiRegionFailoverManager` | `apps/web-next/src/views/MultiRegionFailoverManager.tsx` | — | — | UI-only (no RPC wiring) |
| `cost-allocation` | Cost Allocation | `CostAllocationDashboard` | `apps/web-next/src/views/CostAllocationDashboard.tsx` | — | — | UI-only (no RPC wiring) |
| `session-debug-timeline` | Session Debug Timeline | `SessionDebugTimeline` | `apps/web-next/src/views/SessionDebugTimeline.tsx` | — | — | UI-only (no RPC wiring) |

## Non-routed RPC Components

| Component File | RPC Methods | Notes |
| --- | --- | --- |
| `apps/web-next/src/components/WhatsAppQrLogin.tsx` | `web.login.start`, `web.login.wait` | Used by provider/channel auth flows; not directly routed from App shell. |

## Backend RPC TODO (Large)

- The following methods are used by web-next but are **not found** in gateway method registrations.
- This is a large backend task: define method contracts, implement handlers, add auth scopes, tests, and docs.

- `alerts.dismiss`
  - Used by: `apps/web-next/src/hooks/useMissionControl.ts`
  - Required work: add server method + schema validation + scope mapping + e2e coverage + client error-handling semantics.
- `alerts.list`
  - Used by: `apps/web-next/src/hooks/useMissionControl.ts`
  - Required work: add server method + schema validation + scope mapping + e2e coverage + client error-handling semantics.
- `approvals.approve`
  - Used by: `apps/web-next/src/hooks/useMissionControl.ts`
  - Required work: add server method + schema validation + scope mapping + e2e coverage + client error-handling semantics.
- `approvals.deny`
  - Used by: `apps/web-next/src/hooks/useMissionControl.ts`
  - Required work: add server method + schema validation + scope mapping + e2e coverage + client error-handling semantics.
- `approvals.list`
  - Used by: `apps/web-next/src/hooks/useMissionControl.ts`
  - Required work: add server method + schema validation + scope mapping + e2e coverage + client error-handling semantics.
- `tools.history`
  - Used by: `apps/web-next/src/hooks/useMissionControl.ts`
  - Required work: add server method + schema validation + scope mapping + e2e coverage + client error-handling semantics.

## Notes

- `docs/reference/rpc.md` in the main docs currently describes external RPC adapter patterns, not a web-next view-to-RPC implementation matrix.
- This file is the dedicated comprehensive map for the revamped `apps/web-next` UI.
