import React, { useState } from "react"
import { cn } from "../lib/utils"

interface Commit { sha: string; message: string; author: string; date: string }

interface Repo {
  id: string; name: string; label: string; syncStatus: "synced" | "behind" | "error"
  lastPush: string; openPRs: number; branchCount: number; defaultBranch: string
  protectionRules: string[]; webhookUrl: string; recentCommits: Commit[]
}

interface Permission { scope: string; access: "read" | "write" }
interface WebhookEvent { id: string; event: string; enabled: boolean; payloadFormat: string }
interface WebhookDelivery { id: string; timestamp: string; eventType: string; responseCode: number; repoName: string }
interface AutoSyncSettings { autoPRCreation: boolean; autoCommitSigning: boolean; requiredStatusChecks: boolean }

const INITIAL_REPOS: Repo[] = [
  {
    id: "repo-1",
    name: "dgarson/clawdbot",
    label: "main",
    syncStatus: "synced",
    lastPush: "2 minutes ago",
    openPRs: 7,
    branchCount: 23,
    defaultBranch: "dgarson/fork",
    protectionRules: [
      "Require pull request reviews (1 approver)",
      "Require status checks to pass",
      "Restrict force pushes",
    ],
    webhookUrl: "https://hooks.openclaw.dev/github/clawdbot",
    recentCommits: [
      { sha: "a3f81c2", message: "feat: add megabranch rebase automation", author: "dgarson", date: "2 min ago" },
      { sha: "e9b44d7", message: "fix: worker PR review notification timing", author: "luis-agent", date: "18 min ago" },
      { sha: "c7210fa", message: "chore: update pnpm lockfile after dep bump", author: "reed-agent", date: "1 hr ago" },
    ],
  },
  {
    id: "repo-2",
    name: "openclaw/openclaw",
    label: "upstream",
    syncStatus: "behind",
    lastPush: "3 hours ago",
    openPRs: 12,
    branchCount: 41,
    defaultBranch: "main",
    protectionRules: [
      "Require pull request reviews (2 approvers)",
      "Require signed commits",
      "Require linear history",
      "Restrict deletions",
    ],
    webhookUrl: "https://hooks.openclaw.dev/github/openclaw",
    recentCommits: [
      { sha: "f1d92b8", message: "feat: gateway heartbeat health endpoint", author: "tim-agent", date: "3 hr ago" },
      { sha: "b8c35e1", message: "fix: node pairing race condition on reconnect", author: "roman-agent", date: "5 hr ago" },
      { sha: "d4a67c3", message: "docs: update AGENTS.md escalation paths", author: "joey-agent", date: "8 hr ago" },
    ],
  },
]

const INITIAL_PERMISSIONS: Permission[] = [
  { scope: "contents", access: "read" },
  { scope: "pull_requests", access: "write" },
  { scope: "checks", access: "write" },
  { scope: "issues", access: "write" },
  { scope: "metadata", access: "read" },
  { scope: "statuses", access: "write" },
  { scope: "actions", access: "read" },
  { scope: "webhooks", access: "write" },
]

const INITIAL_EVENTS: WebhookEvent[] = [
  { id: "evt-1", event: "push", enabled: true, payloadFormat: "JSON" },
  { id: "evt-2", event: "pull_request", enabled: true, payloadFormat: "JSON" },
  { id: "evt-3", event: "pull_request_review", enabled: true, payloadFormat: "JSON" },
  { id: "evt-4", event: "check_run", enabled: true, payloadFormat: "JSON" },
  { id: "evt-5", event: "check_suite", enabled: false, payloadFormat: "JSON" },
  { id: "evt-6", event: "issues", enabled: true, payloadFormat: "JSON" },
  { id: "evt-7", event: "issue_comment", enabled: false, payloadFormat: "JSON" },
  { id: "evt-8", event: "status", enabled: true, payloadFormat: "JSON" },
]

const INITIAL_DELIVERIES: WebhookDelivery[] = [
  { id: "del-1", timestamp: "2026-02-22 03:16:42", eventType: "push", responseCode: 200, repoName: "dgarson/clawdbot" },
  { id: "del-2", timestamp: "2026-02-22 03:14:18", eventType: "pull_request", responseCode: 200, repoName: "dgarson/clawdbot" },
  { id: "del-3", timestamp: "2026-02-22 02:58:04", eventType: "check_run", responseCode: 422, repoName: "openclaw/openclaw" },
  { id: "del-4", timestamp: "2026-02-22 02:41:33", eventType: "push", responseCode: 200, repoName: "openclaw/openclaw" },
  { id: "del-5", timestamp: "2026-02-22 02:22:10", eventType: "pull_request_review", responseCode: 500, repoName: "dgarson/clawdbot" },
  { id: "del-6", timestamp: "2026-02-22 01:59:55", eventType: "issues", responseCode: 200, repoName: "openclaw/openclaw" },
]

function StatusDot({ status }: { status: "synced" | "behind" | "error" }) {
  return (
    <div
      className={cn(
        "w-2.5 h-2.5 rounded-full shrink-0",
        status === "synced" && "bg-emerald-500",
        status === "behind" && "bg-amber-500",
        status === "error" && "bg-red-500"
      )}
    />
  )
}

function ResponseBadge({ code }: { code: number }) {
  return (
    <div
      className={cn(
        "px-2 py-0.5 rounded text-xs font-mono font-medium",
        code >= 200 && code < 300 && "bg-emerald-500/15 text-emerald-400",
        code >= 400 && code < 500 && "bg-amber-500/15 text-amber-400",
        code >= 500 && "bg-red-500/15 text-red-400"
      )}
    >
      {code}
    </div>
  )
}

function AccessBadge({ access }: { access: "read" | "write" }) {
  return (
    <div
      className={cn(
        "px-2 py-0.5 rounded text-xs font-medium",
        access === "read" && "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]",
        access === "write" && "bg-primary/15 text-primary"
      )}
    >
      {access}
    </div>
  )
}

export default function GitHubIntegration() {
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null)
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>(INITIAL_EVENTS)
  const [autoSync, setAutoSync] = useState<AutoSyncSettings>({
    autoPRCreation: true,
    autoCommitSigning: false,
    requiredStatusChecks: true,
  })
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>(INITIAL_DELIVERIES)
  const [pingStatus, setPingStatus] = useState<Record<string, "idle" | "sending" | "sent">>({})
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"repos" | "permissions" | "webhooks" | "deliveries">("repos")

  const toggleRepo = (id: string) => {
    setExpandedRepo((prev) => (prev === id ? null : id))
  }

  const toggleEvent = (id: string) => {
    setWebhookEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    )
  }

  const toggleAutoSync = (key: keyof AutoSyncSettings) => {
    setAutoSync((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const sendTestPing = (repoId: string) => {
    setPingStatus((prev) => ({ ...prev, [repoId]: "sending" }))
    setTimeout(() => {
      setPingStatus((prev) => ({ ...prev, [repoId]: "sent" }))
      const newDelivery: WebhookDelivery = {
        id: `del-ping-${Date.now()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        eventType: "ping",
        responseCode: 200,
        repoName: INITIAL_REPOS.find((r) => r.id === repoId)?.name ?? "unknown",
      }
      setDeliveries((prev) => [newDelivery, ...prev])
      setTimeout(() => setPingStatus((prev) => ({ ...prev, [repoId]: "idle" })), 2000)
    }, 1200)
  }

  const retryDelivery = (id: string) => {
    setRetryingId(id)
    setTimeout(() => {
      setDeliveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, responseCode: 200 } : d))
      )
      setRetryingId(null)
    }, 1500)
  }

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "repos", label: "Repositories" },
    { key: "permissions", label: "App Permissions" },
    { key: "webhooks", label: "Webhook Config" },
    { key: "deliveries", label: "Deliveries" },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GitHub Integration</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Manage connected repositories, webhooks, and sync settings
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <StatusDot status="synced" />
            <span className="text-[var(--color-text-secondary)]">Connected as</span>
            <span className="font-mono text-primary">openclaw-bot[app]</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[var(--color-surface-1)] rounded-lg p-1 border border-[var(--color-border)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Repositories Tab */}
        {activeTab === "repos" && (
          <div className="space-y-3">
            {INITIAL_REPOS.map((repo) => (
              <div key={repo.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleRepo(repo.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--color-surface-2)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={repo.syncStatus} />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{repo.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">
                          {repo.label}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Last push: {repo.lastPush}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    <div className="text-right">
                      <div className="text-[var(--color-text-secondary)]">{repo.openPRs} open PRs</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{repo.branchCount} branches</div>
                    </div>
                    <div
                      className={cn(
                        "text-[var(--color-text-muted)] transition-transform text-lg",
                        expandedRepo === repo.id && "rotate-180"
                      )}
                    >
                      ▾
                    </div>
                  </div>
                </button>

                {expandedRepo === repo.id && (
                  <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Default Branch</div>
                        <div className="font-mono text-sm text-primary">{repo.defaultBranch}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Webhook URL</div>
                        <div className="font-mono text-xs text-[var(--color-text-primary)] truncate">{repo.webhookUrl}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Protection Rules</div>
                      <div className="space-y-1">
                        {repo.protectionRules.map((rule) => (
                          <div key={rule} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            {rule}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Recent Commits</div>
                      <div className="space-y-2">
                        {repo.recentCommits.map((commit) => (
                          <div
                            key={commit.sha}
                            className="flex items-center justify-between bg-[var(--color-surface-0)] rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-xs text-primary shrink-0">
                                {commit.sha}
                              </span>
                              <span className="text-sm text-[var(--color-text-primary)] truncate">{commit.message}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <span className="text-xs text-[var(--color-text-muted)]">{commit.author}</span>
                              <span className="text-xs text-[var(--color-text-muted)]">{commit.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => sendTestPing(repo.id)}
                      disabled={pingStatus[repo.id] === "sending"}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        pingStatus[repo.id] === "sent"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : pingStatus[repo.id] === "sending"
                            ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-wait"
                            : "bg-primary/15 text-primary hover:bg-primary/25"
                      )}
                    >
                      {pingStatus[repo.id] === "sending"
                        ? "Sending ping…"
                        : pingStatus[repo.id] === "sent"
                          ? "Ping delivered ✓"
                          : "Test Webhook"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === "permissions" && (
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold">GitHub App Permissions</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Scopes granted to the openclaw-bot GitHub App installation
              </p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {INITIAL_PERMISSIONS.map((perm) => (
                <div
                  key={perm.scope}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-2)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="font-mono text-sm">{perm.scope}</span>
                  </div>
                  <AccessBadge access={perm.access} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === "webhooks" && (
          <div className="space-y-4">
            {/* Events Table */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <h2 className="text-sm font-semibold">Webhook Events</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Events this integration listens for
                </p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                <div className="grid grid-cols-3 px-5 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  <span>Event</span>
                  <span>Format</span>
                  <span className="text-right">Enabled</span>
                </div>
                {webhookEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="grid grid-cols-3 items-center px-5 py-3 hover:bg-[var(--color-surface-2)]/30 transition-colors"
                  >
                    <span className="font-mono text-sm">{evt.event}</span>
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">{evt.payloadFormat}</span>
                    <div className="flex justify-end">
                      <button
                        onClick={() => toggleEvent(evt.id)}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative",
                          evt.enabled ? "bg-primary" : "bg-[var(--color-surface-3)]"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                            evt.enabled ? "left-5" : "left-0.5"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-Sync Settings */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <h2 className="text-sm font-semibold">Auto-Sync Settings</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Configure automated sync behavior
                </p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {([
                  { key: "autoPRCreation" as const, label: "Auto PR Creation", desc: "Automatically create PRs for upstream changes" },
                  { key: "autoCommitSigning" as const, label: "Auto Commit Signing", desc: "Sign commits with the bot GPG key" },
                  { key: "requiredStatusChecks" as const, label: "Required Status Checks", desc: "Enforce passing CI before merge" },
                ]).map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-2)]/30 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium">{setting.label}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{setting.desc}</div>
                    </div>
                    <button
                      onClick={() => toggleAutoSync(setting.key)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative shrink-0 ml-4",
                        autoSync[setting.key] ? "bg-primary" : "bg-[var(--color-surface-3)]"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                          autoSync[setting.key] ? "left-5" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Deliveries Tab */}
        {activeTab === "deliveries" && (
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold">Recent Webhook Deliveries</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {deliveries.length} deliveries — failed deliveries can be retried
              </p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              <div className="grid grid-cols-5 px-5 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                <span>Timestamp</span>
                <span>Event</span>
                <span>Repository</span>
                <span>Status</span>
                <span className="text-right">Action</span>
              </div>
              {deliveries.map((del) => (
                <div
                  key={del.id}
                  className="grid grid-cols-5 items-center px-5 py-3 hover:bg-[var(--color-surface-2)]/30 transition-colors"
                >
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">{del.timestamp}</span>
                  <span className="font-mono text-sm">{del.eventType}</span>
                  <span className="text-sm text-[var(--color-text-secondary)] truncate">{del.repoName}</span>
                  <ResponseBadge code={del.responseCode} />
                  <div className="flex justify-end">
                    {del.responseCode >= 400 ? (
                      <button
                        onClick={() => retryDelivery(del.id)}
                        disabled={retryingId === del.id}
                        className={cn(
                          "px-3 py-1 rounded text-xs font-medium transition-colors",
                          retryingId === del.id
                            ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-wait"
                            : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        )}
                      >
                        {retryingId === del.id ? "Retrying…" : "Retry"}
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Summary Bar */}
        <div className="flex items-center justify-between bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-5 py-3">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <StatusDot status="synced" />
              <span className="text-[var(--color-text-secondary)]">1 synced</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="behind" />
              <span className="text-[var(--color-text-secondary)]">1 behind</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-[var(--color-text-muted)] font-mono">
                {webhookEvents.filter((e) => e.enabled).length}/{webhookEvents.length} events active
              </div>
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Last sync check: just now
          </div>
        </div>
      </div>
    </div>
  )
}
