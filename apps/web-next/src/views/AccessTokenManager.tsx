import React, { useState } from "react";
import { cn } from "../lib/utils";

interface OAuthApp {
  id: string;
  name: string;
  clientId: string;
  type: "web" | "native" | "spa" | "machine";
  scopes: string[];
  redirectUris: string[];
  status: "active" | "suspended";
  createdAt: string;
  lastUsed: string;
  tokenCount: number;
}

interface AccessToken {
  id: string;
  appId: string;
  userId: string;
  userEmail: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  lastUsed: string;
  status: "active" | "expired" | "revoked";
  ipAddress: string;
  userAgent: string;
}

interface JWTClaim {
  key: string;
  value: string;
  type: "standard" | "custom";
}

const APPS: OAuthApp[] = [
  { id: "app1", name: "Horizon Dashboard",      clientId: "cli_9kX2mNpQ",  type: "spa",     scopes: ["read","write","admin"],                   redirectUris: ["https://app.corp.io/callback"],                          status: "active",    createdAt: "2024-01-15", lastUsed: "2026-02-22", tokenCount: 8241 },
  { id: "app2", name: "Mobile App (iOS)",        clientId: "cli_7jM3pRsT",  type: "native",  scopes: ["read","write"],                          redirectUris: ["io.corp.app://callback"],                                status: "active",    createdAt: "2024-03-02", lastUsed: "2026-02-22", tokenCount: 3102 },
  { id: "app3", name: "CI Pipeline Bot",         clientId: "cli_5nK4qStU",  type: "machine", scopes: ["deploy","read"],                         redirectUris: [],                                                        status: "active",    createdAt: "2024-06-10", lastUsed: "2026-02-21", tokenCount: 144 },
  { id: "app4", name: "Analytics Exporter",      clientId: "cli_3mJ5rTuV",  type: "machine", scopes: ["read","analytics.export"],               redirectUris: [],                                                        status: "active",    createdAt: "2025-01-20", lastUsed: "2026-02-20", tokenCount: 29 },
  { id: "app5", name: "Legacy Web App (Sunset)", clientId: "cli_1kH6sTwW",  type: "web",     scopes: ["read"],                                  redirectUris: ["https://legacy.corp.io/auth"],                           status: "suspended", createdAt: "2022-09-01", lastUsed: "2025-11-14", tokenCount: 0 },
  { id: "app6", name: "Partner Integration",     clientId: "cli_8pN7uVxX",  type: "web",     scopes: ["read","partner.api"],                    redirectUris: ["https://partner.acme.com/oauth/callback"],               status: "active",    createdAt: "2025-08-12", lastUsed: "2026-02-22", tokenCount: 891 },
];

const TOKENS: AccessToken[] = [
  { id: "tok1", appId: "app1", userId: "usr_9kX2", userEmail: "alice@corp.io",  scopes: ["read","write","admin"],      issuedAt: "2026-02-22T06:15:00Z", expiresAt: "2026-02-22T07:15:00Z", lastUsed: "2026-02-22T07:38:00Z", status: "active",  ipAddress: "10.0.1.42",    userAgent: "Chrome/122 macOS" },
  { id: "tok2", appId: "app2", userId: "usr_8xT1", userEmail: "bob@corp.io",    scopes: ["read","write"],              issuedAt: "2026-02-22T07:01:00Z", expiresAt: "2026-02-22T08:01:00Z", lastUsed: "2026-02-22T07:35:00Z", status: "active",  ipAddress: "192.168.1.101", userAgent: "iOS/17.3 com.corp.app" },
  { id: "tok3", appId: "app3", userId: "sys_ci",   userEmail: "ci@corp.io",     scopes: ["deploy","read"],             issuedAt: "2026-02-22T07:30:00Z", expiresAt: "2026-02-22T08:30:00Z", lastUsed: "2026-02-22T07:32:00Z", status: "active",  ipAddress: "10.100.0.5",   userAgent: "GitHub-Actions" },
  { id: "tok4", appId: "app1", userId: "usr_7kW2", userEmail: "carol@corp.io",  scopes: ["read","write"],              issuedAt: "2026-02-22T05:00:00Z", expiresAt: "2026-02-22T06:00:00Z", lastUsed: "2026-02-22T05:55:00Z", status: "expired", ipAddress: "172.16.0.20",  userAgent: "Firefox/124 Windows" },
  { id: "tok5", appId: "app6", userId: "ext_acme", userEmail: "api@acme.com",   scopes: ["read","partner.api"],        issuedAt: "2026-02-21T12:00:00Z", expiresAt: "2026-02-22T12:00:00Z", lastUsed: "2026-02-21T18:30:00Z", status: "active",  ipAddress: "54.201.88.12",  userAgent: "AcmeIntegration/2.1" },
  { id: "tok6", appId: "app4", userId: "sys_exp",  userEmail: "exporter@corp.io",scopes: ["read","analytics.export"], issuedAt: "2026-02-20T00:00:00Z", expiresAt: "2026-02-21T00:00:00Z", lastUsed: "2026-02-20T23:45:00Z", status: "expired", ipAddress: "10.0.2.30",    userAgent: "ExporterBot/1.0" },
  { id: "tok7", appId: "app1", userId: "usr_5nRt", userEmail: "david@corp.io",  scopes: ["read"],                      issuedAt: "2026-02-19T14:00:00Z", expiresAt: "2026-02-20T14:00:00Z", lastUsed: "2026-02-19T14:00:00Z", status: "revoked", ipAddress: "203.0.113.44", userAgent: "Chrome/121 Linux" },
];

const JWT_SAMPLE: JWTClaim[] = [
  { key: "sub",   value: "usr_9kX2",                           type: "standard" },
  { key: "iss",   value: "https://auth.corp.io",               type: "standard" },
  { key: "aud",   value: "https://api.corp.io",                type: "standard" },
  { key: "exp",   value: "1740207300 (2026-02-22T07:15:00Z)",  type: "standard" },
  { key: "iat",   value: "1740203700 (2026-02-22T06:15:00Z)",  type: "standard" },
  { key: "jti",   value: "tok_a8f3d9e2",                       type: "standard" },
  { key: "scope", value: "read write admin",                   type: "standard" },
  { key: "email", value: "alice@corp.io",                      type: "custom"   },
  { key: "plan",  value: "enterprise",                         type: "custom"   },
  { key: "org",   value: "corp_9kX2",                          type: "custom"   },
  { key: "roles", value: "[\"admin\",\"developer\"]",          type: "custom"   },
];

const ALL_SCOPES = ["read","write","admin","deploy","analytics.export","partner.api","billing","audit.read"];

const TYPE_BADGES: Record<string, string> = {
  spa:     "bg-indigo-400/15 border-indigo-500/30 text-indigo-300",
  web:     "bg-blue-400/15 border-blue-500/30 text-blue-300",
  native:  "bg-emerald-400/15 border-emerald-500/30 text-emerald-300",
  machine: "bg-amber-400/15 border-amber-500/30 text-amber-300",
};

type Tab = "tokens" | "apps" | "jwt" | "config";

export default function AccessTokenManager() {
  const [activeTab, setActiveTab]       = useState<Tab>("tokens");
  const [selectedApp, setSelectedApp]   = useState<OAuthApp | null>(null);
  const [selectedToken, setSelectedToken] = useState<AccessToken | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterApp, setFilterApp]       = useState("all");
  const [jwtInput, setJwtInput]         = useState("");
  const [showDecoded, setShowDecoded]   = useState(false);

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "tokens", label: "Active Tokens",  emoji: "🔑" },
    { id: "apps",   label: "OAuth Apps",     emoji: "📱" },
    { id: "jwt",    label: "JWT Inspector",  emoji: "🔍" },
    { id: "config", label: "Config",         emoji: "⚙️" },
  ];

  const filteredTokens = TOKENS.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterApp    !== "all" && t.appId  !== filterApp)    return false;
    return true;
  });

  const activeTokens  = TOKENS.filter(t => t.status === "active").length;
  const expiredTokens = TOKENS.filter(t => t.status === "expired").length;
  const revokedTokens = TOKENS.filter(t => t.status === "revoked").length;

  const getAppName = (appId: string) => APPS.find(a => a.id === appId)?.name ?? appId;

  const TOKEN_STATUS_STYLES: Record<string, string> = {
    active:  "bg-emerald-400/15 text-emerald-400 border-emerald-500/30",
    expired: "bg-zinc-700 text-zinc-400 border-zinc-600",
    revoked: "bg-rose-400/15 text-rose-400 border-rose-500/30",
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Access Token Manager</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Manage OAuth apps, access tokens, and JWT configuration</p>
        </div>
        <button className="text-sm px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">
          + Register App
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "OAuth Apps",      value: APPS.filter(a=>a.status==="active").length, color: "text-indigo-400" },
          { label: "Active Tokens",   value: activeTokens,  color: "text-emerald-400" },
          { label: "Expired",         value: expiredTokens, color: "text-zinc-400" },
          { label: "Revoked",         value: revokedTokens, color: "text-rose-400" },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">{card.label}</div>
            <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tokens */}
      {activeTab === "tokens" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 space-y-3">
            <div className="flex gap-2">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
              <select value={filterApp} onChange={e => setFilterApp(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none">
                <option value="all">All Apps</option>
                {APPS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {filteredTokens.map(token => (
                <button
                  key={token.id}
                  onClick={() => setSelectedToken(token)}
                  className={cn(
                    "w-full border-b border-zinc-800 last:border-b-0 p-4 text-left hover:bg-zinc-800/30 transition-colors",
                    selectedToken?.id === token.id && "bg-zinc-800/50"
                  )}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded border", TOKEN_STATUS_STYLES[token.status])}>{token.status}</span>
                      <span className="text-sm font-mono text-zinc-300 truncate max-w-[160px]">{token.id}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{fmtTime(token.issuedAt)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span>{token.userEmail}</span>
                    <span>·</span>
                    <span>{getAppName(token.appId)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {token.scopes.map(s => (
                      <span key={s} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{s}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            {selectedToken ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Token Detail</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", TOKEN_STATUS_STYLES[selectedToken.status])}>{selectedToken.status}</span>
                </div>

                <div className="space-y-2 text-xs">
                  {[
                    ["Token ID",   selectedToken.id],
                    ["User",       selectedToken.userEmail],
                    ["App",        getAppName(selectedToken.appId)],
                    ["Issued",     fmtTime(selectedToken.issuedAt)],
                    ["Expires",    fmtTime(selectedToken.expiresAt)],
                    ["Last Used",  fmtTime(selectedToken.lastUsed)],
                    ["IP",         selectedToken.ipAddress],
                    ["User Agent", selectedToken.userAgent],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-zinc-500">{k}</span>
                      <span className="text-zinc-300 font-mono max-w-[60%] truncate text-right">{v}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-xs text-zinc-500 mb-1.5">Scopes</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedToken.scopes.map(s => (
                      <span key={s} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded font-mono">{s}</span>
                    ))}
                  </div>
                </div>

                {selectedToken.status === "active" && (
                  <button className="w-full text-xs py-2 bg-rose-400/10 border border-rose-500/30 text-rose-300 rounded hover:bg-rose-400/20 transition-colors">
                    🚫 Revoke Token
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
                Select a token to inspect
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apps */}
      {activeTab === "apps" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-3">
            {APPS.map(app => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-4 text-left hover:border-zinc-600 transition-colors",
                  selectedApp?.id === app.id ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium text-white">{app.name}</span>
                  {app.status === "suspended" && (
                    <span className="text-xs bg-rose-400/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded">suspended</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn("px-1.5 py-0.5 rounded border", TYPE_BADGES[app.type])}>{app.type}</span>
                  <span className="text-zinc-500 font-mono">{app.clientId}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{app.tokenCount.toLocaleString()} tokens · last used {app.lastUsed}</div>
              </button>
            ))}
          </div>

          <div className="col-span-3">
            {selectedApp ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{selectedApp.name}</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", TYPE_BADGES[selectedApp.type])}>{selectedApp.type}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ["Client ID",  selectedApp.clientId],
                    ["Created",    selectedApp.createdAt],
                    ["Last Used",  selectedApp.lastUsed],
                    ["Tokens",     selectedApp.tokenCount.toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-zinc-800 rounded p-2">
                      <div className="text-zinc-500">{k}</div>
                      <div className="text-zinc-300 font-mono mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-xs text-zinc-400 mb-2">Allowed Scopes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SCOPES.map(s => (
                      <span key={s} className={cn(
                        "text-xs px-2 py-0.5 rounded border font-mono",
                        selectedApp.scopes.includes(s)
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                          : "bg-zinc-800 border-zinc-700 text-zinc-600"
                      )}>{s}</span>
                    ))}
                  </div>
                </div>

                {selectedApp.redirectUris.length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-400 mb-2">Redirect URIs</div>
                    <div className="space-y-1">
                      {selectedApp.redirectUris.map(uri => (
                        <div key={uri} className="bg-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-300">{uri}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  <button className="text-xs px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/30">Edit App</button>
                  <button className="text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-700">Rotate Secret</button>
                  {selectedApp.status === "active" ? (
                    <button className="text-xs px-3 py-1.5 bg-rose-400/10 border border-rose-500/30 text-rose-300 rounded hover:bg-rose-400/20">Suspend</button>
                  ) : (
                    <button className="text-xs px-3 py-1.5 bg-emerald-400/10 border border-emerald-500/30 text-emerald-300 rounded hover:bg-emerald-400/20">Reactivate</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select an app to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* JWT Inspector */}
      {activeTab === "jwt" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-white mb-2">Paste JWT Token</div>
            <textarea
              value={jwtInput}
              onChange={e => setJwtInput(e.target.value)}
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full h-32 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono rounded p-3 resize-none focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600"
            />
            <button
              onClick={() => setShowDecoded(true)}
              className="mt-2 w-full py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors"
            >
              🔍 Decode JWT
            </button>

            {/* Sample token structure display */}
            <div className="mt-4">
              <div className="text-xs text-zinc-400 mb-2">Token format</div>
              <div className="bg-zinc-900 border border-zinc-800 rounded p-3 font-mono text-xs leading-relaxed">
                <span className="text-rose-300">header</span>.<span className="text-indigo-300">payload</span>.<span className="text-emerald-300">signature</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-white mb-2">Decoded Claims</div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex gap-2 px-4 py-2 border-b border-zinc-800 text-xs">
                <span className="text-zinc-400">Algorithm:</span>
                <span className="text-indigo-300 font-mono">RS256</span>
                <span className="text-zinc-600 mx-1">|</span>
                <span className="text-zinc-400">Type:</span>
                <span className="text-indigo-300 font-mono">JWT</span>
              </div>
              <div className="divide-y divide-zinc-800 max-h-80 overflow-y-auto">
                {JWT_SAMPLE.map(claim => (
                  <div key={claim.key} className="flex items-center gap-3 px-4 py-2">
                    <span className={cn("w-16 text-xs font-mono font-semibold flex-shrink-0",
                      claim.type === "standard" ? "text-amber-300" : "text-indigo-300"
                    )}>{claim.key}</span>
                    <span className="text-xs text-zinc-300 font-mono">{claim.value}</span>
                    <span className={cn("ml-auto text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                      claim.type === "standard" ? "bg-amber-400/10 text-amber-400" : "bg-indigo-500/10 text-indigo-300"
                    )}>{claim.type}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
              <span>✓ Signature valid</span>
              <span className="text-zinc-600">|</span>
              <span>✓ Not expired</span>
            </div>
          </div>
        </div>
      )}

      {/* Config */}
      {activeTab === "config" && (
        <div className="max-w-lg space-y-4">
          {[
            { label: "Token Expiry (access)",  value: "3600",         type: "number", unit: "seconds" },
            { label: "Token Expiry (refresh)", value: "2592000",      type: "number", unit: "seconds" },
            { label: "Signing Algorithm",      value: "RS256",        type: "select", opts: ["RS256","RS512","HS256","ES256"] },
            { label: "PKCE Required",          value: "enabled",      type: "select", opts: ["enabled","disabled"] },
            { label: "Token Rotation",         value: "enabled",      type: "select", opts: ["enabled","disabled"] },
            { label: "Max Tokens per User",    value: "10",           type: "number" },
            { label: "Issuer URL",             value: "https://auth.corp.io", type: "text" },
            { label: "JWKS URI",               value: "https://auth.corp.io/.well-known/jwks.json", type: "text" },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs text-zinc-400 mb-1.5">{f.label}{f.unit ? <span className="text-zinc-500 ml-1">({f.unit})</span> : ""}</label>
              {f.type === "select" ? (
                <select className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none">
                  {f.opts?.map(o => <option key={o} selected={o === f.value}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} defaultValue={f.value} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-indigo-500 font-mono" />
              )}
            </div>
          ))}
          <button className="px-4 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors">Save Configuration</button>
        </div>
      )}
    </div>
  );
}
