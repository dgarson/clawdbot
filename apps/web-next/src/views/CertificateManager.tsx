import React, { useState } from "react";
import { cn } from "../lib/utils";

type CertStatus = "valid" | "expiring" | "expired" | "pending" | "revoked";
type CertType = "tls" | "code_signing" | "client" | "ca" | "wildcard";
type KeyAlgorithm = "RSA-2048" | "RSA-4096" | "ECDSA-256" | "ECDSA-384";

interface Certificate {
  id: string;
  commonName: string;
  sans: string[];
  type: CertType;
  issuer: string;
  status: CertStatus;
  algorithm: KeyAlgorithm;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
  autoRenew: boolean;
  domain: string;
  environment: "production" | "staging" | "development";
}

interface CsrRequest {
  id: string;
  commonName: string;
  organization: string;
  country: string;
  state: string;
  locality: string;
  status: "pending" | "signed" | "rejected";
  createdAt: string;
}

interface CertAuditEntry {
  id: string;
  action: "issued" | "renewed" | "revoked" | "imported" | "exported";
  certId: string;
  certName: string;
  actor: string;
  timestamp: string;
}

function daysUntilExpiry(dateStr: string): number {
  const now = new Date("2026-02-22");
  const exp = new Date(dateStr);
  return Math.floor((exp.getTime() - now.getTime()) / 86400000);
}

const CERTIFICATES: Certificate[] = [
  {
    id: "c1", commonName: "*.openclaw.io", sans: ["openclaw.io", "*.openclaw.io", "api.openclaw.io"],
    type: "wildcard", issuer: "Let's Encrypt Authority X3", status: "valid",
    algorithm: "ECDSA-256", validFrom: "2025-12-01", validTo: "2026-03-01",
    serialNumber: "04:B2:1A:8C:3D", fingerprint: "SHA256:a4b2c8d1e9f0a1b2c3d4e5f6",
    autoRenew: true, domain: "openclaw.io", environment: "production",
  },
  {
    id: "c2", commonName: "app.openclaw.io", sans: ["app.openclaw.io"],
    type: "tls", issuer: "DigiCert TLS Hybrid ECC SHA384 2020 CA1", status: "expiring",
    algorithm: "ECDSA-384", validFrom: "2025-03-10", validTo: "2026-03-10",
    serialNumber: "07:C3:2B:9D:4E", fingerprint: "SHA256:b5c3d9e2f0a2b3c4d5e6f7a8",
    autoRenew: false, domain: "openclaw.io", environment: "production",
  },
  {
    id: "c3", commonName: "staging.openclaw.io", sans: ["staging.openclaw.io", "api-staging.openclaw.io"],
    type: "tls", issuer: "Let's Encrypt Authority X3", status: "valid",
    algorithm: "RSA-2048", validFrom: "2026-01-15", validTo: "2026-04-15",
    serialNumber: "0A:D4:3C:AE:5F", fingerprint: "SHA256:c6d4e0f3a1b4c5d6e7f8a9b0",
    autoRenew: true, domain: "openclaw.io", environment: "staging",
  },
  {
    id: "c4", commonName: "internal-ca.openclaw.io", sans: [],
    type: "ca", issuer: "OpenClaw Internal CA", status: "valid",
    algorithm: "RSA-4096", validFrom: "2024-01-01", validTo: "2029-01-01",
    serialNumber: "00:01:00:00:01", fingerprint: "SHA256:d7e5f1a4b2c5d6e7f8a9b0c1",
    autoRenew: false, domain: "openclaw.io", environment: "production",
  },
  {
    id: "c5", commonName: "api.openclaw.io", sans: ["api.openclaw.io"],
    type: "tls", issuer: "Amazon Root CA 1", status: "valid",
    algorithm: "ECDSA-256", validFrom: "2025-09-01", validTo: "2026-09-01",
    serialNumber: "0E:F5:4D:BF:6A", fingerprint: "SHA256:e8f6a2b5c3d6e7f8a9b0c1d2",
    autoRenew: true, domain: "openclaw.io", environment: "production",
  },
  {
    id: "c6", commonName: "legacy-api.openclaw.io", sans: ["legacy-api.openclaw.io"],
    type: "tls", issuer: "GlobalSign Atlas R3 DV TLS CA 2022 Q4", status: "expired",
    algorithm: "RSA-2048", validFrom: "2025-01-01", validTo: "2026-01-01",
    serialNumber: "12:A6:5E:C0:7B", fingerprint: "SHA256:f9a7b3c6d4e7f8a9b0c1d2e3",
    autoRenew: false, domain: "openclaw.io", environment: "production",
  },
  {
    id: "c7", commonName: "deploy.openclaw.io", sans: ["deploy.openclaw.io"],
    type: "code_signing", issuer: "DigiCert EV Code Signing CA", status: "valid",
    algorithm: "RSA-4096", validFrom: "2024-06-01", validTo: "2027-06-01",
    serialNumber: "15:B7:6F:D1:8C", fingerprint: "SHA256:a0b8c4d7e5f8a9b0c1d2e3f4",
    autoRenew: false, domain: "openclaw.io", environment: "production",
  },
];

const CSR_REQUESTS: CsrRequest[] = [
  {
    id: "csr1", commonName: "payments.openclaw.io", organization: "OpenClaw Inc.",
    country: "US", state: "California", locality: "San Francisco",
    status: "pending", createdAt: "2026-02-22",
  },
  {
    id: "csr2", commonName: "ws.openclaw.io", organization: "OpenClaw Inc.",
    country: "US", state: "California", locality: "San Francisco",
    status: "signed", createdAt: "2026-02-15",
  },
];

const AUDIT_LOG: CertAuditEntry[] = [
  { id: "a1", action: "renewed", certId: "c1", certName: "*.openclaw.io", actor: "system (auto-renew)", timestamp: "2025-12-01T03:00:00Z" },
  { id: "a2", action: "issued", certId: "c7", certName: "deploy.openclaw.io", actor: "admin@openclaw.io", timestamp: "2024-06-01T10:00:00Z" },
  { id: "a3", action: "exported", certId: "c4", certName: "internal-ca.openclaw.io", actor: "devops@openclaw.io", timestamp: "2026-02-10T14:30:00Z" },
  { id: "a4", action: "revoked", certId: "c6", certName: "legacy-api.openclaw.io", actor: "admin@openclaw.io", timestamp: "2026-01-05T09:00:00Z" },
  { id: "a5", action: "imported", certId: "c5", certName: "api.openclaw.io", actor: "platform@openclaw.io", timestamp: "2025-09-01T11:15:00Z" },
];

const TABS = ["Certificates", "CSR", "Audit", "Settings"] as const;
type Tab = typeof TABS[number];

const statusColor: Record<CertStatus, string> = {
  valid:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  expiring: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  expired:  "text-rose-400 bg-rose-400/10 border-rose-400/30",
  pending:  "text-blue-400 bg-blue-400/10 border-blue-400/30",
  revoked:  "text-zinc-400 bg-zinc-400/10 border-zinc-400/30",
};

const typeColor: Record<CertType, string> = {
  tls:          "text-indigo-400",
  wildcard:     "text-purple-400",
  code_signing: "text-amber-400",
  client:       "text-blue-400",
  ca:           "text-rose-400",
};

const actionColor: Record<CertAuditEntry["action"], string> = {
  issued:   "text-emerald-400",
  renewed:  "text-indigo-400",
  revoked:  "text-rose-400",
  imported: "text-amber-400",
  exported: "text-zinc-400",
};

export default function CertificateManager(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Certificates");
  const [selectedCert, setSelectedCert] = useState<Certificate>(CERTIFICATES[0]);
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<CertStatus | "all">("all");

  const filteredCerts = CERTIFICATES.filter((c) => {
    if (envFilter !== "all" && c.environment !== envFilter) {return false;}
    if (statusFilter !== "all" && c.status !== statusFilter) {return false;}
    return true;
  });

  const expiringCount = CERTIFICATES.filter(c => c.status === "expiring").length;
  const expiredCount = CERTIFICATES.filter(c => c.status === "expired").length;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Certificate Manager</h1>
          <p className="text-xs text-zinc-400 mt-0.5">TLS/SSL certificate lifecycle management, CSR generation, and renewal automation</p>
        </div>
        <div className="flex items-center gap-3">
          {expiringCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400">⚠ {expiringCount} expiring</span>
          )}
          {expiredCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-rose-400/10 border border-rose-400/30 text-rose-400">✗ {expiredCount} expired</span>
          )}
          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">
            + Import Cert
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-zinc-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-indigo-400 border-indigo-500"
                : "text-zinc-400 border-transparent hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── CERTIFICATES ── */}
        {tab === "Certificates" && (
          <div className="h-full flex">
            <div className="w-72 border-r border-zinc-800 flex flex-col">
              <div className="p-3 space-y-2 border-b border-zinc-800">
                <div className="flex flex-wrap gap-1">
                  {(["all", "valid", "expiring", "expired", "revoked"] as const).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={cn("px-2 py-0.5 text-[10px] rounded border transition-colors",
                        statusFilter === s ? "bg-indigo-600/20 border-indigo-500 text-indigo-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                      )}>{s}</button>
                  ))}
                </div>
                <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none">
                  <option value="all">All environments</option>
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
                {filteredCerts.map((cert) => {
                  const days = daysUntilExpiry(cert.validTo);
                  return (
                    <button key={cert.id} onClick={() => setSelectedCert(cert)}
                      className={cn("w-full text-left px-4 py-3 transition-colors",
                        selectedCert.id === cert.id ? "bg-indigo-600/10" : "hover:bg-zinc-800/40"
                      )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white truncate max-w-[130px]">{cert.commonName}</span>
                        <span className={cn("text-[10px] px-1 py-0.5 rounded border shrink-0", statusColor[cert.status])}>{cert.status}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className={typeColor[cert.type]}>{cert.type.replace("_", " ")}</span>
                        <span>{cert.environment}</span>
                      </div>
                      {(cert.status === "expiring" || cert.status === "expired") && (
                        <div className={cn("text-[10px] mt-1", days < 0 ? "text-rose-400" : "text-amber-400")}>
                          {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold font-mono">{selectedCert.commonName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs", typeColor[selectedCert.type])}>{selectedCert.type.replace("_", " ")}</span>
                    <span className="text-xs text-zinc-500">{selectedCert.environment}</span>
                    <span className="text-xs text-zinc-500">{selectedCert.algorithm}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded border", statusColor[selectedCert.status])}>{selectedCert.status}</span>
                  <button className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-600 rounded-md transition-colors">Renew</button>
                  <button className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-600 rounded-md transition-colors">Download</button>
                </div>
              </div>

              {/* Validity bar */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex justify-between text-xs text-zinc-400 mb-2">
                  <span>Valid from: {selectedCert.validFrom}</span>
                  <span>Expires: {selectedCert.validTo}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  {(() => {
                    const start = new Date(selectedCert.validFrom).getTime();
                    const end = new Date(selectedCert.validTo).getTime();
                    const now = new Date("2026-02-22").getTime();
                    const pct = Math.round(((now - start) / (end - start)) * 100);
                    return (
                      <div className={cn("h-full rounded-full", pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${Math.min(100, pct)}%` }} />
                    );
                  })()}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {(() => {
                    const days = daysUntilExpiry(selectedCert.validTo);
                    return days > 0 ? `${days} days remaining` : `Expired ${Math.abs(days)} days ago`;
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: "Issuer", value: selectedCert.issuer },
                  { label: "Serial Number", value: selectedCert.serialNumber },
                  { label: "Fingerprint", value: selectedCert.fingerprint },
                  { label: "Auto Renew", value: selectedCert.autoRenew ? "Enabled" : "Disabled" },
                ].map((m) => (
                  <div key={m.label} className="flex gap-4 text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-zinc-500 w-28 shrink-0">{m.label}</span>
                    <span className="text-zinc-200 font-mono break-all">{m.value}</span>
                  </div>
                ))}
              </div>

              {selectedCert.sans.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3">Subject Alternative Names</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCert.sans.map(san => (
                      <span key={san} className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-300">{san}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CSR ── */}
        {tab === "CSR" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Certificate Signing Requests</h3>
              <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">Generate CSR</button>
            </div>
            {CSR_REQUESTS.map((csr) => (
              <div key={csr.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-sm font-semibold">{csr.commonName}</div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border",
                    csr.status === "signed" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" :
                    csr.status === "rejected" ? "text-rose-400 bg-rose-400/10 border-rose-400/30" :
                    "text-amber-400 bg-amber-400/10 border-amber-400/30"
                  )}>{csr.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div><span className="text-zinc-500">O: </span>{csr.organization}</div>
                  <div><span className="text-zinc-500">C: </span>{csr.country}</div>
                  <div><span className="text-zinc-500">ST: </span>{csr.state}</div>
                  <div><span className="text-zinc-500">L: </span>{csr.locality}</div>
                </div>
                <div className="text-[10px] text-zinc-500 mt-2">Created: {csr.createdAt}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── AUDIT ── */}
        {tab === "Audit" && (
          <div className="h-full overflow-y-auto p-6 space-y-2">
            {AUDIT_LOG.map((entry) => (
              <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-3 flex items-center gap-4">
                <span className={cn("text-xs font-mono font-bold w-16 shrink-0", actionColor[entry.action])}>{entry.action}</span>
                <div className="flex-1">
                  <div className="text-sm">{entry.certName}</div>
                  <div className="text-xs text-zinc-500">{entry.actor}</div>
                </div>
                <div className="text-xs text-zinc-500">{entry.timestamp.slice(0, 10)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "Settings" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {[
              { label: "Auto-Renewal Buffer", value: "30 days", desc: "Renew certificates this many days before expiry" },
              { label: "ACME Provider", value: "Let's Encrypt", desc: "Default ACME CA for auto-issued certs" },
              { label: "ACME Challenge Type", value: "DNS-01", desc: "Domain validation method for ACME" },
              { label: "Private Key Algorithm", value: "ECDSA-256", desc: "Default algorithm for new private keys" },
              { label: "Key Storage Backend", value: "HashiCorp Vault", desc: "Where private keys are securely stored" },
              { label: "Expiry Alert Threshold", value: "30 days", desc: "Send alerts when cert has this many days remaining" },
              { label: "Notification Email", value: "infra@openclaw.io", desc: "Recipient for expiry and renewal notifications" },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                </div>
                <div className="text-sm font-mono text-zinc-300 text-right">{s.value}</div>
                <button className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0">Edit</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
