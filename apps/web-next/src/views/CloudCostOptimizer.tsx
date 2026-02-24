import React, { useState } from "react"
import { cn } from "../lib/utils"
import { DollarSign } from "lucide-react"
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState"

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "recommendations" | "resources" | "savings" | "policies"
type EffortLevel = "low" | "medium" | "high"
type RecommendationStatus = "new" | "in-progress" | "implemented" | "dismissed"
type ResourceCategory = "compute" | "storage" | "network" | "database"
type TrendDirection = "up" | "down" | "stable"
type PolicySeverity = "critical" | "warning" | "info"

interface Recommendation {
  id: string
  title: string
  description: string
  estimatedSavings: number
  effort: EffortLevel
  status: RecommendationStatus
  category: string
  implementationSteps: string[]
  affectedResources: string[]
  risk: string
}

interface Resource {
  id: string
  name: string
  category: ResourceCategory
  costPerMonth: number
  utilizationPct: number
  wastePct: number
  trend: TrendDirection
  region: string
  resourceType: string
  overProvisioned: boolean
}

interface MonthlySavings {
  month: string
  implemented: number
  potential: number
  cumulative: number
}

interface CategorySavings {
  category: string
  implemented: number
  potential: number
  color: string
}

interface Policy {
  id: string
  name: string
  description: string
  compliancePct: number
  violationCount: number
  severity: PolicySeverity
  affectedResources: number
  lastChecked: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-001",
    title: "Right-size m5.2xlarge EC2 instances in Production",
    description:
      "14 EC2 instances in the production cluster are running at under 20% CPU and 30% memory utilization. Downsizing to m5.xlarge reduces cost without any performance impact on batch workloads.",
    estimatedSavings: 3240,
    effort: "low",
    status: "new",
    category: "Compute",
    implementationSteps: [
      "Review CPU and memory utilization metrics over the past 30 days in CloudWatch",
      "Create AMI snapshots of all instances scheduled for resize",
      "Schedule maintenance window: Sunday 02:00–04:00 UTC",
      "Stop instances and change instance type to m5.xlarge via EC2 console or AWS CLI",
      "Restart instances and run smoke tests against production endpoints",
      "Monitor CloudWatch metrics for 72 hours before closing the ticket",
    ],
    affectedResources: ["i-0a1b2c3d4e5f", "i-1b2c3d4e5f6a", "i-2c3d4e5f6a7b"],
    risk: "Low — instances are non-critical batch workers with no customer-facing SLA",
  },
  {
    id: "rec-002",
    title: "Purchase Reserved Instances for Aurora RDS clusters",
    description:
      "Aurora clusters in us-east-1 have been running fully on-demand for 18+ months. 1-year reserved instances deliver 40% cost savings with zero operational changes required.",
    estimatedSavings: 5820,
    effort: "low",
    status: "in-progress",
    category: "Database",
    implementationSteps: [
      "Identify all RDS instances with consistent usage over the past 6 months",
      "Open the AWS Cost Explorer Reserved Instance Recommendations report",
      "Compare 1-year No Upfront vs Partial Upfront cost profiles",
      "Submit purchase request for finance approval",
      "Purchase reserved instances via AWS Billing console",
      "Confirm reservations are applying to running instances in Cost Explorer",
    ],
    affectedResources: ["db-prod-aurora-cluster-writer", "db-analytics-aurora-writer"],
    risk: "None — financial commitment only, zero operational changes required",
  },
  {
    id: "rec-003",
    title: "Terminate idle NAT Gateways in dev environments",
    description:
      "8 NAT Gateways in non-production VPCs process under 1 GB/month but still incur the $32/month base fee each plus per-GB data processing charges.",
    estimatedSavings: 256,
    effort: "medium",
    status: "new",
    category: "Network",
    implementationSteps: [
      "Audit all NAT Gateways across dev and staging VPCs",
      "Check CloudWatch NetworkIn/Out metrics over the past 30 days",
      "Verify no active services route through each gateway",
      "Issue a 1-week advance notice to development teams via Slack #dev-infra",
      "Update VPC route tables to remove all NAT Gateway routes",
      "Delete NAT Gateways and archive the Terraform state diff in the PR",
    ],
    affectedResources: ["nat-dev-use1-01", "nat-dev-use1-02", "nat-staging-use1-01", "nat-staging-use1-02"],
    risk: "Medium — may disrupt developer outbound traffic if not coordinated in advance",
  },
  {
    id: "rec-004",
    title: "Transition analytics S3 bucket to Intelligent-Tiering",
    description:
      "The 4.2 TB analytics-data-prod bucket sits in STANDARD class but objects are only accessed occasionally after 30 days. Intelligent-Tiering auto-optimizes storage costs based on real access frequency.",
    estimatedSavings: 892,
    effort: "low",
    status: "new",
    category: "Storage",
    implementationSteps: [
      "Enable S3 Intelligent-Tiering archive configuration on analytics-data-prod",
      "Create a lifecycle rule to transition objects to Intelligent-Tiering after 30 days of inactivity",
      "Review S3 Storage Lens access-frequency report after 90 days",
      "Validate no latency impact on downstream analytics queries",
      "Apply the same policy to reports-archive-prod bucket",
    ],
    affectedResources: ["s3://analytics-data-prod", "s3://reports-archive-prod"],
    risk: "Low — transparent to applications with no API or latency changes for hot objects",
  },
  {
    id: "rec-005",
    title: "Delete unattached EBS volumes from terminated instances",
    description:
      "47 EBS volumes totaling 8.3 TB are unattached and are remnants of terminated EC2 instances. Verified snapshot backups exist for all volumes in the same region.",
    estimatedSavings: 664,
    effort: "medium",
    status: "implemented",
    category: "Storage",
    implementationSteps: [
      "Run: aws ec2 describe-volumes --filters Name=status,Values=available",
      "Cross-reference volumes with terminated instance IDs from CloudTrail",
      "Verify each volume has at least one restorable snapshot",
      "Tag volumes as pending-deletion and notify resource owners by email",
      "Enforce a 14-day hold period for owner objections",
      "Delete volumes in batches and log all deletions to the audit S3 bucket",
    ],
    affectedResources: ["vol-0a1b2c3d4e5f", "vol-1b2c3d4e5f6a", "vol-2c3d4e5f6a7b", "vol-3d4e5f6a7b8c"],
    risk: "Medium — data loss is permanent; snapshot verification is mandatory before deletion",
  },
  {
    id: "rec-006",
    title: "Consolidate underutilized ElastiCache Redis clusters in staging",
    description:
      "Three staging Redis clusters each run at under 10% utilization. Merging into a single cluster with logical database separation cuts infrastructure overhead by 66%.",
    estimatedSavings: 1440,
    effort: "high",
    status: "new",
    category: "Database",
    implementationSteps: [
      "Document all Redis keyspaces, TTL policies, and eviction configurations",
      "Design key namespace separation strategy using logical database indices (DB 0, 1, 2)",
      "Provision consolidated cache.r6g.large cluster with extra memory headroom",
      "Benchmark consolidated cluster performance under combined synthetic load",
      "Update application configs with new Redis endpoint and database selectors",
      "Migrate data using redis-cli DUMP/RESTORE across all three keyspaces",
      "Run old and new clusters in parallel for 2 weeks with full monitoring",
      "Decommission old clusters after zero-regression validation period",
    ],
    affectedResources: ["cache-staging-sessions", "cache-staging-queue", "cache-staging-api"],
    risk: "High — requires coordinated application config changes and careful live data migration",
  },
  {
    id: "rec-007",
    title: "Purchase Compute Savings Plans for Lambda functions",
    description:
      "Lambda invocations have been stable at ~2 M/day for 6+ months. A 1-year Compute Savings Plan covers approximately 65% of Lambda costs at a 35% discount rate.",
    estimatedSavings: 720,
    effort: "low",
    status: "new",
    category: "Compute",
    implementationSteps: [
      "Pull Lambda usage trend from Cost Explorer over the past 90 days",
      "Run Savings Plans Calculator at a conservative 80% commitment level",
      "Get finance approval for the 1-year committed spend",
      "Purchase Compute Savings Plan via AWS Billing and Cost Management console",
      "Confirm plan is applying in the Cost Explorer Savings Plans utilization report",
    ],
    affectedResources: ["lambda-api-handler", "lambda-event-processor", "lambda-cron-jobs", "lambda-notifier"],
    risk: "None — financial commitment only, no operational or architectural changes required",
  },
  {
    id: "rec-008",
    title: "Migrate 312 gp2 EBS volumes to gp3",
    description:
      "312 gp2 EBS volumes (45 TB total) can be live-migrated to gp3 for 20% cost savings while maintaining equivalent baseline IOPS and unlocking independent IOPS/throughput scaling.",
    estimatedSavings: 2160,
    effort: "low",
    status: "in-progress",
    category: "Storage",
    implementationSteps: [
      "List gp2 volumes: aws ec2 describe-volumes --filters Name=volume-type,Values=gp2",
      "Generate migration script using aws ec2 modify-volume --volume-type gp3",
      "Set IOPS and throughput baseline values to match or exceed gp2 equivalents",
      "Monitor CloudWatch VolumeReadOps and VolumeWriteOps for 24 hours post-migration",
      "Update all Terraform modules to provision gp3 by default going forward",
    ],
    affectedResources: ["vol-prod-app-001 through vol-prod-app-180", "vol-staging-001 through vol-staging-132"],
    risk: "Low — fully online migration; no instance restart or application downtime required",
  },
  {
    id: "rec-009",
    title: "Release 23 unused Elastic IP addresses",
    description:
      "23 Elastic IPs are allocated but not associated with any running resource, incurring $0.005/hr ($3.65/month) each — approximately $84/month in idle spend.",
    estimatedSavings: 101,
    effort: "low",
    status: "dismissed",
    category: "Network",
    implementationSteps: [
      "List unassociated EIPs: aws ec2 describe-addresses --filters Name=domain,Values=vpc",
      "Verify none of the EIPs appear in external DNS A-records or whitelists",
      "Notify network team and allow 5 business days for objections",
      "Release each EIP: aws ec2 release-address --allocation-id <id>",
    ],
    affectedResources: ["eip-prod-01", "eip-prod-02", "eip-staging-01"],
    risk: "Low — no functional impact once DNS record verification is complete",
  },
  {
    id: "rec-010",
    title: "Apply environment-appropriate CloudWatch Log retention policies",
    description:
      "All log groups retain logs for 365 days by default. Reducing dev retention to 30 days and staging to 90 days substantially cuts CloudWatch Logs storage costs.",
    estimatedSavings: 384,
    effort: "low",
    status: "new",
    category: "Storage",
    implementationSteps: [
      "Enumerate all CloudWatch Log Groups across all accounts using AWS Organizations",
      "Tag all log groups by environment if the Environment tag is missing",
      "Apply retention rules via Terraform: dev=30d, staging=90d, prod=365d",
      "Deploy a Lambda + EventBridge rule to enforce retention on newly created log groups",
      "Review storage size reduction in CloudWatch Logs Insights after 30 days",
    ],
    affectedResources: ["/aws/lambda/*-dev", "/aws/ecs/*-staging", "/aws/rds/*-dev"],
    risk: "Low — logs beyond retention are permanently deleted; verify no active compliance requirements first",
  },
  {
    id: "rec-011",
    title: "Rightsize Aurora read replicas to match actual query load",
    description:
      "Aurora read replicas are provisioned at db.r6g.2xlarge matching the primary but only handle 15% of query traffic. Downsizing to r6g.large reduces cost without impacting read SLA.",
    estimatedSavings: 1980,
    effort: "medium",
    status: "new",
    category: "Database",
    implementationSteps: [
      "Pull read replica CloudWatch metrics: CPU, DatabaseConnections, ReadIOPS over 30 days",
      "Confirm replicas average under 25% CPU utilization across the sample window",
      "Provision a test r6g.large replica and route 10% of read traffic to it via weighted endpoint",
      "Validate P99 query latency does not exceed production SLA thresholds",
      "Perform rolling resize one replica at a time to minimize connection disruption",
      "Update the Terraform RDS module with the new instance class and re-apply",
      "Monitor all replicas for 2 weeks and confirm zero regressions",
    ],
    affectedResources: ["db-prod-aurora-replica-1", "db-prod-aurora-replica-2", "db-prod-aurora-replica-3"],
    risk: "Medium — brief connection interruption per replica during instance modification",
  },
  {
    id: "rec-012",
    title: "Apply S3 lifecycle policies to all application log buckets",
    description:
      "Application log buckets have no lifecycle policies and have accumulated 12+ TB in STANDARD storage class. Lifecycle rules reduce costs while satisfying the 365-day compliance retention requirement.",
    estimatedSavings: 1120,
    effort: "low",
    status: "new",
    category: "Storage",
    implementationSteps: [
      "Inventory all application log S3 buckets across all accounts",
      "Confirm retention requirements with legal and security teams",
      "Define lifecycle rule: STANDARD (0d) -> STANDARD_IA (30d) -> GLACIER (90d) -> Delete (365d)",
      "Apply rules via Terraform aws_s3_bucket_lifecycle_configuration resource",
      "Validate transitions in the S3 console Storage Class Analysis after 30 days",
      "Set up a CloudWatch alarm for unexpected storage growth above the cost baseline",
    ],
    affectedResources: [
      "s3://app-logs-prod",
      "s3://access-logs-prod",
      "s3://audit-logs-prod",
      "s3://elb-logs-prod",
    ],
    risk: "Low — only affects archival storage; active application log writes are fully unaffected",
  },
]

const RESOURCES: Resource[] = [
  {
    id: "i-0a1b2c3d",
    name: "prod-web-server-01",
    category: "compute",
    costPerMonth: 892,
    utilizationPct: 18,
    wastePct: 72,
    trend: "up",
    region: "us-east-1",
    resourceType: "m5.2xlarge",
    overProvisioned: true,
  },
  {
    id: "i-1b2c3d4e",
    name: "prod-web-server-02",
    category: "compute",
    costPerMonth: 892,
    utilizationPct: 21,
    wastePct: 68,
    trend: "stable",
    region: "us-east-1",
    resourceType: "m5.2xlarge",
    overProvisioned: true,
  },
  {
    id: "i-api-worker-01",
    name: "api-worker-primary",
    category: "compute",
    costPerMonth: 446,
    utilizationPct: 62,
    wastePct: 18,
    trend: "down",
    region: "us-east-1",
    resourceType: "m5.xlarge",
    overProvisioned: false,
  },
  {
    id: "i-ml-inference-01",
    name: "ml-inference-worker-01",
    category: "compute",
    costPerMonth: 1840,
    utilizationPct: 84,
    wastePct: 8,
    trend: "up",
    region: "us-east-1",
    resourceType: "g4dn.xlarge",
    overProvisioned: false,
  },
  {
    id: "i-batch-proc-01",
    name: "batch-processing-worker-01",
    category: "compute",
    costPerMonth: 892,
    utilizationPct: 14,
    wastePct: 79,
    trend: "stable",
    region: "us-west-2",
    resourceType: "m5.2xlarge",
    overProvisioned: true,
  },
  {
    id: "db-aurora-prod-writer",
    name: "aurora-prod-cluster-writer",
    category: "database",
    costPerMonth: 2840,
    utilizationPct: 71,
    wastePct: 12,
    trend: "stable",
    region: "us-east-1",
    resourceType: "db.r6g.2xlarge",
    overProvisioned: false,
  },
  {
    id: "db-aurora-replica-1",
    name: "aurora-prod-replica-1",
    category: "database",
    costPerMonth: 2840,
    utilizationPct: 15,
    wastePct: 74,
    trend: "down",
    region: "us-east-1",
    resourceType: "db.r6g.2xlarge",
    overProvisioned: true,
  },
  {
    id: "db-aurora-replica-2",
    name: "aurora-prod-replica-2",
    category: "database",
    costPerMonth: 2840,
    utilizationPct: 14,
    wastePct: 75,
    trend: "down",
    region: "us-west-2",
    resourceType: "db.r6g.2xlarge",
    overProvisioned: true,
  },
  {
    id: "cache-staging-sessions",
    name: "elasticache-staging-sessions",
    category: "database",
    costPerMonth: 480,
    utilizationPct: 9,
    wastePct: 81,
    trend: "stable",
    region: "us-east-1",
    resourceType: "cache.r6g.large",
    overProvisioned: true,
  },
  {
    id: "cache-staging-queue",
    name: "elasticache-staging-queue",
    category: "database",
    costPerMonth: 480,
    utilizationPct: 7,
    wastePct: 83,
    trend: "stable",
    region: "us-east-1",
    resourceType: "cache.r6g.large",
    overProvisioned: true,
  },
  {
    id: "s3-analytics-data",
    name: "analytics-data-prod",
    category: "storage",
    costPerMonth: 1240,
    utilizationPct: 100,
    wastePct: 61,
    trend: "up",
    region: "us-east-1",
    resourceType: "S3 Standard (4.2 TB)",
    overProvisioned: true,
  },
  {
    id: "s3-app-logs",
    name: "app-logs-prod",
    category: "storage",
    costPerMonth: 890,
    utilizationPct: 100,
    wastePct: 55,
    trend: "up",
    region: "us-east-1",
    resourceType: "S3 Standard (3.1 TB)",
    overProvisioned: true,
  },
  {
    id: "ebs-batch-vol-01",
    name: "batch-processing-vol-01",
    category: "storage",
    costPerMonth: 320,
    utilizationPct: 22,
    wastePct: 78,
    trend: "stable",
    region: "us-east-1",
    resourceType: "gp2 1 TB",
    overProvisioned: true,
  },
  {
    id: "s3-db-backups",
    name: "database-backups-prod",
    category: "storage",
    costPerMonth: 440,
    utilizationPct: 100,
    wastePct: 20,
    trend: "up",
    region: "us-east-1",
    resourceType: "S3 Standard (1.6 TB)",
    overProvisioned: false,
  },
  {
    id: "nat-dev-01",
    name: "nat-gateway-dev-01",
    category: "network",
    costPerMonth: 32,
    utilizationPct: 3,
    wastePct: 95,
    trend: "stable",
    region: "us-east-1",
    resourceType: "NAT Gateway",
    overProvisioned: true,
  },
  {
    id: "nat-dev-02",
    name: "nat-gateway-dev-02",
    category: "network",
    costPerMonth: 32,
    utilizationPct: 2,
    wastePct: 97,
    trend: "stable",
    region: "us-east-1",
    resourceType: "NAT Gateway",
    overProvisioned: true,
  },
  {
    id: "alb-prod-main",
    name: "alb-prod-main",
    category: "network",
    costPerMonth: 184,
    utilizationPct: 58,
    wastePct: 12,
    trend: "up",
    region: "us-east-1",
    resourceType: "Application Load Balancer",
    overProvisioned: false,
  },
]

const MONTHLY_SAVINGS: MonthlySavings[] = [
  { month: "Mar", implemented: 0, potential: 18777, cumulative: 0 },
  { month: "Apr", implemented: 664, potential: 18777, cumulative: 664 },
  { month: "May", implemented: 1120, potential: 18777, cumulative: 1784 },
  { month: "Jun", implemented: 892, potential: 18777, cumulative: 2676 },
  { month: "Jul", implemented: 2160, potential: 18777, cumulative: 4836 },
  { month: "Aug", implemented: 384, potential: 18777, cumulative: 5220 },
  { month: "Sep", implemented: 1980, potential: 18777, cumulative: 7200 },
  { month: "Oct", implemented: 3240, potential: 18777, cumulative: 10440 },
  { month: "Nov", implemented: 720, potential: 18777, cumulative: 11160 },
  { month: "Dec", implemented: 5820, potential: 18777, cumulative: 16980 },
  { month: "Jan", implemented: 256, potential: 18777, cumulative: 17236 },
  { month: "Feb", implemented: 101, potential: 18777, cumulative: 17337 },
]

const CATEGORY_SAVINGS: CategorySavings[] = [
  { category: "Compute", implemented: 3960, potential: 5400, color: "bg-indigo-500" },
  { category: "Database", implemented: 5820, potential: 12080, color: "bg-violet-500" },
  { category: "Storage", implemented: 2840, potential: 6260, color: "bg-cyan-500" },
  { category: "Network", implemented: 256, potential: 389, color: "bg-emerald-500" },
]

const POLICIES: Policy[] = [
  {
    id: "pol-001",
    name: "No Untagged Resources",
    description:
      "All AWS resources must carry required tags: Environment, Owner, CostCenter, Project. Resources missing any required tag are flagged for immediate remediation by the resource owner.",
    compliancePct: 73,
    violationCount: 142,
    severity: "critical",
    affectedResources: 142,
    lastChecked: "2 hours ago",
  },
  {
    id: "pol-002",
    name: "Maximum Instance Size per Environment",
    description:
      "Dev and staging environments are restricted to m5.xlarge (compute) and db.t3.medium (database). Production allows up to m5.4xlarge and db.r6g.2xlarge only.",
    compliancePct: 88,
    violationCount: 23,
    severity: "warning",
    affectedResources: 23,
    lastChecked: "15 minutes ago",
  },
  {
    id: "pol-003",
    name: "Idle Resource Automatic Shutdown",
    description:
      "EC2 instances in dev/staging that are idle for 4+ hours during business hours are automatically stopped. Resources idle for 7 days are flagged for owner-confirmed termination.",
    compliancePct: 91,
    violationCount: 14,
    severity: "warning",
    affectedResources: 14,
    lastChecked: "30 minutes ago",
  },
  {
    id: "pol-004",
    name: "Minimum Reserved Instance Coverage (70%)",
    description:
      "Production compute and database workloads must maintain at least 70% reserved instance coverage. On-demand usage above the threshold triggers an automatic RI purchase recommendation.",
    compliancePct: 64,
    violationCount: 8,
    severity: "critical",
    affectedResources: 8,
    lastChecked: "1 hour ago",
  },
  {
    id: "pol-005",
    name: "S3 Bucket Lifecycle Policy Required",
    description:
      "All S3 buckets storing logs, archives, or backup data must have a lifecycle policy configured. Buckets without lifecycle rules are marked non-compliant and reported weekly.",
    compliancePct: 61,
    violationCount: 31,
    severity: "warning",
    affectedResources: 31,
    lastChecked: "45 minutes ago",
  },
  {
    id: "pol-006",
    name: "S3 Public Access Block Enforcement",
    description:
      "All S3 buckets must have public access blocked unless listed in the approved-public-buckets SSM parameter. Unauthorized public buckets trigger a critical security alert.",
    compliancePct: 99,
    violationCount: 1,
    severity: "info",
    affectedResources: 1,
    lastChecked: "5 minutes ago",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollars(n: number): string {
  return "$" + n.toLocaleString()
}

function fmtDollarsShort(n: number): string {
  if (n >= 1000) {
    return "$" + (n / 1000).toFixed(1) + "k"
  }
  return "$" + n
}

function trendArrow(t: TrendDirection): string {
  if (t === "up") {return "↑"}
  if (t === "down") {return "↓"}
  return "→"
}

function trendColor(t: TrendDirection): string {
  if (t === "up") {return "text-rose-400"}
  if (t === "down") {return "text-emerald-400"}
  return "text-fg-secondary"
}

function effortClasses(e: EffortLevel): string {
  if (e === "low") {return "bg-emerald-900 text-emerald-300 border border-emerald-800"}
  if (e === "medium") {return "bg-amber-900 text-amber-300 border border-amber-800"}
  return "bg-rose-900 text-rose-300 border border-rose-800"
}

function statusClasses(s: RecommendationStatus): string {
  if (s === "new") {return "bg-indigo-900 text-indigo-300 border border-indigo-800"}
  if (s === "in-progress") {return "bg-amber-900 text-amber-300 border border-amber-800"}
  if (s === "implemented") {return "bg-emerald-900 text-emerald-300 border border-emerald-800"}
  return "bg-surface-2 text-fg-secondary border border-tok-border"
}

function severityClasses(s: PolicySeverity): string {
  if (s === "critical") {return "bg-rose-900 text-rose-300 border border-rose-800"}
  if (s === "warning") {return "bg-amber-900 text-amber-300 border border-amber-800"}
  return "bg-blue-900 text-blue-300 border border-blue-800"
}

function utilizationBarColor(pct: number): string {
  if (pct < 25) {return "bg-rose-500"}
  if (pct < 50) {return "bg-amber-500"}
  return "bg-emerald-500"
}

function complianceBarColor(pct: number): string {
  if (pct < 70) {return "bg-rose-500"}
  if (pct < 90) {return "bg-amber-500"}
  return "bg-emerald-500"
}

const STATUS_LABELS: Record<RecommendationStatus, string> = {
  "new": "New",
  "in-progress": "In Progress",
  "implemented": "Implemented",
  "dismissed": "Dismissed",
}

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  compute: "Compute",
  storage: "Storage",
  network: "Network",
  database: "Database",
}

const CATEGORY_ORDER: ResourceCategory[] = ["compute", "database", "storage", "network"]

// ─── Recommendation Detail Panel ─────────────────────────────────────────────

interface RecDetailProps {
  rec: Recommendation
  onClose: () => void
}

function RecDetail({ rec, onClose }: RecDetailProps) {
  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 md:p-6 border-b border-tok-border">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex flex-wrap gap-2">
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusClasses(rec.status))}>
              {STATUS_LABELS[rec.status]}
            </span>
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", effortClasses(rec.effort))}>
              {rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)} effort
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface-2 text-fg-primary border border-tok-border">
              {rec.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex-none text-fg-secondary hover:text-fg-primary transition-colors text-sm font-medium px-3 py-1 rounded-lg bg-surface-2 hover:bg-surface-3"
          >
            ← Back
          </button>
        </div>
        <h3 className="text-xl font-bold text-fg-primary leading-snug">{rec.title}</h3>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-6">
        {/* Savings summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-0 rounded-xl p-4 border border-tok-border">
            <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Monthly Savings</p>
            <p className="text-3xl font-bold text-emerald-400">{fmtDollars(rec.estimatedSavings)}</p>
          </div>
          <div className="bg-surface-0 rounded-xl p-4 border border-tok-border">
            <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Annual Potential</p>
            <p className="text-3xl font-bold text-fg-primary">{fmtDollars(rec.estimatedSavings * 12)}</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-sm text-fg-primary leading-relaxed">{rec.description}</p>
        </div>

        {/* Implementation steps */}
        <div>
          <h4 className="text-sm font-semibold text-fg-primary mb-4">Implementation Steps</h4>
          <ol className="space-y-3">
            {rec.implementationSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 border border-indigo-800 text-xs flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-fg-primary leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Affected resources */}
        <div>
          <h4 className="text-sm font-semibold text-fg-primary mb-3">Affected Resources</h4>
          <div className="flex flex-wrap gap-2">
            {rec.affectedResources.map((r, i) => (
              <code key={i} className="text-xs bg-surface-2 text-fg-primary px-2.5 py-1.5 rounded-lg font-mono border border-tok-border">
                {r}
              </code>
            ))}
          </div>
        </div>

        {/* Risk */}
        <div className="flex gap-3 items-start bg-surface-0 rounded-xl p-4 border border-tok-border">
          <span className="text-amber-400 text-base flex-none mt-0.5">⚠</span>
          <div>
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider block mb-1">Risk Assessment</span>
            <span className="text-sm text-fg-primary">{rec.risk}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Recommendations Tab ─────────────────────────────────────────────────────

interface RecommendationsTabProps {
  recommendations: Recommendation[]
}

function RecommendationsTab({ recommendations }: RecommendationsTabProps) {
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [filterStatus, setFilterStatus] = useState<RecommendationStatus | "all">("all")

  const statusFilters: Array<{ value: RecommendationStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "in-progress", label: "In Progress" },
    { value: "implemented", label: "Implemented" },
    { value: "dismissed", label: "Dismissed" },
  ]

  const filtered =
    filterStatus === "all" ? recommendations : recommendations.filter((r) => r.status === filterStatus)

  const totalPotential = recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0)
  const totalImplemented = recommendations
    .filter((r) => r.status === "implemented")
    .reduce((sum, r) => sum + r.estimatedSavings, 0)
  const newCount = recommendations.filter((r) => r.status === "new").length

  if (selected !== null) {
    return (
      <div className="p-6">
        <RecDetail rec={selected} onClose={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Total Potential</p>
          <p className="text-2xl font-bold text-fg-primary">{fmtDollars(totalPotential)}<span className="text-sm font-normal text-fg-secondary">/mo</span></p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Implemented Savings</p>
          <p className="text-2xl font-bold text-emerald-400">{fmtDollars(totalImplemented)}<span className="text-sm font-normal text-fg-secondary">/mo</span></p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Open Recommendations</p>
          <p className="text-2xl font-bold text-indigo-400">{newCount} <span className="text-sm font-normal text-fg-secondary">new</span></p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
              filterStatus === f.value
                ? "bg-indigo-600 text-fg-primary border-indigo-500"
                : "bg-surface-1 text-fg-secondary border-tok-border hover:text-fg-primary hover:border-tok-border"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Recommendation list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <ContextualEmptyState
            icon={DollarSign}
            title="No recommendations match"
            description="Try a different filter to see cost optimization recommendations."
            size="sm"
          />
        )}
        {filtered.map((rec) => (
          <button
            key={rec.id}
            onClick={() => setSelected(rec)}
            className="w-full text-left bg-surface-1 border border-tok-border rounded-xl p-5 hover:border-indigo-700 hover:bg-surface-2 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusClasses(rec.status))}>
                    {STATUS_LABELS[rec.status]}
                  </span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", effortClasses(rec.effort))}>
                    {rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)} effort
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-fg-secondary border border-tok-border">
                    {rec.category}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-fg-primary group-hover:text-indigo-300 transition-colors leading-snug mb-1.5">
                  {rec.title}
                </h4>
                <p className="text-xs text-fg-secondary line-clamp-2 leading-relaxed">{rec.description}</p>
              </div>
              <div className="flex-none text-right">
                <p className="text-lg font-bold text-emerald-400">{fmtDollarsShort(rec.estimatedSavings)}</p>
                <p className="text-xs text-fg-muted">/month</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Resources Tab ────────────────────────────────────────────────────────────

interface ResourcesTabProps {
  resources: Resource[]
}

function ResourcesTab({ resources }: ResourcesTabProps) {
  const totalMonthly = resources.reduce((sum, r) => sum + r.costPerMonth, 0)
  const overProvisionedCount = resources.filter((r) => r.overProvisioned).length
  const totalWaste = resources.reduce((sum, r) => sum + r.costPerMonth * (r.wastePct / 100), 0)

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Total Monthly Cost</p>
          <p className="text-2xl font-bold text-fg-primary">{fmtDollars(totalMonthly)}</p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Estimated Waste</p>
          <p className="text-2xl font-bold text-rose-400">{fmtDollars(Math.round(totalWaste))}<span className="text-sm font-normal text-fg-secondary">/mo</span></p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Over-provisioned</p>
          <p className="text-2xl font-bold text-amber-400">{overProvisionedCount} <span className="text-sm font-normal text-fg-secondary">resources</span></p>
        </div>
      </div>

      {/* Resources by category */}
      {CATEGORY_ORDER.map((cat) => {
        const catResources = resources.filter((r) => r.category === cat)
        if (catResources.length === 0) {return null}
        const catTotal = catResources.reduce((sum, r) => sum + r.costPerMonth, 0)

        return (
          <div key={cat} className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-tok-border bg-surface-0">
              <h3 className="text-sm font-semibold text-fg-primary">{CATEGORY_LABELS[cat]}</h3>
              <span className="text-sm font-semibold text-fg-primary">{fmtDollars(catTotal)}/mo</span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-tok-border text-xs text-fg-muted uppercase tracking-wider">
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-1">Region</div>
              <div className="col-span-2 text-right">Cost/mo</div>
              <div className="col-span-2">Utilization</div>
              <div className="col-span-1 text-right">Waste</div>
              <div className="col-span-1 text-right">Trend</div>
            </div>

            {/* Rows */}
            {catResources.map((res) => (
              <div
                key={res.id}
                className={cn(
                  "grid grid-cols-12 gap-2 px-5 py-3 border-b border-tok-border last:border-b-0 items-center text-sm",
                  res.overProvisioned ? "bg-rose-950/20" : ""
                )}
              >
                {/* Name */}
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  {res.overProvisioned && (
                    <span className="flex-none w-1.5 h-1.5 rounded-full bg-rose-500" />
                  )}
                  <span className="text-fg-primary font-medium truncate">{res.name}</span>
                </div>
                {/* Type */}
                <div className="col-span-2 text-fg-secondary text-xs font-mono truncate">{res.resourceType}</div>
                {/* Region */}
                <div className="col-span-1 text-fg-muted text-xs">{res.region}</div>
                {/* Cost */}
                <div className="col-span-2 text-right font-semibold text-fg-primary">{fmtDollars(res.costPerMonth)}</div>
                {/* Utilization bar */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", utilizationBarColor(res.utilizationPct))}
                        style={{ width: res.utilizationPct + "%" }}
                      />
                    </div>
                    <span className="text-xs text-fg-secondary w-8 text-right">{res.utilizationPct}%</span>
                  </div>
                </div>
                {/* Waste */}
                <div className={cn("col-span-1 text-right text-sm font-semibold", res.wastePct > 60 ? "text-rose-400" : res.wastePct > 30 ? "text-amber-400" : "text-fg-secondary")}>
                  {res.wastePct}%
                </div>
                {/* Trend */}
                <div className={cn("col-span-1 text-right font-bold", trendColor(res.trend))}>
                  {trendArrow(res.trend)}
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-fg-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          Over-provisioned (highlighted)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block text-rose-400 font-bold">↑</span>
          Cost trending up
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block text-emerald-400 font-bold">↓</span>
          Cost trending down
        </div>
      </div>
    </div>
  )
}

// ─── Savings Tracker Tab ──────────────────────────────────────────────────────

interface SavingsTrackerTabProps {
  monthly: MonthlySavings[]
  categories: CategorySavings[]
}

function SavingsTrackerTab({ monthly, categories }: SavingsTrackerTabProps) {
  const lastMonth = monthly[monthly.length - 1]
  const totalImplemented = lastMonth.cumulative
  const totalPotential = categories.reduce((sum, c) => sum + c.potential, 0)
  const pctRealized = Math.round((totalImplemented / totalPotential) * 100)

  const maxCumulative = Math.max(...monthly.map((m) => m.cumulative), 1)
  const chartHeight = 200

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Total Implemented</p>
          <p className="text-2xl font-bold text-emerald-400">{fmtDollars(totalImplemented)}<span className="text-sm font-normal text-fg-secondary">/mo</span></p>
          <p className="text-xs text-fg-muted mt-1">Annual: {fmtDollars(totalImplemented * 12)}</p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Total Potential</p>
          <p className="text-2xl font-bold text-fg-primary">{fmtDollars(totalPotential)}<span className="text-sm font-normal text-fg-secondary">/mo</span></p>
          <p className="text-xs text-fg-muted mt-1">Annual: {fmtDollars(totalPotential * 12)}</p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Savings Realized</p>
          <p className="text-2xl font-bold text-indigo-400">{pctRealized}%</p>
          <div className="mt-2 h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: pctRealized + "%" }}
            />
          </div>
        </div>
      </div>

      {/* Waterfall chart */}
      <div className="bg-surface-1 border border-tok-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">Cumulative Monthly Savings (12-month waterfall)</h3>
        <div className="flex gap-1 items-end" style={{ height: chartHeight + 32 + "px" }}>
          {/* Y-axis */}
          <div className="flex flex-col justify-between text-right pr-2 flex-none" style={{ height: chartHeight + "px" }}>
            {[100, 75, 50, 25, 0].map((pct) => (
              <span key={pct} className="text-xs text-fg-muted leading-none">
                {fmtDollarsShort(Math.round((maxCumulative * pct) / 100))}
              </span>
            ))}
          </div>

          {/* Bars */}
          <div className="flex-1 flex gap-1 items-end">
            {monthly.map((m) => {
              const barHeightPx = (m.implemented / maxCumulative) * chartHeight
              const spacerHeightPx = ((m.cumulative - m.implemented) / maxCumulative) * chartHeight
              return (
                <div key={m.month} className="flex-1 flex flex-col items-stretch">
                  {/* Chart column */}
                  <div className="relative flex-none" style={{ height: chartHeight + "px" }}>
                    {/* Grid lines */}
                    {[25, 50, 75].map((pct) => (
                      <div
                        key={pct}
                        className="absolute left-0 right-0 border-t border-dashed border-tok-border"
                        style={{ bottom: (pct / 100) * chartHeight + "px" }}
                      />
                    ))}
                    {/* Spacer (transparent — positions the bar) */}
                    {m.implemented > 0 && (
                      <div
                        className="absolute left-0.5 right-0.5"
                        style={{
                          bottom: spacerHeightPx + "px",
                          height: Math.max(barHeightPx, 4) + "px",
                        }}
                      >
                        <div className="w-full h-full bg-indigo-500 rounded-t-sm group relative">
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <div className="bg-surface-2 border border-tok-border rounded px-2 py-1 text-xs text-fg-primary whitespace-nowrap shadow-xl">
                              <span className="font-semibold text-emerald-400">+{fmtDollarsShort(m.implemented)}</span>
                              <span className="text-fg-secondary ml-1">this month</span>
                            </div>
                            <div className="w-1.5 h-1.5 bg-surface-2 border-r border-b border-tok-border rotate-45 -mt-0.5" />
                          </div>
                        </div>
                        {/* Cumulative total line */}
                        <div className="absolute -top-px left-0 right-0 h-0.5 bg-indigo-300 opacity-60" />
                      </div>
                    )}
                  </div>
                  {/* Month label */}
                  <div className="text-center mt-1.5">
                    <span className="text-xs text-fg-muted">{m.month}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* X-axis label */}
        <p className="text-xs text-fg-muted text-center mt-1">Monthly incremental savings (bar height = new savings that month, position = cumulative base)</p>
      </div>

      {/* Category savings bars */}
      <div className="bg-surface-1 border border-tok-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">Savings by Category</h3>
        <div className="space-y-4">
          {categories.map((cat) => {
            const pct = Math.round((cat.implemented / cat.potential) * 100)
            return (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-fg-primary">{cat.category}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-400 font-semibold">{fmtDollarsShort(cat.implemented)}</span>
                    <span className="text-fg-muted">/</span>
                    <span className="text-fg-secondary">{fmtDollarsShort(cat.potential)}</span>
                    <span className="text-xs text-fg-muted w-10 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", cat.color)}
                    style={{ width: pct + "%" }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-tok-border flex justify-between items-center">
          <span className="text-sm text-fg-secondary">Total across all categories</span>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="text-emerald-400">{fmtDollars(categories.reduce((s, c) => s + c.implemented, 0))}</span>
            <span className="text-fg-muted">/</span>
            <span className="text-fg-primary">{fmtDollars(categories.reduce((s, c) => s + c.potential, 0))}</span>
            <span className="text-fg-muted text-xs">per month</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Policies Tab ────────────────────────────────────────────────────────────

interface PoliciesTabProps {
  policies: Policy[]
}

function PoliciesTab({ policies }: PoliciesTabProps) {
  const criticalCount = policies.filter((p) => p.severity === "critical").length
  const totalViolations = policies.reduce((sum, p) => sum + p.violationCount, 0)
  const avgCompliance = Math.round(policies.reduce((sum, p) => sum + p.compliancePct, 0) / policies.length)

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Avg Compliance</p>
          <p className="text-2xl font-bold text-fg-primary">{avgCompliance}%</p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Total Violations</p>
          <p className="text-2xl font-bold text-rose-400">{totalViolations}</p>
        </div>
        <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
          <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Critical Policies</p>
          <p className="text-2xl font-bold text-amber-400">{criticalCount}</p>
        </div>
      </div>

      {/* Policy cards */}
      <div className="space-y-3">
        {policies.map((policy) => (
          <div
            key={policy.id}
            className={cn(
              "bg-surface-1 border rounded-xl p-5",
              policy.severity === "critical" ? "border-rose-900" : policy.severity === "warning" ? "border-amber-900/50" : "border-tok-border"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold text-fg-primary">{policy.name}</h4>
                    <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full", severityClasses(policy.severity))}>
                      {policy.severity.charAt(0).toUpperCase() + policy.severity.slice(1)}
                    </span>
                  </div>
                  <div className="flex-none text-right">
                    <p className={cn("text-xl font-bold", complianceBarColor(policy.compliancePct).replace("bg-", "text-"))}>
                      {policy.compliancePct}%
                    </p>
                    <p className="text-xs text-fg-muted">compliant</p>
                  </div>
                </div>

                {/* Compliance bar */}
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden mb-3">
                  <div
                    className={cn("h-full rounded-full", complianceBarColor(policy.compliancePct))}
                    style={{ width: policy.compliancePct + "%" }}
                  />
                </div>

                {/* Description */}
                <p className="text-sm text-fg-secondary leading-relaxed mb-3">{policy.description}</p>

                {/* Meta row */}
                <div className="flex items-center gap-5 text-xs text-fg-muted">
                  <span>
                    <span className={cn("font-semibold", policy.violationCount > 0 ? "text-rose-400" : "text-fg-primary")}>
                      {policy.violationCount}
                    </span>{" "}
                    violation{policy.violationCount !== 1 ? "s" : ""}
                  </span>
                  <span>
                    <span className="font-semibold text-fg-primary">{policy.affectedResources}</span> resource{policy.affectedResources !== 1 ? "s" : ""} affected
                  </span>
                  <span>Checked {policy.lastChecked}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "recommendations", label: "Recommendations" },
  { id: "resources", label: "Resources" },
  { id: "savings", label: "Savings Tracker" },
  { id: "policies", label: "Policies" },
]

export default function CloudCostOptimizer() {
  const [activeTab, setActiveTab] = useState<TabId>("recommendations")

  const totalMonthlySpend = RESOURCES.reduce((sum, r) => sum + r.costPerMonth, 0)
  const totalPotentialSavings = RECOMMENDATIONS.reduce((sum, r) => sum + r.estimatedSavings, 0)
  const implementedSavings = MONTHLY_SAVINGS[MONTHLY_SAVINGS.length - 1].cumulative
  const overProvisionedCount = RESOURCES.filter((r) => r.overProvisioned).length

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary">
      {/* Page header */}
      <div className="border-b border-tok-border bg-surface-0 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-fg-primary">Cloud Cost Optimizer</h1>
              <p className="text-sm text-fg-secondary mt-1">Identify, track, and implement cloud infrastructure savings across all AWS accounts</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-muted bg-surface-1 border border-tok-border rounded-lg px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Live — last refreshed 3 min ago
            </div>
          </div>

          {/* Global summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
              <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Monthly Spend</p>
              <p className="text-xl font-bold text-fg-primary">{fmtDollars(totalMonthlySpend)}</p>
            </div>
            <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
              <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Savings Potential</p>
              <p className="text-xl font-bold text-indigo-400">{fmtDollars(totalPotentialSavings)}<span className="text-sm font-normal text-fg-muted">/mo</span></p>
            </div>
            <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
              <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Savings Implemented</p>
              <p className="text-xl font-bold text-emerald-400">{fmtDollars(implementedSavings)}<span className="text-sm font-normal text-fg-muted">/mo</span></p>
            </div>
            <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
              <p className="text-xs text-fg-muted uppercase tracking-wider mb-1">Over-provisioned</p>
              <p className="text-xl font-bold text-amber-400">{overProvisionedCount} <span className="text-sm font-normal text-fg-muted">resources</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-tok-border bg-surface-0 px-3 sm:px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-5 py-3.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-fg-secondary hover:text-fg-primary hover:border-tok-border"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === "recommendations" && (
          <RecommendationsTab recommendations={RECOMMENDATIONS} />
        )}
        {activeTab === "resources" && (
          <ResourcesTab resources={RESOURCES} />
        )}
        {activeTab === "savings" && (
          <SavingsTrackerTab monthly={MONTHLY_SAVINGS} categories={CATEGORY_SAVINGS} />
        )}
        {activeTab === "policies" && (
          <PoliciesTab policies={POLICIES} />
        )}
      </div>
    </div>
  )
}
