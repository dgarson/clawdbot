import React, { useState } from "react";
import { cn } from "../lib/utils";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type ThreatCategory = "malware" | "phishing" | "ransomware" | "apt" | "vulnerability" | "insider" | "ddos";
type IoC = { type: "ip" | "domain" | "hash" | "url" | "email"; value: string; confidence: number };

interface ThreatItem {
  id: string;
  title: string;
  severity: Severity;
  category: ThreatCategory;
  source: string;
  publishedAt: string;
  tlpLevel: "WHITE" | "GREEN" | "AMBER" | "RED";
  iocs: IoC[];
  affectedSystems: string[];
  description: string;
  mitreAttack: string[];
  cvss?: number;
  cveId?: string;
  status: "new" | "investigating" | "mitigated" | "closed";
  tags: string[];
}

interface ThreatActor {
  id: string;
  name: string;
  origin: string;
  motivation: string;
  activeSince: string;
  campaigns: number;
  techniques: string[];
  severity: Severity;
}

interface CVEItem {
  id: string;
  score: number;
  severity: Severity;
  product: string;
  vendor: string;
  published: string;
  patched: boolean;
  exploited: boolean;
  description: string;
  vector: string;
}

const THREATS: ThreatItem[] = [
  {
    id: "TI-2024-001",
    title: "APT-41 Targeting SaaS Authentication Providers via Supply Chain",
    severity: "critical",
    category: "apt",
    source: "CISA",
    publishedAt: "2026-02-22T04:15:00Z",
    tlpLevel: "AMBER",
    iocs: [
      { type: "ip", value: "185.220.101.47", confidence: 95 },
      { type: "domain", value: "auth-verify-cdn.com", confidence: 88 },
      { type: "hash", value: "a3f8d2c1e9b4567890abcdef12345678", confidence: 92 },
    ],
    affectedSystems: ["Identity Provider", "OAuth Gateway", "API Keys Manager"],
    description: "APT-41 (Winnti Group) has been observed targeting SaaS authentication providers through compromised CI/CD pipelines. Actors inject malicious OAuth flows to harvest tokens at scale.",
    mitreAttack: ["T1195.002", "T1078", "T1556"],
    status: "investigating",
    tags: ["supply-chain", "oauth", "token-theft"],
  },
  {
    id: "TI-2024-002",
    title: "Ransomware Campaign Targeting AI/ML Infrastructure",
    severity: "critical",
    category: "ransomware",
    source: "FBI IC3",
    publishedAt: "2026-02-21T18:30:00Z",
    tlpLevel: "GREEN",
    iocs: [
      { type: "ip", value: "91.108.4.155", confidence: 97 },
      { type: "hash", value: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9", confidence: 99 },
      { type: "url", value: "hxxps://exfil-drop[.]onion/upload", confidence: 85 },
    ],
    affectedSystems: ["Model Training Cluster", "Data Pipeline", "Storage"],
    description: "Novel ransomware variant 'NeuralLock' specifically targets GPU clusters and model checkpoints. Encrypts training data and demands payment in exchange for decryption keys.",
    mitreAttack: ["T1486", "T1041", "T1489"],
    cvss: 9.8,
    status: "new",
    tags: ["ransomware", "gpu-cluster", "ml-infra"],
  },
  {
    id: "TI-2024-003",
    title: "Phishing Campaign Spoofing OpenAI API Billing Notifications",
    severity: "high",
    category: "phishing",
    source: "Internal SOC",
    publishedAt: "2026-02-21T09:00:00Z",
    tlpLevel: "WHITE",
    iocs: [
      { type: "domain", value: "openai-billing-verify.net", confidence: 99 },
      { type: "email", value: "billing@openai-billing-verify.net", confidence: 99 },
      { type: "url", value: "hxxps://openai-billing-verify[.]net/confirm", confidence: 95 },
    ],
    affectedSystems: ["Email Gateway", "User Accounts"],
    description: "Mass phishing campaign sending convincing billing alerts that redirect to credential harvesting pages. 23 users in the org received targeted emails.",
    mitreAttack: ["T1566.001", "T1078"],
    status: "mitigated",
    tags: ["phishing", "credential-harvest", "api-keys"],
  },
  {
    id: "TI-2024-004",
    title: "CVE-2026-11247: Remote Code Execution in Node.js HTTP/2 Parser",
    severity: "high",
    category: "vulnerability",
    source: "NVD",
    publishedAt: "2026-02-20T12:00:00Z",
    tlpLevel: "WHITE",
    iocs: [],
    affectedSystems: ["API Gateway", "Web Server", "Node Services"],
    description: "A heap overflow vulnerability in the Node.js HTTP/2 parser allows unauthenticated remote code execution. All versions < 22.14.1 are affected.",
    mitreAttack: ["T1190"],
    cvss: 9.3,
    cveId: "CVE-2026-11247",
    status: "investigating",
    tags: ["rce", "nodejs", "http2"],
  },
  {
    id: "TI-2024-005",
    title: "DDoS Amplification via Exposed LLM Inference Endpoints",
    severity: "medium",
    category: "ddos",
    source: "Cloudflare Radar",
    publishedAt: "2026-02-19T16:45:00Z",
    tlpLevel: "GREEN",
    iocs: [
      { type: "ip", value: "192.0.2.45", confidence: 72 },
      { type: "ip", value: "203.0.113.12", confidence: 68 },
    ],
    affectedSystems: ["LLM Inference Cluster", "Rate Limiter"],
    description: "Attackers are abusing publicly exposed LLM inference endpoints as amplification vectors for DDoS attacks. Unauthenticated token streaming endpoints generate disproportionate response volumes.",
    mitreAttack: ["T1499"],
    status: "mitigated",
    tags: ["ddos", "amplification", "llm-endpoints"],
  },
  {
    id: "TI-2024-006",
    title: "Insider Threat: Anomalous Model Weight Exfiltration Detected",
    severity: "high",
    category: "insider",
    source: "UEBA",
    publishedAt: "2026-02-18T22:10:00Z",
    tlpLevel: "RED",
    iocs: [
      { type: "ip", value: "10.14.22.108", confidence: 90 },
    ],
    affectedSystems: ["Model Registry", "S3 Storage", "VPN"],
    description: "UEBA flagged an internal account downloading 47GB of fine-tuned model weights outside business hours. Access originated from an unusual geographic location via VPN.",
    mitreAttack: ["T1048", "T1078.004"],
    status: "investigating",
    tags: ["insider-threat", "exfiltration", "model-weights"],
  },
];

const THREAT_ACTORS: ThreatActor[] = [
  {
    id: "TA-041",
    name: "APT-41 (Winnti)",
    origin: "China",
    motivation: "Espionage + Financial",
    activeSince: "2012",
    campaigns: 47,
    techniques: ["Supply Chain", "Living off the Land", "Spear Phishing", "Zero-Day Exploitation"],
    severity: "critical",
  },
  {
    id: "TA-019",
    name: "Lazarus Group",
    origin: "North Korea",
    motivation: "Financial",
    activeSince: "2009",
    campaigns: 31,
    techniques: ["Watering Hole", "Spear Phishing", "Ransomware", "Crypto Theft"],
    severity: "critical",
  },
  {
    id: "TA-027",
    name: "Sandworm",
    origin: "Russia",
    motivation: "Disruption",
    activeSince: "2014",
    campaigns: 22,
    techniques: ["ICS Targeting", "Wiper Malware", "Supply Chain", "OT/IT Convergence"],
    severity: "high",
  },
  {
    id: "TA-033",
    name: "Scattered Spider",
    origin: "USA/UK",
    motivation: "Financial",
    activeSince: "2022",
    campaigns: 18,
    techniques: ["SIM Swapping", "Social Engineering", "MFA Bypass", "Cloud Pivoting"],
    severity: "high",
  },
];

const CVES: CVEItem[] = [
  { id: "CVE-2026-11247", score: 9.3, severity: "critical", product: "Node.js", vendor: "OpenJS", published: "2026-02-20", patched: false, exploited: true, description: "Heap overflow in HTTP/2 parser allows RCE", vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
  { id: "CVE-2026-9821", score: 8.8, severity: "high", product: "Vite", vendor: "Evan You", published: "2026-02-18", patched: true, exploited: false, description: "Path traversal in dev server config endpoint", vector: "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H" },
  { id: "CVE-2026-8107", score: 7.5, severity: "high", product: "Redis", vendor: "Redis Ltd", published: "2026-02-15", patched: true, exploited: false, description: "Authentication bypass via RESP3 protocol", vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N" },
  { id: "CVE-2026-6544", score: 6.5, severity: "medium", product: "pnpm", vendor: "pnpm team", published: "2026-02-12", patched: true, exploited: false, description: "Symlink attack during package installation", vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N" },
  { id: "CVE-2026-4432", score: 5.9, severity: "medium", product: "Tailwind CSS", vendor: "Tailwind Labs", published: "2026-02-10", patched: true, exploited: false, description: "XSS via unsafe class injection in JIT mode", vector: "AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N" },
];

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; dot: string }> = {
  critical: { label: "Critical", color: "text-rose-400 bg-rose-900/40 border-rose-800", dot: "bg-rose-400" },
  high:     { label: "High",     color: "text-orange-400 bg-orange-900/40 border-orange-800", dot: "bg-orange-400" },
  medium:   { label: "Medium",   color: "text-amber-400 bg-amber-900/40 border-amber-800", dot: "bg-amber-400" },
  low:      { label: "Low",      color: "text-emerald-400 bg-emerald-900/40 border-emerald-800", dot: "bg-emerald-400" },
  info:     { label: "Info",     color: "text-sky-400 bg-sky-900/40 border-sky-800", dot: "bg-sky-400" },
};

const TLP_CONFIG: Record<string, { label: string; color: string }> = {
  WHITE: { label: "TLP:WHITE", color: "text-white bg-zinc-700" },
  GREEN: { label: "TLP:GREEN", color: "text-emerald-300 bg-emerald-900/50" },
  AMBER: { label: "TLP:AMBER", color: "text-amber-300 bg-amber-900/50" },
  RED:   { label: "TLP:RED",   color: "text-rose-300 bg-rose-900/50" },
};

const CATEGORY_EMOJI: Record<ThreatCategory, string> = {
  malware: "🦠", phishing: "🎣", ransomware: "🔒", apt: "🕵️",
  vulnerability: "🔓", insider: "👤", ddos: "💥",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:           { label: "New",           color: "text-rose-400 bg-rose-900/30" },
  investigating: { label: "Investigating", color: "text-amber-400 bg-amber-900/30" },
  mitigated:     { label: "Mitigated",     color: "text-emerald-400 bg-emerald-900/30" },
  closed:        { label: "Closed",        color: "text-zinc-400 bg-zinc-800" },
};

type Tab = "feed" | "actors" | "cves" | "iocs";

export default function ThreatIntelligenceFeed() {
  const [tab, setTab] = useState<Tab>("feed");
  const [selectedThreat, setSelectedThreat] = useState<ThreatItem | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ThreatCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreats = THREATS.filter(t => {
    if (severityFilter !== "all" && t.severity !== severityFilter) {return false;}
    if (categoryFilter !== "all" && t.category !== categoryFilter) {return false;}
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.id.toLowerCase().includes(searchQuery.toLowerCase())) {return false;}
    return true;
  });

  const criticalCount = THREATS.filter(t => t.severity === "critical").length;
  const newCount = THREATS.filter(t => t.status === "new").length;
  const openCVEs = CVES.filter(c => !c.patched).length;
  const exploitedCVEs = CVES.filter(c => c.exploited).length;

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "feed",   label: "Threat Feed",    emoji: "📡" },
    { id: "actors", label: "Threat Actors",  emoji: "🕵️" },
    { id: "cves",   label: "CVEs",           emoji: "🔓" },
    { id: "iocs",   label: "IOC Search",     emoji: "🔍" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Threat Intelligence Feed</h1>
            <p className="text-zinc-400 text-sm mt-1">Live threat intelligence aggregated from CISA, FBI IC3, Cloudflare, and internal SOC</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-400">Live Feed Active</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "Critical Threats", value: criticalCount, color: "text-rose-400", bg: "bg-rose-900/20 border-rose-900" },
            { label: "New Alerts", value: newCount, color: "text-amber-400", bg: "bg-amber-900/20 border-amber-900" },
            { label: "Open CVEs", value: openCVEs, color: "text-orange-400", bg: "bg-orange-900/20 border-orange-900" },
            { label: "Exploited In Wild", value: exploitedCVEs, color: "text-rose-300", bg: "bg-rose-900/20 border-rose-900" },
          ].map(stat => (
            <div key={stat.label} className={cn("rounded-lg border p-3", stat.bg)}>
              <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800 pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              tab === t.id
                ? "text-white bg-zinc-800 border border-b-0 border-zinc-700"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Feed Tab */}
      {tab === "feed" && (
        <div className="flex gap-4">
          {/* Sidebar filters */}
          <div className="w-56 shrink-0 space-y-4">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Severity</div>
              <div className="space-y-1">
                {(["all", "critical", "high", "medium", "low"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors",
                      severityFilter === s ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    )}
                  >
                    {s !== "all" && <div className={cn("w-2 h-2 rounded-full", SEVERITY_CONFIG[s].dot)} />}
                    {s === "all" ? "All Severities" : SEVERITY_CONFIG[s].label}
                    <span className="ml-auto text-xs text-zinc-600">
                      {s === "all" ? THREATS.length : THREATS.filter(t => t.severity === s).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Category</div>
              <div className="space-y-1">
                {(["all", "apt", "ransomware", "phishing", "vulnerability", "ddos", "insider"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors",
                      categoryFilter === c ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    )}
                  >
                    {c !== "all" && CATEGORY_EMOJI[c]}
                    {c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main feed */}
          <div className="flex-1">
            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 Search threats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-3">
              {filteredThreats.map(threat => (
                <div
                  key={threat.id}
                  onClick={() => setSelectedThreat(selectedThreat?.id === threat.id ? null : threat)}
                  className={cn(
                    "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedThreat?.id === threat.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-zinc-500">{threat.id}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", SEVERITY_CONFIG[threat.severity].color)}>
                          {SEVERITY_CONFIG[threat.severity].label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {CATEGORY_EMOJI[threat.category]} {threat.category.toUpperCase()}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded", TLP_CONFIG[threat.tlpLevel].color)}>
                          {TLP_CONFIG[threat.tlpLevel].label}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded ml-auto", STATUS_CONFIG[threat.status].color)}>
                          {STATUS_CONFIG[threat.status].label}
                        </span>
                      </div>
                      <div className="font-medium text-white text-sm">{threat.title}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {threat.source} · {new Date(threat.publishedAt).toLocaleString()} · {threat.iocs.length} IOCs
                      </div>
                    </div>
                  </div>

                  {selectedThreat?.id === threat.id && (
                    <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4" onClick={e => e.stopPropagation()}>
                      <p className="text-sm text-zinc-300">{threat.description}</p>

                      {/* IOCs */}
                      {threat.iocs.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Indicators of Compromise</div>
                          <div className="space-y-1">
                            {threat.iocs.map((ioc, i) => (
                              <div key={i} className="flex items-center gap-3 bg-zinc-950 rounded px-3 py-2">
                                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono w-16 text-center">
                                  {ioc.type.toUpperCase()}
                                </span>
                                <span className="font-mono text-sm text-amber-300 flex-1">{ioc.value}</span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${ioc.confidence}%` }} />
                                  </div>
                                  <span className="text-xs text-zinc-500">{ioc.confidence}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MITRE ATT&CK */}
                      <div>
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">MITRE ATT&CK Techniques</div>
                        <div className="flex flex-wrap gap-2">
                          {threat.mitreAttack.map(t => (
                            <span key={t} className="text-xs px-2 py-1 rounded bg-indigo-900/40 border border-indigo-800 text-indigo-300 font-mono">{t}</span>
                          ))}
                        </div>
                      </div>

                      {/* Affected systems + tags */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Affected Systems</div>
                          <div className="flex flex-wrap gap-1">
                            {threat.affectedSystems.map(s => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Tags</div>
                          <div className="flex flex-wrap gap-1">
                            {threat.tags.map(tag => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* CVSS */}
                      {threat.cvss && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">CVSS Score:</span>
                          <span className={cn("text-lg font-bold", threat.cvss >= 9 ? "text-rose-400" : threat.cvss >= 7 ? "text-orange-400" : "text-amber-400")}>
                            {threat.cvss}
                          </span>
                          {threat.cveId && <span className="text-xs font-mono text-sky-400">{threat.cveId}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Threat Actors Tab */}
      {tab === "actors" && (
        <div className="grid grid-cols-2 gap-4">
          {THREAT_ACTORS.map(actor => (
            <div key={actor.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-zinc-500">{actor.id}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded border", SEVERITY_CONFIG[actor.severity].color)}>
                      {SEVERITY_CONFIG[actor.severity].label}
                    </span>
                  </div>
                  <div className="font-semibold text-white text-lg">{actor.name}</div>
                </div>
                <div className="text-2xl">🕵️</div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Origin", value: actor.origin },
                  { label: "Active Since", value: actor.activeSince },
                  { label: "Campaigns", value: actor.campaigns.toString() },
                ].map(item => (
                  <div key={item.label} className="bg-zinc-950 rounded p-2 text-center">
                    <div className="text-xs text-zinc-500 mb-1">{item.label}</div>
                    <div className="text-sm font-medium text-white">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <div className="text-xs text-zinc-500 mb-1">Motivation</div>
                <div className="text-sm text-amber-300">{actor.motivation}</div>
              </div>

              <div>
                <div className="text-xs text-zinc-500 mb-2">Known Techniques</div>
                <div className="flex flex-wrap gap-1">
                  {actor.techniques.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CVEs Tab */}
      {tab === "cves" && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Total Tracked", value: CVES.length, color: "text-white" },
              { label: "Unpatched", value: openCVEs, color: "text-rose-400" },
              { label: "Exploited in Wild", value: exploitedCVEs, color: "text-orange-400" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
                <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
                <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["CVE ID", "Product", "Score", "Severity", "Exploited", "Patched", "Published"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CVES.map(cve => (
                  <tr key={cve.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-sky-400 text-xs">{cve.id}</td>
                    <td className="px-4 py-3 text-zinc-300">{cve.product} <span className="text-zinc-600 text-xs">({cve.vendor})</span></td>
                    <td className="px-4 py-3">
                      <span className={cn("font-bold", cve.score >= 9 ? "text-rose-400" : cve.score >= 7 ? "text-orange-400" : "text-amber-400")}>
                        {cve.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded border", SEVERITY_CONFIG[cve.severity].color)}>
                        {SEVERITY_CONFIG[cve.severity].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cve.exploited
                        ? <span className="text-xs text-rose-400 font-medium">⚠️ Yes</span>
                        : <span className="text-xs text-zinc-500">No</span>}
                    </td>
                    <td className="px-4 py-3">
                      {cve.patched
                        ? <span className="text-xs text-emerald-400">✅ Patched</span>
                        : <span className="text-xs text-rose-400">❌ Unpatched</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{cve.published}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CVE detail for exploited one */}
          <div className="mt-4 bg-rose-900/20 border border-rose-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-rose-400 font-semibold text-sm">⚠️ Priority: Actively Exploited CVE</span>
            </div>
            <div className="font-mono text-sky-400 font-bold">CVE-2026-11247</div>
            <div className="text-sm text-zinc-300 mt-1">{CVES[0].description}</div>
            <div className="font-mono text-xs text-zinc-500 mt-2">Vector: {CVES[0].vector}</div>
            <div className="mt-3 text-sm text-zinc-400">
              <strong className="text-zinc-200">Remediation:</strong> Upgrade Node.js to v22.14.1 or later. Apply available patches immediately. Monitor for unusual HTTP/2 traffic patterns.
            </div>
          </div>
        </div>
      )}

      {/* IOC Search Tab */}
      {tab === "iocs" && (
        <div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-zinc-300 mb-3">Search IOC Database</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter IP, domain, hash, URL, or email..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">
                🔍 Search
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold text-zinc-300">
              All Known IOCs ({THREATS.flatMap(t => t.iocs).length})
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Type", "Value", "Source", "Threat", "Confidence", "Severity"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {THREATS.flatMap(threat =>
                  threat.iocs.map((ioc, i) => (
                    <tr key={`${threat.id}-${i}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{ioc.type.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-amber-300 max-w-48 truncate">{ioc.value}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{threat.source}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400 max-w-40 truncate">{threat.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", ioc.confidence >= 90 ? "bg-emerald-500" : ioc.confidence >= 70 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${ioc.confidence}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500">{ioc.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded border", SEVERITY_CONFIG[threat.severity].color)}>
                          {SEVERITY_CONFIG[threat.severity].label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
