import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "./lib/utils";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import { TourOverlay, useTour, DEFAULT_DASHBOARD_TOUR_STEPS } from "./components/Tour";
import {
  DashboardSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  ChatSkeleton,
  ContentSkeleton,
} from "./components/Skeleton";
import { ToastProvider, useToast } from "./components/Toast";
import { ProficiencyProvider, useProficiency } from "./stores/proficiencyStore";
import ProficiencyBadge from "./components/ProficiencyBadge";
import ThemeToggle from "./components/ui/ThemeToggle";
import { useGateway, GatewayProvider } from "./hooks/useGateway";
import { GatewayAuthModal } from "./components/GatewayAuthModal";

// Operator-mode types
interface OperatorDashboardProps {
  onNavigate?: (viewId: string) => void;
}
interface OperatorAICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (viewId: string) => void;
}

// Component prop types
interface ChatInterfaceProps {
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
}

interface AgentSoulEditorProps {
  agentName?: string;
  agentEmoji?: string;
}

// Lazy-load all views with proper typing
const MorningPacket = React.lazy(() => import("./views/MorningPacket"));
const DiscoveryRunMonitor          = React.lazy(() => import("./views/DiscoveryRunMonitor"));
const BraveAPIKeySetupWizard       = React.lazy(() => import("./views/BraveAPIKeySetupWizard"));
const DiscoveryWaveResults         = React.lazy(() => import("./views/DiscoveryWaveResults"));
const DiscoveryAgentCostTracker    = React.lazy(() => import("./views/DiscoveryAgentCostTracker"));
const ToolReliabilityDashboard     = React.lazy(() => import("./views/ToolReliabilityDashboard"));
const ModelComparisonMatrix        = React.lazy(() => import("./views/ModelComparisonMatrix"));
const AgentWaveScheduler           = React.lazy(() => import("./views/AgentWaveScheduler"));
const DiscoveryPreflightChecklist  = React.lazy(() => import("./views/DiscoveryPreflightChecklist"));
const DiscoveryFindingsSearch      = React.lazy(() => import("./views/DiscoveryFindingsSearch"));
const TodayCommandCenter            = React.lazy(() => import("./views/TodayCommandCenter"));
const ActionInboxView               = React.lazy(() => import("./views/ActionInboxView"));
const AgentCapacityPlanner          = React.lazy(() => import("./views/AgentCapacityPlanner"));
const AgentHandoffPlanner           = React.lazy(() => import("./views/AgentHandoffPlanner"));
const CompareModesDiffView          = React.lazy(() => import("./views/CompareModesDiffView"));
const ContextBudgetInspector        = React.lazy(() => import("./views/ContextBudgetInspector"));
const AgentDashboard = React.lazy(() => import("./views/AgentDashboard"));
const AgentBuilderWizard = React.lazy(() => import("./views/AgentBuilderWizard"));
const AgentSoulEditor = React.lazy<React.ComponentType<AgentSoulEditorProps>>(() => import("./views/AgentSoulEditor"));
const AgentIdentityCard = React.lazy(() => import("./views/AgentIdentityCard"));
const ModelSelector = React.lazy(() => import("./views/ModelSelector"));
const ChatInterface = React.lazy<React.ComponentType<ChatInterfaceProps>>(() => import("./views/ChatInterface"));
const CronScheduleBuilder = React.lazy(() => import("./views/CronScheduleBuilder"));
const SkillsMarketplace = React.lazy(() => import("./views/SkillsMarketplace"));
const SkillBuilderEditor = React.lazy(() => import("./views/SkillBuilderEditor"));
const SessionExplorer = React.lazy(() => import("./views/SessionExplorer"));
const OnboardingFlow = React.lazy(() => import("./views/OnboardingFlow"));
const AgentConfigReview = React.lazy(() => import("./views/AgentConfigReview"));
const SettingsDashboard = React.lazy(() => import("./views/SettingsDashboard"));
const NodeManager = React.lazy(() => import("./views/NodeManager"));
const UsageDashboard = React.lazy(() => import("./views/UsageDashboard"));
const WorkspaceFileBrowser = React.lazy(() => import("./views/WorkspaceFileBrowser"));
const ProviderAuthManager = React.lazy(() => import("./views/ProviderAuthManager"));
const AgentPulseMonitor = React.lazy(() => import("./views/AgentPulseMonitor"));
const NotificationCenter = React.lazy(() => import("./views/NotificationCenter"));
import { useNotificationUnreadCount } from "./views/NotificationCenter";
const ApiKeysManager = React.lazy(() => import("./views/ApiKeysManager"));
const AuditLog = React.lazy(() => import("./views/AuditLog"));
const BillingSubscription = React.lazy(() => import("./views/BillingSubscription"));
const SystemHealth = React.lazy(() => import("./views/SystemHealth"));
const IntegrationHub = React.lazy(() => import("./views/IntegrationHub"));
const TeamManagement = React.lazy(() => import("./views/TeamManagement"));
const GlobalSearch = React.lazy(() => import("./views/GlobalSearch"));
const PromptLibrary = React.lazy(() => import("./views/PromptLibrary"));
const DataExportManager = React.lazy(() => import("./views/DataExportManager"));
const VoiceInterface = React.lazy(() => import("./views/VoiceInterface"));
const AgentInsights = React.lazy(() => import("./views/AgentInsights"));
const DeveloperConsole = React.lazy(() => import("./views/DeveloperConsole"));
const SecurityDashboard = React.lazy(() => import("./views/SecurityDashboard"));
const ChangelogView = React.lazy(() => import("./views/ChangelogView"));
const EnvironmentManager = React.lazy(() => import("./views/EnvironmentManager"));
const FeatureFlags = React.lazy(() => import("./views/FeatureFlags"));
const AgentComparison = React.lazy(() => import("./views/AgentComparison"));
const KnowledgeBase   = React.lazy(() => import("./views/KnowledgeBase"));
const CrashReporter   = React.lazy(() => import("./views/CrashReporter"));
const ModelBenchmark  = React.lazy(() => import("./views/ModelBenchmark"));
const RateLimitDashboard = React.lazy(() => import("./views/RateLimitDashboard"));
const TaskQueue       = React.lazy(() => import("./views/TaskQueue"));
const StorageExplorer = React.lazy(() => import("./views/StorageExplorer"));
const AlertCenter          = React.lazy(() => import("./views/AlertCenter"));
const MissionControlDashboard = React.lazy(() => import("./views/MissionControlDashboard"));
const WebhookManager       = React.lazy(() => import("./views/WebhookManager"));
const ConversationHistory  = React.lazy(() => import("./views/ConversationHistory"));
const AgentScheduler       = React.lazy(() => import("./views/AgentScheduler"));
const TokenLedger          = React.lazy(() => import("./views/TokenLedger"));
const ThemeEditor          = React.lazy(() => import("./views/ThemeEditor"));
const PermissionsManager   = React.lazy(() => import("./views/PermissionsManager"));
const ActivityFeed         = React.lazy(() => import("./views/ActivityFeed"));
const CommandPalette       = React.lazy(() => import("./views/CommandPalette"));
const CommandPaletteV2     = React.lazy(() => import("./views/CommandPaletteV2"));
const SupportCenter        = React.lazy(() => import("./views/SupportCenter"));
const ReleasePipeline      = React.lazy(() => import("./views/ReleasePipeline"));
const AgentMemoryViewer    = React.lazy(() => import("./views/AgentMemoryViewer"));
const NetworkInspector     = React.lazy(() => import("./views/NetworkInspector"));
const AnalyticsOverview    = React.lazy(() => import("./views/AnalyticsOverview"));
const OnboardingChecklist  = React.lazy(() => import("./views/OnboardingChecklist"));
const AgentWorkload        = React.lazy(() => import("./views/AgentWorkload"));
const ApiPlayground        = React.lazy(() => import("./views/ApiPlayground"));
const WorkspaceSettings    = React.lazy(() => import("./views/WorkspaceSettings"));
const AgentTracer          = React.lazy(() => import("./views/AgentTracer"));
const DataPipelineViewer   = React.lazy(() => import("./views/DataPipelineViewer"));
const CostOptimizer        = React.lazy(() => import("./views/CostOptimizer"));
const PluginManager        = React.lazy(() => import("./views/PluginManager"));
const LogViewer            = React.lazy(() => import("./views/LogViewer"));
const LLMPlayground        = React.lazy(() => import("./views/LLMPlayground"));
const ABTestManager        = React.lazy(() => import("./views/ABTestManager"));
const QuotaManager         = React.lazy(() => import("./views/QuotaManager"));
const AgentDiffViewer      = React.lazy(() => import("./views/AgentDiffViewer"));
const MCPInspector         = React.lazy(() => import("./views/MCPInspector"));
const ModelRouter          = React.lazy(() => import("./views/ModelRouter"));
const SessionReplay        = React.lazy(() => import("./views/SessionReplay"));
const ConfigValidatorView  = React.lazy(() => import("./views/ConfigValidatorView"));
const ContextWindowViewer  = React.lazy(() => import("./views/ContextWindowViewer"));
const AgentInbox           = React.lazy(() => import("./views/AgentInbox"));
const DependencyGraph      = React.lazy(() => import("./views/DependencyGraph"));
const GoalTracker          = React.lazy(() => import("./views/GoalTracker"));
const ResourceMonitor      = React.lazy(() => import("./views/ResourceMonitor"));
const ServiceMap           = React.lazy(() => import("./views/ServiceMap"));
const PromptOptimizer      = React.lazy(() => import("./views/PromptOptimizer"));
const TeamDirectory        = React.lazy(() => import("./views/TeamDirectory"));
const WorkflowBuilder      = React.lazy(() => import("./views/WorkflowBuilder"));
const TokenBudgetPlanner   = React.lazy(() => import("./views/TokenBudgetPlanner"));
const SandboxRunner        = React.lazy(() => import("./views/SandboxRunner"));
const MetricsDrilldown     = React.lazy(() => import("./views/MetricsDrilldown"));
const EmbeddingExplorer    = React.lazy(() => import("./views/EmbeddingExplorer"));
const RuleEngine           = React.lazy(() => import("./views/RuleEngine"));
const TelemetryViewer      = React.lazy(() => import("./views/TelemetryViewer"));
const ModelHealthDashboard = React.lazy(() => import("./views/ModelHealthDashboard"));
const ActivityTimeline     = React.lazy(() => import("./views/ActivityTimeline"));
const PolicyManager        = React.lazy(() => import("./views/PolicyManager"));
const VersionControl       = React.lazy(() => import("./views/VersionControl"));
const ScoreCard            = React.lazy(() => import("./views/ScoreCard"));
const CapacityPlanner      = React.lazy(() => import("./views/CapacityPlanner"));
const ExperimentDashboard  = React.lazy(() => import("./views/ExperimentDashboard"));
const SearchResultsView    = React.lazy(() => import("./views/SearchResultsView"));
const HealthChecklist      = React.lazy(() => import("./views/HealthChecklist"));
const BudgetTracker        = React.lazy(() => import("./views/BudgetTracker"));
const ChatRoomView         = React.lazy(() => import("./views/ChatRoomView"));
const ReportGenerator      = React.lazy(() => import("./views/ReportGenerator"));
const AccessControlMatrix  = React.lazy(() => import("./views/AccessControlMatrix"));
const InfrastructureMap    = React.lazy(() => import("./views/InfrastructureMap"));
const StatusPageBuilder    = React.lazy(() => import("./views/StatusPageBuilder"));
const DiffViewer           = React.lazy(() => import("./views/DiffViewer"));
const OncallScheduler      = React.lazy(() => import("./views/OncallScheduler"));
const DataQualityDashboard = React.lazy(() => import("./views/DataQualityDashboard"));
const EventScheduler       = React.lazy(() => import("./views/EventScheduler"));
const SlackIntegrationManager = React.lazy(() => import("./views/SlackIntegrationManager"));
const UserJourneyMap       = React.lazy(() => import("./views/UserJourneyMap"));
const MemoryProfiler       = React.lazy(() => import("./views/MemoryProfiler"));
const ErrorBudgetTracker   = React.lazy(() => import("./views/ErrorBudgetTracker"));
const MultiModelComparator = React.lazy(() => import("./views/MultiModelComparator"));
const ContextBrowser       = React.lazy(() => import("./views/ContextBrowser"));
const GitHubIntegration    = React.lazy(() => import("./views/GitHubIntegration"));
const FunnelAnalytics      = React.lazy(() => import("./views/FunnelAnalytics"));
const SprintBoard          = React.lazy(() => import("./views/SprintBoard"));
const CostForecast         = React.lazy(() => import("./views/CostForecast"));
const ThreatIntelligenceFeed = React.lazy(() => import("./views/ThreatIntelligenceFeed"));
const PipelineMonitor      = React.lazy(() => import("./views/PipelineMonitor"));
const A11yAuditDashboard   = React.lazy(() => import("./views/A11yAuditDashboard"));
const DesignTokenManager   = React.lazy(() => import("./views/DesignTokenManager"));
const WebhookPlayground    = React.lazy(() => import("./views/WebhookPlayground"));
const SLAManager           = React.lazy(() => import("./views/SLAManager"));
const DocumentationViewer  = React.lazy(() => import("./views/DocumentationViewer"));
const GanttChartView       = React.lazy(() => import("./views/GanttChartView"));
const CustomerFeedbackDashboard = React.lazy(() => import("./views/CustomerFeedbackDashboard"));
const SecurityPolicyEditor  = React.lazy(() => import("./views/SecurityPolicyEditor"));
const TeamCollaboration     = React.lazy(() => import("./views/TeamCollaboration"));
const MigrationManager     = React.lazy(() => import("./views/MigrationManager"));
const LocalizationManager  = React.lazy(() => import("./views/LocalizationManager"));
const MultiTenantManager   = React.lazy(() => import("./views/MultiTenantManager"));
const MLModelRegistry      = React.lazy(() => import("./views/MLModelRegistry"));
const EventStreamViewer    = React.lazy(() => import("./views/EventStreamViewer"));
const PermissionsMatrix    = React.lazy(() => import("./views/PermissionsMatrix"));
const ChangelogViewer        = React.lazy(() => import("./views/ChangelogViewer"));
const ResourceQuotaManager   = React.lazy(() => import("./views/ResourceQuotaManager"));
const DatabaseQueryBuilder    = React.lazy(() => import("./views/DatabaseQueryBuilder"));
const InvoiceManager          = React.lazy(() => import("./views/InvoiceManager"));
const NetworkTopologyViewer   = React.lazy(() => import("./views/NetworkTopologyViewer"));
const ComplianceDashboard     = React.lazy(() => import("./views/ComplianceDashboard"));
const UserSegmentation        = React.lazy(() => import("./views/UserSegmentation"));
const DeploymentTracker       = React.lazy(() => import("./views/DeploymentTracker"));
const ContentModerationQueue  = React.lazy(() => import("./views/ContentModerationQueue"));
const PricingCalculator       = React.lazy(() => import("./views/PricingCalculator"));
const TechRadar               = React.lazy(() => import("./views/TechRadar"));
const IncidentPostmortem      = React.lazy(() => import("./views/IncidentPostmortem"));
const AccessTokenManager      = React.lazy(() => import("./views/AccessTokenManager"));
const KubernetesClusterViewer  = React.lazy(() => import("./views/KubernetesClusterViewer"));
const CohortAnalysisDashboard  = React.lazy(() => import("./views/CohortAnalysisDashboard"));
const SentimentAnalysisViewer  = React.lazy(() => import("./views/SentimentAnalysisViewer"));
const GraphQLExplorer          = React.lazy(() => import("./views/GraphQLExplorer"));
const BackupManager              = React.lazy(() => import("./views/BackupManager"));
const VectorDatabaseViewer       = React.lazy(() => import("./views/VectorDatabaseViewer"));
const DocumentTemplateBuilder    = React.lazy(() => import("./views/DocumentTemplateBuilder"));
const ServiceAccountManager      = React.lazy(() => import("./views/ServiceAccountManager"));
const ContainerRegistry          = React.lazy(() => import("./views/ContainerRegistry"));
const EmailCampaignManager       = React.lazy(() => import("./views/EmailCampaignManager"));
const ChangeDataCapture          = React.lazy(() => import("./views/ChangeDataCapture"));
const FleetDeviceManager         = React.lazy(() => import("./views/FleetDeviceManager"));
const CDNManager                 = React.lazy(() => import("./views/CDNManager"));
const GeofenceManager            = React.lazy(() => import("./views/GeofenceManager"));
const ScimUserProvisioner        = React.lazy(() => import("./views/ScimUserProvisioner"));
const LicenseManager             = React.lazy(() => import("./views/LicenseManager"));
const MessageQueueManager        = React.lazy(() => import("./views/MessageQueueManager"));
const TenantUsageDashboard       = React.lazy(() => import("./views/TenantUsageDashboard"));
const CertificateManager         = React.lazy(() => import("./views/CertificateManager"));
const FinancialReportingDashboard = React.lazy(() => import("./views/FinancialReportingDashboard"));
const OpenAPIExplorer            = React.lazy(() => import("./views/OpenAPIExplorer"));
const DataLineageViewer          = React.lazy(() => import("./views/DataLineageViewer"));
const StorageBucketManager       = React.lazy(() => import("./views/StorageBucketManager"));
const AIPromptRouter             = React.lazy(() => import("./views/AIPromptRouter"));
const ObservabilityDashboard     = React.lazy(() => import("./views/ObservabilityDashboard"));
const AccessControlManager       = React.lazy(() => import("./views/AccessControlManager"));
const ErrorTrackingDashboard     = React.lazy(() => import("./views/ErrorTrackingDashboard"));
const ComplianceTracker          = React.lazy(() => import("./views/ComplianceTracker"));
const SSOConfigManager           = React.lazy(() => import("./views/SSOConfigManager"));
const ContentCalendar            = React.lazy(() => import("./views/ContentCalendar"));
const InfrastructureCostOptimizer = React.lazy(() => import("./views/InfrastructureCostOptimizer"));
const APIGatewayManager          = React.lazy(() => import("./views/APIGatewayManager"));
const CostAnomalyDetector        = React.lazy(() => import("./views/CostAnomalyDetector"));
const KnowledgeGraphViewer       = React.lazy(() => import("./views/KnowledgeGraphViewer"));
const WorkflowOrchestrator       = React.lazy(() => import("./views/WorkflowOrchestrator"));
const ResourceTagManager         = React.lazy(() => import("./views/ResourceTagManager"));
const CapacityForecastDashboard  = React.lazy(() => import("./views/CapacityForecastDashboard"));
const EventCatalogBrowser        = React.lazy(() => import("./views/EventCatalogBrowser"));
const SecurityScanDashboard      = React.lazy(() => import("./views/SecurityScanDashboard"));
const DataPrivacyDashboard       = React.lazy(() => import("./views/DataPrivacyDashboard"));
const UserOnboardingFlow         = React.lazy(() => import("./views/UserOnboardingFlow"));
const QueryPerformanceAnalyzer   = React.lazy(() => import("./views/QueryPerformanceAnalyzer"));
const ServiceMeshViewer          = React.lazy(() => import("./views/ServiceMeshViewer"));
const MultiRegionDashboard       = React.lazy(() => import("./views/MultiRegionDashboard"));
const RevenueAnalyticsDashboard  = React.lazy(() => import("./views/RevenueAnalyticsDashboard"));
const VaultSecretsManager        = React.lazy(() => import("./views/VaultSecretsManager"));
const MLPipelineMonitor          = React.lazy(() => import("./views/MLPipelineMonitor"));
const IncidentTimeline           = React.lazy(() => import("./views/IncidentTimeline"));
const TestResultsDashboard       = React.lazy(() => import("./views/TestResultsDashboard"));
const CustomerSuccessDashboard       = React.lazy(() => import("./views/CustomerSuccessDashboard"));
const ContainerLogViewer             = React.lazy(() => import("./views/ContainerLogViewer"));
const InfrastructureDriftDetector    = React.lazy(() => import("./views/InfrastructureDriftDetector"));
const AnnouncementCenter             = React.lazy(() => import("./views/AnnouncementCenter"));
const DatabaseSchemaExplorer         = React.lazy(() => import("./views/DatabaseSchemaExplorer"));
const SupportTicketDashboard         = React.lazy(() => import("./views/SupportTicketDashboard"));
const APIChangelogManager            = React.lazy(() => import("./views/APIChangelogManager"));
const ProductTourBuilder             = React.lazy(() => import("./views/ProductTourBuilder"));
const NetworkFirewallRuleManager     = React.lazy(() => import("./views/NetworkFirewallRuleManager"));
const ObservabilityAlertManager      = React.lazy(() => import("./views/ObservabilityAlertManager"));
const CloudCostOptimizer             = React.lazy(() => import("./views/CloudCostOptimizer"));
const NetworkBandwidthMonitor        = React.lazy(() => import("./views/NetworkBandwidthMonitor"));
const ServiceDependencyMap           = React.lazy(() => import("./views/ServiceDependencyMap"));
const FeatureRequestBoard            = React.lazy(() => import("./views/FeatureRequestBoard"));
const DataCatalog                    = React.lazy(() => import("./views/DataCatalog"));
const OnCallRotationManager          = React.lazy(() => import("./views/OnCallRotationManager"));
const ResourceInventoryDashboard     = React.lazy(() => import("./views/ResourceInventoryDashboard"));
const WebhookDebugger                = React.lazy(() => import("./views/WebhookDebugger"));
const CostAttributionDashboard       = React.lazy(() => import("./views/CostAttributionDashboard"));
const LogAggregatorView              = React.lazy(() => import("./views/LogAggregatorView"));
const UserDeviceManager              = React.lazy(() => import("./views/UserDeviceManager"));
const SecurityScannerDashboard       = React.lazy(() => import("./views/SecurityScannerDashboard"));
const APIGatewayMonitor              = React.lazy(() => import("./views/APIGatewayMonitor"));
const DatabaseMigrationManager       = React.lazy(() => import("./views/DatabaseMigrationManager"));
const ReleaseNotesManager            = React.lazy(() => import("./views/ReleaseNotesManager"));
const TrafficAnalyticsDashboard      = React.lazy(() => import("./views/TrafficAnalyticsDashboard"));
const IncidentCommandCenter          = React.lazy(() => import("./views/IncidentCommandCenter"));
const EnvironmentConfigManager       = React.lazy(() => import("./views/EnvironmentConfigManager"));
const UserPermissionManager          = React.lazy(() => import("./views/UserPermissionManager"));
const InfrastructureCostManager      = React.lazy(() => import("./views/InfrastructureCostManager"));
const SessionReplayViewer            = React.lazy(() => import("./views/SessionReplayViewer"));
const TokenUsageOptimizer            = React.lazy(() => import("./views/TokenUsageOptimizer"));
const StreamingDebugger              = React.lazy(() => import("./views/StreamingDebugger"));
const AgentCollaborationGraph        = React.lazy(() => import("./views/AgentCollaborationGraph"));
const IntegrationTestRunner          = React.lazy(() => import("./views/IntegrationTestRunner"));
const SLAComplianceTracker           = React.lazy(() => import("./views/SLAComplianceTracker"));
const CostBreakdownAnalyzer          = React.lazy(() => import("./views/CostBreakdownAnalyzer"));
const CompliancePolicyEditor         = React.lazy(() => import("./views/CompliancePolicyEditor"));
const FeatureGatingDashboard         = React.lazy(() => import("./views/FeatureGatingDashboard"));
const ServiceHealthDashboard         = React.lazy(() => import("./views/ServiceHealthDashboard"));
const DataMaskingManager             = React.lazy(() => import("./views/DataMaskingManager"));
const ObservabilityRulesEngine       = React.lazy(() => import("./views/ObservabilityRulesEngine"));
const AgentRelationshipTopology      = React.lazy(() => import("./views/AgentRelationshipTopology"));
const TenantProvisioningWizard       = React.lazy(() => import("./views/TenantProvisioningWizard"));
const BillingAuditLog                = React.lazy(() => import("./views/BillingAuditLog"));
const APIRateLimitManager            = React.lazy(() => import("./views/APIRateLimitManager"));
const EnvironmentDriftDetector       = React.lazy(() => import("./views/EnvironmentDriftDetector"));
const WorkflowOrchestrationDashboard = React.lazy(() => import("./views/WorkflowOrchestrationDashboard"));
const AIGovernanceDashboard          = React.lazy(() => import("./views/AIGovernanceDashboard"));
const DataRetentionPolicyManager     = React.lazy(() => import("./views/DataRetentionPolicyManager"));
const IncidentResponsePlaybook       = React.lazy(() => import("./views/IncidentResponsePlaybook"));
const UserJourneyAnalytics           = React.lazy(() => import("./views/UserJourneyAnalytics"));
const SecurityAuditTrail             = React.lazy(() => import("./views/SecurityAuditTrail"));
const ChangeManagementBoard          = React.lazy(() => import("./views/ChangeManagementBoard"));
const MultiRegionFailoverManager     = React.lazy(() => import("./views/MultiRegionFailoverManager"));
const CostAllocationDashboard        = React.lazy(() => import("./views/CostAllocationDashboard"));
const SessionDebugTimeline           = React.lazy(() => import("./views/SessionDebugTimeline"));
const DatabaseSchemaViewer           = React.lazy(() => import("./views/DatabaseSchemaViewer"));
const DeploymentEnvironmentManager   = React.lazy(() => import("./views/DeploymentEnvironmentManager"));
const MLExperimentTracker            = React.lazy(() => import("./views/MLExperimentTracker"));
const DisasterRecoveryPlanner        = React.lazy(() => import("./views/DisasterRecoveryPlanner"));
const DataRetentionManager           = React.lazy(() => import("./views/DataRetentionManager"));
const CodeReviewDashboard            = React.lazy(() => import("./views/CodeReviewDashboard"));
const EndpointMonitor                = React.lazy(() => import("./views/EndpointMonitor"));
const ChaosEngineeringDashboard      = React.lazy(() => import("./views/ChaosEngineeringDashboard"));
const DependencyAuditDashboard       = React.lazy(() => import("./views/DependencyAuditDashboard"));
const SearchAnalyticsDashboard       = React.lazy(() => import("./views/SearchAnalyticsDashboard"));
const ChangeApprovalBoard            = React.lazy(() => import("./views/ChangeApprovalBoard"));
const QueueInspector                 = React.lazy(() => import("./views/QueueInspector"));
const DatabaseQueryAnalyzer          = React.lazy(() => import("./views/DatabaseQueryAnalyzer"));
const FeatureFlagManager             = React.lazy(() => import("./views/FeatureFlagManager"));

// Operator Dashboard views
const OperatorDashboard    = React.lazy<React.ComponentType<OperatorDashboardProps>>(() => import("./views/OperatorDashboard"));
const OperatorAICopilot    = React.lazy<React.ComponentType<OperatorAICopilotProps>>(() => import("./views/OperatorAICopilot"));
const LiveLogTail          = React.lazy(() => import("./views/LiveLogTail"));
const DecisionProvenance   = React.lazy(() => import("./views/DecisionProvenance"));

// ============================================================================
// Navigation Groups — Operator vs Standard mode
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  emoji: string;
  shortcut: string | null;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const operatorNavGroups: NavGroup[] = [
  {
    id: "ops-command",
    label: "Command Center",
    items: [
      { id: "operator-dashboard", label: "Operator Dashboard", emoji: "🖥️", shortcut: "1" },
      { id: "live-logs",          label: "Live Log Tail",      emoji: "📜", shortcut: "2" },
      { id: "decision-provenance", label: "Decision Provenance", emoji: "🧠", shortcut: "3" },
    ],
  },
  {
    id: "ops-monitoring",
    label: "Monitoring",
    items: [
      { id: "pulse",              label: "Agent Pulse",        emoji: "📡", shortcut: null },
      { id: "system-health",      label: "System Health",      emoji: "🩺", shortcut: null },
      { id: "alerts",             label: "Alert Center",       emoji: "🚨", shortcut: null },
      { id: "telemetry",          label: "Telemetry",          emoji: "📡", shortcut: null },
      { id: "model-health",       label: "Model Health",       emoji: "💚", shortcut: null },
      { id: "logs",               label: "Log Viewer",         emoji: "📜", shortcut: null },
    ],
  },
  {
    id: "ops-sessions",
    label: "Sessions & Agents",
    items: [
      { id: "sessions",           label: "Sessions",           emoji: "🌳", shortcut: null },
      { id: "tracer",             label: "Agent Tracer",       emoji: "🔭", shortcut: null },
      { id: "workload",           label: "Agent Workload",     emoji: "👥", shortcut: null },
      { id: "agent-insights",     label: "Agent Insights",     emoji: "📊", shortcut: null },
      { id: "history",            label: "Session History",    emoji: "🕐", shortcut: null },
      { id: "session-replay",     label: "Session Replay",     emoji: "▶️", shortcut: null },
      { id: "mcp",                label: "MCP Inspector",      emoji: "🔧", shortcut: null },
    ],
  },
  {
    id: "ops-cost",
    label: "Budget & Cost",
    items: [
      { id: "usage",              label: "Usage & Costs",      emoji: "📈", shortcut: null },
      { id: "token-ledger",       label: "Token Ledger",       emoji: "🪙", shortcut: null },
      { id: "budget-tracker",     label: "Budget Tracker",     emoji: "💵", shortcut: null },
      { id: "cost",               label: "Cost Optimizer",     emoji: "💰", shortcut: null },
      { id: "rate-limits",        label: "Rate Limits",        emoji: "⚡", shortcut: null },
      { id: "quotas",             label: "Quotas",             emoji: "📏", shortcut: null },
    ],
  },
  {
    id: "ops-models",
    label: "Models & Routing",
    items: [
      { id: "models",             label: "Models",             emoji: "🤖", shortcut: null },
      { id: "model-router",       label: "Model Router",       emoji: "🔀", shortcut: null },
      { id: "benchmark",          label: "Model Benchmark",    emoji: "📈", shortcut: null },
      { id: "model-compare",      label: "Model Comparator",   emoji: "⚖️", shortcut: null },
      { id: "providers",          label: "Providers",          emoji: "🔐", shortcut: null },
      { id: "llm-playground",     label: "LLM Playground",     emoji: "🎮", shortcut: null },
    ],
  },
  {
    id: "ops-config",
    label: "Configuration",
    items: [
      { id: "settings",           label: "Settings",           emoji: "⚙️", shortcut: null },
      { id: "config-review",      label: "Config Review",      emoji: "🔍", shortcut: null },
      { id: "cron",               label: "Schedules",          emoji: "⏰", shortcut: null },
      { id: "feature-flags",      label: "Feature Flags",      emoji: "🚩", shortcut: null },
      { id: "permissions",        label: "Permissions",        emoji: "🔐", shortcut: null },
      { id: "env-vars",           label: "Environment",        emoji: "🔑", shortcut: null },
      { id: "rules",              label: "Rule Engine",        emoji: "📋", shortcut: null },
    ],
  },
];

export const navItems = [
  { id: "operator-dashboard",    label: "Operator Dashboard",   emoji: "🖥️", shortcut: null },
  { id: "live-logs",             label: "Live Log Tail",        emoji: "📜", shortcut: null },
  { id: "decision-provenance",   label: "Decision Provenance",  emoji: "🧠", shortcut: null },
  { id: "morning-packet",        label: "Morning Packet",       emoji: "☀️", shortcut: null },
  { id: "today-command",         label: "Today Command Center", emoji: "🧭", shortcut: null },
  { id: "action-inbox",          label: "Action Inbox",         emoji: "📥", shortcut: null },
  { id: "capacity-planner",      label: "Capacity Planner",     emoji: "📐", shortcut: null },
  { id: "handoff-planner",       label: "Handoff Planner",      emoji: "🤝", shortcut: null },
  { id: "compare-modes",         label: "Compare Modes",        emoji: "🪞", shortcut: null },
  { id: "context-budget",        label: "Context Budget",       emoji: "🧠", shortcut: null },
  { id: "discovery-run-monitor",   label: "Discovery Monitor",    emoji: "🔭", shortcut: null },
  { id: "brave-api-wizard",        label: "Brave API Setup",      emoji: "🔑", shortcut: null },
  { id: "discovery-wave-results",  label: "Wave Results",         emoji: "🌊", shortcut: null },
  { id: "agent-cost-tracker",      label: "Agent Cost Tracker",   emoji: "💰", shortcut: null },
  { id: "tool-reliability",        label: "Tool Reliability",     emoji: "🛡️", shortcut: null },
  { id: "model-comparison",       label: "Model Comparison",      emoji: "⚖️", shortcut: null },
  { id: "wave-scheduler",         label: "Wave Scheduler",        emoji: "🗓️", shortcut: null },
  { id: "preflight-checklist",    label: "Preflight Checklist",   emoji: "✅", shortcut: null },
  { id: "findings-search",        label: "Findings Search",       emoji: "🔎", shortcut: null },
  { id: "dashboard",             label: "Dashboard",             emoji: "📊", shortcut: "1" },
  { id: "chat",          label: "Chat",           emoji: "💬", shortcut: "2" },
  { id: "builder",       label: "Agent Builder",  emoji: "🔧", shortcut: "3" },
  { id: "soul-editor",   label: "Soul Editor",    emoji: "✨", shortcut: "4" },
  { id: "identity",      label: "Identity Cards", emoji: "🪪", shortcut: "5" },
  { id: "models",        label: "Models",         emoji: "🤖", shortcut: "6" },
  { id: "providers",     label: "Providers",      emoji: "🔐", shortcut: "7" },
  { id: "cron",          label: "Schedules",      emoji: "⏰", shortcut: "8" },
  { id: "skills",        label: "Skills",         emoji: "🧩", shortcut: "9" },
  { id: "skill-builder", label: "Skill Builder",  emoji: "🔨", shortcut: null },
  { id: "sessions",      label: "Sessions",       emoji: "🌳", shortcut: null },
  { id: "config-review", label: "Config Review",  emoji: "🔍", shortcut: null },
  { id: "settings",      label: "Settings",       emoji: "⚙️", shortcut: null },
  { id: "nodes",         label: "Nodes",          emoji: "📱", shortcut: null },
  { id: "usage",         label: "Usage & Costs",  emoji: "📈", shortcut: null },
  { id: "files",         label: "Files",          emoji: "📁", shortcut: null },
  { id: "onboarding",    label: "Onboarding",     emoji: "🚀", shortcut: null },
  { id: "pulse",         label: "Agent Pulse",    emoji: "📡", shortcut: null },
  { id: "notifications", label: "Notifications",  emoji: "🔔", shortcut: null },
  { id: "api-keys",      label: "API & Integrations", emoji: "🗝️", shortcut: null },
  { id: "audit-log",    label: "Audit Log",          emoji: "🔎", shortcut: null },
  { id: "billing",      label: "Billing",            emoji: "💳", shortcut: null },
  { id: "system-health",    label: "System Health",  emoji: "🩺", shortcut: null },
  { id: "integrations",     label: "Integrations",   emoji: "🔌", shortcut: null },
  { id: "team",             label: "Team",           emoji: "👥", shortcut: null },
  { id: "search",           label: "Search",         emoji: "🔍", shortcut: null },
  { id: "prompts",          label: "Prompt Library", emoji: "📝", shortcut: null },
  { id: "exports",          label: "Data Export",    emoji: "📦", shortcut: null },
  { id: "voice",            label: "Voice",          emoji: "🎙️", shortcut: null },
  { id: "agent-insights",   label: "Agent Insights", emoji: "📊", shortcut: null },
  { id: "dev-console",      label: "Dev Console",    emoji: "🖥️", shortcut: null },
  { id: "security",         label: "Security",       emoji: "🛡️", shortcut: null },
  { id: "changelog",        label: "What's New",     emoji: "🎉", shortcut: null },
  { id: "env-vars",         label: "Environment",    emoji: "🔑", shortcut: null },
  { id: "feature-flags",   label: "Feature Flags",  emoji: "🚩", shortcut: null },
  { id: "agent-compare",   label: "Agent Compare",  emoji: "⚖️", shortcut: null },
  { id: "knowledge",       label: "Knowledge Base", emoji: "📚", shortcut: null },
  { id: "crashes",         label: "Crash Reports",  emoji: "💥", shortcut: null },
  { id: "benchmark",       label: "Model Benchmark", emoji: "📈", shortcut: null },
  { id: "rate-limits",     label: "Rate Limits",    emoji: "⚡", shortcut: null },
  { id: "task-queue",      label: "Task Queue",     emoji: "📬", shortcut: null },
  { id: "storage",         label: "Storage",        emoji: "💾", shortcut: null },
  { id: "alerts",          label: "Alert Center",   emoji: "🚨", shortcut: null },
  { id: "mission-control", label: "Mission Control", emoji: "🎯", shortcut: null },
  { id: "webhooks",        label: "Webhooks",       emoji: "🔗", shortcut: null },
  { id: "history",         label: "Session History", emoji: "🕐", shortcut: null },
  { id: "scheduler",       label: "Scheduler",      emoji: "⏰", shortcut: null },
  { id: "token-ledger",    label: "Token Ledger",   emoji: "🪙", shortcut: null },
  { id: "theme-editor",    label: "Theme Editor",   emoji: "🎨", shortcut: null },
  { id: "permissions",     label: "Permissions",    emoji: "🔐", shortcut: null },
  { id: "activity",        label: "Activity Feed",  emoji: "📋", shortcut: null },
  { id: "commands",        label: "Commands",       emoji: "⌨️", shortcut: null },
  { id: "commands-v2",     label: "Commands V2",    emoji: "🔮", shortcut: null },
  { id: "support",         label: "Support",        emoji: "🎫", shortcut: null },
  { id: "releases",        label: "Releases",       emoji: "🚢", shortcut: null },
  { id: "memory",          label: "Agent Memory",   emoji: "🧠", shortcut: null },
  { id: "network",         label: "Network",        emoji: "🌐", shortcut: null },
  { id: "analytics",       label: "Analytics",      emoji: "📉", shortcut: null },
  { id: "setup",           label: "Setup Guide",    emoji: "✅", shortcut: null },
  { id: "workload",        label: "Agent Workload", emoji: "👥", shortcut: null },
  { id: "api-playground",  label: "API Playground", emoji: "🔬", shortcut: null },
  { id: "workspace",       label: "Workspace",      emoji: "🏠", shortcut: null },
  { id: "tracer",          label: "Agent Tracer",   emoji: "🔭", shortcut: null },
  { id: "pipelines",       label: "Pipelines",      emoji: "🔀", shortcut: null },
  { id: "cost",            label: "Cost Optimizer", emoji: "💰", shortcut: null },
  { id: "plugins",         label: "Plugins",        emoji: "🧩", shortcut: null },
  { id: "logs",            label: "Log Viewer",     emoji: "📜", shortcut: null },
  { id: "llm-playground",  label: "LLM Playground", emoji: "🎮", shortcut: null },
  { id: "ab-tests",        label: "A/B Tests",      emoji: "🧪", shortcut: null },
  { id: "quotas",          label: "Quotas",         emoji: "📏", shortcut: null },
  { id: "agent-diff",      label: "Agent Diff",     emoji: "🔍", shortcut: null },
  { id: "mcp",             label: "MCP Inspector",  emoji: "🔧", shortcut: null },
  { id: "model-router",    label: "Model Router",   emoji: "🔀", shortcut: null },
  { id: "session-replay",  label: "Session Replay", emoji: "▶️", shortcut: null },
  { id: "config-validator", label: "Config Validator", emoji: "✅", shortcut: null },
  { id: "context-window",  label: "Context Window",  emoji: "🪟", shortcut: null },
  { id: "inbox",           label: "Agent Inbox",    emoji: "📬", shortcut: null },
  { id: "dep-graph",       label: "Dependency Graph", emoji: "🕸️", shortcut: null },
  { id: "goals",           label: "Goal Tracker",   emoji: "🎯", shortcut: null },
  { id: "resources",       label: "Resources",      emoji: "📊", shortcut: null },
  { id: "service-map",     label: "Service Map",    emoji: "🗺️", shortcut: null },
  { id: "prompt-optimizer", label: "Prompt Optimizer", emoji: "✨", shortcut: null },
  { id: "directory",        label: "Team Directory",   emoji: "👥", shortcut: null },
  { id: "workflows",        label: "Workflow Builder",  emoji: "🔄", shortcut: null },
  { id: "token-budget",     label: "Token Budget",      emoji: "💰", shortcut: null },
  { id: "sandbox",          label: "Sandbox Runner",    emoji: "🧪", shortcut: null },
  { id: "metrics",          label: "Metrics Drilldown", emoji: "📊", shortcut: null },
  { id: "embeddings",       label: "Embedding Explorer", emoji: "🧭", shortcut: null },
  { id: "rules",            label: "Rule Engine",       emoji: "📋", shortcut: null },
  { id: "telemetry",        label: "Telemetry Viewer",  emoji: "📡", shortcut: null },
  { id: "model-health",     label: "Model Health",      emoji: "💚", shortcut: null },
  { id: "timeline",         label: "Activity Timeline", emoji: "📅", shortcut: null },
  { id: "policies",         label: "Policy Manager",    emoji: "⚖️", shortcut: null },
  { id: "git",              label: "Version Control",   emoji: "🌿", shortcut: null },
  { id: "scorecard",        label: "Score Card",        emoji: "🏆", shortcut: null },
  { id: "capacity",         label: "Capacity Planner",  emoji: "📐", shortcut: null },
  { id: "experiments",      label: "Experiments",       emoji: "🔬", shortcut: null },
  { id: "search-results",   label: "Search Results",    emoji: "🔍", shortcut: null },
  { id: "checklist",        label: "Health Checklist",  emoji: "✅", shortcut: null },
  { id: "budget-tracker",  label: "Budget Tracker",    emoji: "💵", shortcut: null },
  { id: "chat-room",       label: "Chat Room",         emoji: "💬", shortcut: null },
  { id: "reports",         label: "Report Generator",  emoji: "📊", shortcut: null },
  { id: "access-control",  label: "Access Control",    emoji: "🔐", shortcut: null },
  { id: "infra-map",       label: "Infrastructure",    emoji: "🗺️", shortcut: null },
  { id: "status-page",     label: "Status Page",       emoji: "🟢", shortcut: null },
  { id: "diff-viewer",     label: "Diff Viewer",       emoji: "⚖️", shortcut: null },
  { id: "oncall",          label: "On-Call Schedule",  emoji: "📟", shortcut: null },
  { id: "data-quality",   label: "Data Quality",      emoji: "🔬", shortcut: null },
  { id: "cal",             label: "Event Scheduler",   emoji: "📅", shortcut: null },
  { id: "slack-mgr",      label: "Slack Integration",  emoji: "💬", shortcut: null },
  { id: "user-journey",   label: "User Journey Map",   emoji: "🗺️", shortcut: null },
  { id: "mem-profiler",   label: "Memory Profiler",    emoji: "🧮", shortcut: null },
  { id: "error-budget",   label: "Error Budget",       emoji: "🎯", shortcut: null },
  { id: "model-compare",  label: "Model Comparator",   emoji: "⚖️", shortcut: null },
  { id: "ctx-browser",    label: "Context Browser",    emoji: "📖", shortcut: null },
  { id: "github",         label: "GitHub Integration", emoji: "🐙", shortcut: null },
  { id: "funnel",         label: "Funnel Analytics",   emoji: "📉", shortcut: null },
  { id: "sprint-board",   label: "Sprint Board",       emoji: "🏃", shortcut: null },
  { id: "cost-forecast",  label: "Cost Forecast",      emoji: "💸", shortcut: null },
  { id: "threat-intel",      label: "Threat Intelligence", emoji: "🛡️", shortcut: null },
  { id: "pipeline-monitor", label: "Pipeline Monitor",    emoji: "⚙️", shortcut: null },
  { id: "a11y-audit",       label: "A11y Audit",          emoji: "♿", shortcut: null },
  { id: "design-tokens",    label: "Design Tokens",       emoji: "🎨", shortcut: null },
  { id: "webhook-play",     label: "Webhook Playground",  emoji: "📨", shortcut: null },
  { id: "sla-manager",      label: "SLA Manager",         emoji: "📋", shortcut: null },
  { id: "docs",             label: "Documentation",       emoji: "📖", shortcut: null },
  { id: "gantt",            label: "Gantt Chart",         emoji: "📊", shortcut: null },
  { id: "feedback",         label: "Customer Feedback",   emoji: "💬", shortcut: null },
  { id: "sec-policy",       label: "Security Policies",   emoji: "🔒", shortcut: null },
  { id: "team-collab",      label: "Team Collaboration",  emoji: "👥", shortcut: null },
  { id: "migrations",       label: "Migrations",          emoji: "🗂️", shortcut: null },
  { id: "i18n",             label: "Localization",        emoji: "🌍", shortcut: null },
  { id: "multi-tenant",     label: "Multi-Tenant Mgr",   emoji: "🏢", shortcut: null },
  { id: "ml-registry",      label: "ML Model Registry",  emoji: "🤖", shortcut: null },
  { id: "event-stream",     label: "Event Streams",       emoji: "📡", shortcut: null },
  { id: "perms-matrix",     label: "Permissions Matrix",  emoji: "🔐", shortcut: null },
  { id: "changelog-v2",      label: "Changelog Viewer",    emoji: "📝", shortcut: null },
  { id: "quota-mgr",        label: "Resource Quotas",     emoji: "📊", shortcut: null },
  { id: "db-query",         label: "DB Query Builder",    emoji: "🗃️", shortcut: null },
  { id: "invoices",         label: "Invoice Manager",     emoji: "🧾", shortcut: null },
  { id: "net-topology",     label: "Network Topology",    emoji: "🌐", shortcut: null },
  { id: "compliance",       label: "Compliance",          emoji: "✅", shortcut: null },
  { id: "user-segments",    label: "User Segmentation",   emoji: "🎯", shortcut: null },
  { id: "deployments",      label: "Deployment Tracker",  emoji: "🚀", shortcut: null },
  { id: "moderation",       label: "Content Moderation",  emoji: "🛡️", shortcut: null },
  { id: "pricing-calc",     label: "Pricing Calculator",  emoji: "💰", shortcut: null },
  { id: "tech-radar",       label: "Tech Radar",          emoji: "📡", shortcut: null },
  { id: "postmortem",       label: "Incident Postmortem", emoji: "📝", shortcut: null },
  { id: "access-tokens",    label: "Access Tokens",       emoji: "🔑", shortcut: null },
  { id: "k8s-cluster",     label: "K8s Cluster",         emoji: "☸️", shortcut: null },
  { id: "cohort-analysis", label: "Cohort Analysis",     emoji: "👥", shortcut: null },
  { id: "sentiment",       label: "Sentiment Analysis",  emoji: "💬", shortcut: null },
  { id: "graphql",         label: "GraphQL Explorer",    emoji: "🔷", shortcut: null },
  { id: "backups",         label: "Backup Manager",      emoji: "💾", shortcut: null },
  { id: "vector-db",       label: "Vector Database",     emoji: "🧬", shortcut: null },
  { id: "doc-templates",   label: "Doc Templates",       emoji: "📄", shortcut: null },
  { id: "service-accounts",label: "Service Accounts",    emoji: "🤖", shortcut: null },
  { id: "container-reg",   label: "Container Registry",  emoji: "📦", shortcut: null },
  { id: "email-campaigns", label: "Email Campaigns",     emoji: "📧", shortcut: null },
  { id: "cdc",             label: "Change Data Capture", emoji: "🔄", shortcut: null },
  { id: "fleet",           label: "Fleet Devices",       emoji: "📡", shortcut: null },
  { id: "cdn",             label: "CDN Manager",         emoji: "🌐", shortcut: null },
  { id: "geofence",        label: "Geofence Manager",    emoji: "🗺️", shortcut: null },
  { id: "scim",            label: "SCIM Provisioner",    emoji: "👤", shortcut: null },
  { id: "licenses",        label: "License Manager",     emoji: "🏷️", shortcut: null },
  { id: "message-queues",  label: "Message Queues",      emoji: "📬", shortcut: null },
  { id: "tenant-usage",   label: "Tenant Usage",         emoji: "🏢", shortcut: null },
  { id: "certs",          label: "Certificates",          emoji: "🔒", shortcut: null },
  { id: "financial",      label: "Financial Reports",     emoji: "💰", shortcut: null },
  { id: "openapi",        label: "OpenAPI Explorer",      emoji: "📋", shortcut: null },
  { id: "data-lineage",   label: "Data Lineage",          emoji: "🔗", shortcut: null },
  { id: "storage-buckets", label: "Storage Buckets",      emoji: "🪣", shortcut: null },
  { id: "prompt-router",  label: "AI Prompt Router",      emoji: "🤖", shortcut: null },
  { id: "observability",  label: "Observability",         emoji: "📡", shortcut: null },
  { id: "rbac",           label: "RBAC Manager",          emoji: "🛡", shortcut: null },
  { id: "error-tracking", label: "Error Tracking",        emoji: "🐛", shortcut: null },
  { id: "compliance-v2",  label: "Compliance Tracker",   emoji: "✅", shortcut: null },
  { id: "sso",            label: "SSO Config",            emoji: "🔑", shortcut: null },
  { id: "content-cal",    label: "Content Calendar",      emoji: "📅", shortcut: null },
  { id: "infra-cost",     label: "Infra Cost Optimizer",  emoji: "💡", shortcut: null },
  { id: "api-gateway",    label: "API Gateway",           emoji: "🌐", shortcut: null },
  { id: "cost-anomaly",  label: "Cost Anomaly",          emoji: "🚨", shortcut: null },
  { id: "knowledge-graph", label: "Knowledge Graph",     emoji: "🕸️", shortcut: null },
  { id: "workflow-orch",  label: "Workflow Orchestrator", emoji: "🔄", shortcut: null },
  { id: "resource-tags",  label: "Resource Tags",        emoji: "🏷️", shortcut: null },
  { id: "capacity-forecast", label: "Capacity Forecast", emoji: "📈", shortcut: null },
  { id: "event-catalog",    label: "Event Catalog",      emoji: "📚", shortcut: null },
  { id: "security-scan",    label: "Security Scans",     emoji: "🔍", shortcut: null },
  { id: "data-privacy",    label: "Data Privacy",        emoji: "🔒", shortcut: null },
  { id: "onboarding-flow", label: "Onboarding Flows",   emoji: "🚀", shortcut: null },
  { id: "query-perf",      label: "Query Performance",  emoji: "🐢", shortcut: null },
  { id: "service-mesh",    label: "Service Mesh",       emoji: "🕸", shortcut: null },
  { id: "multi-region",    label: "Multi-Region",       emoji: "🌍", shortcut: null },
  { id: "revenue",         label: "Revenue Analytics",  emoji: "💰", shortcut: null },
  { id: "vault-secrets",  label: "Vault Secrets",       emoji: "🔐", shortcut: null },
  { id: "ml-pipeline",    label: "ML Pipelines",        emoji: "🤖", shortcut: null },
  { id: "incident-timeline", label: "Incident Timeline", emoji: "🚨", shortcut: null },
  { id: "test-results",  label: "Test Results",         emoji: "🧪", shortcut: null },
  { id: "customer-success", label: "Customer Success",  emoji: "🌟", shortcut: null },
  { id: "container-logs",  label: "Container Logs",    emoji: "📜", shortcut: null },
  { id: "infra-drift",     label: "Drift Detector",    emoji: "🔀", shortcut: null },
  { id: "announcements",  label: "Announcements",      emoji: "📣", shortcut: null },
  { id: "schema-explorer",label: "Schema Explorer",    emoji: "🗄️", shortcut: null },
  { id: "support-tickets",label: "Support Tickets",    emoji: "🎫", shortcut: null },
  { id: "api-changelog",  label: "API Changelog",      emoji: "📋", shortcut: null },
  { id: "product-tour",         label: "Product Tours",       emoji: "🗺️", shortcut: null },
  { id: "network-firewall",     label: "Firewall Rules",      emoji: "🔥", shortcut: null },
  { id: "observability-alerts", label: "Alert Manager",       emoji: "🚨", shortcut: null },
  { id: "cloud-cost-opt",       label: "Cloud Cost Optimizer", emoji: "💰", shortcut: null },
  { id: "network-bw",           label: "Network Bandwidth",    emoji: "📶", shortcut: null },
  { id: "service-deps",         label: "Service Dependencies", emoji: "🕸️", shortcut: null },
  { id: "feature-requests",     label: "Feature Requests",     emoji: "💡", shortcut: null },
  { id: "data-catalog",         label: "Data Catalog",          emoji: "🗂️", shortcut: null },
  { id: "oncall-rotation",      label: "On-Call Rotation",      emoji: "🔔", shortcut: null },
  { id: "resource-inventory",   label: "Resource Inventory",    emoji: "📋", shortcut: null },
  { id: "webhook-debugger",     label: "Webhook Debugger",      emoji: "🪝", shortcut: null },
  { id: "cost-attribution",     label: "Cost Attribution",      emoji: "💳", shortcut: null },
  { id: "log-aggregator",       label: "Log Aggregator",        emoji: "📜", shortcut: null },
  { id: "user-devices",         label: "User Devices",          emoji: "📱", shortcut: null },
  { id: "security-scanner",     label: "Security Scanner",      emoji: "🛡️", shortcut: null },
  { id: "api-gateway-monitor",  label: "API Gateway",           emoji: "🌐", shortcut: null },
  { id: "db-migrations",        label: "DB Migrations",         emoji: "🗄️", shortcut: null },
  { id: "release-notes",        label: "Release Notes",         emoji: "📝", shortcut: null },
  { id: "traffic-analytics",    label: "Traffic Analytics",     emoji: "📊", shortcut: null },
  { id: "incident-command",     label: "Incident Command",      emoji: "🚨", shortcut: null },
  { id: "env-config",           label: "Env Config",            emoji: "⚙️", shortcut: null },
  { id: "user-perms",           label: "User Permissions",      emoji: "👥", shortcut: null },
  { id: "infra-cost-mgr",       label: "Infra Cost",            emoji: "💸", shortcut: null },
  { id: "db-schema-viewer",     label: "DB Schema",             emoji: "🗃️", shortcut: null },
  { id: "deploy-env-mgr",       label: "Deploy Environments",   emoji: "🚀", shortcut: null },
  { id: "ml-experiment",        label: "ML Experiments",        emoji: "🧪", shortcut: null },
  { id: "disaster-recovery",    label: "Disaster Recovery",     emoji: "🛟", shortcut: null },
  { id: "data-retention",       label: "Data Retention",        emoji: "🗑️", shortcut: null },
  { id: "code-review",          label: "Code Review",           emoji: "🔍", shortcut: null },
  { id: "endpoint-monitor",     label: "Endpoint Monitor",      emoji: "📡", shortcut: null },
  { id: "integration-tests",    label: "Integration Tests",     emoji: "🧪", shortcut: null },
  { id: "session-replay-viewer", label: "Session Replay Viewer", emoji: "🎬", shortcut: null },
  { id: "chaos-engineering",    label: "Chaos Engineering",     emoji: "💥", shortcut: null },
  { id: "dependency-audit",     label: "Dependency Audit",      emoji: "🔐", shortcut: null },
  { id: "search-analytics",     label: "Search Analytics",      emoji: "🔎", shortcut: null },
  { id: "change-approval",      label: "Change Approval",       emoji: "✅", shortcut: null },
  { id: "queue-inspector",      label: "Queue Inspector",       emoji: "📬", shortcut: null },
  { id: "db-query-analyzer",    label: "DB Query Analyzer",     emoji: "🔬", shortcut: null },
  { id: "feature-flag-manager", label: "Feature Flag Manager",  emoji: "🏁", shortcut: null },
  { id: "token-usage",          label: "Token Usage Optimizer", emoji: "🪙", shortcut: null },
  { id: "streaming-debugger",      label: "Streaming Debugger",     emoji: "📺", shortcut: null },
  { id: "sla-compliance",          label: "SLA Compliance",         emoji: "📋", shortcut: null },
  { id: "agent-collab-graph",      label: "Agent Collab Graph",     emoji: "🕸️", shortcut: null },
  { id: "cost-breakdown",          label: "Cost Breakdown",         emoji: "💰", shortcut: null },
  { id: "compliance-policy",       label: "Compliance Policies",    emoji: "📜", shortcut: null },
  { id: "feature-gating",          label: "Feature Gating",         emoji: "🚦", shortcut: null },
  { id: "service-health-dashboard", label: "Service Health",          emoji: "❤️", shortcut: null },
  { id: "data-masking",             label: "Data Masking",            emoji: "🎭", shortcut: null },
  { id: "obs-rules-engine",         label: "Observability Rules",     emoji: "🔭", shortcut: null },
  { id: "agent-rel-topology",       label: "Agent Topology",          emoji: "🤝", shortcut: null },
  { id: "tenant-provisioning",      label: "Tenant Provisioning",     emoji: "🏗️", shortcut: null },
  { id: "billing-audit-log",        label: "Billing Audit Log",       emoji: "🧾", shortcut: null },
  { id: "api-rate-limit",           label: "API Rate Limits",         emoji: "⛽", shortcut: null },
  { id: "env-drift",                label: "Env Drift Detector",      emoji: "🌊", shortcut: null },
  { id: "workflow-orchestration",   label: "Workflow Orchestration",  emoji: "⚙️", shortcut: null },
  { id: "ai-governance",            label: "AI Governance",           emoji: "🤖", shortcut: null },
  { id: "retention-policy",         label: "Retention Policy Mgr",   emoji: "🗂️", shortcut: null },
  { id: "incident-playbook",        label: "Incident Playbooks",     emoji: "📖", shortcut: null },
  { id: "user-journey-analytics",   label: "User Journey Analytics", emoji: "🗺️", shortcut: null },
  { id: "security-audit-trail",     label: "Security Audit Trail",   emoji: "🔎", shortcut: null },
  { id: "change-mgmt",              label: "Change Management",      emoji: "📋", shortcut: null },
  { id: "multi-region-failover",    label: "Multi-Region Failover",  emoji: "🔄", shortcut: null },
  { id: "cost-allocation",          label: "Cost Allocation",         emoji: "💰", shortcut: null },
  { id: "session-debug-timeline",  label: "Session Debug Timeline", emoji: "🎬", shortcut: null },
];

const SKELETON_MAP: Record<string, React.ReactNode> = {
  "operator-dashboard": <DashboardSkeleton />,
  "live-logs":          <ContentSkeleton />,
  "decision-provenance": <ContentSkeleton />,
  dashboard:     <DashboardSkeleton />,
  "today-command": <DashboardSkeleton />,
  "action-inbox": <TableSkeleton rows={8} />,
  "capacity-planner": <DashboardSkeleton />,
  "handoff-planner": <ContentSkeleton />,
  "compare-modes": <ContentSkeleton />,
  "context-budget": <ContentSkeleton />,
  "model-comparison": <ContentSkeleton />,
  "wave-scheduler": <ContentSkeleton />,
  "preflight-checklist": <ContentSkeleton />,
  "findings-search": <ContentSkeleton />,
  chat:          <ChatSkeleton />,
  sessions:      <TableSkeleton rows={8} />,
  nodes:         <TableSkeleton rows={6} />,
  usage:         <DashboardSkeleton />,
  skills:        <CardGridSkeleton count={9} />,
  identity:      <CardGridSkeleton count={6} />,
  models:        <CardGridSkeleton count={6} />,
  builders:      <ContentSkeleton />,
  settings:      <ContentSkeleton />,
  files:         <ContentSkeleton />,
  providers:     <ContentSkeleton />,
  cron:          <TableSkeleton rows={5} />,
  "soul-editor": <ContentSkeleton />,
  "config-review": <ContentSkeleton />,
  onboarding:    <ContentSkeleton />,
  pulse:         <DashboardSkeleton />,
  notifications: <TableSkeleton rows={8} />,
  "api-keys":    <TableSkeleton rows={6} />,
  "audit-log":   <TableSkeleton rows={10} />,
  "billing":     <ContentSkeleton />,
  "system-health": <DashboardSkeleton />,
  "integrations":  <CardGridSkeleton count={9} />,
  "team":          <TableSkeleton rows={6} />,
  "search":        <ContentSkeleton />,
  "prompts":       <CardGridSkeleton count={6} />,
  "exports":       <ContentSkeleton />,
  "voice":         <ContentSkeleton />,
  "agent-insights": <DashboardSkeleton />,
  "dev-console":    <ContentSkeleton />,
  "security":       <DashboardSkeleton />,
  "changelog":      <ContentSkeleton />,
  "env-vars":       <TableSkeleton rows={8} />,
  "feature-flags":  <ContentSkeleton />,
  "agent-compare":  <DashboardSkeleton />,
  "knowledge":      <ContentSkeleton />,
  "crashes":        <TableSkeleton rows={8} />,
  "benchmark":      <DashboardSkeleton />,
  "rate-limits":    <DashboardSkeleton />,
  "task-queue":     <TableSkeleton rows={10} />,
  "storage":        <ContentSkeleton />,
  "alerts":         <DashboardSkeleton />,
  "mission-control": <DashboardSkeleton />,
  "webhooks":       <TableSkeleton rows={6} />,
  "history":        <ContentSkeleton />,
  "scheduler":      <DashboardSkeleton />,
  "token-ledger":   <TableSkeleton rows={10} />,
  "theme-editor":   <ContentSkeleton />,
  "permissions":    <TableSkeleton rows={8} />,
  "activity":       <ContentSkeleton />,
  "commands":       <ContentSkeleton />,
  "commands-v2":    <ContentSkeleton />,
  "support":        <ContentSkeleton />,
  "releases":       <DashboardSkeleton />,
  "memory":         <ContentSkeleton />,
  "network":        <TableSkeleton rows={10} />,
  "analytics":      <DashboardSkeleton />,
  "setup":          <ContentSkeleton />,
  "workload":       <DashboardSkeleton />,
  "api-playground": <ContentSkeleton />,
  "workspace":      <ContentSkeleton />,
  "tracer":         <ContentSkeleton />,
  "pipelines":      <ContentSkeleton />,
  "cost":           <DashboardSkeleton />,
  "plugins":        <ContentSkeleton />,
  "logs":           <ContentSkeleton />,
  "llm-playground": <ContentSkeleton />,
  "ab-tests":        <ContentSkeleton />,
  "quotas":          <ContentSkeleton />,
  "agent-diff":      <ContentSkeleton />,
  "mcp":             <ContentSkeleton />,
  "model-router":    <ContentSkeleton />,
  "session-replay":  <ContentSkeleton />,
  "config-validator": <ContentSkeleton />,
  "context-window":  <ContentSkeleton />,
  "inbox":           <ContentSkeleton />,
  "dep-graph":       <ContentSkeleton />,
  "goals":           <ContentSkeleton />,
  "resources":       <DashboardSkeleton />,
  "service-map":     <ContentSkeleton />,
  "prompt-optimizer": <ContentSkeleton />,
  "directory":        <ContentSkeleton />,
  "workflows":        <ContentSkeleton />,
  "token-budget":     <ContentSkeleton />,
  "sandbox":          <ContentSkeleton />,
  "metrics":          <ContentSkeleton />,
  "embeddings":       <ContentSkeleton />,
  "rules":            <ContentSkeleton />,
  "telemetry":        <ContentSkeleton />,
  "model-health":     <ContentSkeleton />,
  "timeline":         <ContentSkeleton />,
  "policies":         <ContentSkeleton />,
  "git":              <ContentSkeleton />,
  "scorecard":        <ContentSkeleton />,
  "capacity":         <ContentSkeleton />,
  "experiments":      <ContentSkeleton />,
  "search-results":   <ContentSkeleton />,
  "checklist":        <ContentSkeleton />,
  "budget-tracker":   <ContentSkeleton />,
  "chat-room":        <ContentSkeleton />,
  "reports":          <ContentSkeleton />,
  "access-control":   <ContentSkeleton />,
  "infra-map":        <ContentSkeleton />,
  "status-page":      <ContentSkeleton />,
  "diff-viewer":      <ContentSkeleton />,
  "oncall":           <ContentSkeleton />,
  "data-quality":     <ContentSkeleton />,
  "cal":              <ContentSkeleton />,
  "slack-mgr":        <ContentSkeleton />,
  "user-journey":     <ContentSkeleton />,
  "mem-profiler":     <ContentSkeleton />,
  "error-budget":     <ContentSkeleton />,
  "model-compare":    <ContentSkeleton />,
  "ctx-browser":      <ContentSkeleton />,
  "github":           <ContentSkeleton />,
  "funnel":           <ContentSkeleton />,
  "sprint-board":     <ContentSkeleton />,
  "cost-forecast":    <ContentSkeleton />,
  "threat-intel":        <ContentSkeleton />,
  "pipeline-monitor":    <ContentSkeleton />,
  "a11y-audit":          <ContentSkeleton />,
  "design-tokens":       <ContentSkeleton />,
  "webhook-play":        <ContentSkeleton />,
  "sla-manager":         <ContentSkeleton />,
  "docs":                <ContentSkeleton />,
  "gantt":               <ContentSkeleton />,
  "feedback":            <ContentSkeleton />,
  "sec-policy":          <ContentSkeleton />,
  "team-collab":         <ContentSkeleton />,
  "migrations":          <ContentSkeleton />,
  "i18n":                <ContentSkeleton />,
  "multi-tenant":        <ContentSkeleton />,
  "ml-registry":         <ContentSkeleton />,
  "event-stream":        <ContentSkeleton />,
  "perms-matrix":        <ContentSkeleton />,
  "changelog-v2":        <ContentSkeleton />,
  "quota-mgr":           <ContentSkeleton />,
  "db-query":            <ContentSkeleton />,
  "invoices":            <ContentSkeleton />,
  "net-topology":        <ContentSkeleton />,
  "compliance":          <ContentSkeleton />,
  "user-segments":       <ContentSkeleton />,
  "deployments":         <ContentSkeleton />,
  "moderation":          <ContentSkeleton />,
  "pricing-calc":        <ContentSkeleton />,
  "tech-radar":          <ContentSkeleton />,
  "postmortem":          <ContentSkeleton />,
  "access-tokens":       <ContentSkeleton />,
  "k8s-cluster":        <ContentSkeleton />,
  "cohort-analysis":    <ContentSkeleton />,
  "sentiment":          <ContentSkeleton />,
  "graphql":            <ContentSkeleton />,
  "backups":            <ContentSkeleton />,
  "vector-db":          <ContentSkeleton />,
  "doc-templates":      <ContentSkeleton />,
  "service-accounts":   <ContentSkeleton />,
  "container-reg":      <ContentSkeleton />,
  "email-campaigns":    <ContentSkeleton />,
  "cdc":                <ContentSkeleton />,
  "fleet":              <ContentSkeleton />,
  "cdn":                <ContentSkeleton />,
  "geofence":           <ContentSkeleton />,
  "scim":               <ContentSkeleton />,
  "licenses":           <ContentSkeleton />,
  "message-queues":     <ContentSkeleton />,
  "tenant-usage":       <ContentSkeleton />,
  "certs":              <ContentSkeleton />,
  "financial":          <ContentSkeleton />,
  "openapi":            <ContentSkeleton />,
  "data-lineage":       <ContentSkeleton />,
  "storage-buckets":    <ContentSkeleton />,
  "prompt-router":      <ContentSkeleton />,
  "observability":      <ContentSkeleton />,
  "rbac":               <ContentSkeleton />,
  "error-tracking":     <ContentSkeleton />,
  "compliance-v2":      <ContentSkeleton />,
  "sso":                <ContentSkeleton />,
  "content-cal":        <ContentSkeleton />,
  "infra-cost":         <ContentSkeleton />,
  "api-gateway":        <ContentSkeleton />,
  "cost-anomaly":       <ContentSkeleton />,
  "knowledge-graph":    <ContentSkeleton />,
  "workflow-orch":      <ContentSkeleton />,
  "resource-tags":      <ContentSkeleton />,
  "capacity-forecast":  <ContentSkeleton />,
  "event-catalog":      <ContentSkeleton />,
  "security-scan":      <ContentSkeleton />,
  "data-privacy":       <ContentSkeleton />,
  "onboarding-flow":    <ContentSkeleton />,
  "query-perf":         <ContentSkeleton />,
  "service-mesh":       <ContentSkeleton />,
  "multi-region":       <ContentSkeleton />,
  "revenue":            <ContentSkeleton />,
  "vault-secrets":     <ContentSkeleton />,
  "ml-pipeline":       <ContentSkeleton />,
  "incident-timeline": <ContentSkeleton />,
  "test-results":      <ContentSkeleton />,
  "customer-success":  <ContentSkeleton />,
  "container-logs":    <ContentSkeleton />,
  "infra-drift":       <ContentSkeleton />,
  "announcements":     <ContentSkeleton />,
  "schema-explorer":   <ContentSkeleton />,
  "support-tickets":   <ContentSkeleton />,
  "api-changelog":     <ContentSkeleton />,
  "product-tour":           <ContentSkeleton />,
  "network-firewall":       <ContentSkeleton />,
  "observability-alerts":   <ContentSkeleton />,
  "cloud-cost-opt":         <ContentSkeleton />,
  "network-bw":             <ContentSkeleton />,
  "service-deps":           <ContentSkeleton />,
  "feature-requests":       <ContentSkeleton />,
  "data-catalog":           <ContentSkeleton />,
  "oncall-rotation":        <ContentSkeleton />,
  "resource-inventory":     <ContentSkeleton />,
  "webhook-debugger":       <ContentSkeleton />,
  "cost-attribution":       <ContentSkeleton />,
  "log-aggregator":         <ContentSkeleton />,
  "user-devices":           <ContentSkeleton />,
  "security-scanner":       <ContentSkeleton />,
  "api-gateway-monitor":    <ContentSkeleton />,
  "db-migrations":          <ContentSkeleton />,
  "release-notes":          <ContentSkeleton />,
  "traffic-analytics":      <ContentSkeleton />,
  "incident-command":       <ContentSkeleton />,
  "env-config":             <ContentSkeleton />,
  "user-perms":             <ContentSkeleton />,
  "infra-cost-mgr":         <ContentSkeleton />,
  "db-schema-viewer":       <ContentSkeleton />,
  "deploy-env-mgr":         <ContentSkeleton />,
  "ml-experiment":          <ContentSkeleton />,
  "disaster-recovery":      <ContentSkeleton />,
  "data-retention":         <ContentSkeleton />,
  "code-review":            <ContentSkeleton />,
  "endpoint-monitor":       <ContentSkeleton />,
  "integration-tests":      <ContentSkeleton />,
  "session-replay-viewer":  <ContentSkeleton />,
  "chaos-engineering":      <ContentSkeleton />,
  "dependency-audit":       <ContentSkeleton />,
  "search-analytics":       <ContentSkeleton />,
  "change-approval":        <ContentSkeleton />,
  "queue-inspector":        <ContentSkeleton />,
  "db-query-analyzer":      <ContentSkeleton />,
  "feature-flag-manager":   <ContentSkeleton />,
  "token-usage":            <ContentSkeleton />,
  "streaming-debugger":        <ContentSkeleton />,
  "sla-compliance":            <ContentSkeleton />,
  "agent-collab-graph":        <ContentSkeleton />,
  "cost-breakdown":            <ContentSkeleton />,
  "compliance-policy":         <ContentSkeleton />,
  "feature-gating":            <ContentSkeleton />,
  "service-health-dashboard":  <ContentSkeleton />,
  "data-masking":              <ContentSkeleton />,
  "obs-rules-engine":          <ContentSkeleton />,
  "agent-rel-topology":        <ContentSkeleton />,
  "tenant-provisioning":       <ContentSkeleton />,
  "billing-audit-log":         <ContentSkeleton />,
  "api-rate-limit":            <ContentSkeleton />,
  "env-drift":                 <ContentSkeleton />,
  "workflow-orchestration":    <ContentSkeleton />,
  "ai-governance":             <ContentSkeleton />,
  "retention-policy":          <ContentSkeleton />,
  "incident-playbook":         <ContentSkeleton />,
  "user-journey-analytics":    <ContentSkeleton />,
  "security-audit-trail":      <ContentSkeleton />,
  "change-mgmt":               <ContentSkeleton />,
  "multi-region-failover":     <ContentSkeleton />,
  "cost-allocation":           <ContentSkeleton />,
  "session-debug-timeline":    <ContentSkeleton />,
};

type NavFilter = "all" | "core" | "builders" | "operations" | "analytics";

type NavPreset = {
  id: string;
  name: string;
  viewId: string;
  navFilter: NavFilter;
  navQuery: string;
};

const NAV_FILTER_OPTIONS: Array<{ value: NavFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "core", label: "Core" },
  { value: "builders", label: "Build" },
  { value: "operations", label: "Ops" },
  { value: "analytics", label: "Insights" },
];

const NAV_SHORTCUT_MAP = new Map(
  navItems
    .filter((item): item is typeof item & { shortcut: string } => item.shortcut !== null)
    .map((item) => [item.shortcut, item.id] as const)
);

const CORE_VIEW_IDS = new Set([
  "dashboard",
  "chat",
  "builder",
  "sessions",
  "settings",
  "notifications",
  "search",
  "system-health",
]);

function getNavCategory(item: { id: string; label: string }): Exclude<NavFilter, "all"> {
  if (CORE_VIEW_IDS.has(item.id)) {return "core";}
  const text = `${item.id} ${item.label}`.toLowerCase();
  if (["builder", "wizard", "editor", "config", "setup", "flow", "onboarding"].some((k) => text.includes(k))) {
    return "builders";
  }
  if (["dashboard", "analytics", "report", "metrics", "insight", "ledger", "forecast", "monitor"].some((k) => text.includes(k))) {
    return "analytics";
  }
  return "operations";
}

function getAudienceLabel(category: Exclude<NavFilter, "all">): string {
  if (category === "core") {return "All operators";}
  if (category === "builders") {return "Builders and implementers";}
  if (category === "analytics") {return "Leads tracking outcomes";}
  return "Platform operators";
}

function LoadingFallback({ viewId }: { viewId: string }) {
  const skeleton = SKELETON_MAP[viewId];
  if (skeleton) {
    return <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">{skeleton}</div>; {/* M9: responsive pass */}
  }
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse-soft text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

// Error boundary for views
class ViewErrorBoundary extends React.Component<
  { children: React.ReactNode; viewId: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; viewId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm">Something went wrong loading this view.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ProficiencyProvider>
      <ToastProvider>
        <GatewayProvider>
          <AppContent />
        </GatewayProvider>
      </ToastProvider>
    </ProficiencyProvider>
  );
}

function AppContent() {
  const [activeView, setActiveView] = useState("dashboard");
  const [navHistory, setNavHistory] = useState<string[]>(["dashboard"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("oc_sidebar_collapsed") === "true"; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [navQuery, setNavQuery] = useState("");
  const [navFilter, setNavFilter] = useState<NavFilter>("core");
  const [savedPresets, setSavedPresets] = useState<NavPreset[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("oc_nav_presets") ?? "[]");
    } catch {
      return [];
    }
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Initialize tour with default steps
  const tour = useTour({
    tourId: 'dashboard-onboarding',
    steps: DEFAULT_DASHBOARD_TOUR_STEPS,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const navHistoryRef = useRef(navHistory);
  const historyIndexRef = useRef(historyIndex);
  const { toast } = useToast();

  // Gateway connection — monitor auth failures and surface the credentials modal.
  const gateway = useGateway();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  useEffect(() => {
    if (gateway.authFailed) {
      setAuthModalOpen(true);
    }
  }, [gateway.authFailed]);
  const { visitView, recordInteraction } = useProficiency();
  const notificationUnreadCount = useNotificationUnreadCount();

  // Operator mode state
  const [operatorMode, setOperatorMode] = useState(() => {
    try { return localStorage.getItem("oc_operator_mode") === "true"; } catch { return false; }
  });
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleOperatorMode = useCallback(() => {
    setOperatorMode(prev => {
      const next = !prev;
      try { localStorage.setItem("oc_operator_mode", String(next)); } catch {}
      if (next) {
        setActiveView("operator-dashboard");
      } else {
        setActiveView("dashboard");
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }, []);

  const currentNav = navItems.find((n) => n.id === activeView) ?? navItems[0];
  const currentCategory = getNavCategory(currentNav);
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;

  useEffect(() => {
    navHistoryRef.current = navHistory;
  }, [navHistory]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const openCommandPalette = useCallback(() => {
    setCmdPaletteOpen(true);
    setSearchQuery("");
    setHighlightedIndex(0);
  }, []);

  // Navigate and update history + recents
  const navigate = useCallback((viewId: string, pushHistory = true) => {
    setActiveView(viewId);
    setMobileSidebarOpen(false);
    setCmdPaletteOpen(false);
    setSearchQuery("");
    visitView(viewId);
    recordInteraction();

    if (pushHistory) {
      const trimmed = navHistoryRef.current.slice(0, historyIndexRef.current + 1);
      // Don't push if same as current
      if (trimmed[trimmed.length - 1] !== viewId) {
        const nextHistory = [...trimmed, viewId];
        setNavHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
      }
    }

    // Track recents
    try {
      const recents: string[] = JSON.parse(localStorage.getItem("oc_recent_views") ?? "[]");
      const updated = [viewId, ...recents.filter((r) => r !== viewId)].slice(0, 5);
      localStorage.setItem("oc_recent_views", JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [visitView, recordInteraction]);

  const saveCurrentPreset = () => {
    const name = window.prompt("Preset name", currentNav.label);
    if (!name) {return;}
    const preset: NavPreset = {
      id: `preset-${Date.now()}`,
      name,
      viewId: activeView,
      navFilter,
      navQuery,
    };
    setSavedPresets((prev) => [preset, ...prev].slice(0, 8));
    toast({ message: `Saved preset: ${name}`, type: 'success' });
  };

  const applyPreset = (presetId: string) => {
    const preset = savedPresets.find((p) => p.id === presetId);
    if (!preset) {return;}
    setNavFilter(preset.navFilter);
    setNavQuery(preset.navQuery);
    navigate(preset.viewId);
  };

  const goBack = useCallback(() => {
    if (!canGoBack) {return;}
    const newIndex = historyIndexRef.current - 1;
    const targetView = navHistoryRef.current[newIndex];
    if (!targetView) {return;}
    setHistoryIndex(newIndex);
    navigate(targetView, false);
  }, [canGoBack, navigate]);

  const goForward = useCallback(() => {
    if (!canGoForward) {return;}
    const newIndex = historyIndexRef.current + 1;
    const targetView = navHistoryRef.current[newIndex];
    if (!targetView) {return;}
    setHistoryIndex(newIndex);
    navigate(targetView, false);
  }, [canGoForward, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      // Cmd+K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (cmdPaletteOpen) {
          setCmdPaletteOpen(false);
        } else {
          openCommandPalette();
        }
        return;
      }

      // Cmd+J / Ctrl+J — AI Copilot (operator mode)
      if ((e.metaKey || e.ctrlKey) && e.key === "j" && operatorMode) {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
        return;
      }

      // Cmd+Shift+O — toggle operator mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "O") {
        e.preventDefault();
        toggleOperatorMode();
        return;
      }

      // Escape — close in priority order
      if (e.key === "Escape") {
        if (cmdPaletteOpen) { setCmdPaletteOpen(false); return; }
        if (presetsOpen) { setPresetsOpen(false); return; }
        if (copilotOpen) { setCopilotOpen(false); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (mobileSidebarOpen) { setMobileSidebarOpen(false); return; }
      }

      if (isInput || cmdPaletteOpen || shortcutsOpen) {return;}

      // ? — keyboard shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Alt+← / Alt+→ — back/forward navigation
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === "ArrowLeft") { e.preventDefault(); goBack(); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); goForward(); return; }

        // Alt+1–9 for quick nav
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          const shortcutView = NAV_SHORTCUT_MAP.get(String(num));
          if (shortcutView) { e.preventDefault(); navigate(shortcutView); }
        }
      }

      // [ / ] — collapse or expand sidebar
      if (e.key === "[") {
        e.preventDefault();
        setSidebarCollapsed(true);
      }
      if (e.key === "]") {
        e.preventDefault();
        setSidebarCollapsed(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdPaletteOpen, shortcutsOpen, mobileSidebarOpen, copilotOpen, operatorMode, navigate, goBack, goForward, openCommandPalette, toggleOperatorMode]);

  // Focus search when palette opens
  useEffect(() => {
    if (cmdPaletteOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [cmdPaletteOpen]);

  useEffect(() => {
    localStorage.setItem("oc_nav_presets", JSON.stringify(savedPresets));
  }, [savedPresets]);

  useEffect(() => {
    try { localStorage.setItem("oc_sidebar_collapsed", String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  // Filtered commands for palette
  const filteredNav = navItems.filter(
    (n) =>
      searchQuery === "" ||
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.id.includes(searchQuery.toLowerCase())
  );

  const visibleNavItems = navItems.filter((item) => {
    const query = navQuery.trim().toLowerCase();
    const matchesQuery = query.length === 0
      ? true
      : item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
    const category = getNavCategory(item);
    const matchesFilter = navFilter === "all" ? true : category === navFilter;
    return matchesQuery && matchesFilter;
  });

  const activeViewVisible = visibleNavItems.some((item) => item.id === activeView);

  const recentIds: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("oc_recent_views") ?? "[]");
    } catch {
      return [];
    }
  })();
  const recentItems = recentIds
    .map((id) => navItems.find((n) => n.id === id))
    .filter(Boolean)
    .slice(0, 3) as typeof navItems;

  const allPaletteItems = searchQuery
    ? filteredNav
    : [...(recentItems.length ? recentItems : []), ...navItems.filter((n) => !recentIds.includes(n.id))];

  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (allPaletteItems.length === 0) {return 0;}
      return Math.min(prev, allPaletteItems.length - 1);
    });
  }, [allPaletteItems.length]);

  // Palette keyboard nav
  const handlePaletteKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, allPaletteItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const item = allPaletteItems[highlightedIndex];
      if (item) {navigate(item.id);}
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "operator-dashboard": return <OperatorDashboard onNavigate={navigate} />;
      case "live-logs":          return <LiveLogTail />;
      case "decision-provenance": return <DecisionProvenance onNavigate={navigate} />;
      case "morning-packet": return <MorningPacket />;
      case "today-command": return <TodayCommandCenter />;
      case "action-inbox": return <ActionInboxView />;
      case "capacity-planner": return <AgentCapacityPlanner />;
      case "handoff-planner": return <AgentHandoffPlanner />;
      case "compare-modes": return <CompareModesDiffView />;
      case "context-budget": return <ContextBudgetInspector />;
      case "discovery-run-monitor":   return <DiscoveryRunMonitor />;
      case "brave-api-wizard":        return <BraveAPIKeySetupWizard />;
      case "discovery-wave-results":  return <DiscoveryWaveResults />;
      case "agent-cost-tracker":      return <DiscoveryAgentCostTracker />;
      case "tool-reliability":        return <ToolReliabilityDashboard />;
      case "model-comparison":        return <ModelComparisonMatrix />;
      case "wave-scheduler":          return <AgentWaveScheduler />;
      case "preflight-checklist":     return <DiscoveryPreflightChecklist />;
      case "findings-search":         return <DiscoveryFindingsSearch />;
      case "dashboard":     return <AgentDashboard />;
      case "chat":          return <ChatInterface agentName="Luis" agentEmoji="🎨" />;
      case "builder":       return <AgentBuilderWizard />;
      case "soul-editor":   return <AgentSoulEditor agentName="Luis" agentEmoji="🎨" />;
      case "identity":      return <AgentIdentityCard />;
      case "models":        return <ModelSelector />;
      case "providers":     return <ProviderAuthManager />;
      case "cron":          return <CronScheduleBuilder />;
      case "skills":        return <SkillsMarketplace />;
      case "skill-builder": return <SkillBuilderEditor />;
      case "sessions":      return <SessionExplorer />;
      case "config-review": return <AgentConfigReview />;
      case "settings":      return <SettingsDashboard />;
      case "nodes":         return <NodeManager />;
      case "usage":         return <UsageDashboard />;
      case "files":         return <WorkspaceFileBrowser />;
      case "onboarding":    return <OnboardingFlow />;
      case "pulse":         return <AgentPulseMonitor />;
      case "notifications": return <NotificationCenter />;
      case "api-keys":      return <ApiKeysManager />;
      case "audit-log":     return <AuditLog />;
      case "billing":       return <BillingSubscription />;
      case "system-health":  return <SystemHealth />;
      case "integrations":   return <IntegrationHub />;
      case "team":           return <TeamManagement />;
      case "search":         return <GlobalSearch />;
      case "prompts":        return <PromptLibrary />;
      case "exports":        return <DataExportManager />;
      case "voice":          return <VoiceInterface />;
      case "agent-insights":  return <AgentInsights />;
      case "dev-console":     return <DeveloperConsole />;
      case "security":        return <SecurityDashboard />;
      case "changelog":       return <ChangelogView />;
      case "env-vars":        return <EnvironmentManager />;
      case "feature-flags":   return <FeatureFlags />;
      case "agent-compare":   return <AgentComparison />;
      case "knowledge":       return <KnowledgeBase />;
      case "crashes":         return <CrashReporter />;
      case "benchmark":       return <ModelBenchmark />;
      case "rate-limits":     return <RateLimitDashboard />;
      case "task-queue":      return <TaskQueue />;
      case "storage":         return <StorageExplorer />;
      case "alerts":          return <AlertCenter />;
      case "mission-control": return <MissionControlDashboard />;
      case "webhooks":        return <WebhookManager />;
      case "history":         return <ConversationHistory />;
      case "scheduler":       return <AgentScheduler />;
      case "token-ledger":    return <TokenLedger />;
      case "theme-editor":    return <ThemeEditor />;
      case "permissions":     return <PermissionsManager />;
      case "activity":        return <ActivityFeed />;
      case "commands":        return <CommandPalette />;
      case "commands-v2":     return <CommandPaletteV2 />;
      case "support":         return <SupportCenter />;
      case "releases":        return <ReleasePipeline />;
      case "memory":          return <AgentMemoryViewer />;
      case "network":         return <NetworkInspector />;
      case "analytics":       return <AnalyticsOverview />;
      case "setup":           return <OnboardingChecklist />;
      case "workload":        return <AgentWorkload />;
      case "api-playground":  return <ApiPlayground />;
      case "workspace":       return <WorkspaceSettings />;
      case "tracer":          return <AgentTracer />;
      case "pipelines":       return <DataPipelineViewer />;
      case "cost":            return <CostOptimizer />;
      case "plugins":         return <PluginManager />;
      case "logs":            return <LogViewer />;
      case "llm-playground":  return <LLMPlayground />;
      case "ab-tests":        return <ABTestManager />;
      case "quotas":          return <QuotaManager />;
      case "agent-diff":      return <AgentDiffViewer />;
      case "mcp":             return <MCPInspector />;
      case "model-router":    return <ModelRouter />;
      case "session-replay":  return <SessionReplay />;
      case "config-validator": return <ConfigValidatorView />;
      case "context-window":  return <ContextWindowViewer />;
      case "inbox":           return <AgentInbox />;
      case "dep-graph":       return <DependencyGraph />;
      case "goals":           return <GoalTracker />;
      case "resources":       return <ResourceMonitor />;
      case "service-map":     return <ServiceMap />;
      case "prompt-optimizer": return <PromptOptimizer />;
      case "directory":        return <TeamDirectory />;
      case "workflows":        return <WorkflowBuilder />;
      case "token-budget":     return <TokenBudgetPlanner />;
      case "sandbox":          return <SandboxRunner />;
      case "metrics":          return <MetricsDrilldown />;
      case "embeddings":       return <EmbeddingExplorer />;
      case "rules":            return <RuleEngine />;
      case "telemetry":        return <TelemetryViewer />;
      case "model-health":     return <ModelHealthDashboard />;
      case "timeline":         return <ActivityTimeline />;
      case "policies":         return <PolicyManager />;
      case "git":              return <VersionControl />;
      case "scorecard":        return <ScoreCard />;
      case "capacity":         return <CapacityPlanner />;
      case "experiments":      return <ExperimentDashboard />;
      case "search-results":   return <SearchResultsView />;
      case "checklist":        return <HealthChecklist />;
      case "budget-tracker":   return <BudgetTracker />;
      case "chat-room":        return <ChatRoomView />;
      case "reports":          return <ReportGenerator />;
      case "access-control":   return <AccessControlMatrix />;
      case "infra-map":        return <InfrastructureMap />;
      case "status-page":      return <StatusPageBuilder />;
      case "diff-viewer":      return <DiffViewer />;
      case "oncall":           return <OncallScheduler />;
      case "data-quality":     return <DataQualityDashboard />;
      case "cal":              return <EventScheduler />;
      case "slack-mgr":        return <SlackIntegrationManager />;
      case "user-journey":     return <UserJourneyMap />;
      case "mem-profiler":     return <MemoryProfiler />;
      case "error-budget":     return <ErrorBudgetTracker />;
      case "model-compare":    return <MultiModelComparator />;
      case "ctx-browser":      return <ContextBrowser />;
      case "github":           return <GitHubIntegration />;
      case "funnel":           return <FunnelAnalytics />;
      case "sprint-board":     return <SprintBoard />;
      case "cost-forecast":    return <CostForecast />;
      case "threat-intel":       return <ThreatIntelligenceFeed />;
      case "pipeline-monitor":   return <PipelineMonitor />;
      case "a11y-audit":         return <A11yAuditDashboard />;
      case "design-tokens":      return <DesignTokenManager />;
      case "webhook-play":       return <WebhookPlayground />;
      case "sla-manager":        return <SLAManager />;
      case "docs":               return <DocumentationViewer />;
      case "gantt":              return <GanttChartView />;
      case "feedback":           return <CustomerFeedbackDashboard />;
      case "sec-policy":         return <SecurityPolicyEditor />;
      case "team-collab":        return <TeamCollaboration />;
      case "migrations":         return <MigrationManager />;
      case "i18n":               return <LocalizationManager />;
      case "multi-tenant":       return <MultiTenantManager />;
      case "ml-registry":        return <MLModelRegistry />;
      case "event-stream":       return <EventStreamViewer />;
      case "perms-matrix":       return <PermissionsMatrix />;
      case "changelog-v2":       return <ChangelogViewer />;
      case "quota-mgr":          return <ResourceQuotaManager />;
      case "db-query":           return <DatabaseQueryBuilder />;
      case "invoices":           return <InvoiceManager />;
      case "net-topology":       return <NetworkTopologyViewer />;
      case "compliance":         return <ComplianceDashboard />;
      case "user-segments":      return <UserSegmentation />;
      case "deployments":        return <DeploymentTracker />;
      case "moderation":         return <ContentModerationQueue />;
      case "pricing-calc":       return <PricingCalculator />;
      case "tech-radar":         return <TechRadar />;
      case "postmortem":         return <IncidentPostmortem />;
      case "access-tokens":      return <AccessTokenManager />;
      case "k8s-cluster":       return <KubernetesClusterViewer />;
      case "cohort-analysis":   return <CohortAnalysisDashboard />;
      case "sentiment":         return <SentimentAnalysisViewer />;
      case "graphql":           return <GraphQLExplorer />;
      case "backups":           return <BackupManager />;
      case "vector-db":         return <VectorDatabaseViewer />;
      case "doc-templates":     return <DocumentTemplateBuilder />;
      case "service-accounts":  return <ServiceAccountManager />;
      case "container-reg":     return <ContainerRegistry />;
      case "email-campaigns":   return <EmailCampaignManager />;
      case "cdc":               return <ChangeDataCapture />;
      case "fleet":             return <FleetDeviceManager />;
      case "cdn":               return <CDNManager />;
      case "geofence":          return <GeofenceManager />;
      case "scim":              return <ScimUserProvisioner />;
      case "licenses":          return <LicenseManager />;
      case "message-queues":    return <MessageQueueManager />;
      case "tenant-usage":      return <TenantUsageDashboard />;
      case "certs":             return <CertificateManager />;
      case "financial":         return <FinancialReportingDashboard />;
      case "openapi":           return <OpenAPIExplorer />;
      case "data-lineage":      return <DataLineageViewer />;
      case "storage-buckets":   return <StorageBucketManager />;
      case "prompt-router":     return <AIPromptRouter />;
      case "observability":     return <ObservabilityDashboard />;
      case "rbac":              return <AccessControlManager />;
      case "error-tracking":    return <ErrorTrackingDashboard />;
      case "compliance-v2":     return <ComplianceTracker />;
      case "sso":               return <SSOConfigManager />;
      case "content-cal":       return <ContentCalendar />;
      case "infra-cost":        return <InfrastructureCostOptimizer />;
      case "api-gateway":       return <APIGatewayManager />;
      case "cost-anomaly":      return <CostAnomalyDetector />;
      case "knowledge-graph":   return <KnowledgeGraphViewer />;
      case "workflow-orch":     return <WorkflowOrchestrator />;
      case "resource-tags":     return <ResourceTagManager />;
      case "capacity-forecast": return <CapacityForecastDashboard />;
      case "event-catalog":     return <EventCatalogBrowser />;
      case "security-scan":     return <SecurityScanDashboard />;
      case "data-privacy":      return <DataPrivacyDashboard />;
      case "onboarding-flow":   return <UserOnboardingFlow />;
      case "query-perf":        return <QueryPerformanceAnalyzer />;
      case "service-mesh":      return <ServiceMeshViewer />;
      case "multi-region":      return <MultiRegionDashboard />;
      case "revenue":           return <RevenueAnalyticsDashboard />;
      case "vault-secrets":    return <VaultSecretsManager />;
      case "ml-pipeline":      return <MLPipelineMonitor />;
      case "incident-timeline": return <IncidentTimeline />;
      case "test-results":     return <TestResultsDashboard />;
      case "customer-success":     return <CustomerSuccessDashboard />;
      case "container-logs":       return <ContainerLogViewer />;
      case "infra-drift":          return <InfrastructureDriftDetector />;
      case "announcements":        return <AnnouncementCenter />;
      case "schema-explorer":      return <DatabaseSchemaExplorer />;
      case "support-tickets":      return <SupportTicketDashboard />;
      case "api-changelog":        return <APIChangelogManager />;
      case "product-tour":         return <ProductTourBuilder />;
      case "network-firewall":     return <NetworkFirewallRuleManager />;
      case "observability-alerts": return <ObservabilityAlertManager />;
      case "cloud-cost-opt":       return <CloudCostOptimizer />;
      case "network-bw":           return <NetworkBandwidthMonitor />;
      case "service-deps":         return <ServiceDependencyMap />;
      case "feature-requests":     return <FeatureRequestBoard />;
      case "data-catalog":         return <DataCatalog />;
      case "oncall-rotation":      return <OnCallRotationManager />;
      case "resource-inventory":   return <ResourceInventoryDashboard />;
      case "webhook-debugger":     return <WebhookDebugger />;
      case "cost-attribution":     return <CostAttributionDashboard />;
      case "log-aggregator":       return <LogAggregatorView />;
      case "user-devices":         return <UserDeviceManager />;
      case "security-scanner":     return <SecurityScannerDashboard />;
      case "api-gateway-monitor":  return <APIGatewayMonitor />;
      case "db-migrations":        return <DatabaseMigrationManager />;
      case "release-notes":        return <ReleaseNotesManager />;
      case "traffic-analytics":    return <TrafficAnalyticsDashboard />;
      case "incident-command":     return <IncidentCommandCenter />;
      case "env-config":           return <EnvironmentConfigManager />;
      case "user-perms":           return <UserPermissionManager />;
      case "infra-cost-mgr":       return <InfrastructureCostManager />;
      case "db-schema-viewer":     return <DatabaseSchemaViewer />;
      case "deploy-env-mgr":       return <DeploymentEnvironmentManager />;
      case "ml-experiment":        return <MLExperimentTracker />;
      case "disaster-recovery":    return <DisasterRecoveryPlanner />;
      case "data-retention":       return <DataRetentionManager />;
      case "code-review":          return <CodeReviewDashboard />;
      case "endpoint-monitor":     return <EndpointMonitor />;
      case "session-replay-viewer": return <SessionReplayViewer />;
      case "streaming-debugger":   return <StreamingDebugger />;
      case "agent-collab-graph":   return <AgentCollaborationGraph />;
      case "integration-tests":    return <IntegrationTestRunner />;
      case "sla-compliance":       return <SLAComplianceTracker />;
      case "cost-breakdown":       return <CostBreakdownAnalyzer />;
      case "compliance-policy":    return <CompliancePolicyEditor />;
      case "feature-gating":       return <FeatureGatingDashboard />;
      case "service-health-dashboard": return <ServiceHealthDashboard />;
      case "data-masking":         return <DataMaskingManager />;
      case "obs-rules-engine":     return <ObservabilityRulesEngine />;
      case "agent-rel-topology":   return <AgentRelationshipTopology />;
      case "tenant-provisioning":  return <TenantProvisioningWizard />;
      case "billing-audit-log":    return <BillingAuditLog />;
      case "api-rate-limit":       return <APIRateLimitManager />;
      case "env-drift":            return <EnvironmentDriftDetector />;
      case "workflow-orchestration": return <WorkflowOrchestrationDashboard />;
      case "ai-governance":          return <AIGovernanceDashboard />;
      case "retention-policy":       return <DataRetentionPolicyManager />;
      case "incident-playbook":      return <IncidentResponsePlaybook />;
      case "user-journey-analytics": return <UserJourneyAnalytics />;
      case "security-audit-trail":   return <SecurityAuditTrail />;
      case "change-mgmt":            return <ChangeManagementBoard />;
      case "multi-region-failover":  return <MultiRegionFailoverManager />;
      case "cost-allocation":        return <CostAllocationDashboard />;
      case "session-debug-timeline": return <SessionDebugTimeline />;
      case "chaos-engineering":    return <ChaosEngineeringDashboard />;
      case "dependency-audit":     return <DependencyAuditDashboard />;
      case "search-analytics":     return <SearchAnalyticsDashboard />;
      case "change-approval":      return <ChangeApprovalBoard />;
      case "queue-inspector":         return <QueueInspector />;
      case "db-query-analyzer":       return <DatabaseQueryAnalyzer />;
      case "feature-flag-manager":    return <FeatureFlagManager />;
      case "token-usage":             return <TokenUsageOptimizer />;
      default:              return <AgentDashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300 z-40",
          // Desktop: collapsible width
          "hidden md:flex",
          sidebarCollapsed ? "w-16" : "w-56",
          // Mobile: slide-in overlay
          mobileSidebarOpen && "flex fixed inset-y-0 left-0 w-64 shadow-2xl"
        )}
      >
        {/* Logo + Operator Mode Toggle */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-xl hover:opacity-80 transition-opacity"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar (])" : "Collapse sidebar ([)"}
          >
            🐾
          </button>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg text-foreground" data-tour="brand">OpenClaw</span>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={toggleOperatorMode}
              className={cn(
                "ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border transition-colors",
                operatorMode
                  ? "bg-violet-600/20 text-violet-400 border-violet-500/30 hover:bg-violet-600/30"
                  : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
              )}
              title={operatorMode ? "Switch to Standard mode" : "Switch to Operator mode"}
            >
              {operatorMode ? "OPS" : "STD"}
            </button>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="p-2 border-b border-border space-y-2">
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Filter views"
              className="w-full bg-secondary/40 border border-border rounded-md px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filter navigation views"
            />
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Audience filter">
              {NAV_FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={navFilter === value}
                  onClick={() => setNavFilter(value)}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded border transition-colors",
                    navFilter === value
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Nav — Operator Mode: Grouped | Standard Mode: Flat */}
        <nav className="flex-1 overflow-y-auto py-2" data-tour="sidebar">
          {operatorMode ? (
            <>
              {operatorNavGroups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.id);
                return (
                  <div key={group.id}>
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={cn("transition-transform", isCollapsed ? "" : "rotate-90")}>
                          <path d="M2 1l4 3-4 3z" />
                        </svg>
                        {group.label}
                      </button>
                    )}
                    {!isCollapsed && group.items.map((item) => (
                      <button
                        key={item.id}
                        data-tour={`nav-${item.id}`}
                        onClick={() => navigate(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                          activeView === item.id ? "bg-primary/10 text-primary border-r-2 border-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        )}
                        aria-current={activeView === item.id ? "page" : undefined}
                        title={item.shortcut ? `${item.label} (Alt+${item.shortcut})` : item.label}
                      >
                        <span className="text-base" aria-hidden="true">{item.emoji}</span>
                        {!sidebarCollapsed && <span>{item.label}</span>}
                        {!sidebarCollapsed && item.shortcut && <span className="ml-auto text-xs text-muted-foreground/50 font-mono">⌥{item.shortcut}</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
              {!sidebarCollapsed && (
                <div className="px-3 pt-3 pb-1 border-t border-border mt-2">
                  <button
                    onClick={() => setCopilotOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/20 transition-colors"
                  >
                    <span className="text-base">✨</span>
                    <span>AI Copilot</span>
                    <span className="ml-auto text-[9px] bg-violet-600/30 px-1.5 py-0.5 rounded font-mono">⌘J</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            visibleNavItems.map((item) => (
              <button
                key={item.id}
                data-tour={`nav-${item.id}`}
                onClick={() => navigate(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                  activeView === item.id ? "bg-primary/10 text-primary border-r-2 border-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
                aria-current={activeView === item.id ? "page" : undefined}
                title={item.shortcut ? `${item.label} (Alt+${item.shortcut})` : item.label}
              >
                <span className="text-base relative" aria-hidden="true">
                  {item.emoji}
                  {item.id === "notifications" && notificationUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-violet-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                    </span>
                  )}
                </span>
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && item.id === "notifications" && notificationUnreadCount > 0 && (
                  <span className="ml-auto text-[9px] bg-violet-600 text-white rounded-full px-1.5 py-0.5 font-bold">
                    {notificationUnreadCount}
                  </span>
                )}
                {!sidebarCollapsed && item.shortcut && item.id !== "notifications" && (
                  <span className="ml-auto text-xs text-muted-foreground/50 font-mono">⌥{item.shortcut}</span>
                )}
              </button>
            ))
          )}
          {!operatorMode && visibleNavItems.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">No views match this filter.</p>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border flex flex-col gap-2">
          {/* Proficiency Level Badge */}
          {!sidebarCollapsed && <ProficiencyBadge />}
          {/* Start Tour Button */}
          {!sidebarCollapsed && !tour.hasCompleted && (
            <button
              onClick={() => tour.startTour()}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 transition-colors"
              aria-label="Start guided tour"
            >
              <span>🎯</span>
              <span>Start Tour</span>
            </button>
          )}
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">v0.1.0</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShortcutsOpen(true)}
                  className="text-xs text-muted-foreground/50 font-mono bg-secondary/50 px-1.5 py-0.5 rounded border border-border hover:text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Show keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  ?
                </button>
                <button
                  onClick={openCommandPalette}
                  className="text-xs text-muted-foreground/50 font-mono bg-secondary/50 px-1.5 py-0.5 rounded border border-border hover:text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Open command palette"
                  title="Open command palette (⌘K)"
                >
                  ⌘K
                </button>
                <button
                  onClick={() => toast({ message: 'Hello from OpenClaw!', type: 'success' })}
                  className="text-xs text-muted-foreground/50 bg-secondary/50 px-1.5 py-0.5 rounded border border-border hover:text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Test Toast"
                  title="Test Toast"
                >
                  ✨
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={openCommandPalette}
                className="text-xs text-muted-foreground/50 font-mono"
                aria-label="Open command palette"
                title="Open command palette (⌘K)"
              >
                ⌘
              </button>
              <button
                onClick={() => setShortcutsOpen(true)}
                className="text-xs text-muted-foreground/50 font-mono"
                aria-label="Show keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                ?
              </button>
            </div>
          )}
          {!sidebarCollapsed && (
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Audience: <span className="text-foreground/90">{getAudienceLabel(currentCategory)}</span>
            </p>
          )}
        </div>
      </aside>

      {/* Mobile sidebar (separate element for overlay) */}
      {/* M9: responsive pass — mobile drawer with ≥44px touch targets */}
      {mobileSidebarOpen && (
        <aside
          role="navigation"
          aria-label="Main navigation"
          className="flex flex-col fixed inset-y-0 left-0 w-64 border-r border-border bg-card z-40 shadow-2xl md:hidden"
        >
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-lg text-foreground">OpenClaw</span>
            <button
              onClick={toggleOperatorMode}
              className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border transition-colors",
                operatorMode
                  ? "bg-violet-600/20 text-violet-400 border-violet-500/30"
                  : "bg-secondary/50 text-muted-foreground border-border"
              )}
            >
              {operatorMode ? "OPS" : "STD"}
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <div className="p-2 border-b border-border">
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Filter views"
              className="w-full bg-secondary/40 border border-border rounded-md px-2 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filter navigation views"
            />
            <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Audience filter">
              {NAV_FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={navFilter === value}
                  onClick={() => setNavFilter(value)}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded border transition-colors",
                    navFilter === value
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {operatorMode ? (
              operatorNavGroups.map((group) => (
                <div key={group.id}>
                  <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm transition-colors",
                        activeView === item.id
                          ? "bg-primary/10 text-primary border-r-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                      aria-current={activeView === item.id ? "page" : undefined}
                    >
                      <span className="text-base" aria-hidden="true">{item.emoji}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm transition-colors",
                    activeView === item.id
                      ? "bg-primary/10 text-primary border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  aria-current={activeView === item.id ? "page" : undefined}
                >
                  <span className="text-base relative" aria-hidden="true">
                    {item.emoji}
                    {item.id === "notifications" && notificationUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-violet-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                      </span>
                    )}
                  </span>
                  <span>{item.label}</span>
                  {item.id === "notifications" && notificationUnreadCount > 0 && (
                    <span className="ml-auto text-[9px] bg-violet-600 text-white rounded-full px-1.5 py-0.5 font-bold">
                      {notificationUnreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
            {!operatorMode && visibleNavItems.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No views match this filter.</p>
            )}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect y="2" width="18" height="2" rx="1" />
              <rect y="8" width="18" height="2" rx="1" />
              <rect y="14" width="18" height="2" rx="1" />
            </svg>
          </button>
          <button
            onClick={openCommandPalette}
            className="sm:hidden text-muted-foreground hover:text-foreground transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open command palette"
            title="Open command palette (Ctrl/Cmd+K)"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="8" cy="8" r="5" />
              <path d="m12 12 4 4" strokeLinecap="round" />
            </svg>
          </button>

          {/* Back / Forward */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className={cn(
                "p-1.5 rounded-md text-sm transition-colors",
                canGoBack
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/20 cursor-not-allowed"
              )}
              aria-label="Go back (Alt+←)"
              title="Go back (Alt+←)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2L4 7l5 5" />
              </svg>
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              className={cn(
                "p-1.5 rounded-md text-sm transition-colors",
                canGoForward
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/20 cursor-not-allowed"
              )}
              aria-label="Go forward (Alt+→)"
              title="Go forward (Alt+→)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 2l5 5-5 5" />
              </svg>
            </button>
          </div>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/50">OpenClaw</span>
            <span className="text-muted-foreground/30">/</span>
            <span className="hidden md:inline text-muted-foreground/50 capitalize">{currentCategory}</span>
            <span className="hidden md:inline text-muted-foreground/30">/</span>
            <span className="text-foreground font-medium flex items-center gap-1.5">
              <span aria-hidden="true">{currentNav.emoji}</span>
              {currentNav.label}
            </span>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Presets */}
          <div className="relative hidden lg:block">
            <button
              onClick={() => setPresetsOpen(!presetsOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span>Presets</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={cn("transition-transform", presetsOpen && "rotate-180")}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {presetsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPresetsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] py-1 shadow-xl">
                  <button
                    onClick={() => { saveCurrentPreset(); setPresetsOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    + Save current view as preset
                  </button>
                  {savedPresets.length > 0 && <div className="my-1 border-t border-[var(--color-border)]" />}
                  {savedPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => { applyPreset(preset.id); setPresetsOpen(false); }}
                      className="w-full px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                  {savedPresets.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">No saved presets</p>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Operator Mode indicator */}
          {operatorMode && (
            <div className="hidden md:flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                5 active
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                2 errors
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                $42.18 today
              </span>
              <button
                onClick={() => setCopilotOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                title="Open AI Copilot (⌘J)"
              >
                ✨ Copilot
              </button>
            </div>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Search trigger */}
          <button
            onClick={openCommandPalette}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-secondary/50 border border-border rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Open command palette"
            title="Open command palette (Ctrl/Cmd+K)"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="5.5" cy="5.5" r="4" />
              <path d="m9 9 2.5 2.5" strokeLinecap="round" />
            </svg>
            <span>Search...</span>
            <span className="font-mono bg-background/60 px-1 py-0.5 rounded text-[10px]">⌘/Ctrl K</span>
          </button>
        </header>

        {/* Skip nav link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
        >
          Skip to main content
        </a>

        {/* View content */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main" data-tour="main-content">
          {!activeViewVisible && (
            <div className="mx-3 mt-3 sm:mx-4 md:mx-6 max-w-7xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Current view is outside the active navigation filter.
            </div>
          )}
          <ViewErrorBoundary viewId={activeView}>
            <React.Suspense fallback={<LoadingFallback viewId={activeView} />}>
              {/* M9: responsive pass — reduce padding on mobile */}
              <div key={activeView} className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto animate-slide-in">
                {renderView()}
              </div>
            </React.Suspense>
          </ViewErrorBoundary>
        </main>
      </div>

      {/* AI Copilot Panel — Operator Mode */}
      {operatorMode && (
        <React.Suspense fallback={null}>
          <OperatorAICopilot
            isOpen={copilotOpen}
            onClose={() => setCopilotOpen(false)}
            onNavigate={navigate}
          />
        </React.Suspense>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Guided Tour Overlay */}
      <TourOverlay
        isActive={tour.isActive}
        steps={DEFAULT_DASHBOARD_TOUR_STEPS}
        tourId="dashboard-onboarding"
        onComplete={tour.stopTour}
        onSkip={tour.skipTour}
        onStepChange={tour.nextStep}
        showProgress={true}
        allowSkip={true}
      />

      {/* Command Palette */}
      {cmdPaletteOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setCmdPaletteOpen(false)}
            aria-hidden="true"
          />

          {/* Palette modal — M9: responsive pass — full-screen on mobile, centered modal on desktop */}
          <div
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:inset-auto sm:top-[20%] sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg animate-slide-in"
          >
            {/* M9: responsive pass — full-height on mobile */}
            <div className="bg-card border border-border rounded-none sm:rounded-xl shadow-2xl overflow-hidden h-full sm:h-auto w-full sm:w-auto">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground shrink-0"
                  aria-hidden="true"
                >
                  <circle cx="6.5" cy="6.5" r="5" />
                  <path d="m11 11 3 3" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search views and commands..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handlePaletteKey}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  aria-autocomplete="list"
                  aria-controls="palette-results"
                  autoComplete="off"
                />
                <kbd className="text-[10px] text-muted-foreground/50 font-mono bg-secondary/60 px-1.5 py-0.5 rounded border border-border">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div
                id="palette-results"
                role="listbox"
                className="max-h-80 overflow-y-auto py-1"
              >
                {allPaletteItems.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results for "{searchQuery}"
                  </p>
                ) : (
                  <>
                    {!searchQuery && recentItems.length > 0 && (
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                          Recent
                        </span>
                      </div>
                    )}
                    {allPaletteItems.map((item, idx) => {
                      const isRecent = !searchQuery && idx < recentItems.length;
                      const showNavHeader =
                        !searchQuery &&
                        recentItems.length > 0 &&
                        idx === recentItems.length;
                      return (
                        <React.Fragment key={item.id}>
                          {showNavHeader && (
                            <div className="px-3 pt-3 pb-1 border-t border-border mt-1">
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                                Navigation
                              </span>
                            </div>
                          )}
                          <button
                            role="option"
                            aria-selected={idx === highlightedIndex}
                            onClick={() => navigate(item.id)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors cursor-pointer",
                              idx === highlightedIndex
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-secondary/50"
                            )}
                          >
                            <span className="text-base w-6 text-center" aria-hidden="true">
                              {item.emoji}
                            </span>
                            <span className="flex-1 text-left">{item.label}</span>
                            {isRecent && (
                              <span className="text-[10px] text-muted-foreground/40">Recent</span>
                            )}
                            {item.shortcut && (
                              <kbd className="text-[10px] text-muted-foreground/50 font-mono bg-secondary/60 px-1.5 py-0.5 rounded">
                                ⌥{item.shortcut}
                              </kbd>
                            )}
                            {item.id === activeView && (
                              <span className="text-[10px] text-muted-foreground/40">Current</span>
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-secondary/20">
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="font-mono">↑↓</kbd> navigate
                </span>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="font-mono">↵</kbd> open
                </span>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="font-mono">ESC</kbd> close
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Gateway auth modal — shown when the gateway rejects our token */}
      {authModalOpen && (
        <GatewayAuthModal
          authError={gateway.authError}
          onConnect={() => {
            setAuthModalOpen(false);
            gateway.reconnect();
          }}
          onDismiss={() => setAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
