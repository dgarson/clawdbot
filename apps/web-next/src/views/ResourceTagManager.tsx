import React, { useState } from "react"
import { cn } from "../lib/utils"

type TaggableType = "instance" | "bucket" | "database" | "function" | "network" | "cluster"
type ComplianceStatus = "compliant" | "missing-required" | "invalid-value" | "untagged"
type PolicyAction = "enforce" | "audit" | "suggest"

interface Tag {
  key: string
  value: string
}

interface TaggableResource {
  id: string
  name: string
  type: TaggableType
  provider: "aws" | "gcp" | "azure"
  region: string
  tags: Tag[]
  complianceStatus: ComplianceStatus
  lastTagged?: string
  monthlyCost: number
}

interface TagPolicy {
  id: string
  name: string
  description: string
  requiredKeys: string[]
  allowedValues: Record<string, string[]>
  action: PolicyAction
  appliesTo: TaggableType[]
  violations: number
}

interface TagTemplate {
  id: string
  name: string
  description: string
  tags: Tag[]
  usageCount: number
}

const RESOURCES: TaggableResource[] = [
  { id: "i-0abc123", name: "api-server-prod-1", type: "instance", provider: "aws", region: "us-east-1", tags: [{ key: "env", value: "production" }, { key: "team", value: "platform" }, { key: "cost-center", value: "CC-101" }], complianceStatus: "compliant", lastTagged: "2026-02-10", monthlyCost: 420 },
  { id: "i-0def456", name: "worker-node-3", type: "instance", provider: "aws", region: "us-west-2", tags: [{ key: "env", value: "production" }, { key: "team", value: "data" }], complianceStatus: "missing-required", lastTagged: "2026-01-28", monthlyCost: 280 },
  { id: "bucket-analytics-raw", name: "analytics-raw-data", type: "bucket", provider: "gcp", region: "us-central1", tags: [{ key: "env", value: "production" }, { key: "team", value: "data" }, { key: "cost-center", value: "CC-205" }, { key: "data-class", value: "internal" }], complianceStatus: "compliant", lastTagged: "2026-02-15", monthlyCost: 890 },
  { id: "db-prod-pg-01", name: "postgres-primary", type: "database", provider: "aws", region: "us-east-1", tags: [{ key: "env", value: "production" }, { key: "team", value: "platform" }, { key: "cost-center", value: "CC-101" }, { key: "backup", value: "enabled" }], complianceStatus: "compliant", lastTagged: "2026-02-18", monthlyCost: 1240 },
  { id: "fn-process-events", name: "process-events-fn", type: "function", provider: "aws", region: "eu-west-1", tags: [], complianceStatus: "untagged", lastTagged: undefined, monthlyCost: 45 },
  { id: "cluster-k8s-staging", name: "k8s-staging-cluster", type: "cluster", provider: "gcp", region: "us-east1", tags: [{ key: "env", value: "staging" }, { key: "team", value: "platform" }, { key: "cost-center", value: "CC-102" }], complianceStatus: "compliant", lastTagged: "2026-02-20", monthlyCost: 3200 },
  { id: "vnet-prod-001", name: "prod-vnet-eastus", type: "network", provider: "azure", region: "eastus", tags: [{ key: "env", value: "prod" }, { key: "team", value: "platform" }], complianceStatus: "invalid-value", lastTagged: "2026-01-15", monthlyCost: 120 },
  { id: "i-0ghi789", name: "ml-training-gpu-1", type: "instance", provider: "aws", region: "us-east-1", tags: [{ key: "env", value: "production" }, { key: "team", value: "ml" }, { key: "cost-center", value: "CC-310" }], complianceStatus: "compliant", lastTagged: "2026-02-19", monthlyCost: 5600 },
  { id: "bucket-backups-eu", name: "backup-store-eu", type: "bucket", provider: "azure", region: "westeurope", tags: [{ key: "env", value: "production" }], complianceStatus: "missing-required", lastTagged: "2026-02-01", monthlyCost: 340 },
  { id: "fn-webhook-handler", name: "webhook-handler", type: "function", provider: "gcp", region: "us-central1", tags: [{ key: "env", value: "production" }, { key: "team", value: "integrations" }, { key: "cost-center", value: "CC-210" }], complianceStatus: "compliant", lastTagged: "2026-02-12", monthlyCost: 22 },
  { id: "db-analytics-bq", name: "analytics-bq-dataset", type: "database", provider: "gcp", region: "us-central1", tags: [], complianceStatus: "untagged", lastTagged: undefined, monthlyCost: 780 },
  { id: "cluster-ecs-prod", name: "ecs-prod-cluster", type: "cluster", provider: "aws", region: "us-east-1", tags: [{ key: "env", value: "production" }, { key: "team", value: "platform" }, { key: "cost-center", value: "CC-101" }, { key: "tier", value: "critical" }], complianceStatus: "compliant", lastTagged: "2026-02-21", monthlyCost: 2100 },
]

const POLICIES: TagPolicy[] = [
  { id: "pol-001", name: "Core Tagging Standard", description: "All resources must have env, team, and cost-center tags", requiredKeys: ["env", "team", "cost-center"], allowedValues: { env: ["production", "staging", "development", "test"], team: ["platform", "data", "ml", "security", "finance", "integrations"] }, action: "enforce", appliesTo: ["instance", "bucket", "database", "cluster"], violations: 4 },
  { id: "pol-002", name: "Data Classification", description: "Buckets and databases must declare data-class tag", requiredKeys: ["data-class"], allowedValues: { "data-class": ["public", "internal", "confidential", "restricted"] }, action: "enforce", appliesTo: ["bucket", "database"], violations: 2 },
  { id: "pol-003", name: "Cost Attribution", description: "All resources must map to a cost center for FinOps tracking", requiredKeys: ["cost-center"], allowedValues: {}, action: "audit", appliesTo: ["instance", "bucket", "database", "function", "network", "cluster"], violations: 5 },
  { id: "pol-004", name: "Backup Configuration", description: "Production databases should declare backup policy", requiredKeys: ["backup"], allowedValues: { backup: ["enabled", "disabled"] }, action: "suggest", appliesTo: ["database"], violations: 1 },
]

const TEMPLATES: TagTemplate[] = [
  { id: "tmpl-001", name: "Production Service", description: "Standard tags for production services", tags: [{ key: "env", value: "production" }, { key: "team", value: "" }, { key: "cost-center", value: "" }, { key: "tier", value: "standard" }], usageCount: 248 },
  { id: "tmpl-002", name: "Staging Environment", description: "Tags for staging resources", tags: [{ key: "env", value: "staging" }, { key: "team", value: "" }, { key: "cost-center", value: "" }], usageCount: 91 },
  { id: "tmpl-003", name: "Data Pipeline", description: "Tags for data processing resources", tags: [{ key: "env", value: "production" }, { key: "team", value: "data" }, { key: "cost-center", value: "CC-205" }, { key: "data-class", value: "internal" }, { key: "pipeline", value: "" }], usageCount: 67 },
  { id: "tmpl-004", name: "ML Training", description: "GPU/compute resources for ML workloads", tags: [{ key: "env", value: "production" }, { key: "team", value: "ml" }, { key: "cost-center", value: "CC-310" }, { key: "gpu", value: "true" }], usageCount: 34 },
]

const complianceColor: Record<ComplianceStatus, string> = {
  compliant: "text-emerald-400 bg-emerald-400/10",
  "missing-required": "text-amber-400 bg-amber-400/10",
  "invalid-value": "text-rose-400 bg-rose-400/10",
  untagged: "text-zinc-400 bg-zinc-400/10",
}

const complianceLabel: Record<ComplianceStatus, string> = {
  compliant: "✓ Compliant",
  "missing-required": "⚠ Missing Tags",
  "invalid-value": "✗ Invalid Value",
  untagged: "○ Untagged",
}

const typeIcon: Record<TaggableType, string> = {
  instance: "🖥",
  bucket: "🪣",
  database: "🗄",
  function: "λ",
  network: "🌐",
  cluster: "☸",
}

const providerColor: Record<string, string> = {
  aws: "text-amber-400",
  gcp: "text-blue-400",
  azure: "text-indigo-400",
}

const policyActionColor: Record<PolicyAction, string> = {
  enforce: "text-rose-400 bg-rose-400/10",
  audit: "text-amber-400 bg-amber-400/10",
  suggest: "text-indigo-400 bg-indigo-400/10",
}

function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700">
      <span className="text-zinc-400">{tag.key}:</span>
      <span className="text-zinc-200">{tag.value}</span>
    </span>
  )
}

export default function ResourceTagManager() {
  const [tab, setTab] = useState<"resources" | "policies" | "templates" | "analytics">("resources")
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [complianceFilter, setComplianceFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  const tabs = [
    { id: "resources" as const, label: "Resources", emoji: "🗂" },
    { id: "policies" as const, label: "Policies", emoji: "📋" },
    { id: "templates" as const, label: "Templates", emoji: "📄" },
    { id: "analytics" as const, label: "Analytics", emoji: "📊" },
  ]

  const filtered = RESOURCES.filter(r => {
    if (complianceFilter !== "all" && r.complianceStatus !== complianceFilter) {return false}
    if (typeFilter !== "all" && r.type !== typeFilter) {return false}
    if (providerFilter !== "all" && r.provider !== providerFilter) {return false}
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.id.toLowerCase().includes(searchQuery.toLowerCase())) {return false}
    return true
  })

  const resource = selectedResource ? RESOURCES.find(r => r.id === selectedResource) : null

  // Compliance summary
  const compliantCount = RESOURCES.filter(r => r.complianceStatus === "compliant").length
  const missingCount = RESOURCES.filter(r => r.complianceStatus === "missing-required").length
  const invalidCount = RESOURCES.filter(r => r.complianceStatus === "invalid-value").length
  const untaggedCount = RESOURCES.filter(r => r.complianceStatus === "untagged").length

  const totalCost = RESOURCES.reduce((s, r) => s + r.monthlyCost, 0)
  const taggedCostPct = Math.round((RESOURCES.filter(r => r.complianceStatus === "compliant").reduce((s, r) => s + r.monthlyCost, 0) / totalCost) * 100)

  // Tag key frequency for analytics
  const keyFreq: Record<string, number> = {}
  RESOURCES.forEach(r => r.tags.forEach(t => { keyFreq[t.key] = (keyFreq[t.key] ?? 0) + 1 }))
  const topKeys = Object.entries(keyFreq).toSorted((a, b) => b[1] - a[1]).slice(0, 8)
  const maxFreq = topKeys[0]?.[1] ?? 1

  const toggleBulk = (id: string) => {
    const next = new Set(bulkSelected)
    if (next.has(id)) {next.delete(id)}
    else {next.add(id)}
    setBulkSelected(next)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Resource Tag Manager</h1>
          <p className="text-zinc-400 text-sm mt-1">Enforce tagging policies across AWS, GCP, and Azure</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm text-zinc-300 transition-colors">
            Import Tags
          </button>
          <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-md text-sm font-medium transition-colors">
            + New Policy
          </button>
        </div>
      </div>

      {/* Compliance summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 cursor-pointer hover:border-emerald-500/30 transition-colors" onClick={() => setComplianceFilter(complianceFilter === "compliant" ? "all" : "compliant")}>
          <div className="text-xs text-zinc-400 mb-1">Compliant</div>
          <div className="text-2xl font-bold text-emerald-400">{compliantCount}</div>
          <div className="text-xs text-zinc-500 mt-1">{Math.round((compliantCount / RESOURCES.length) * 100)}% of resources</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 cursor-pointer hover:border-amber-500/30 transition-colors" onClick={() => setComplianceFilter(complianceFilter === "missing-required" ? "all" : "missing-required")}>
          <div className="text-xs text-zinc-400 mb-1">Missing Tags</div>
          <div className="text-2xl font-bold text-amber-400">{missingCount}</div>
          <div className="text-xs text-zinc-500 mt-1">click to filter</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 cursor-pointer hover:border-rose-500/30 transition-colors" onClick={() => setComplianceFilter(complianceFilter === "untagged" ? "all" : "untagged")}>
          <div className="text-xs text-zinc-400 mb-1">Untagged</div>
          <div className="text-2xl font-bold text-rose-400">{untaggedCount + invalidCount}</div>
          <div className="text-xs text-zinc-500 mt-1">{invalidCount} invalid values</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-400 mb-1">Cost Attributed</div>
          <div className="text-2xl font-bold text-indigo-400">{taggedCostPct}%</div>
          <div className="text-xs text-zinc-500 mt-1">${totalCost.toLocaleString()}/mo total</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              tab === t.id
                ? "border-indigo-500 text-white bg-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-300"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Resources Tab */}
      {tab === "resources" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search resources..."
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-zinc-500 w-48"
            />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white">
              <option value="all">All Types</option>
              <option value="instance">Instance</option>
              <option value="bucket">Bucket</option>
              <option value="database">Database</option>
              <option value="function">Function</option>
              <option value="network">Network</option>
              <option value="cluster">Cluster</option>
            </select>
            <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white">
              <option value="all">All Providers</option>
              <option value="aws">AWS</option>
              <option value="gcp">GCP</option>
              <option value="azure">Azure</option>
            </select>
            <select value={complianceFilter} onChange={e => setComplianceFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white">
              <option value="all">All Compliance</option>
              <option value="compliant">Compliant</option>
              <option value="missing-required">Missing Required</option>
              <option value="invalid-value">Invalid Value</option>
              <option value="untagged">Untagged</option>
            </select>
            <span className="text-sm text-zinc-400 self-center">{filtered.length} resources</span>
            {bulkSelected.size > 0 && (
              <button className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-md text-sm transition-colors ml-auto">
                Apply Template to {bulkSelected.size} selected
              </button>
            )}
          </div>

          {/* Resource list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="p-3 w-8"><input type="checkbox" className="rounded" /></th>
                  <th className="text-left p-3 text-zinc-400 font-medium">Resource</th>
                  <th className="text-left p-3 text-zinc-400 font-medium">Tags</th>
                  <th className="text-left p-3 text-zinc-400 font-medium">Cost/mo</th>
                  <th className="text-left p-3 text-zinc-400 font-medium">Compliance</th>
                  <th className="text-left p-3 text-zinc-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <React.Fragment key={r.id}>
                    <tr
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(r.id)}
                          onChange={() => toggleBulk(r.id)}
                          className="rounded"
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{typeIcon[r.type]}</span>
                          <div>
                            <div className="font-medium text-zinc-200">{r.name}</div>
                            <div className="text-xs text-zinc-500 font-mono">{r.id}</div>
                            <div className="text-xs mt-0.5">
                              <span className={cn("font-medium uppercase", providerColor[r.provider])}>{r.provider}</span>
                              <span className="text-zinc-500 ml-1">{r.region}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {r.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {r.tags.slice(0, 3).map(t => <TagBadge key={t.key} tag={t} />)}
                            {r.tags.length > 3 && (
                              <span className="text-xs text-zinc-500 self-center">+{r.tags.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">No tags</span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-300 font-mono text-sm">${r.monthlyCost.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", complianceColor[r.complianceStatus])}>
                          {complianceLabel[r.complianceStatus]}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedResource(selectedResource === r.id ? null : r.id)}
                            className="px-2 py-1 text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded transition-colors"
                          >
                            Edit Tags
                          </button>
                        </div>
                      </td>
                    </tr>
                    {selectedResource === r.id && (
                      <tr className="border-b border-zinc-800/50">
                        <td colSpan={6} className="p-4 bg-zinc-950">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium">Edit Tags — {r.name}</h3>
                              <div className="flex gap-2">
                                <button className="px-3 py-1 text-xs bg-indigo-500 hover:bg-indigo-400 rounded-md transition-colors">Save</button>
                                <button className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 transition-colors">Cancel</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {r.tags.map(t => (
                                <div key={t.key} className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2">
                                  <input defaultValue={t.key} className="bg-transparent text-zinc-400 text-xs w-24 outline-none" />
                                  <span className="text-zinc-600">:</span>
                                  <input defaultValue={t.value} className="bg-transparent text-zinc-200 text-xs flex-1 outline-none" />
                                  <button className="text-zinc-600 hover:text-rose-400 transition-colors text-xs">✕</button>
                                </div>
                              ))}
                              <button className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 border-dashed rounded-md px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                                + Add Tag
                              </button>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <span className="text-xs text-zinc-500">Apply template:</span>
                              {TEMPLATES.slice(0, 3).map(t => (
                                <button key={t.id} className="text-xs px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors">
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policies Tab */}
      {tab === "policies" && (
        <div className="space-y-4">
          {POLICIES.map(pol => (
            <div key={pol.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{pol.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", policyActionColor[pol.action])}>
                      {pol.action}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-3">{pol.description}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wider">Required Keys</span>
                      <div className="flex gap-1.5 mt-1">
                        {pol.requiredKeys.map(k => (
                          <span key={k} className="text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded font-mono text-zinc-300">{k}</span>
                        ))}
                      </div>
                    </div>
                    {Object.keys(pol.allowedValues).length > 0 && (
                      <div>
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">Allowed Values</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(pol.allowedValues).map(([key, vals]) => (
                            <div key={key} className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-zinc-400 w-24">{key}:</span>
                              <div className="flex gap-1 flex-wrap">
                                {vals.map(v => (
                                  <span key={v} className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">{v}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wider">Applies To</span>
                      <div className="flex gap-1.5 mt-1">
                        {pol.appliesTo.map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                            {typeIcon[t]} {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-2xl font-bold", pol.violations > 0 ? "text-rose-400" : "text-emerald-400")}>
                    {pol.violations}
                  </div>
                  <div className="text-xs text-zinc-400">violations</div>
                  <div className="flex flex-col gap-1 mt-2">
                    <button className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-300 transition-colors">Edit</button>
                    {pol.violations > 0 && (
                      <button className="px-3 py-1 text-xs bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 rounded-md transition-colors">
                        View Violations
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-md text-sm font-medium transition-colors">
              + New Template
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map(tmpl => (
              <div key={tmpl.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{tmpl.name}</div>
                    <div className="text-sm text-zinc-400 mt-0.5">{tmpl.description}</div>
                  </div>
                  <div className="text-xs text-zinc-500 text-right">
                    <div className="text-indigo-400 font-medium">{tmpl.usageCount}</div>
                    <div>uses</div>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3">
                  {tmpl.tags.map(t => (
                    <div key={t.key} className="flex items-center gap-2 text-xs bg-zinc-800 rounded px-2 py-1.5">
                      <span className="text-zinc-400 font-mono w-28">{t.key}</span>
                      <span className="text-zinc-600">→</span>
                      <span className={cn("font-mono flex-1", t.value ? "text-zinc-200" : "text-zinc-600 italic")}>
                        {t.value || "(fill in)"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
                  <button className="flex-1 px-3 py-1.5 text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-md transition-colors">
                    Apply to Selection
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 transition-colors">
                    Edit
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 transition-colors">
                    Clone
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Tag key coverage */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Tag Key Coverage (resources using each key)</h3>
            <div className="space-y-2.5">
              {topKeys.map(([key, count]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-zinc-300">{key}</span>
                    <span className="text-zinc-400">{count} / {RESOURCES.length} resources ({Math.round((count / RESOURCES.length) * 100)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", count / RESOURCES.length >= 0.8 ? "bg-emerald-500" : count / RESOURCES.length >= 0.5 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${(count / maxFreq) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Provider breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {(["aws", "gcp", "azure"] as const).map(provider => {
              const pResources = RESOURCES.filter(r => r.provider === provider)
              const pCompliant = pResources.filter(r => r.complianceStatus === "compliant").length
              const pCost = pResources.reduce((s, r) => s + r.monthlyCost, 0)
              return (
                <div key={provider} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className={cn("text-sm font-bold uppercase mb-1", providerColor[provider])}>{provider}</div>
                  <div className="text-2xl font-bold text-white mb-2">{pResources.length}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Compliant</span>
                      <span className="text-emerald-400">{pCompliant}/{pResources.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Monthly cost</span>
                      <span className="text-zinc-300">${pCost.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-2 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(pCompliant / pResources.length) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Cost attribution */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Monthly Cost by Compliance Status</h3>
            <div className="space-y-2">
              {(["compliant", "missing-required", "invalid-value", "untagged"] as ComplianceStatus[]).map(status => {
                const cost = RESOURCES.filter(r => r.complianceStatus === status).reduce((s, r) => s + r.monthlyCost, 0)
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={cn("font-medium", complianceColor[status].split(" ")[0])}>{complianceLabel[status]}</span>
                      <span className="text-zinc-300">${cost.toLocaleString()}/mo</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", {
                          "bg-emerald-500": status === "compliant",
                          "bg-amber-500": status === "missing-required",
                          "bg-rose-500": status === "invalid-value" || status === "untagged",
                        })}
                        style={{ width: `${(cost / totalCost) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
