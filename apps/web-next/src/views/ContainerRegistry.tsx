import React, { useState } from "react";
import { cn } from "../lib/utils";

type Tab = "repositories" | "images" | "vulnerabilities" | "settings";

interface RepoTag {
  tag: string;
  size: string;
  digest: string;
  pushedAt: string;
}

interface Repo {
  name: string;
  visibility: "public" | "private";
  imageCount: number;
  totalSize: string;
  lastPush: string;
  pulls: number;
  tags: RepoTag[];
}

interface Image {
  repo: string;
  tag: string;
  digest: string;
  size: string;
  arch: string;
  os: string;
  created: string;
  layers: { size: string; bytes: number }[];
}

interface CVE {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  fixAvailable: boolean;
  affectedImages: string[];
  packages: string[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: "repositories", label: "Repositories" },
  { key: "images", label: "Images" },
  { key: "vulnerabilities", label: "Vulnerabilities" },
  { key: "settings", label: "Settings" },
];

const repos: Repo[] = [
  { name: "frontend/web-app", visibility: "private", imageCount: 24, totalSize: "4.8 GB", lastPush: "2026-02-21", pulls: 11842, tags: [
    { tag: "latest", size: "187 MB", digest: "sha256:a1b2c3d4e5f6", pushedAt: "2026-02-21" },
    { tag: "v2.14.0", size: "185 MB", digest: "sha256:f6e5d4c3b2a1", pushedAt: "2026-02-19" },
    { tag: "v2.13.1", size: "182 MB", digest: "sha256:1a2b3c4d5e6f", pushedAt: "2026-02-10" },
  ]},
  { name: "backend/api-server", visibility: "private", imageCount: 31, totalSize: "6.2 GB", lastPush: "2026-02-22", pulls: 28463, tags: [
    { tag: "latest", size: "214 MB", digest: "sha256:b2c3d4e5f6a7", pushedAt: "2026-02-22" },
    { tag: "v5.1.0", size: "210 MB", digest: "sha256:7a6f5e4d3c2b", pushedAt: "2026-02-20" },
  ]},
  { name: "infra/nginx-proxy", visibility: "public", imageCount: 8, totalSize: "920 MB", lastPush: "2026-02-15", pulls: 54210, tags: [
    { tag: "stable", size: "112 MB", digest: "sha256:c3d4e5f6a7b8", pushedAt: "2026-02-15" },
    { tag: "1.25-alpine", size: "42 MB", digest: "sha256:8b7a6f5e4d3c", pushedAt: "2026-02-01" },
  ]},
  { name: "data/postgres-backup", visibility: "private", imageCount: 12, totalSize: "2.1 GB", lastPush: "2026-02-18", pulls: 3891, tags: [
    { tag: "latest", size: "178 MB", digest: "sha256:d4e5f6a7b8c9", pushedAt: "2026-02-18" },
  ]},
  { name: "ml/model-serving", visibility: "private", imageCount: 6, totalSize: "8.4 GB", lastPush: "2026-02-20", pulls: 1247, tags: [
    { tag: "v1.3.0-gpu", size: "1.4 GB", digest: "sha256:e5f6a7b8c9d0", pushedAt: "2026-02-20" },
    { tag: "v1.3.0-cpu", size: "820 MB", digest: "sha256:0d9c8b7a6f5e", pushedAt: "2026-02-20" },
  ]},
  { name: "tools/ci-runner", visibility: "public", imageCount: 15, totalSize: "3.3 GB", lastPush: "2026-02-17", pulls: 72041, tags: [
    { tag: "ubuntu-22.04", size: "245 MB", digest: "sha256:f6a7b8c9d0e1", pushedAt: "2026-02-17" },
    { tag: "alpine-3.19", size: "89 MB", digest: "sha256:1e0d9c8b7a6f", pushedAt: "2026-02-12" },
  ]},
  { name: "frontend/storybook", visibility: "private", imageCount: 9, totalSize: "1.7 GB", lastPush: "2026-02-14", pulls: 2105, tags: [
    { tag: "latest", size: "198 MB", digest: "sha256:a7b8c9d0e1f2", pushedAt: "2026-02-14" },
  ]},
  { name: "infra/redis-cluster", visibility: "public", imageCount: 5, totalSize: "480 MB", lastPush: "2026-02-11", pulls: 18390, tags: [
    { tag: "7.2-alpine", size: "34 MB", digest: "sha256:b8c9d0e1f2a3", pushedAt: "2026-02-11" },
    { tag: "7.2", size: "98 MB", digest: "sha256:3a2f1e0d9c8b", pushedAt: "2026-02-08" },
  ]},
];

const images: Image[] = [
  { repo: "frontend/web-app", tag: "latest", digest: "sha256:a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890", size: "187 MB", arch: "amd64", os: "linux", created: "2026-02-21", layers: [{ size: "5 MB", bytes: 5 }, { size: "82 MB", bytes: 82 }, { size: "45 MB", bytes: 45 }, { size: "55 MB", bytes: 55 }] },
  { repo: "frontend/web-app", tag: "v2.14.0", digest: "sha256:f6e5d4c3b2a17890abcdef1234567890abcdef1234567890abcdef1234567890", size: "185 MB", arch: "amd64", os: "linux", created: "2026-02-19", layers: [{ size: "5 MB", bytes: 5 }, { size: "80 MB", bytes: 80 }, { size: "48 MB", bytes: 48 }, { size: "52 MB", bytes: 52 }] },
  { repo: "backend/api-server", tag: "latest", digest: "sha256:b2c3d4e5f6a77890abcdef1234567890abcdef1234567890abcdef1234567890", size: "214 MB", arch: "amd64", os: "linux", created: "2026-02-22", layers: [{ size: "5 MB", bytes: 5 }, { size: "78 MB", bytes: 78 }, { size: "62 MB", bytes: 62 }, { size: "41 MB", bytes: 41 }, { size: "28 MB", bytes: 28 }] },
  { repo: "backend/api-server", tag: "v5.1.0", digest: "sha256:7a6f5e4d3c2b7890abcdef1234567890abcdef1234567890abcdef1234567890", size: "210 MB", arch: "amd64", os: "linux", created: "2026-02-20", layers: [{ size: "5 MB", bytes: 5 }, { size: "78 MB", bytes: 78 }, { size: "60 MB", bytes: 60 }, { size: "40 MB", bytes: 40 }, { size: "27 MB", bytes: 27 }] },
  { repo: "infra/nginx-proxy", tag: "stable", digest: "sha256:c3d4e5f6a7b87890abcdef1234567890abcdef1234567890abcdef1234567890", size: "112 MB", arch: "amd64", os: "linux", created: "2026-02-15", layers: [{ size: "3 MB", bytes: 3 }, { size: "72 MB", bytes: 72 }, { size: "37 MB", bytes: 37 }] },
  { repo: "infra/nginx-proxy", tag: "1.25-alpine", digest: "sha256:8b7a6f5e4d3c7890abcdef1234567890abcdef1234567890abcdef1234567890", size: "42 MB", arch: "amd64", os: "linux", created: "2026-02-01", layers: [{ size: "3 MB", bytes: 3 }, { size: "28 MB", bytes: 28 }, { size: "11 MB", bytes: 11 }] },
  { repo: "data/postgres-backup", tag: "latest", digest: "sha256:d4e5f6a7b8c97890abcdef1234567890abcdef1234567890abcdef1234567890", size: "178 MB", arch: "amd64", os: "linux", created: "2026-02-18", layers: [{ size: "5 MB", bytes: 5 }, { size: "95 MB", bytes: 95 }, { size: "42 MB", bytes: 42 }, { size: "36 MB", bytes: 36 }] },
  { repo: "ml/model-serving", tag: "v1.3.0-gpu", digest: "sha256:e5f6a7b8c9d07890abcdef1234567890abcdef1234567890abcdef1234567890", size: "1.4 GB", arch: "amd64", os: "linux", created: "2026-02-20", layers: [{ size: "5 MB", bytes: 5 }, { size: "120 MB", bytes: 120 }, { size: "680 MB", bytes: 680 }, { size: "420 MB", bytes: 420 }, { size: "210 MB", bytes: 210 }] },
  { repo: "ml/model-serving", tag: "v1.3.0-cpu", digest: "sha256:0d9c8b7a6f5e7890abcdef1234567890abcdef1234567890abcdef1234567890", size: "820 MB", arch: "amd64", os: "linux", created: "2026-02-20", layers: [{ size: "5 MB", bytes: 5 }, { size: "120 MB", bytes: 120 }, { size: "480 MB", bytes: 480 }, { size: "215 MB", bytes: 215 }] },
  { repo: "tools/ci-runner", tag: "ubuntu-22.04", digest: "sha256:f6a7b8c9d0e17890abcdef1234567890abcdef1234567890abcdef1234567890", size: "245 MB", arch: "amd64", os: "linux", created: "2026-02-17", layers: [{ size: "5 MB", bytes: 5 }, { size: "72 MB", bytes: 72 }, { size: "88 MB", bytes: 88 }, { size: "52 MB", bytes: 52 }, { size: "28 MB", bytes: 28 }] },
  { repo: "tools/ci-runner", tag: "alpine-3.19", digest: "sha256:1e0d9c8b7a6f7890abcdef1234567890abcdef1234567890abcdef1234567890", size: "89 MB", arch: "amd64", os: "linux", created: "2026-02-12", layers: [{ size: "3 MB", bytes: 3 }, { size: "48 MB", bytes: 48 }, { size: "38 MB", bytes: 38 }] },
  { repo: "frontend/storybook", tag: "latest", digest: "sha256:a7b8c9d0e1f27890abcdef1234567890abcdef1234567890abcdef1234567890", size: "198 MB", arch: "amd64", os: "linux", created: "2026-02-14", layers: [{ size: "5 MB", bytes: 5 }, { size: "82 MB", bytes: 82 }, { size: "64 MB", bytes: 64 }, { size: "47 MB", bytes: 47 }] },
  { repo: "infra/redis-cluster", tag: "7.2-alpine", digest: "sha256:b8c9d0e1f2a37890abcdef1234567890abcdef1234567890abcdef1234567890", size: "34 MB", arch: "amd64", os: "linux", created: "2026-02-11", layers: [{ size: "3 MB", bytes: 3 }, { size: "22 MB", bytes: 22 }, { size: "9 MB", bytes: 9 }] },
  { repo: "infra/redis-cluster", tag: "7.2", digest: "sha256:3a2f1e0d9c8b7890abcdef1234567890abcdef1234567890abcdef1234567890", size: "98 MB", arch: "amd64", os: "linux", created: "2026-02-08", layers: [{ size: "5 MB", bytes: 5 }, { size: "58 MB", bytes: 58 }, { size: "35 MB", bytes: 35 }] },
  { repo: "backend/api-server", tag: "v5.0.2", digest: "sha256:2b3c4d5e6f7a7890abcdef1234567890abcdef1234567890abcdef1234567890", size: "208 MB", arch: "arm64", os: "linux", created: "2026-02-14", layers: [{ size: "5 MB", bytes: 5 }, { size: "76 MB", bytes: 76 }, { size: "59 MB", bytes: 59 }, { size: "40 MB", bytes: 40 }, { size: "28 MB", bytes: 28 }] },
];

const cves: CVE[] = [
  { id: "CVE-2026-0142", severity: "critical", description: "Remote code execution via crafted HTTP/2 request in OpenSSL 3.1.x", fixAvailable: true, affectedImages: ["backend/api-server:latest", "backend/api-server:v5.1.0"], packages: ["openssl 3.1.4"] },
  { id: "CVE-2026-0198", severity: "critical", description: "Heap buffer overflow in glibc DNS resolver affecting all linked binaries", fixAvailable: false, affectedImages: ["ml/model-serving:v1.3.0-gpu", "ml/model-serving:v1.3.0-cpu", "tools/ci-runner:ubuntu-22.04"], packages: ["glibc 2.35"] },
  { id: "CVE-2025-4891", severity: "high", description: "Privilege escalation through container runtime symlink race condition", fixAvailable: true, affectedImages: ["tools/ci-runner:ubuntu-22.04", "tools/ci-runner:alpine-3.19"], packages: ["runc 1.1.9"] },
  { id: "CVE-2025-4720", severity: "high", description: "Server-side request forgery in Node.js undici HTTP client", fixAvailable: true, affectedImages: ["frontend/web-app:latest", "frontend/web-app:v2.14.0", "frontend/storybook:latest"], packages: ["undici 5.28.2"] },
  { id: "CVE-2026-0055", severity: "high", description: "Authentication bypass in PostgreSQL libpq trust authentication fallback", fixAvailable: true, affectedImages: ["data/postgres-backup:latest"], packages: ["libpq 15.4"] },
  { id: "CVE-2025-4502", severity: "medium", description: "Denial of service via malformed YAML input in PyYAML C loader", fixAvailable: true, affectedImages: ["ml/model-serving:v1.3.0-gpu", "ml/model-serving:v1.3.0-cpu"], packages: ["pyyaml 6.0.1"] },
  { id: "CVE-2025-4388", severity: "medium", description: "Information disclosure through timing side-channel in bcrypt comparison", fixAvailable: false, affectedImages: ["backend/api-server:latest"], packages: ["bcrypt 5.1.0"] },
  { id: "CVE-2025-3991", severity: "medium", description: "Cross-site scripting via improper sanitization in markdown renderer", fixAvailable: true, affectedImages: ["frontend/web-app:latest", "frontend/storybook:latest"], packages: ["marked 9.1.2"] },
  { id: "CVE-2025-3650", severity: "low", description: "Minor information leak in nginx error page default configuration", fixAvailable: true, affectedImages: ["infra/nginx-proxy:stable", "infra/nginx-proxy:1.25-alpine"], packages: ["nginx 1.25.3"] },
  { id: "CVE-2025-3201", severity: "low", description: "Cosmetic log injection through unescaped user-agent header in access logs", fixAvailable: false, affectedImages: ["infra/nginx-proxy:stable"], packages: ["nginx 1.25.3"] },
  { id: "CVE-2025-2980", severity: "low", description: "Resource exhaustion via unbounded regex in email validation library", fixAvailable: true, affectedImages: ["backend/api-server:latest", "backend/api-server:v5.1.0"], packages: ["validator 13.11.0"] },
];

const severityColor: Record<CVE["severity"], string> = {
  critical: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  high: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  medium: "text-yellow-300 bg-yellow-300/10 border-yellow-300/30",
  low: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/30",
};

const severityRingColor: Record<CVE["severity"], string> = {
  critical: "border-rose-400",
  high: "border-amber-400",
  medium: "border-yellow-300",
  low: "border-[var(--color-surface-3)]",
};

function SeverityDonut({ counts }: { counts: { critical: number; high: number; medium: number; low: number } }) {
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const segments: { severity: CVE["severity"]; count: number; deg: number }[] = [];
  let accumulated = 0;
  for (const sev of ["critical", "high", "medium", "low"] as CVE["severity"][]) {
    const deg = total > 0 ? (counts[sev] / total) * 360 : 0;
    segments.push({ severity: sev, count: counts[sev], deg });
    accumulated += deg;
  }

  const gradientStops: string[] = [];
  let offset = 0;
  const colorMap: Record<string, string> = { critical: "#fb7185", high: "#fbbf24", medium: "#fde047", low: "#71717a" };
  for (const seg of segments) {
    if (seg.count === 0) {continue;}
    gradientStops.push(`${colorMap[seg.severity]} ${offset}deg ${offset + seg.deg}deg`);
    offset += seg.deg;
  }
  const gradient = gradientStops.length > 0
    ? `conic-gradient(${gradientStops.join(", ")})`
    : "conic-gradient(#27272a 0deg 360deg)";

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <div
          className="w-32 h-32 rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-3 rounded-full bg-[var(--color-surface-1)] flex items-center justify-center">
          <span className="text-2xl font-bold text-[var(--color-text-primary)]">{total}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {(["critical", "high", "medium", "low"] as CVE["severity"][]).map((sev) => (
          <div key={sev} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", severityRingColor[sev], "border-2 bg-transparent")} />
            <span className="text-sm text-[var(--color-text-secondary)] capitalize w-16">{sev}</span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{counts[sev]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RepositoriesTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">
        <span>Repository</span><span>Visibility</span><span>Images</span><span>Size</span><span>Last Push</span><span>Pulls</span>
      </div>
      {repos.map((r) => (
        <div key={r.name}>
          <button
            onClick={() => setExpanded(expanded === r.name ? null : r.name)}
            className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-border)] transition-colors text-left items-center"
          >
            <span className="text-[var(--color-text-primary)] font-medium text-sm">{r.name}</span>
            <span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full border", r.visibility === "public" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-[var(--color-text-secondary)] border-[var(--color-surface-3)] bg-[var(--color-surface-2)]")}>
                {r.visibility}
              </span>
            </span>
            <span className="text-[var(--color-text-primary)] text-sm">{r.imageCount}</span>
            <span className="text-[var(--color-text-primary)] text-sm">{r.totalSize}</span>
            <span className="text-[var(--color-text-secondary)] text-sm">{r.lastPush}</span>
            <span className="text-[var(--color-text-primary)] text-sm">{r.pulls.toLocaleString()}</span>
          </button>
          {expanded === r.name && (
            <div className="ml-8 mt-1 mb-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-0)] overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_2fr_1fr] gap-4 px-4 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium border-b border-[var(--color-border)]">
                <span>Tag</span><span>Size</span><span>Digest</span><span>Pushed</span>
              </div>
              {r.tags.map((t) => (
                <div key={t.tag} className="grid grid-cols-[1fr_1fr_2fr_1fr] gap-4 px-4 py-2.5 border-b border-[var(--color-border)]/50 last:border-0">
                  <span className="text-primary text-sm font-mono">{t.tag}</span>
                  <span className="text-[var(--color-text-primary)] text-sm">{t.size}</span>
                  <span className="text-[var(--color-text-muted)] text-xs font-mono truncate">{t.digest}</span>
                  <span className="text-[var(--color-text-secondary)] text-sm">{t.pushedAt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ImagesTab() {
  const [repoFilter, setRepoFilter] = useState<string>("all");
  const [layerView, setLayerView] = useState<string | null>(null);
  const repoNames = Array.from(new Set(images.map((i) => i.repo)));
  const filtered = repoFilter === "all" ? images : images.filter((i) => i.repo === repoFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--color-text-secondary)]">Filter by repo:</label>
        <select
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-1.5 outline-none focus:border-primary"
        >
          <option value="all">All repositories</option>
          {repoNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium bg-[var(--color-surface-1)] border-b border-[var(--color-border)]">
          <span>Image</span><span>Size</span><span>Arch</span><span>OS</span><span>Created</span><span>Layers</span>
        </div>
        {filtered.map((img) => {
          const key = `${img.repo}:${img.tag}`;
          return (
            <React.Fragment key={key}>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-b border-[var(--color-border)]/50 items-center hover:bg-[var(--color-surface-1)]/50">
                <div>
                  <div className="text-[var(--color-text-primary)] text-sm font-medium">{key}</div>
                  <div className="text-[var(--color-text-muted)] text-xs font-mono truncate mt-0.5">{img.digest}</div>
                </div>
                <span className="text-[var(--color-text-primary)] text-sm">{img.size}</span>
                <span className="text-[var(--color-text-primary)] text-sm font-mono">{img.arch}</span>
                <span className="text-[var(--color-text-primary)] text-sm">{img.os}</span>
                <span className="text-[var(--color-text-secondary)] text-sm">{img.created}</span>
                <button
                  onClick={() => setLayerView(layerView === key ? null : key)}
                  className="text-primary text-sm hover:text-indigo-300 text-left"
                >
                  {img.layers.length} layers
                </button>
              </div>
              {layerView === key && (
                <div className="px-4 py-3 bg-[var(--color-surface-0)] border-b border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Layer Stack</div>
                  <div className="flex flex-col gap-1">
                    {img.layers.map((layer, idx) => {
                      const maxBytes = Math.max(...img.layers.map((l) => l.bytes));
                      const pct = maxBytes > 0 ? (layer.bytes / maxBytes) * 100 : 0;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-muted)] w-6 text-right">{idx}</span>
                          <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--color-text-secondary)] w-16 text-right">{layer.size}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function VulnerabilitiesTab() {
  const [expandedCve, setExpandedCve] = useState<string | null>(null);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of cves) {counts[c.severity]++;}

  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">Severity Breakdown</h3>
        <SeverityDonut counts={counts} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">All Vulnerabilities</h3>
        {cves.map((c) => (
          <div key={c.id} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedCve(expandedCve === c.id ? null : c.id)}
              className="w-full flex items-center gap-4 px-4 py-3 bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-1)]/80 transition-colors text-left"
            >
              <span className={cn("text-xs px-2 py-0.5 rounded border font-medium uppercase", severityColor[c.severity])}>
                {c.severity}
              </span>
              <span className="text-[var(--color-text-primary)] text-sm font-mono font-medium">{c.id}</span>
              <span className="text-[var(--color-text-secondary)] text-sm flex-1 truncate">{c.description}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded", c.fixAvailable ? "text-emerald-400 bg-emerald-400/10" : "text-[var(--color-text-muted)] bg-[var(--color-surface-2)]")}>
                {c.fixAvailable ? "fix available" : "no fix"}
              </span>
            </button>
            {expandedCve === c.id && (
              <div className="px-4 py-4 bg-[var(--color-surface-0)] border-t border-[var(--color-border)] space-y-3">
                <p className="text-sm text-[var(--color-text-primary)]">{c.description}</p>
                <div>
                  <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Affected Packages</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {c.packages.map((p) => (
                      <span key={p} className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Affected Images</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {c.affectedImages.map((img) => (
                      <span key={img} className="text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">{img}</span>
                    ))}
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

function SettingsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">Registry Configuration</h3>
        <div className="grid grid-cols-[1fr_2fr] gap-y-3 gap-x-6 text-sm">
          <span className="text-[var(--color-text-muted)]">Primary Mirror</span>
          <span className="text-[var(--color-text-primary)] font-mono">https://registry.internal.acme.io</span>
          <span className="text-[var(--color-text-muted)]">Secondary Mirror</span>
          <span className="text-[var(--color-text-primary)] font-mono">https://registry-us-west.acme.io</span>
          <span className="text-[var(--color-text-muted)]">Upstream Proxy</span>
          <span className="text-[var(--color-text-primary)] font-mono">https://registry-1.docker.io</span>
          <span className="text-[var(--color-text-muted)]">GC Schedule</span>
          <span className="text-[var(--color-text-primary)] font-mono">0 3 * * 0 (Sundays at 03:00 UTC)</span>
          <span className="text-[var(--color-text-muted)]">GC Policy</span>
          <span className="text-[var(--color-text-primary)]">Delete untagged manifests older than 30 days</span>
          <span className="text-[var(--color-text-muted)]">Storage Quota</span>
          <div className="space-y-1">
            <span className="text-[var(--color-text-primary)]">28.9 GB / 50 GB</span>
            <div className="w-full h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "57.8%" }} />
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">57.8% used</span>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">Credentials</h3>
        <div className="grid grid-cols-[1fr_2fr] gap-y-3 gap-x-6 text-sm">
          <span className="text-[var(--color-text-muted)]">Push Token</span>
          <span className="text-[var(--color-text-primary)] font-mono">oci_pat_••••••••••••••••••••a4f8</span>
          <span className="text-[var(--color-text-muted)]">Pull Token</span>
          <span className="text-[var(--color-text-primary)] font-mono">oci_read_••••••••••••••••••••7b2e</span>
          <span className="text-[var(--color-text-muted)]">Robot Account</span>
          <span className="text-[var(--color-text-primary)] font-mono">robot$acme-ci-pipeline</span>
          <span className="text-[var(--color-text-muted)]">Token Expiry</span>
          <span className="text-amber-400">2026-04-15 (52 days remaining)</span>
        </div>
      </div>

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">Webhooks</h3>
        <div className="space-y-3">
          {[
            { url: "https://ci.acme.io/hooks/registry-push", events: ["push", "tag"], status: "active" },
            { url: "https://slack.acme.io/webhooks/registry-alerts", events: ["push", "vulnerability_scan"], status: "active" },
            { url: "https://deploy.acme.io/api/trigger", events: ["push"], status: "inactive" },
          ].map((wh) => (
            <div key={wh.url} className="flex items-center gap-4 p-3 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg">
              <span className={cn("w-2 h-2 rounded-full", wh.status === "active" ? "bg-emerald-400" : "bg-[var(--color-surface-3)]")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--color-text-primary)] font-mono truncate">{wh.url}</div>
                <div className="flex gap-2 mt-1">
                  {wh.events.map((e) => (
                    <span key={e} className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded">{e}</span>
                  ))}
                </div>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded capitalize", wh.status === "active" ? "text-emerald-400 bg-emerald-400/10" : "text-[var(--color-text-muted)] bg-[var(--color-surface-2)]")}>
                {wh.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ContainerRegistry() {
  const [tab, setTab] = useState<Tab>("repositories");

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Container Registry</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage repositories, images, and vulnerability scans</p>
        </div>

        <div className="flex gap-1 border-b border-[var(--color-border)] pb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors rounded-t-md border-b-2",
                tab === t.key
                  ? "text-primary border-primary bg-primary/5"
                  : "text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {tab === "repositories" && <RepositoriesTab />}
          {tab === "images" && <ImagesTab />}
          {tab === "vulnerabilities" && <VulnerabilitiesTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
