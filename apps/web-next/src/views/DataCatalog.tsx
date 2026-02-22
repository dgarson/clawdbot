import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "browse" | "domains" | "glossary" | "quality"
type AccessLevel = "public" | "restricted" | "sensitive"
type DatasetType = "table" | "view" | "file" | "api"
type Domain = "finance" | "marketing" | "product" | "engineering" | "operations" | "analytics"

interface SchemaField {
  name: string
  type: string
  nullable: boolean
  description: string
}

interface LineageSummary {
  upstream: string[]
  downstream: string[]
  transformations: string[]
}

interface Dataset {
  id: string
  name: string
  type: DatasetType
  domain: Domain
  owner: string
  ownerTeam: string
  description: string
  freshness: string
  freshnessStatus: "fresh" | "stale" | "critical"
  qualityScore: number
  accessLevel: AccessLevel
  rowCount: number
  sizeGB: number
  lastUpdated: string
  tags: string[]
  schema: SchemaField[]
  sampleData: Record<string, string>[]
  lineage: LineageSummary
  completeness: number
  accuracy: number
  uniqueness: number
}

interface DataDomain {
  id: Domain
  label: string
  description: string
  datasetCount: number
  qualityScore: number
  topContributors: string[]
  recentActivity: string[]
  color: string
}

interface GlossaryTerm {
  id: string
  term: string
  definition: string
  relatedDatasets: string[]
  owner: string
  category: string
  domain: Domain
  aliases: string[]
}

interface QualityPoint {
  date: string
  score: number
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const DATASETS: Dataset[] = [
  {
    id: "ds-001",
    name: "customer_transactions",
    type: "table",
    domain: "finance",
    owner: "Sarah Chen",
    ownerTeam: "Finance Analytics",
    description: "All customer financial transactions including purchases, refunds, and adjustments. Source of truth for revenue reporting.",
    freshness: "2 hours ago",
    freshnessStatus: "fresh",
    qualityScore: 97,
    accessLevel: "sensitive",
    rowCount: 48320000,
    sizeGB: 234.5,
    lastUpdated: "2026-02-22T03:14:00Z",
    tags: ["revenue", "transactions", "pii", "sot"],
    schema: [
      { name: "transaction_id", type: "UUID", nullable: false, description: "Unique transaction identifier" },
      { name: "customer_id", type: "VARCHAR(36)", nullable: false, description: "Customer foreign key" },
      { name: "amount", type: "DECIMAL(18,4)", nullable: false, description: "Transaction amount in USD" },
      { name: "currency", type: "CHAR(3)", nullable: false, description: "ISO 4217 currency code" },
      { name: "transaction_at", type: "TIMESTAMPTZ", nullable: false, description: "Transaction timestamp UTC" },
      { name: "status", type: "VARCHAR(20)", nullable: false, description: "pending | completed | refunded | failed" },
      { name: "merchant_id", type: "VARCHAR(36)", nullable: true, description: "Merchant reference" },
    ],
    sampleData: [
      { transaction_id: "txn-a1b2c3", customer_id: "cust-001", amount: "149.99", currency: "USD", status: "completed" },
      { transaction_id: "txn-d4e5f6", customer_id: "cust-042", amount: "29.00", currency: "USD", status: "refunded" },
      { transaction_id: "txn-g7h8i9", customer_id: "cust-117", amount: "599.00", currency: "EUR", status: "completed" },
    ],
    lineage: {
      upstream: ["raw_payment_events", "stripe_webhooks"],
      downstream: ["revenue_daily_agg", "customer_ltv", "finance_dashboard"],
      transformations: ["deduplication", "currency_normalization", "pii_masking"],
    },
    completeness: 99,
    accuracy: 97,
    uniqueness: 100,
  },
  {
    id: "ds-002",
    name: "marketing_campaign_performance",
    type: "view",
    domain: "marketing",
    owner: "Marcus Webb",
    ownerTeam: "Growth Marketing",
    description: "Aggregated campaign performance metrics across all channels including email, paid social, SEM, and display.",
    freshness: "6 hours ago",
    freshnessStatus: "fresh",
    qualityScore: 88,
    accessLevel: "restricted",
    rowCount: 125400,
    sizeGB: 1.2,
    lastUpdated: "2026-02-21T22:00:00Z",
    tags: ["campaigns", "marketing", "kpis"],
    schema: [
      { name: "campaign_id", type: "VARCHAR(50)", nullable: false, description: "Campaign identifier" },
      { name: "channel", type: "VARCHAR(30)", nullable: false, description: "Marketing channel" },
      { name: "impressions", type: "BIGINT", nullable: false, description: "Total impressions" },
      { name: "clicks", type: "INTEGER", nullable: false, description: "Total clicks" },
      { name: "conversions", type: "INTEGER", nullable: true, description: "Attributed conversions" },
      { name: "spend_usd", type: "DECIMAL(12,2)", nullable: false, description: "Total spend in USD" },
    ],
    sampleData: [
      { campaign_id: "camp-spring-2026", channel: "paid_social", impressions: "1450000", clicks: "32100", conversions: "890" },
      { campaign_id: "camp-retarget-q1", channel: "display", impressions: "890000", clicks: "7200", conversions: "210" },
    ],
    lineage: {
      upstream: ["ad_platform_raw", "google_ads_export", "meta_ads_export"],
      downstream: ["marketing_roi_report", "attribution_model"],
      transformations: ["channel_normalization", "deduplication"],
    },
    completeness: 92,
    accuracy: 88,
    uniqueness: 98,
  },
  {
    id: "ds-003",
    name: "product_feature_usage",
    type: "table",
    domain: "product",
    owner: "Priya Nair",
    ownerTeam: "Product Intelligence",
    description: "Feature-level usage events tracked from frontend instrumentation. Powers product analytics and roadmap prioritization.",
    freshness: "15 min ago",
    freshnessStatus: "fresh",
    qualityScore: 91,
    accessLevel: "restricted",
    rowCount: 920000000,
    sizeGB: 1820.3,
    lastUpdated: "2026-02-22T05:15:00Z",
    tags: ["events", "product", "usage", "instrumentation"],
    schema: [
      { name: "event_id", type: "UUID", nullable: false, description: "Unique event identifier" },
      { name: "user_id", type: "VARCHAR(36)", nullable: false, description: "User identifier" },
      { name: "feature_key", type: "VARCHAR(100)", nullable: false, description: "Feature identifier slug" },
      { name: "action", type: "VARCHAR(50)", nullable: false, description: "User action type" },
      { name: "properties", type: "JSONB", nullable: true, description: "Event properties payload" },
      { name: "occurred_at", type: "TIMESTAMPTZ", nullable: false, description: "Event timestamp" },
      { name: "session_id", type: "VARCHAR(36)", nullable: true, description: "Session reference" },
    ],
    sampleData: [
      { event_id: "evt-001", user_id: "usr-554", feature_key: "dashboard.export", action: "click", occurred_at: "2026-02-22T04:11:00Z" },
      { event_id: "evt-002", user_id: "usr-229", feature_key: "reports.schedule", action: "submit", occurred_at: "2026-02-22T04:12:00Z" },
    ],
    lineage: {
      upstream: ["segment_events_raw", "mobile_sdk_events"],
      downstream: ["feature_adoption_report", "user_journey_funnel", "retention_analysis"],
      transformations: ["session_stitching", "bot_filtering", "schema_validation"],
    },
    completeness: 95,
    accuracy: 91,
    uniqueness: 99,
  },
  {
    id: "ds-004",
    name: "infrastructure_cost_daily",
    type: "table",
    domain: "engineering",
    owner: "Alex Torres",
    ownerTeam: "Platform Engineering",
    description: "Daily cloud infrastructure cost breakdowns by service, region, team, and resource type from AWS Cost Explorer.",
    freshness: "1 day ago",
    freshnessStatus: "fresh",
    qualityScore: 94,
    accessLevel: "restricted",
    rowCount: 2840000,
    sizeGB: 8.7,
    lastUpdated: "2026-02-21T08:00:00Z",
    tags: ["infra", "cost", "aws", "finops"],
    schema: [
      { name: "date", type: "DATE", nullable: false, description: "Cost date" },
      { name: "service", type: "VARCHAR(100)", nullable: false, description: "AWS service name" },
      { name: "region", type: "VARCHAR(20)", nullable: false, description: "AWS region" },
      { name: "team_tag", type: "VARCHAR(50)", nullable: true, description: "Team cost allocation tag" },
      { name: "cost_usd", type: "DECIMAL(14,4)", nullable: false, description: "Daily cost in USD" },
      { name: "usage_amount", type: "DECIMAL(18,6)", nullable: false, description: "Usage quantity" },
      { name: "usage_unit", type: "VARCHAR(30)", nullable: false, description: "Usage measurement unit" },
    ],
    sampleData: [
      { date: "2026-02-21", service: "Amazon EC2", region: "us-east-1", team_tag: "platform", cost_usd: "12450.23" },
      { date: "2026-02-21", service: "Amazon RDS", region: "us-west-2", team_tag: "product", cost_usd: "3210.88" },
    ],
    lineage: {
      upstream: ["aws_cost_explorer_api", "cost_allocation_tags"],
      downstream: ["finops_dashboard", "team_budget_alerts", "quarterly_cost_report"],
      transformations: ["tag_enrichment", "currency_normalization"],
    },
    completeness: 96,
    accuracy: 94,
    uniqueness: 100,
  },
  {
    id: "ds-005",
    name: "customer_profiles",
    type: "table",
    domain: "marketing",
    owner: "Lena Kovacs",
    ownerTeam: "Customer Data Platform",
    description: "Unified customer identity profiles with demographic, behavioral, and preference signals. Golden record from identity resolution.",
    freshness: "4 hours ago",
    freshnessStatus: "fresh",
    qualityScore: 82,
    accessLevel: "sensitive",
    rowCount: 4200000,
    sizeGB: 45.1,
    lastUpdated: "2026-02-22T01:30:00Z",
    tags: ["customers", "identity", "pii", "cdp"],
    schema: [
      { name: "profile_id", type: "UUID", nullable: false, description: "Golden record ID" },
      { name: "email_hash", type: "VARCHAR(64)", nullable: true, description: "SHA-256 hashed email" },
      { name: "first_name", type: "VARCHAR(100)", nullable: true, description: "First name" },
      { name: "last_name", type: "VARCHAR(100)", nullable: true, description: "Last name" },
      { name: "country_code", type: "CHAR(2)", nullable: true, description: "ISO 3166-1 alpha-2" },
      { name: "segment", type: "VARCHAR(50)", nullable: true, description: "Customer segment label" },
      { name: "lifetime_value_usd", type: "DECIMAL(14,2)", nullable: true, description: "Predicted LTV" },
    ],
    sampleData: [
      { profile_id: "prof-a1b2", email_hash: "3d4a…f9e1", country_code: "US", segment: "high-value", lifetime_value_usd: "4820.00" },
      { profile_id: "prof-c3d4", email_hash: "7b8c…e2f3", country_code: "GB", segment: "at-risk", lifetime_value_usd: "320.50" },
    ],
    lineage: {
      upstream: ["crm_contacts", "ecommerce_accounts", "support_tickets"],
      downstream: ["personalization_engine", "email_segments", "churn_model"],
      transformations: ["identity_resolution", "pii_masking", "segment_scoring"],
    },
    completeness: 78,
    accuracy: 85,
    uniqueness: 97,
  },
  {
    id: "ds-006",
    name: "revenue_monthly_agg",
    type: "view",
    domain: "finance",
    owner: "Sarah Chen",
    ownerTeam: "Finance Analytics",
    description: "Monthly revenue aggregations by product line, geography, and customer segment. Used for board reporting.",
    freshness: "2 days ago",
    freshnessStatus: "stale",
    qualityScore: 96,
    accessLevel: "sensitive",
    rowCount: 18600,
    sizeGB: 0.1,
    lastUpdated: "2026-02-20T06:00:00Z",
    tags: ["revenue", "monthly", "board-reporting", "finance"],
    schema: [
      { name: "month", type: "DATE", nullable: false, description: "First day of month" },
      { name: "product_line", type: "VARCHAR(50)", nullable: false, description: "Product line grouping" },
      { name: "region", type: "VARCHAR(30)", nullable: false, description: "Geographic region" },
      { name: "customer_segment", type: "VARCHAR(50)", nullable: false, description: "Customer segment" },
      { name: "mrr_usd", type: "DECIMAL(16,2)", nullable: false, description: "Monthly recurring revenue" },
      { name: "new_mrr_usd", type: "DECIMAL(16,2)", nullable: true, description: "New MRR from new customers" },
    ],
    sampleData: [
      { month: "2026-02-01", product_line: "Enterprise", region: "North America", mrr_usd: "4250000.00" },
      { month: "2026-02-01", product_line: "SMB", region: "EMEA", mrr_usd: "890000.00" },
    ],
    lineage: {
      upstream: ["customer_transactions", "subscription_events"],
      downstream: ["board_dashboard", "investor_reporting"],
      transformations: ["mrr_calculation", "revenue_recognition"],
    },
    completeness: 100,
    accuracy: 96,
    uniqueness: 100,
  },
  {
    id: "ds-007",
    name: "model_predictions_churn",
    type: "table",
    domain: "analytics",
    owner: "Dmitri Volkov",
    ownerTeam: "Data Science",
    description: "Churn propensity predictions from the v3 ML model. Refreshed weekly with 30/60/90 day probability scores.",
    freshness: "3 days ago",
    freshnessStatus: "stale",
    qualityScore: 78,
    accessLevel: "restricted",
    rowCount: 4100000,
    sizeGB: 12.3,
    lastUpdated: "2026-02-19T12:00:00Z",
    tags: ["ml", "churn", "predictions", "data-science"],
    schema: [
      { name: "customer_id", type: "VARCHAR(36)", nullable: false, description: "Customer reference" },
      { name: "score_30d", type: "FLOAT", nullable: false, description: "30-day churn probability 0-1" },
      { name: "score_60d", type: "FLOAT", nullable: false, description: "60-day churn probability 0-1" },
      { name: "score_90d", type: "FLOAT", nullable: false, description: "90-day churn probability 0-1" },
      { name: "model_version", type: "VARCHAR(10)", nullable: false, description: "Model version tag" },
      { name: "predicted_at", type: "TIMESTAMPTZ", nullable: false, description: "Prediction generation time" },
    ],
    sampleData: [
      { customer_id: "cust-001", score_30d: "0.12", score_60d: "0.23", score_90d: "0.38", model_version: "v3.2" },
      { customer_id: "cust-042", score_30d: "0.71", score_60d: "0.84", score_90d: "0.91", model_version: "v3.2" },
    ],
    lineage: {
      upstream: ["customer_profiles", "product_feature_usage", "customer_transactions"],
      downstream: ["churn_prevention_campaigns", "csm_alerts"],
      transformations: ["feature_engineering", "model_inference", "score_calibration"],
    },
    completeness: 88,
    accuracy: 78,
    uniqueness: 100,
  },
  {
    id: "ds-008",
    name: "support_tickets",
    type: "table",
    domain: "operations",
    owner: "Nina Patel",
    ownerTeam: "Customer Success Ops",
    description: "All customer support tickets from Zendesk and Intercom. Includes resolution time, CSAT, and category labels.",
    freshness: "30 min ago",
    freshnessStatus: "fresh",
    qualityScore: 85,
    accessLevel: "restricted",
    rowCount: 3400000,
    sizeGB: 18.9,
    lastUpdated: "2026-02-22T05:00:00Z",
    tags: ["support", "tickets", "csat", "operations"],
    schema: [
      { name: "ticket_id", type: "VARCHAR(50)", nullable: false, description: "Ticket identifier" },
      { name: "customer_id", type: "VARCHAR(36)", nullable: true, description: "Customer reference" },
      { name: "category", type: "VARCHAR(50)", nullable: true, description: "Ticket category" },
      { name: "priority", type: "VARCHAR(20)", nullable: false, description: "low | normal | high | urgent" },
      { name: "status", type: "VARCHAR(20)", nullable: false, description: "open | pending | solved | closed" },
      { name: "resolution_time_h", type: "FLOAT", nullable: true, description: "Hours to resolution" },
      { name: "csat_score", type: "SMALLINT", nullable: true, description: "CSAT 1-5" },
    ],
    sampleData: [
      { ticket_id: "TKT-88201", category: "billing", priority: "high", status: "solved", resolution_time_h: "2.4", csat_score: "5" },
      { ticket_id: "TKT-88202", category: "technical", priority: "urgent", status: "open", resolution_time_h: "", csat_score: "" },
    ],
    lineage: {
      upstream: ["zendesk_export", "intercom_conversations"],
      downstream: ["support_dashboard", "customer_health_score", "product_feedback_topics"],
      transformations: ["source_merge", "category_classification", "pii_redaction"],
    },
    completeness: 82,
    accuracy: 87,
    uniqueness: 99,
  },
  {
    id: "ds-009",
    name: "inventory_snapshots",
    type: "table",
    domain: "operations",
    owner: "James Okafor",
    ownerTeam: "Supply Chain Analytics",
    description: "Daily inventory snapshots by SKU, warehouse, and location. Feeds demand forecasting and replenishment workflows.",
    freshness: "8 hours ago",
    freshnessStatus: "fresh",
    qualityScore: 90,
    accessLevel: "public",
    rowCount: 8700000,
    sizeGB: 22.4,
    lastUpdated: "2026-02-22T00:00:00Z",
    tags: ["inventory", "supply-chain", "sku"],
    schema: [
      { name: "snapshot_date", type: "DATE", nullable: false, description: "Snapshot date" },
      { name: "sku_id", type: "VARCHAR(50)", nullable: false, description: "Product SKU" },
      { name: "warehouse_id", type: "VARCHAR(20)", nullable: false, description: "Warehouse identifier" },
      { name: "quantity_on_hand", type: "INTEGER", nullable: false, description: "Units in stock" },
      { name: "quantity_reserved", type: "INTEGER", nullable: false, description: "Units reserved for orders" },
      { name: "reorder_point", type: "INTEGER", nullable: true, description: "Reorder trigger quantity" },
    ],
    sampleData: [
      { snapshot_date: "2026-02-22", sku_id: "SKU-A1001", warehouse_id: "WH-SEA", quantity_on_hand: "4200", quantity_reserved: "380" },
      { snapshot_date: "2026-02-22", sku_id: "SKU-B2042", warehouse_id: "WH-CHI", quantity_on_hand: "120", quantity_reserved: "95" },
    ],
    lineage: {
      upstream: ["erp_inventory_raw", "warehouse_management_system"],
      downstream: ["demand_forecast", "replenishment_triggers", "ops_dashboard"],
      transformations: ["snapshot_materialization", "location_merge"],
    },
    completeness: 93,
    accuracy: 90,
    uniqueness: 100,
  },
  {
    id: "ds-010",
    name: "ab_experiment_results",
    type: "table",
    domain: "product",
    owner: "Priya Nair",
    ownerTeam: "Product Intelligence",
    description: "A/B test experiment assignments and outcome metrics. Includes statistical significance calculations.",
    freshness: "1 hour ago",
    freshnessStatus: "fresh",
    qualityScore: 93,
    accessLevel: "restricted",
    rowCount: 22000000,
    sizeGB: 67.8,
    lastUpdated: "2026-02-22T04:00:00Z",
    tags: ["experimentation", "ab-test", "statistics", "product"],
    schema: [
      { name: "experiment_id", type: "VARCHAR(50)", nullable: false, description: "Experiment identifier" },
      { name: "user_id", type: "VARCHAR(36)", nullable: false, description: "User reference" },
      { name: "variant", type: "VARCHAR(20)", nullable: false, description: "control | treatment_a | treatment_b" },
      { name: "assigned_at", type: "TIMESTAMPTZ", nullable: false, description: "Assignment timestamp" },
      { name: "converted", type: "BOOLEAN", nullable: false, description: "Primary metric conversion" },
      { name: "revenue_impact_usd", type: "DECIMAL(10,4)", nullable: true, description: "Revenue delta attributed" },
    ],
    sampleData: [
      { experiment_id: "exp-checkout-v2", user_id: "usr-001", variant: "treatment_a", converted: "true", revenue_impact_usd: "12.50" },
      { experiment_id: "exp-checkout-v2", user_id: "usr-002", variant: "control", converted: "false", revenue_impact_usd: "0.00" },
    ],
    lineage: {
      upstream: ["assignment_service_logs", "product_feature_usage", "customer_transactions"],
      downstream: ["experiment_dashboard", "product_decision_log"],
      transformations: ["assignment_join", "metric_computation", "significance_test"],
    },
    completeness: 97,
    accuracy: 93,
    uniqueness: 99,
  },
  {
    id: "ds-011",
    name: "employee_headcount",
    type: "view",
    domain: "operations",
    owner: "Chloe Moreau",
    ownerTeam: "People Analytics",
    description: "Current and historical employee headcount by department, level, and location. Excludes contractors.",
    freshness: "5 hours ago",
    freshnessStatus: "fresh",
    qualityScore: 99,
    accessLevel: "sensitive",
    rowCount: 48200,
    sizeGB: 0.3,
    lastUpdated: "2026-02-22T00:30:00Z",
    tags: ["hr", "headcount", "people-ops", "sensitive"],
    schema: [
      { name: "employee_id", type: "VARCHAR(20)", nullable: false, description: "Employee identifier" },
      { name: "department", type: "VARCHAR(80)", nullable: false, description: "Department name" },
      { name: "level", type: "VARCHAR(20)", nullable: false, description: "Job level" },
      { name: "location", type: "VARCHAR(50)", nullable: false, description: "Office or remote location" },
      { name: "tenure_months", type: "INTEGER", nullable: false, description: "Months at company" },
      { name: "status", type: "VARCHAR(20)", nullable: false, description: "active | leave | terminated" },
    ],
    sampleData: [
      { employee_id: "EMP-0012", department: "Engineering", level: "L5", location: "San Francisco", status: "active" },
      { employee_id: "EMP-0043", department: "Marketing", level: "L3", location: "Remote - US", status: "active" },
    ],
    lineage: {
      upstream: ["workday_hris", "greenhouse_offers"],
      downstream: ["headcount_forecast", "capacity_planning", "diversity_report"],
      transformations: ["active_filter", "pii_masking"],
    },
    completeness: 100,
    accuracy: 99,
    uniqueness: 100,
  },
  {
    id: "ds-012",
    name: "web_analytics_sessions",
    type: "table",
    domain: "marketing",
    owner: "Marcus Webb",
    ownerTeam: "Growth Marketing",
    description: "Web session data from GA4 and Segment. Includes traffic source, device, page flow, and goal completions.",
    freshness: "3 hours ago",
    freshnessStatus: "fresh",
    qualityScore: 76,
    accessLevel: "public",
    rowCount: 380000000,
    sizeGB: 890.2,
    lastUpdated: "2026-02-22T02:00:00Z",
    tags: ["web", "sessions", "analytics", "ga4"],
    schema: [
      { name: "session_id", type: "VARCHAR(36)", nullable: false, description: "Session identifier" },
      { name: "user_pseudo_id", type: "VARCHAR(36)", nullable: false, description: "Anonymous user ID" },
      { name: "traffic_source", type: "VARCHAR(80)", nullable: true, description: "UTM source / medium" },
      { name: "device_type", type: "VARCHAR(20)", nullable: false, description: "desktop | mobile | tablet" },
      { name: "country_code", type: "CHAR(2)", nullable: true, description: "ISO country code" },
      { name: "page_views", type: "INTEGER", nullable: false, description: "Pages viewed in session" },
      { name: "session_duration_s", type: "INTEGER", nullable: true, description: "Session duration seconds" },
      { name: "goal_completed", type: "BOOLEAN", nullable: false, description: "Primary goal conversion" },
    ],
    sampleData: [
      { session_id: "sess-x1y2z3", traffic_source: "google / organic", device_type: "desktop", page_views: "4", goal_completed: "true" },
      { session_id: "sess-a4b5c6", traffic_source: "email / newsletter", device_type: "mobile", page_views: "2", goal_completed: "false" },
    ],
    lineage: {
      upstream: ["ga4_events_raw", "segment_page_events"],
      downstream: ["seo_dashboard", "conversion_funnel", "customer_acquisition_report"],
      transformations: ["session_stitching", "bot_filtering", "source_attribution"],
    },
    completeness: 71,
    accuracy: 79,
    uniqueness: 98,
  },
  {
    id: "ds-013",
    name: "api_usage_logs",
    type: "api",
    domain: "engineering",
    owner: "Alex Torres",
    ownerTeam: "Platform Engineering",
    description: "API gateway request/response logs with latency, error rates, and rate limit hits by endpoint and API key.",
    freshness: "5 min ago",
    freshnessStatus: "fresh",
    qualityScore: 95,
    accessLevel: "restricted",
    rowCount: 12000000000,
    sizeGB: 4200.0,
    lastUpdated: "2026-02-22T05:25:00Z",
    tags: ["api", "logs", "latency", "engineering"],
    schema: [
      { name: "request_id", type: "UUID", nullable: false, description: "Unique request ID" },
      { name: "endpoint", type: "VARCHAR(200)", nullable: false, description: "API endpoint path" },
      { name: "method", type: "VARCHAR(10)", nullable: false, description: "HTTP method" },
      { name: "status_code", type: "SMALLINT", nullable: false, description: "HTTP response status" },
      { name: "latency_ms", type: "INTEGER", nullable: false, description: "Response latency milliseconds" },
      { name: "api_key_id", type: "VARCHAR(36)", nullable: true, description: "API key reference" },
      { name: "requested_at", type: "TIMESTAMPTZ", nullable: false, description: "Request timestamp" },
    ],
    sampleData: [
      { request_id: "req-001", endpoint: "/v2/customers", method: "GET", status_code: "200", latency_ms: "42" },
      { request_id: "req-002", endpoint: "/v2/transactions", method: "POST", status_code: "422", latency_ms: "18" },
    ],
    lineage: {
      upstream: ["kong_gateway_logs", "cloudfront_access_logs"],
      downstream: ["api_health_dashboard", "rate_limit_alerts", "sla_report"],
      transformations: ["log_parsing", "endpoint_normalization", "key_anonymization"],
    },
    completeness: 99,
    accuracy: 95,
    uniqueness: 100,
  },
  {
    id: "ds-014",
    name: "financial_forecast_model",
    type: "file",
    domain: "finance",
    owner: "Rachel Kim",
    ownerTeam: "FP&A",
    description: "Annual financial forecast model outputs including P&L projections, headcount plan, and scenario analysis results.",
    freshness: "7 days ago",
    freshnessStatus: "critical",
    qualityScore: 72,
    accessLevel: "sensitive",
    rowCount: 94000,
    sizeGB: 0.8,
    lastUpdated: "2026-02-15T16:00:00Z",
    tags: ["forecast", "fpa", "sensitive", "annual-plan"],
    schema: [
      { name: "period", type: "VARCHAR(10)", nullable: false, description: "Fiscal period YYYY-QN" },
      { name: "scenario", type: "VARCHAR(20)", nullable: false, description: "base | bear | bull" },
      { name: "department", type: "VARCHAR(80)", nullable: false, description: "Department" },
      { name: "revenue_plan_usd", type: "DECIMAL(18,2)", nullable: true, description: "Planned revenue" },
      { name: "opex_plan_usd", type: "DECIMAL(18,2)", nullable: true, description: "Planned operating expenses" },
      { name: "headcount_plan", type: "INTEGER", nullable: true, description: "Planned headcount" },
    ],
    sampleData: [
      { period: "2026-Q2", scenario: "base", department: "Engineering", revenue_plan_usd: "", opex_plan_usd: "8400000.00", headcount_plan: "142" },
      { period: "2026-Q2", scenario: "bear", department: "Sales", revenue_plan_usd: "18200000.00", opex_plan_usd: "4100000.00", headcount_plan: "88" },
    ],
    lineage: {
      upstream: ["revenue_monthly_agg", "employee_headcount", "budget_actuals"],
      downstream: ["board_presentation", "investor_deck"],
      transformations: ["scenario_modeling", "consolidation"],
    },
    completeness: 68,
    accuracy: 75,
    uniqueness: 100,
  },
]

const DATA_DOMAINS: DataDomain[] = [
  {
    id: "finance",
    label: "Finance",
    description: "Revenue, transactions, forecasting, and financial reporting datasets owned by the Finance and FP&A teams.",
    datasetCount: 3,
    qualityScore: 88,
    topContributors: ["Sarah Chen", "Rachel Kim", "Tom Nguyen"],
    recentActivity: ["customer_transactions refreshed", "revenue_monthly_agg marked stale", "financial_forecast_model added"],
    color: "bg-emerald-500",
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Campaign performance, customer profiles, and web analytics data supporting growth and demand generation.",
    datasetCount: 3,
    qualityScore: 82,
    topContributors: ["Marcus Webb", "Lena Kovacs", "Aisha Johnson"],
    recentActivity: ["web_analytics_sessions schema updated", "customer_profiles quality alert resolved", "new tag: cdp"],
    color: "bg-pink-500",
  },
  {
    id: "product",
    label: "Product",
    description: "Feature usage events, A/B experiments, and product analytics powering roadmap and product decisions.",
    datasetCount: 2,
    qualityScore: 92,
    topContributors: ["Priya Nair", "Felix Grant", "Maya Osei"],
    recentActivity: ["ab_experiment_results updated", "product_feature_usage pipeline optimized"],
    color: "bg-violet-500",
  },
  {
    id: "engineering",
    label: "Engineering",
    description: "Infrastructure costs, API logs, and platform metrics maintained by Platform Engineering.",
    datasetCount: 2,
    qualityScore: 94,
    topContributors: ["Alex Torres", "Sam Rivera", "Chen Wei"],
    recentActivity: ["api_usage_logs partition added", "infrastructure_cost_daily coverage expanded"],
    color: "bg-sky-500",
  },
  {
    id: "operations",
    label: "Operations",
    description: "Support tickets, inventory, and employee data supporting operational analytics and planning.",
    datasetCount: 3,
    qualityScore: 91,
    topContributors: ["Nina Patel", "James Okafor", "Chloe Moreau"],
    recentActivity: ["support_tickets Intercom source added", "inventory_snapshots SLA improved"],
    color: "bg-amber-500",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "ML model outputs, predictions, and derived analytical datasets from the Data Science team.",
    datasetCount: 1,
    qualityScore: 78,
    topContributors: ["Dmitri Volkov", "Yuki Tanaka", "Ravi Sharma"],
    recentActivity: ["model_predictions_churn retrained to v3.2", "churn model accuracy audit completed"],
    color: "bg-orange-500",
  },
]

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: "gt-001",
    term: "Monthly Recurring Revenue (MRR)",
    definition: "The predictable revenue a business expects to receive every month from active subscriptions. Excludes one-time payments and professional services.",
    relatedDatasets: ["revenue_monthly_agg", "customer_transactions"],
    owner: "Sarah Chen",
    category: "Revenue",
    domain: "finance",
    aliases: ["MRR"],
  },
  {
    id: "gt-002",
    term: "Customer Lifetime Value (LTV)",
    definition: "The total revenue a business can expect from a single customer account over their entire relationship. Calculated as average purchase value × purchase frequency × customer lifespan.",
    relatedDatasets: ["customer_profiles", "customer_transactions", "revenue_monthly_agg"],
    owner: "Sarah Chen",
    category: "Revenue",
    domain: "finance",
    aliases: ["LTV", "CLV", "CLTV"],
  },
  {
    id: "gt-003",
    term: "Churn Rate",
    definition: "The percentage of customers who discontinue their subscription in a given time period. Calculated as customers lost / customers at start of period.",
    relatedDatasets: ["model_predictions_churn", "customer_profiles"],
    owner: "Dmitri Volkov",
    category: "Retention",
    domain: "analytics",
    aliases: ["attrition rate"],
  },
  {
    id: "gt-004",
    term: "Net Revenue Retention (NRR)",
    definition: "Measures revenue retained from existing customers including expansions, contractions, and churn over a period. NRR > 100% means expansion revenue exceeds churn.",
    relatedDatasets: ["revenue_monthly_agg", "customer_transactions"],
    owner: "Rachel Kim",
    category: "Revenue",
    domain: "finance",
    aliases: ["NRR", "NDR", "Net Dollar Retention"],
  },
  {
    id: "gt-005",
    term: "Daily Active Users (DAU)",
    definition: "The number of unique users who engage with a product on a given day. A key product health metric. Engagement threshold is at least one qualifying feature interaction.",
    relatedDatasets: ["product_feature_usage", "ab_experiment_results"],
    owner: "Priya Nair",
    category: "Engagement",
    domain: "product",
    aliases: ["DAU"],
  },
  {
    id: "gt-006",
    term: "Customer Acquisition Cost (CAC)",
    definition: "Total sales and marketing spend divided by the number of new customers acquired in a given period. Used to assess marketing efficiency and payback period.",
    relatedDatasets: ["marketing_campaign_performance", "customer_profiles"],
    owner: "Marcus Webb",
    category: "Acquisition",
    domain: "marketing",
    aliases: ["CAC"],
  },
  {
    id: "gt-007",
    term: "Session",
    definition: "A group of user interactions with a product that take place within a given time frame. A session ends after 30 minutes of inactivity or at midnight.",
    relatedDatasets: ["web_analytics_sessions", "product_feature_usage"],
    owner: "Marcus Webb",
    category: "Engagement",
    domain: "marketing",
    aliases: ["visit", "user session"],
  },
  {
    id: "gt-008",
    term: "Golden Record",
    definition: "The single, trusted version of a customer identity created by resolving and merging data from multiple source systems. The authoritative source for customer attributes.",
    relatedDatasets: ["customer_profiles"],
    owner: "Lena Kovacs",
    category: "Identity",
    domain: "marketing",
    aliases: ["master record", "unified profile"],
  },
  {
    id: "gt-009",
    term: "p95 Latency",
    definition: "The response time below which 95% of API requests fall. A key API reliability metric. Our SLO target is p95 < 200ms for synchronous endpoints.",
    relatedDatasets: ["api_usage_logs"],
    owner: "Alex Torres",
    category: "Reliability",
    domain: "engineering",
    aliases: ["95th percentile latency"],
  },
  {
    id: "gt-010",
    term: "Feature Adoption Rate",
    definition: "The percentage of active users who have used a given feature at least once within a 30-day window. Used to assess feature rollout success and prioritize improvements.",
    relatedDatasets: ["product_feature_usage", "ab_experiment_results"],
    owner: "Priya Nair",
    category: "Engagement",
    domain: "product",
    aliases: ["adoption rate", "feature uptake"],
  },
  {
    id: "gt-011",
    term: "CSAT Score",
    definition: "Customer Satisfaction Score measured on a 1-5 scale from post-resolution surveys. Aggregated at ticket, agent, and team levels. Target: 4.2+ average.",
    relatedDatasets: ["support_tickets"],
    owner: "Nina Patel",
    category: "Support",
    domain: "operations",
    aliases: ["customer satisfaction", "CSAT"],
  },
  {
    id: "gt-012",
    term: "Incremental MRR",
    definition: "New MRR added in a period from new customers only, excluding expansion from existing customers. Measures pure new business acquisition velocity.",
    relatedDatasets: ["revenue_monthly_agg", "customer_transactions"],
    owner: "Sarah Chen",
    category: "Revenue",
    domain: "finance",
    aliases: ["New MRR", "New Business MRR"],
  },
  {
    id: "gt-013",
    term: "Conversion Rate",
    definition: "The percentage of users completing a desired action (purchase, signup, goal) out of those who had the opportunity. Calculated per funnel step and experiment variant.",
    relatedDatasets: ["ab_experiment_results", "web_analytics_sessions", "marketing_campaign_performance"],
    owner: "Marcus Webb",
    category: "Acquisition",
    domain: "marketing",
    aliases: ["CVR", "conversion"],
  },
  {
    id: "gt-014",
    term: "Cloud Unit Economics",
    definition: "Infrastructure cost per unit of product value delivered (e.g., cost per active user, cost per API request). Used to track engineering efficiency as the business scales.",
    relatedDatasets: ["infrastructure_cost_daily", "api_usage_logs", "product_feature_usage"],
    owner: "Alex Torres",
    category: "Cost",
    domain: "engineering",
    aliases: ["unit cost", "infra unit economics"],
  },
  {
    id: "gt-015",
    term: "Propensity Score",
    definition: "A machine learning model output between 0 and 1 representing the probability of a customer taking a specific action (churn, upgrade, purchase) within a defined time window.",
    relatedDatasets: ["model_predictions_churn", "customer_profiles"],
    owner: "Dmitri Volkov",
    category: "ML Outputs",
    domain: "analytics",
    aliases: ["probability score", "model score"],
  },
]

const QUALITY_HISTORY: QualityPoint[] = [
  { date: "Feb 1", score: 83 },
  { date: "Feb 3", score: 85 },
  { date: "Feb 5", score: 84 },
  { date: "Feb 7", score: 87 },
  { date: "Feb 9", score: 86 },
  { date: "Feb 11", score: 88 },
  { date: "Feb 13", score: 87 },
  { date: "Feb 15", score: 85 },
  { date: "Feb 17", score: 89 },
  { date: "Feb 19", score: 88 },
  { date: "Feb 21", score: 91 },
  { date: "Feb 22", score: 90 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return n.toString()
}

function qualityColor(score: number): string {
  if (score >= 90) return "text-emerald-400"
  if (score >= 75) return "text-amber-400"
  return "text-red-400"
}

function qualityBg(score: number): string {
  if (score >= 90) return "bg-emerald-500"
  if (score >= 75) return "bg-amber-500"
  return "bg-red-500"
}

function heatmapColor(score: number): string {
  if (score >= 95) return "bg-emerald-600"
  if (score >= 85) return "bg-emerald-700"
  if (score >= 75) return "bg-amber-700"
  if (score >= 60) return "bg-orange-700"
  return "bg-red-800"
}

function freshnessColor(status: Dataset["freshnessStatus"]): string {
  if (status === "fresh") return "text-emerald-400"
  if (status === "stale") return "text-amber-400"
  return "text-red-400"
}

function freshnessDot(status: Dataset["freshnessStatus"]): string {
  if (status === "fresh") return "bg-emerald-400"
  if (status === "stale") return "bg-amber-400"
  return "bg-red-400"
}

function accessBadgeColor(level: AccessLevel): string {
  if (level === "public") return "bg-emerald-900 text-emerald-300 border-emerald-700"
  if (level === "restricted") return "bg-amber-900 text-amber-300 border-amber-700"
  return "bg-red-900 text-red-300 border-red-700"
}

function typeBadgeColor(type: DatasetType): string {
  if (type === "table") return "bg-indigo-900 text-indigo-300"
  if (type === "view") return "bg-violet-900 text-violet-300"
  if (type === "file") return "bg-zinc-700 text-zinc-300"
  return "bg-sky-900 text-sky-300"
}

function domainBadgeColor(domain: Domain): string {
  const map: Record<Domain, string> = {
    finance: "bg-emerald-900 text-emerald-300",
    marketing: "bg-pink-900 text-pink-300",
    product: "bg-violet-900 text-violet-300",
    engineering: "bg-sky-900 text-sky-300",
    operations: "bg-amber-900 text-amber-300",
    analytics: "bg-orange-900 text-orange-300",
  }
  return map[domain]
}

// ─── Dataset Detail Panel ─────────────────────────────────────────────────────

interface DatasetPanelProps {
  dataset: Dataset
  onClose: () => void
}

function DatasetPanel({ dataset, onClose }: DatasetPanelProps) {
  const [activeSection, setActiveSection] = useState<"schema" | "sample" | "lineage">("schema")

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn("text-xs px-2 py-0.5 rounded font-medium", typeBadgeColor(dataset.type))}>
                {dataset.type}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded font-medium", domainBadgeColor(dataset.domain))}>
                {dataset.domain}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded border", accessBadgeColor(dataset.accessLevel))}>
                {dataset.accessLevel}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-mono break-all">{dataset.name}</h2>
            <p className="text-sm text-zinc-400 mt-1">{dataset.description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 border-b border-zinc-800 flex-shrink-0">
          {[
            { label: "Rows", value: formatNumber(dataset.rowCount) },
            { label: "Size", value: dataset.sizeGB + " GB" },
            { label: "Quality", value: dataset.qualityScore + "%" },
            { label: "Owner", value: dataset.owner.split(" ")[0] },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3 border-r border-zinc-800 last:border-r-0">
              <div className="text-xs text-zinc-500 mb-0.5">{stat.label}</div>
              <div className="text-sm font-semibold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Freshness & tags */}
        <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-4 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", freshnessDot(dataset.freshnessStatus))} />
            <span className={cn("text-xs", freshnessColor(dataset.freshnessStatus))}>
              Updated {dataset.freshness}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {dataset.tags.map((tag) => (
              <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-zinc-800 flex-shrink-0">
          {(["schema", "sample", "lineage"] as Array<"schema" | "sample" | "lineage">).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={cn(
                "px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2",
                activeSection === s
                  ? "text-indigo-400 border-indigo-500"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              )}
            >
              {s === "sample" ? "Sample Data" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === "schema" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">{dataset.schema.length} fields</p>
              <div className="space-y-1">
                {dataset.schema.map((field) => (
                  <div
                    key={field.name}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 px-1.5 py-0.5 rounded">
                        {field.type}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-white">{field.name}</span>
                        {!field.nullable && (
                          <span className="text-xs text-rose-400">NOT NULL</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{field.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "sample" && (
            <div className="overflow-x-auto">
              <p className="text-xs text-zinc-500 mb-3">{dataset.sampleData.length} sample rows</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {Object.keys(dataset.sampleData[0] || {}).map((col) => (
                      <th
                        key={col}
                        className="text-left py-2 pr-4 text-zinc-400 font-medium font-mono whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.sampleData.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="py-2 pr-4 font-mono text-zinc-300 whitespace-nowrap">
                          {val || <span className="text-zinc-600">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === "lineage" && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Upstream Sources ({dataset.lineage.upstream.length})
                </h4>
                <div className="space-y-1.5">
                  {dataset.lineage.upstream.map((src) => (
                    <div key={src} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <span className="text-emerald-400 text-xs">▲</span>
                      <span className="text-sm font-mono text-zinc-200">{src}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Downstream Consumers ({dataset.lineage.downstream.length})
                </h4>
                <div className="space-y-1.5">
                  {dataset.lineage.downstream.map((dst) => (
                    <div key={dst} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <span className="text-indigo-400 text-xs">▼</span>
                      <span className="text-sm font-mono text-zinc-200">{dst}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Transformations ({dataset.lineage.transformations.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {dataset.lineage.transformations.map((t) => (
                    <span key={t} className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Browse Tab ───────────────────────────────────────────────────────────────

interface BrowseTabProps {
  domainFilter: Domain | null
  onClearDomainFilter: () => void
}

function BrowseTab({ domainFilter, onClearDomainFilter }: BrowseTabProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<DatasetType | "">("")
  const [accessFilter, setAccessFilter] = useState<AccessLevel | "">("")
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)

  const filtered = DATASETS.filter((ds) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      ds.name.toLowerCase().includes(q) ||
      ds.description.toLowerCase().includes(q) ||
      ds.owner.toLowerCase().includes(q) ||
      ds.tags.some((t) => t.toLowerCase().includes(q))
    const matchesDomain = !domainFilter || ds.domain === domainFilter
    const matchesType = !typeFilter || ds.type === typeFilter
    const matchesAccess = !accessFilter || ds.accessLevel === accessFilter
    return matchesSearch && matchesDomain && matchesType && matchesAccess
  })

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search datasets, owners, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DatasetType | "")}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All Types</option>
          <option value="table">Table</option>
          <option value="view">View</option>
          <option value="file">File</option>
          <option value="api">API</option>
        </select>
        <select
          value={accessFilter}
          onChange={(e) => setAccessFilter(e.target.value as AccessLevel | "")}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All Access</option>
          <option value="public">Public</option>
          <option value="restricted">Restricted</option>
          <option value="sensitive">Sensitive</option>
        </select>
        {domainFilter && (
          <div className="flex items-center gap-2 bg-indigo-950 border border-indigo-700 rounded-lg px-3 py-2 text-sm text-indigo-300">
            <span>Domain: {domainFilter}</span>
            <button
              onClick={onClearDomainFilter}
              className="text-indigo-500 hover:text-indigo-300 ml-1 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        <span className="text-sm text-zinc-500 ml-auto">{filtered.length} datasets</span>
      </div>

      {/* Dataset grid */}
      <div className="space-y-2">
        {filtered.map((ds) => (
          <button
            key={ds.id}
            onClick={() => setSelectedDataset(ds)}
            className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-indigo-600 hover:bg-zinc-900/80 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={cn("text-xs px-2 py-0.5 rounded font-medium", typeBadgeColor(ds.type))}>
                    {ds.type}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded font-medium", domainBadgeColor(ds.domain))}>
                    {ds.domain}
                  </span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded border", accessBadgeColor(ds.accessLevel))}>
                    {ds.accessLevel}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold font-mono text-white group-hover:text-indigo-300 transition-colors">
                    {ds.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", freshnessDot(ds.freshnessStatus))} />
                    <span className={cn("text-xs", freshnessColor(ds.freshnessStatus))}>
                      {ds.freshness}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-1">{ds.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-zinc-600">
                    <span className="text-zinc-400">{ds.owner}</span> · {ds.ownerTeam}
                  </span>
                  <span className="text-xs text-zinc-600">{formatNumber(ds.rowCount)} rows</span>
                  <span className="text-xs text-zinc-600">{ds.sizeGB} GB</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Quality</span>
                  <span className={cn("text-sm font-bold", qualityColor(ds.qualityScore))}>
                    {ds.qualityScore}%
                  </span>
                </div>
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", qualityBg(ds.qualityScore))}
                    style={{ width: ds.qualityScore + "%" }}
                  />
                </div>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <div className="text-4xl mb-3">⊘</div>
            <p className="text-sm">No datasets match your filters</p>
          </div>
        )}
      </div>

      {selectedDataset && (
        <DatasetPanel dataset={selectedDataset} onClose={() => setSelectedDataset(null)} />
      )}
    </div>
  )
}

// ─── Domains Tab ─────────────────────────────────────────────────────────────

interface DomainsTabProps {
  onSelectDomain: (domain: Domain) => void
}

function DomainsTab({ onSelectDomain }: DomainsTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {DATA_DOMAINS.map((domain) => (
        <button
          key={domain.id}
          onClick={() => onSelectDomain(domain.id)}
          className="text-left bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-indigo-600 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className={cn("w-3 h-3 rounded-full flex-shrink-0", domain.color)} />
              <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                {domain.label}
              </h3>
            </div>
            <div className="flex flex-col items-end">
              <span className={cn("text-lg font-bold leading-none", qualityColor(domain.qualityScore))}>
                {domain.qualityScore}%
              </span>
              <span className="text-xs text-zinc-600 mt-0.5">quality</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{domain.description}</p>

          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{domain.datasetCount}</div>
              <div className="text-xs text-zinc-600">datasets</div>
            </div>
            <div className="flex-1">
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", domain.color)}
                  style={{ width: domain.qualityScore + "%" }}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3 mb-3">
            <p className="text-xs text-zinc-600 mb-1.5 font-medium">Top Contributors</p>
            <div className="flex flex-wrap gap-1.5">
              {domain.topContributors.map((c) => (
                <span key={c} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-600 mb-1.5 font-medium">Recent Activity</p>
            <ul className="space-y-1">
              {domain.recentActivity.slice(0, 2).map((activity) => (
                <li key={activity} className="text-xs text-zinc-500 flex items-start gap-1.5">
                  <span className="text-indigo-500 mt-0.5 flex-shrink-0">·</span>
                  {activity}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800">
            <span className="text-xs text-indigo-500 group-hover:text-indigo-400 transition-colors">
              Browse {domain.datasetCount} datasets →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Glossary Tab ─────────────────────────────────────────────────────────────

function GlossaryTab() {
  const [search, setSearch] = useState("")
  const [domainFilter, setDomainFilter] = useState<Domain | "">("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null)

  const categories = Array.from(new Set(GLOSSARY_TERMS.map((t) => t.category))).sort()

  const filtered = GLOSSARY_TERMS.filter((term) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      term.term.toLowerCase().includes(q) ||
      term.definition.toLowerCase().includes(q) ||
      term.aliases.some((a) => a.toLowerCase().includes(q))
    const matchesDomain = !domainFilter || term.domain === domainFilter
    const matchesCategory = !categoryFilter || term.category === categoryFilter
    return matchesSearch && matchesDomain && matchesCategory
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            placeholder="Search terms, definitions, aliases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as Domain | "")}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All Domains</option>
          {DATA_DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-sm text-zinc-500 ml-auto">{filtered.length} terms</span>
      </div>

      {/* Terms list */}
      <div className="space-y-2">
        {filtered.map((term) => {
          const isExpanded = expandedTerm === term.id
          return (
            <div
              key={term.id}
              className={cn(
                "bg-zinc-900 border rounded-xl overflow-hidden transition-all",
                isExpanded ? "border-indigo-700" : "border-zinc-800"
              )}
            >
              <button
                className="w-full text-left p-4 hover:bg-zinc-800/40 transition-colors"
                onClick={() => setExpandedTerm(isExpanded ? null : term.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-white">{term.term}</h3>
                      {term.aliases.length > 0 && (
                        <div className="flex gap-1.5">
                          {term.aliases.slice(0, 2).map((alias) => (
                            <span key={alias} className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium", domainBadgeColor(term.domain))}>
                        {term.domain}
                      </span>
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {term.category}
                      </span>
                      <span className="text-xs text-zinc-600">{term.owner}</span>
                    </div>
                  </div>
                  <span className={cn(
                    "text-zinc-500 transition-transform flex-shrink-0 mt-1",
                    isExpanded ? "rotate-180" : ""
                  )}>
                    ▾
                  </span>
                </div>
                {!isExpanded && (
                  <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{term.definition}</p>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-zinc-800">
                  <p className="text-sm text-zinc-300 mt-4 leading-relaxed">{term.definition}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                        Related Datasets
                      </h4>
                      <div className="space-y-1">
                        {term.relatedDatasets.map((ds) => (
                          <span key={ds} className="block text-xs font-mono text-indigo-400 bg-indigo-950 border border-indigo-900 px-2 py-1 rounded">
                            {ds}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                        Aliases
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {term.aliases.map((alias) => (
                          <span key={alias} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                            {alias}
                          </span>
                        ))}
                        {term.aliases.length === 0 && (
                          <span className="text-xs text-zinc-600">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <div className="text-4xl mb-3">⊘</div>
            <p className="text-sm">No terms match your search</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Quality Tab ──────────────────────────────────────────────────────────────

function QualityTab() {
  const minScore = Math.min(...QUALITY_HISTORY.map((p) => p.score))
  const maxScore = Math.max(...QUALITY_HISTORY.map((p) => p.score))
  const chartMin = minScore - 5
  const chartMax = maxScore + 5
  const chartRange = chartMax - chartMin

  interface QualityDimension {
    key: "completeness" | "accuracy" | "uniqueness" | "freshnessStatus"
    label: string
  }
  const dimensions: QualityDimension[] = [
    { key: "completeness", label: "Completeness" },
    { key: "accuracy", label: "Accuracy" },
    { key: "uniqueness", label: "Uniqueness" },
    { key: "freshnessStatus", label: "Freshness" },
  ]

  const getFreshnessScore = (ds: Dataset): number => {
    if (ds.freshnessStatus === "fresh") return 95
    if (ds.freshnessStatus === "stale") return 60
    return 20
  }

  const avgOverall = Math.round(
    DATASETS.reduce((sum, ds) => sum + ds.qualityScore, 0) / DATASETS.length
  )

  const avgCompleteness = Math.round(
    DATASETS.reduce((sum, ds) => sum + ds.completeness, 0) / DATASETS.length
  )

  const avgAccuracy = Math.round(
    DATASETS.reduce((sum, ds) => sum + ds.accuracy, 0) / DATASETS.length
  )

  const avgUniqueness = Math.round(
    DATASETS.reduce((sum, ds) => sum + ds.uniqueness, 0) / DATASETS.length
  )

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Overall Quality", value: avgOverall + "%", sub: "catalog average" },
          { label: "Completeness", value: avgCompleteness + "%", sub: "avg across datasets" },
          { label: "Accuracy", value: avgAccuracy + "%", sub: "avg across datasets" },
          { label: "Uniqueness", value: avgUniqueness + "%", sub: "avg across datasets" },
        ].map((card) => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
            <p className={cn("text-2xl font-bold", qualityColor(parseInt(card.value)))}>
              {card.value}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Line chart: Quality over time */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Overall Quality Score — Last 30 Days</h3>
        <p className="text-xs text-zinc-500 mb-5">Weighted average quality score across all catalog datasets</p>

        <div className="flex gap-4">
          {/* Y axis labels */}
          <div className="flex flex-col justify-between text-right w-8 flex-shrink-0">
            {[chartMax, Math.round(chartMin + chartRange * 0.75), Math.round(chartMin + chartRange * 0.5), Math.round(chartMin + chartRange * 0.25), chartMin].map((val) => (
              <span key={val} className="text-xs text-zinc-600">{val}</span>
            ))}
          </div>

          {/* Chart area */}
          <div className="flex-1 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t border-zinc-800 w-full" />
              ))}
            </div>

            {/* Bars */}
            <div className="relative flex items-end gap-1 h-40">
              {QUALITY_HISTORY.map((point, i) => {
                const heightPct = ((point.score - chartMin) / chartRange) * 100
                const isLast = i === QUALITY_HISTORY.length - 1
                return (
                  <div key={point.date} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <div className="relative w-full flex items-end justify-center h-full">
                      <div
                        className={cn(
                          "w-full rounded-t transition-all",
                          isLast ? "bg-indigo-500" : "bg-indigo-800 group-hover:bg-indigo-600"
                        )}
                        style={{ height: heightPct + "%" }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                          {point.score}%
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X axis labels */}
            <div className="flex gap-1 mt-2">
              {QUALITY_HISTORY.map((point, i) => (
                <div key={i} className="flex-1 text-center">
                  {i % 3 === 0 && (
                    <span className="text-xs text-zinc-600">{point.date.replace("Feb ", "")}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quality heatmap */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Quality Dimensions Heatmap</h3>
        <p className="text-xs text-zinc-500 mb-5">Per-dataset scores across completeness, accuracy, freshness, and uniqueness dimensions</p>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          <span className="text-xs text-zinc-500">Score:</span>
          {[
            { label: "≥95%", color: "bg-emerald-600" },
            { label: "85–95%", color: "bg-emerald-700" },
            { label: "75–85%", color: "bg-amber-700" },
            { label: "60–75%", color: "bg-orange-700" },
            { label: "<60%", color: "bg-red-800" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded-sm flex-shrink-0", l.color)} />
              <span className="text-xs text-zinc-500">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 text-zinc-500 font-medium w-48">Dataset</th>
                {dimensions.map((d) => (
                  <th key={d.key} className="text-center py-2 px-2 text-zinc-500 font-medium min-w-24">
                    {d.label}
                  </th>
                ))}
                <th className="text-center py-2 px-2 text-zinc-500 font-medium min-w-20">Overall</th>
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((ds) => {
                const dimScores = [
                  ds.completeness,
                  ds.accuracy,
                  getFreshnessScore(ds),
                  ds.uniqueness,
                ]
                return (
                  <tr key={ds.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 pr-4">
                      <div className="font-mono text-zinc-300 truncate max-w-44">{ds.name}</div>
                      <div className={cn("text-xs mt-0.5", domainBadgeColor(ds.domain).split(" ")[1])}>
                        {ds.domain}
                      </div>
                    </td>
                    {dimScores.map((score, i) => (
                      <td key={i} className="py-2 px-2 text-center">
                        <div
                          className={cn(
                            "inline-flex items-center justify-center w-14 h-7 rounded text-white text-xs font-semibold",
                            heatmapColor(score)
                          )}
                        >
                          {score}%
                        </div>
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center">
                      <div
                        className={cn(
                          "inline-flex items-center justify-center w-14 h-7 rounded text-white text-xs font-bold",
                          heatmapColor(ds.qualityScore)
                        )}
                      >
                        {ds.qualityScore}%
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Domain quality breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Quality by Domain</h3>
        <p className="text-xs text-zinc-500 mb-5">Average quality scores per data domain</p>
        <div className="space-y-3">
          {DATA_DOMAINS.sort((a, b) => b.qualityScore - a.qualityScore).map((domain) => (
            <div key={domain.id} className="flex items-center gap-4">
              <div className="w-28 text-sm text-zinc-300 flex-shrink-0">{domain.label}</div>
              <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", domain.color)}
                  style={{ width: domain.qualityScore + "%" }}
                />
              </div>
              <span className={cn("w-12 text-right text-sm font-semibold flex-shrink-0", qualityColor(domain.qualityScore))}>
                {domain.qualityScore}%
              </span>
              <span className="text-xs text-zinc-600 w-20 flex-shrink-0">
                {domain.datasetCount} datasets
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataCatalog() {
  const [activeTab, setActiveTab] = useState<TabId>("browse")
  const [browseDomainFilter, setBrowseDomainFilter] = useState<Domain | null>(null)

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "browse", label: "Browse", count: DATASETS.length },
    { id: "domains", label: "Domains", count: DATA_DOMAINS.length },
    { id: "glossary", label: "Glossary", count: GLOSSARY_TERMS.length },
    { id: "quality", label: "Quality" },
  ]

  function handleSelectDomain(domain: Domain) {
    setBrowseDomainFilter(domain)
    setActiveTab("browse")
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Data Catalog</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Discover, understand, and access your organization's data assets
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{DATASETS.length}</div>
                <div className="text-xs text-zinc-500">datasets</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">{DATA_DOMAINS.length}</div>
                <div className="text-xs text-zinc-500">domains</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-400">
                  {Math.round(DATASETS.reduce((s, d) => s + d.qualityScore, 0) / DATASETS.length)}%
                </div>
                <div className="text-xs text-zinc-500">avg quality</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "text-indigo-400 border-indigo-500"
                  : "text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-700"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-normal",
                    activeTab === tab.id
                      ? "bg-indigo-950 text-indigo-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "browse" && (
          <BrowseTab
            domainFilter={browseDomainFilter}
            onClearDomainFilter={() => setBrowseDomainFilter(null)}
          />
        )}
        {activeTab === "domains" && (
          <DomainsTab onSelectDomain={handleSelectDomain} />
        )}
        {activeTab === "glossary" && <GlossaryTab />}
        {activeTab === "quality" && <QualityTab />}
      </div>
    </div>
  )
}
