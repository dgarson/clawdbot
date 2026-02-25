import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type StorageClass = "standard" | "infrequent" | "archive" | "intelligent";
type AccessLevel = "private" | "public-read" | "authenticated";

interface Bucket {
  id: string;
  name: string;
  region: string;
  provider: "aws" | "gcs" | "azure";
  storageClass: StorageClass;
  access: AccessLevel;
  sizeBytes: number;
  objectCount: number;
  versioning: boolean;
  encryption: boolean;
  lifecycle: boolean;
  createdAt: string;
  lastModified: string;
  monthlyCost: number;
}

interface StorageObject {
  key: string;
  size: number;
  lastModified: string;
  storageClass: StorageClass;
  etag: string;
  contentType: string;
}

interface LifecycleRule {
  id: string;
  name: string;
  prefix: string;
  transition: number;
  transitionClass: StorageClass;
  expiration: number | null;
  enabled: boolean;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const buckets: Bucket[] = [
  {
    id: "b1", name: "prod-assets-cdn", region: "us-east-1", provider: "aws",
    storageClass: "standard", access: "public-read",
    sizeBytes: 42_800_000_000, objectCount: 182_440, versioning: false, encryption: true,
    lifecycle: true, createdAt: "2023-06-01", lastModified: "2026-02-22", monthlyCost: 98.24,
  },
  {
    id: "b2", name: "prod-user-uploads", region: "us-east-1", provider: "aws",
    storageClass: "standard", access: "private",
    sizeBytes: 128_400_000_000, objectCount: 2_041_200, versioning: true, encryption: true,
    lifecycle: true, createdAt: "2023-06-01", lastModified: "2026-02-22", monthlyCost: 294.72,
  },
  {
    id: "b3", name: "prod-backups", region: "us-west-2", provider: "aws",
    storageClass: "infrequent", access: "private",
    sizeBytes: 840_000_000_000, objectCount: 14_280, versioning: false, encryption: true,
    lifecycle: true, createdAt: "2023-08-15", lastModified: "2026-02-21", monthlyCost: 96.60,
  },
  {
    id: "b4", name: "ml-training-data", region: "us-central1", provider: "gcs",
    storageClass: "standard", access: "authenticated",
    sizeBytes: 3_200_000_000_000, objectCount: 48_200, versioning: true, encryption: true,
    lifecycle: false, createdAt: "2024-01-10", lastModified: "2026-02-20", monthlyCost: 640.00,
  },
  {
    id: "b5", name: "prod-logs-archive", region: "us-east-1", provider: "aws",
    storageClass: "archive", access: "private",
    sizeBytes: 12_400_000_000_000, objectCount: 8_820_000, versioning: false, encryption: true,
    lifecycle: true, createdAt: "2023-06-01", lastModified: "2026-02-22", monthlyCost: 124.00,
  },
  {
    id: "b6", name: "staging-workspace", region: "eastus", provider: "azure",
    storageClass: "standard", access: "authenticated",
    sizeBytes: 14_200_000_000, objectCount: 28_400, versioning: false, encryption: true,
    lifecycle: false, createdAt: "2024-03-01", lastModified: "2026-02-19", monthlyCost: 28.40,
  },
  {
    id: "b7", name: "prod-media-orig", region: "us-east-1", provider: "aws",
    storageClass: "intelligent", access: "private",
    sizeBytes: 68_000_000_000, objectCount: 421_800, versioning: true, encryption: true,
    lifecycle: true, createdAt: "2023-09-01", lastModified: "2026-02-22", monthlyCost: 156.40,
  },
];

const sampleObjects: StorageObject[] = [
  { key: "uploads/2026/02/img_20260222_001.jpg", size: 2_480_000, lastModified: "2026-02-22T06:01:00Z", storageClass: "standard", etag: "a1b2c3d4", contentType: "image/jpeg" },
  { key: "uploads/2026/02/img_20260222_002.png", size: 4_120_000, lastModified: "2026-02-22T06:03:00Z", storageClass: "standard", etag: "e5f6a7b8", contentType: "image/png" },
  { key: "uploads/2026/02/doc_report_q4.pdf", size: 840_000, lastModified: "2026-02-22T05:44:00Z", storageClass: "standard", etag: "c9d0e1f2", contentType: "application/pdf" },
  { key: "uploads/2026/02/export_users_0222.csv", size: 128_000, lastModified: "2026-02-22T04:00:00Z", storageClass: "standard", etag: "a3b4c5d6", contentType: "text/csv" },
  { key: "uploads/2026/01/archive_jan.zip", size: 52_400_000, lastModified: "2026-02-01T00:00:00Z", storageClass: "infrequent", etag: "e7f8a9b0", contentType: "application/zip" },
  { key: "uploads/2025/12/year_end_assets.tar.gz", size: 142_000_000, lastModified: "2026-01-01T00:00:00Z", storageClass: "archive", etag: "c1d2e3f4", contentType: "application/gzip" },
  { key: "public/avatars/user_001.jpg", size: 48_000, lastModified: "2025-11-15T12:00:00Z", storageClass: "standard", etag: "a5b6c7d8", contentType: "image/jpeg" },
  { key: "public/avatars/user_002.jpg", size: 62_000, lastModified: "2025-11-20T14:30:00Z", storageClass: "standard", etag: "e9f0a1b2", contentType: "image/jpeg" },
  { key: "private/keys/service_account_prod.json", size: 2_100, lastModified: "2025-06-01T08:00:00Z", storageClass: "standard", etag: "c3d4e5f6", contentType: "application/json" },
  { key: "tmp/processing/batch_20260222_001.parquet", size: 12_400_000, lastModified: "2026-02-22T03:00:00Z", storageClass: "intelligent", etag: "a7b8c9d0", contentType: "application/octet-stream" },
];

const lifecycleRules: LifecycleRule[] = [
  { id: "r1", name: "Transition to IA after 30 days", prefix: "uploads/", transition: 30, transitionClass: "infrequent", expiration: null, enabled: true },
  { id: "r2", name: "Archive after 90 days", prefix: "uploads/", transition: 90, transitionClass: "archive", expiration: null, enabled: true },
  { id: "r3", name: "Delete old exports", prefix: "tmp/", transition: 7, transitionClass: "infrequent", expiration: 30, enabled: true },
  { id: "r4", name: "Purge logs after 365 days", prefix: "logs/", transition: 180, transitionClass: "archive", expiration: 365, enabled: true },
  { id: "r5", name: "Expire temp files", prefix: "tmp/processing/", transition: 1, transitionClass: "infrequent", expiration: 7, enabled: false },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1e12) {return (b / 1e12).toFixed(1) + " TB";}
  if (b >= 1e9) {return (b / 1e9).toFixed(1) + " GB";}
  if (b >= 1e6) {return (b / 1e6).toFixed(1) + " MB";}
  if (b >= 1e3) {return (b / 1e3).toFixed(1) + " KB";}
  return b + " B";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) {return (n / 1_000_000).toFixed(1) + "M";}
  if (n >= 1_000) {return (n / 1_000).toFixed(0) + "K";}
  return String(n);
}

function providerColor(p: Bucket["provider"]): string {
  const map: Record<Bucket["provider"], string> = {
    aws:   "bg-amber-500/20 text-amber-400 border-amber-500/30",
    gcs:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
    azure: "bg-primary/20 text-primary border-primary/30",
  };
  return map[p];
}

function classColor(c: StorageClass): string {
  const map: Record<StorageClass, string> = {
    standard:    "text-[var(--color-text-primary)]",
    infrequent:  "text-amber-400",
    archive:     "text-[var(--color-text-secondary)]",
    intelligent: "text-primary",
  };
  return map[c];
}

function accessColor(a: AccessLevel): string {
  const map: Record<AccessLevel, string> = {
    "private":        "text-[var(--color-text-secondary)]",
    "public-read":    "text-rose-400",
    "authenticated":  "text-emerald-400",
  };
  return map[a];
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function BucketsTab() {
  const [selected, setSelected] = useState<Bucket | null>(null);

  const totalSize = buckets.reduce((a, b) => a + b.sizeBytes, 0);
  const totalCost = buckets.reduce((a, b) => a + b.monthlyCost, 0);

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Buckets", value: buckets.length.toString() },
          { label: "Total Storage", value: fmtBytes(totalSize) },
          { label: "Total Objects", value: fmtNum(buckets.reduce((a, b) => a + b.objectCount, 0)) },
          { label: "Monthly Cost", value: "$" + totalCost.toFixed(2) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">{s.value}</div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {buckets.map((bucket) => (
          <div
            key={bucket.id}
            className={cn(
              "rounded-xl border p-4 cursor-pointer transition-all",
              selected?.id === bucket.id ? "border-primary bg-primary/5" : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-surface-3)]"
            )}
            onClick={() => setSelected(selected?.id === bucket.id ? null : bucket)}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🪣</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">{bucket.name}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded border", providerColor(bucket.provider))}>
                    {bucket.provider.toUpperCase()}
                  </span>
                  <span className={cn("text-xs", accessColor(bucket.access))}>{bucket.access}</span>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{bucket.region}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{fmtBytes(bucket.sizeBytes)}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{fmtNum(bucket.objectCount)} objects</div>
              </div>
              <div className="text-right w-20">
                <div className="text-sm text-emerald-400">${bucket.monthlyCost.toFixed(2)}</div>
                <div className="text-xs text-[var(--color-text-muted)]">/month</div>
              </div>
            </div>

            {selected?.id === bucket.id && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Storage class</span>
                    <span className={classColor(bucket.storageClass)}>{bucket.storageClass}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Versioning</span>
                    <span className={bucket.versioning ? "text-emerald-400" : "text-[var(--color-text-muted)]"}>
                      {bucket.versioning ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Encryption</span>
                    <span className={bucket.encryption ? "text-emerald-400" : "text-rose-400"}>
                      {bucket.encryption ? "AES-256" : "none"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Lifecycle rules</span>
                    <span className={bucket.lifecycle ? "text-primary" : "text-[var(--color-text-muted)]"}>
                      {bucket.lifecycle ? "configured" : "none"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Created</span>
                    <span className="text-[var(--color-text-primary)]">{bucket.createdAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Last modified</span>
                    <span className="text-[var(--color-text-primary)]">{bucket.lastModified}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Total size</span>
                    <span className="text-[var(--color-text-primary)]">{fmtBytes(bucket.sizeBytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Monthly cost</span>
                    <span className="text-emerald-400">${bucket.monthlyCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ObjectsTab() {
  const [bucket, setBucket] = useState<string>(buckets[1].id);
  const [prefix, setPrefix] = useState("");
  const [sortBy, setSortBy] = useState<"key" | "size" | "modified">("modified");

  const filtered = sampleObjects
    .filter((o) => !prefix || o.key.toLowerCase().includes(prefix.toLowerCase()))
    .toSorted((a, b) => {
      if (sortBy === "size") {return b.size - a.size;}
      if (sortBy === "modified") {return b.lastModified.localeCompare(a.lastModified);}
      return a.key.localeCompare(b.key);
    });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
        >
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Filter by prefix..."
          className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "key" | "size" | "modified")}
          className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
        >
          <option value="modified">Sort: Recent</option>
          <option value="size">Sort: Size</option>
          <option value="key">Sort: Name</option>
        </select>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Key</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Size</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Class</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Modified</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.map((obj) => (
              <tr key={obj.key} className="bg-[var(--color-surface-0)] hover:bg-[var(--color-surface-1)] transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)] max-w-xs truncate">{obj.key}</td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-primary)]">{fmtBytes(obj.size)}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={classColor(obj.storageClass)}>{obj.storageClass}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{obj.lastModified.slice(0, 10)}</td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] truncate max-w-xs">{obj.contentType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LifecycleTab() {
  const [rules] = useState<LifecycleRule[]>(lifecycleRules);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Lifecycle rules automatically transition or expire objects based on age and prefix.
      </p>
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("w-2 h-2 rounded-full", rule.enabled ? "bg-emerald-400" : "bg-[var(--color-surface-3)]")} />
            <span className="font-medium text-[var(--color-text-primary)]">{rule.name}</span>
            {!rule.enabled && <span className="text-xs text-[var(--color-text-muted)]">(disabled)</span>}
          </div>
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-[var(--color-text-muted)] mb-0.5">Prefix</div>
              <div className="font-mono text-indigo-300">{rule.prefix}</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)] mb-0.5">Transition after</div>
              <div className="text-[var(--color-text-primary)]">{rule.transition} days</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)] mb-0.5">Transition to</div>
              <div className={classColor(rule.transitionClass)}>{rule.transitionClass}</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)] mb-0.5">Expiration</div>
              <div className={rule.expiration ? "text-rose-400" : "text-[var(--color-text-muted)]"}>
                {rule.expiration ? rule.expiration + " days" : "never"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CostTab() {
  const sorted = [...buckets].toSorted((a, b) => b.monthlyCost - a.monthlyCost);
  const total = buckets.reduce((a, b) => a + b.monthlyCost, 0);

  const byProvider: Record<string, number> = {};
  buckets.forEach((b) => {
    byProvider[b.provider] = (byProvider[b.provider] ?? 0) + b.monthlyCost;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Monthly", value: "$" + total.toFixed(2), color: "text-[var(--color-text-primary)]" },
          { label: "Projected Annual", value: "$" + (total * 12).toFixed(0), color: "text-amber-400" },
          { label: "Avg per Bucket", value: "$" + (total / buckets.length).toFixed(2), color: "text-[var(--color-text-primary)]" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Cost by Bucket</h3>
        <div className="space-y-3">
          {sorted.map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-primary)] w-40 truncate">{b.name}</span>
              <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: (b.monthlyCost / sorted[0].monthlyCost * 100) + "%" }}
                />
              </div>
              <span className="text-xs text-emerald-400 w-16 text-right">${b.monthlyCost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Cost by Provider</h3>
        <div className="space-y-3">
          {Object.entries(byProvider).map(([provider, cost]) => (
            <div key={provider} className="flex items-center gap-3">
              <span className={cn("text-xs px-2 py-0.5 rounded border w-16 text-center capitalize", providerColor(provider as Bucket["provider"]))}>
                {provider}
              </span>
              <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: (cost / total * 100) + "%" }}
                />
              </div>
              <span className="text-xs text-amber-400 w-16 text-right">${cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Buckets", "Objects", "Lifecycle", "Cost"] as const;
type Tab = typeof TABS[number];

export default function StorageBucketManager() {
  const [tab, setTab] = useState<Tab>("Buckets");

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Storage Bucket Manager</h1>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Manage S3, GCS, and Azure Blob storage buckets — {buckets.length} buckets, {fmtBytes(buckets.reduce((a, b) => a + b.sizeBytes, 0))} total
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Buckets" && <BucketsTab />}
      {tab === "Objects" && <ObjectsTab />}
      {tab === "Lifecycle" && <LifecycleTab />}
      {tab === "Cost" && <CostTab />}
    </div>
  );
}
