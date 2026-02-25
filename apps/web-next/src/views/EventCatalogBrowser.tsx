import React, { useState } from "react"
import { cn } from "../lib/utils"

type EventStatus = "active" | "deprecated" | "draft"
type SchemaFormat = "json-schema" | "avro" | "protobuf"

interface EventField {
  name: string
  type: string
  required: boolean
  description: string
}

interface EventSchema {
  version: string
  format: SchemaFormat
  fields: EventField[]
  addedAt: string
}

interface EventTopic {
  id: string
  name: string
  domain: string
  description: string
  status: EventStatus
  owners: string[]
  producers: string[]
  consumers: string[]
  partition: number
  retentionDays: number
  avgMessageSizeKb: number
  messagesPerDay: number
  schemas: EventSchema[]
  tags: string[]
  lastPublished?: string
}

const TOPICS: EventTopic[] = [
  {
    id: "evt-001",
    name: "user.registered",
    domain: "identity",
    description: "Emitted when a new user completes registration. Includes profile data and signup metadata.",
    status: "active",
    owners: ["platform-team"],
    producers: ["auth-service"],
    consumers: ["onboarding-service", "email-service", "crm-sync", "analytics-collector"],
    partition: 8,
    retentionDays: 30,
    avgMessageSizeKb: 2.1,
    messagesPerDay: 1240,
    lastPublished: "2026-02-22T11:45:00Z",
    tags: ["identity", "critical"],
    schemas: [
      {
        version: "v3",
        format: "json-schema",
        addedAt: "2025-11-01",
        fields: [
          { name: "userId", type: "string (uuid)", required: true, description: "Unique user identifier" },
          { name: "email", type: "string", required: true, description: "User email address" },
          { name: "displayName", type: "string", required: false, description: "Optional display name" },
          { name: "signupSource", type: "string (enum)", required: true, description: "organic|referral|campaign" },
          { name: "createdAt", type: "string (ISO8601)", required: true, description: "Registration timestamp" },
          { name: "metadata", type: "object", required: false, description: "Arbitrary signup context" },
        ],
      },
      {
        version: "v2",
        format: "json-schema",
        addedAt: "2024-06-15",
        fields: [
          { name: "userId", type: "string", required: true, description: "User identifier" },
          { name: "email", type: "string", required: true, description: "Email" },
          { name: "createdAt", type: "string", required: true, description: "Timestamp" },
        ],
      },
    ],
  },
  {
    id: "evt-002",
    name: "order.placed",
    domain: "commerce",
    description: "Fired when a customer successfully places an order. Includes line items, pricing, and payment confirmation.",
    status: "active",
    owners: ["commerce-team"],
    producers: ["checkout-service"],
    consumers: ["fulfillment-service", "inventory-service", "billing-service", "analytics-collector", "fraud-detector"],
    partition: 16,
    retentionDays: 90,
    avgMessageSizeKb: 8.4,
    messagesPerDay: 3820,
    lastPublished: "2026-02-22T12:01:00Z",
    tags: ["commerce", "revenue", "critical"],
    schemas: [
      {
        version: "v4",
        format: "json-schema",
        addedAt: "2025-09-20",
        fields: [
          { name: "orderId", type: "string (uuid)", required: true, description: "Order identifier" },
          { name: "customerId", type: "string", required: true, description: "Customer reference" },
          { name: "lineItems", type: "array<LineItem>", required: true, description: "Products ordered" },
          { name: "totalAmount", type: "number", required: true, description: "Total in cents" },
          { name: "currency", type: "string (ISO 4217)", required: true, description: "Currency code" },
          { name: "shippingAddress", type: "object", required: true, description: "Delivery address" },
          { name: "paymentMethodId", type: "string", required: true, description: "Payment method reference" },
          { name: "placedAt", type: "string (ISO8601)", required: true, description: "Order timestamp" },
        ],
      },
    ],
  },
  {
    id: "evt-003",
    name: "payment.processed",
    domain: "billing",
    description: "Emitted after payment gateway confirms charge. Includes transaction ID and amounts.",
    status: "active",
    owners: ["billing-team"],
    producers: ["billing-service"],
    consumers: ["order-service", "analytics-collector", "finance-sync"],
    partition: 8,
    retentionDays: 365,
    avgMessageSizeKb: 3.2,
    messagesPerDay: 3750,
    lastPublished: "2026-02-22T12:03:00Z",
    tags: ["billing", "revenue", "pci"],
    schemas: [
      {
        version: "v2",
        format: "avro",
        addedAt: "2025-01-10",
        fields: [
          { name: "transactionId", type: "string", required: true, description: "Gateway transaction ID" },
          { name: "orderId", type: "string", required: true, description: "Associated order" },
          { name: "amount", type: "long", required: true, description: "Charged amount in cents" },
          { name: "currency", type: "string", required: true, description: "Currency" },
          { name: "gateway", type: "string", required: true, description: "stripe|paypal|braintree" },
          { name: "status", type: "string", required: true, description: "success|failed|pending" },
          { name: "processedAt", type: "string", required: true, description: "Processing timestamp" },
        ],
      },
    ],
  },
  {
    id: "evt-004",
    name: "model.inference.completed",
    domain: "ai-platform",
    description: "Published after each ML model inference completes. Used for usage tracking and latency monitoring.",
    status: "active",
    owners: ["ml-team"],
    producers: ["inference-gateway", "batch-inference-worker"],
    consumers: ["usage-tracker", "billing-service", "model-monitor"],
    partition: 32,
    retentionDays: 14,
    avgMessageSizeKb: 1.8,
    messagesPerDay: 48200,
    lastPublished: "2026-02-22T12:05:00Z",
    tags: ["ml", "ai", "usage"],
    schemas: [
      {
        version: "v1",
        format: "protobuf",
        addedAt: "2025-07-01",
        fields: [
          { name: "requestId", type: "string", required: true, description: "Inference request ID" },
          { name: "modelId", type: "string", required: true, description: "Model identifier" },
          { name: "modelVersion", type: "string", required: true, description: "Version tag" },
          { name: "inputTokens", type: "int32", required: true, description: "Input token count" },
          { name: "outputTokens", type: "int32", required: true, description: "Output token count" },
          { name: "latencyMs", type: "int64", required: true, description: "End-to-end latency" },
          { name: "success", type: "bool", required: true, description: "Whether inference succeeded" },
        ],
      },
    ],
  },
  {
    id: "evt-005",
    name: "alert.triggered",
    domain: "observability",
    description: "Fired by the alerting engine when a metric threshold is crossed.",
    status: "active",
    owners: ["platform-team"],
    producers: ["alert-manager"],
    consumers: ["notification-service", "incident-manager", "pagerduty-bridge"],
    partition: 4,
    retentionDays: 60,
    avgMessageSizeKb: 2.8,
    messagesPerDay: 140,
    lastPublished: "2026-02-22T10:22:00Z",
    tags: ["observability", "critical"],
    schemas: [
      {
        version: "v2",
        format: "json-schema",
        addedAt: "2025-03-15",
        fields: [
          { name: "alertId", type: "string", required: true, description: "Unique alert ID" },
          { name: "ruleName", type: "string", required: true, description: "Alert rule that fired" },
          { name: "severity", type: "string (enum)", required: true, description: "critical|warning|info" },
          { name: "labels", type: "Record<string, string>", required: true, description: "Metric labels" },
          { name: "value", type: "number", required: true, description: "Current metric value" },
          { name: "threshold", type: "number", required: true, description: "Configured threshold" },
          { name: "firedAt", type: "string (ISO8601)", required: true, description: "When alert fired" },
        ],
      },
    ],
  },
  {
    id: "evt-006",
    name: "user.subscription.changed",
    domain: "billing",
    description: "Emitted on any plan change: upgrade, downgrade, cancellation, or reactivation.",
    status: "active",
    owners: ["billing-team"],
    producers: ["subscription-service"],
    consumers: ["email-service", "analytics-collector", "feature-flag-service", "crm-sync"],
    partition: 4,
    retentionDays: 365,
    avgMessageSizeKb: 3.0,
    messagesPerDay: 280,
    lastPublished: "2026-02-22T09:30:00Z",
    tags: ["billing", "users"],
    schemas: [
      {
        version: "v3",
        format: "json-schema",
        addedAt: "2025-10-01",
        fields: [
          { name: "userId", type: "string", required: true, description: "User reference" },
          { name: "previousPlan", type: "string", required: true, description: "Old plan ID" },
          { name: "newPlan", type: "string", required: true, description: "New plan ID" },
          { name: "changeType", type: "string (enum)", required: true, description: "upgrade|downgrade|cancel|reactivate" },
          { name: "effectiveAt", type: "string", required: true, description: "When change takes effect" },
          { name: "billingCycleEnd", type: "string", required: false, description: "End of current cycle" },
        ],
      },
    ],
  },
  {
    id: "evt-007",
    name: "content.published.v1",
    domain: "cms",
    description: "Published when content is published or updated on the CMS. Used by CDN invalidation and search indexing.",
    status: "deprecated",
    owners: ["content-team"],
    producers: ["cms-service"],
    consumers: ["cdn-invalidator", "search-indexer"],
    partition: 4,
    retentionDays: 7,
    avgMessageSizeKb: 12.0,
    messagesPerDay: 450,
    lastPublished: "2026-02-20T14:00:00Z",
    tags: ["cms", "content"],
    schemas: [
      {
        version: "v1",
        format: "json-schema",
        addedAt: "2023-01-01",
        fields: [
          { name: "contentId", type: "string", required: true, description: "Content item ID" },
          { name: "contentType", type: "string", required: true, description: "article|page|product" },
          { name: "slug", type: "string", required: true, description: "URL slug" },
          { name: "publishedAt", type: "string", required: true, description: "Publication timestamp" },
        ],
      },
    ],
  },
  {
    id: "evt-008",
    name: "search.query.executed",
    domain: "search",
    description: "Emitted on each search query. Powers analytics and search quality monitoring.",
    status: "draft",
    owners: ["search-team"],
    producers: ["search-api"],
    consumers: ["analytics-collector"],
    partition: 8,
    retentionDays: 7,
    avgMessageSizeKb: 0.9,
    messagesPerDay: 0,
    tags: ["search", "analytics"],
    schemas: [
      {
        version: "v1",
        format: "json-schema",
        addedAt: "2026-02-01",
        fields: [
          { name: "queryId", type: "string", required: true, description: "Query session ID" },
          { name: "query", type: "string", required: true, description: "Search terms (hashed PII)" },
          { name: "resultsCount", type: "number", required: true, description: "Number of results returned" },
          { name: "latencyMs", type: "number", required: true, description: "Search latency" },
          { name: "userId", type: "string", required: false, description: "Optional authenticated user" },
          { name: "searchedAt", type: "string", required: true, description: "Query timestamp" },
        ],
      },
    ],
  },
]

const statusColor: Record<EventStatus, string> = {
  active: "text-emerald-400 bg-emerald-400/10",
  deprecated: "text-amber-400 bg-amber-400/10",
  draft: "text-primary bg-primary/10",
}

const formatColor: Record<SchemaFormat, string> = {
  "json-schema": "text-blue-400",
  avro: "text-purple-400",
  protobuf: "text-orange-400",
}

const DOMAINS = [...new Set(TOPICS.map(t => t.domain))]

function fmtNum(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(1)}M`}
  if (n >= 1000) {return `${(n / 1000).toFixed(1)}K`}
  return n.toString()
}

function fmtTime(iso?: string): string {
  if (!iso) {return "—"}
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function EventCatalogBrowser() {
  const [tab, setTab] = useState<"catalog" | "schema" | "graph" | "stats">("catalog")
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedSchemaVersion, setSelectedSchemaVersion] = useState<string>("v3")
  const [domainFilter, setDomainFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const tabs = [
    { id: "catalog" as const, label: "Event Catalog", emoji: "📚" },
    { id: "schema" as const, label: "Schema Browser", emoji: "📐" },
    { id: "graph" as const, label: "Dependency Graph", emoji: "🕸" },
    { id: "stats" as const, label: "Stats", emoji: "📊" },
  ]

  const filtered = TOPICS.filter(t => {
    if (domainFilter !== "all" && t.domain !== domainFilter) {return false}
    if (statusFilter !== "all" && t.status !== statusFilter) {return false}
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) {return false}
    return true
  })

  const topic = selectedTopic ? TOPICS.find(t => t.id === selectedTopic) : null
  const totalMessages = TOPICS.filter(t => t.status === "active").reduce((s, t) => s + t.messagesPerDay, 0)
  const totalConsumers = new Set(TOPICS.flatMap(t => t.consumers)).size

  // Domain message volume for stats
  const domainStats = DOMAINS.map(d => ({
    domain: d,
    topics: TOPICS.filter(t => t.domain === d).length,
    messagesPerDay: TOPICS.filter(t => t.domain === d).reduce((s, t) => s + t.messagesPerDay, 0),
  })).toSorted((a, b) => b.messagesPerDay - a.messagesPerDay)
  const maxMsgs = domainStats[0]?.messagesPerDay ?? 1

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Event Catalog</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Browse and explore event-driven architecture schemas</p>
        </div>
        <button className="px-4 py-2 bg-primary hover:bg-primary rounded-md text-sm font-medium transition-colors">
          + Register Event
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Total Events</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{TOPICS.length}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{TOPICS.filter(t => t.status === "active").length} active</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Messages / Day</div>
          <div className="text-2xl font-bold text-primary">{fmtNum(totalMessages)}</div>
          <div className="text-xs text-[var(--color-text-muted)]">across active events</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Consumers</div>
          <div className="text-2xl font-bold text-emerald-400">{totalConsumers}</div>
          <div className="text-xs text-[var(--color-text-muted)]">unique services</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Domains</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{DOMAINS.length}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{TOPICS.filter(t => t.status === "deprecated").length} deprecated events</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              tab === t.id
                ? "border-primary text-[var(--color-text-primary)] bg-[var(--color-surface-1)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Catalog Tab */}
      {tab === "catalog" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] w-48"
            />
            <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Domains</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="draft">Draft</option>
            </select>
            <span className="text-sm text-[var(--color-text-secondary)] self-center">{filtered.length} events</span>
          </div>

          {/* Event list */}
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedTopic(selectedTopic === t.id ? null : t.id)}
                  className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-indigo-300 font-mono text-sm">{t.name}</code>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor[t.status])}>
                          {t.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded">{t.domain}</span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Msgs/day</div>
                        <div className="text-[var(--color-text-primary)] font-mono">{fmtNum(t.messagesPerDay)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Producers</div>
                        <div className="text-[var(--color-text-primary)]">{t.producers.length}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-[var(--color-text-muted)] mb-0.5">Consumers</div>
                        <div className="text-[var(--color-text-primary)]">{t.consumers.length}</div>
                      </div>
                      <span className="text-[var(--color-text-muted)]">{selectedTopic === t.id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {selectedTopic === t.id && (
                  <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)] space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Producers */}
                      <div>
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Producers</div>
                        <div className="space-y-1">
                          {t.producers.map(p => (
                            <div key={p} className="text-sm text-emerald-400 font-mono bg-emerald-400/5 px-2 py-1 rounded">
                              ↑ {p}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Consumers */}
                      <div>
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Consumers</div>
                        <div className="space-y-1">
                          {t.consumers.map(c => (
                            <div key={c} className="text-sm text-primary font-mono bg-primary/5 px-2 py-1 rounded">
                              ↓ {c}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Config */}
                      <div>
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Configuration</div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Partitions</span>
                            <span className="text-[var(--color-text-primary)]">{t.partition}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Retention</span>
                            <span className="text-[var(--color-text-primary)]">{t.retentionDays}d</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Avg Size</span>
                            <span className="text-[var(--color-text-primary)]">{t.avgMessageSizeKb} KB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Last Published</span>
                            <span className="text-[var(--color-text-primary)]">{fmtTime(t.lastPublished)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Schema preview */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          Schema ({t.schemas[0].format}) — {t.schemas[0].version}
                        </div>
                        <span className={cn("text-xs font-mono", formatColor[t.schemas[0].format])}>
                          {t.schemas[0].format}
                        </span>
                      </div>
                      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--color-border)]">
                              <th className="text-left p-2 text-[var(--color-text-muted)]">Field</th>
                              <th className="text-left p-2 text-[var(--color-text-muted)]">Type</th>
                              <th className="text-left p-2 text-[var(--color-text-muted)]">Required</th>
                              <th className="text-left p-2 text-[var(--color-text-muted)]">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.schemas[0].fields.map(f => (
                              <tr key={f.name} className="border-b border-[var(--color-border)]/50">
                                <td className="p-2 font-mono text-indigo-300">{f.name}</td>
                                <td className="p-2 font-mono text-amber-400">{f.type}</td>
                                <td className="p-2">{f.required ? <span className="text-rose-400">✓</span> : <span className="text-[var(--color-text-muted)]">○</span>}</td>
                                <td className="p-2 text-[var(--color-text-secondary)]">{f.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {/* Tags */}
                    <div className="flex gap-1.5">
                      {t.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schema Browser Tab */}
      {tab === "schema" && (
        <div className="flex gap-4">
          {/* Event selector */}
          <div className="w-56 space-y-1 shrink-0">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-2 mb-2">Select Event</div>
            {TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTopic(t.id)
                  setSelectedSchemaVersion(t.schemas[0].version)
                }}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                  selectedTopic === t.id
                    ? "bg-primary/20 text-indigo-300 border border-primary/30"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                )}
              >
                <span className="font-mono">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Schema detail */}
          <div className="flex-1">
            {topic ? (
              <div className="space-y-4">
                {/* Version selector */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-text-secondary)]">Version:</span>
                  <div className="flex gap-1">
                    {topic.schemas.map(s => (
                      <button
                        key={s.version}
                        onClick={() => setSelectedSchemaVersion(s.version)}
                        className={cn(
                          "px-3 py-1 text-sm rounded-md transition-colors font-mono",
                          selectedSchemaVersion === s.version
                            ? "bg-primary text-[var(--color-text-primary)]"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
                        )}
                      >
                        {s.version}
                      </button>
                    ))}
                  </div>
                </div>

                {topic.schemas.filter(s => s.version === selectedSchemaVersion).map(schema => (
                  <div key={schema.version}>
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                          <code className="text-indigo-300 font-mono text-sm">{topic.name}</code>
                          <span className={cn("text-xs font-mono font-medium", formatColor[schema.format])}>{schema.format}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--color-text-muted)]">Added {schema.addedAt}</span>
                          <button className="px-2 py-0.5 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-secondary)] transition-colors">
                            Copy Schema
                          </button>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-0)]">
                            <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Field Name</th>
                            <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Type</th>
                            <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Required</th>
                            <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schema.fields.map(f => (
                            <tr key={f.name} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/20">
                              <td className="p-3 font-mono text-indigo-300">{f.name}</td>
                              <td className="p-3 font-mono text-amber-400">{f.type}</td>
                              <td className="p-3">
                                {f.required
                                  ? <span className="text-xs px-1.5 py-0.5 bg-rose-400/10 text-rose-400 rounded">required</span>
                                  : <span className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-muted)] rounded">optional</span>
                                }
                              </td>
                              <td className="p-3 text-[var(--color-text-secondary)]">{f.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-12 text-center text-[var(--color-text-muted)]">
                Select an event to browse its schema
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dependency Graph Tab */}
      {tab === "graph" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Services as producers and consumers across event topics.</p>
          <div className="grid grid-cols-3 gap-4">
            {/* Producers column */}
            <div>
              <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-1">Producers</div>
              <div className="space-y-2">
                {[...new Set(TOPICS.flatMap(t => t.producers))].map(svc => {
                  const eventsProduced = TOPICS.filter(t => t.producers.includes(svc))
                  return (
                    <div key={svc} className="bg-emerald-400/5 border border-emerald-400/20 rounded-md px-3 py-2">
                      <div className="font-mono text-sm text-emerald-300">{svc}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{eventsProduced.length} events</div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Events column */}
            <div>
              <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-1">Events</div>
              <div className="space-y-2">
                {TOPICS.map(t => (
                  <div key={t.id} className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                    <div className="font-mono text-xs text-indigo-300">{t.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{fmtNum(t.messagesPerDay)}/day</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Consumers column */}
            <div>
              <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-1">Consumers</div>
              <div className="space-y-2">
                {[...new Set(TOPICS.flatMap(t => t.consumers))].map(svc => {
                  const eventsConsumed = TOPICS.filter(t => t.consumers.includes(svc))
                  return (
                    <div key={svc} className="bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2">
                      <div className="font-mono text-sm text-amber-300">{svc}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{eventsConsumed.length} events</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="space-y-6">
          {/* Domain volume */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Message Volume by Domain</h3>
            <div className="space-y-2.5">
              {domainStats.map(d => (
                <div key={d.domain} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-primary)] font-medium">{d.domain}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{d.topics} events</span>
                    </div>
                    <span className="text-primary font-mono">{fmtNum(d.messagesPerDay)}/day</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(d.messagesPerDay / maxMsgs) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{TOPICS.filter(t => t.status === "active").length}</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Active Events</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{TOPICS.filter(t => t.status === "deprecated").length}</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Deprecated</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">{TOPICS.flatMap(t => t.schemas).length}</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Schema Versions</div>
            </div>
          </div>

          {/* Event table with full stats */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Event Volume Ranking</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Event</th>
                  <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Domain</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Msgs/day</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Avg KB</th>
                  <th className="text-right p-3 text-[var(--color-text-secondary)] font-medium">Consumers</th>
                </tr>
              </thead>
              <tbody>
                {[...TOPICS].toSorted((a, b) => b.messagesPerDay - a.messagesPerDay).map(t => (
                  <tr key={t.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/20">
                    <td className="p-3 font-mono text-indigo-300 text-xs">{t.name}</td>
                    <td className="p-3 text-[var(--color-text-secondary)] text-xs">{t.domain}</td>
                    <td className="p-3 text-right font-mono text-[var(--color-text-primary)]">{fmtNum(t.messagesPerDay)}</td>
                    <td className="p-3 text-right text-[var(--color-text-secondary)]">{t.avgMessageSizeKb}</td>
                    <td className="p-3 text-right text-[var(--color-text-primary)]">{t.consumers.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
