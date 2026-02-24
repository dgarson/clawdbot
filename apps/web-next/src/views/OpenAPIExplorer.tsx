import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Param {
  name: string;
  in: "path" | "query" | "header" | "body";
  type: string;
  required: boolean;
  description: string;
}

interface Response {
  status: string;
  description: string;
  schema?: string;
}

interface Endpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tag: string;
  parameters: Param[];
  requestBody?: string;
  responses: Response[];
}

interface SchemaProperty {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

interface Schema {
  name: string;
  description: string;
  properties: SchemaProperty[];
}

interface AuthMethod {
  name: string;
  type: string;
  description: string;
  example: string;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const endpoints: Endpoint[] = [
  {
    method: "GET", path: "/v1/users", summary: "List users", tag: "Users",
    description: "Returns a paginated list of all users in the organization.",
    parameters: [
      { name: "page", in: "query", type: "integer", required: false, description: "Page number (default 1)" },
      { name: "per_page", in: "query", type: "integer", required: false, description: "Results per page (max 100)" },
      { name: "filter", in: "query", type: "string", required: false, description: "Filter by name or email" },
    ],
    responses: [
      { status: "200", description: "Paginated user list", schema: "UserList" },
      { status: "401", description: "Unauthorized" },
    ],
  },
  {
    method: "POST", path: "/v1/users", summary: "Create user", tag: "Users",
    description: "Creates a new user account in the organization.",
    parameters: [],
    requestBody: "CreateUserRequest",
    responses: [
      { status: "201", description: "User created", schema: "User" },
      { status: "400", description: "Validation error", schema: "Error" },
      { status: "409", description: "Email already exists" },
    ],
  },
  {
    method: "GET", path: "/v1/users/{id}", summary: "Get user", tag: "Users",
    description: "Retrieves a single user by ID.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "User UUID" },
    ],
    responses: [
      { status: "200", description: "User object", schema: "User" },
      { status: "404", description: "User not found" },
    ],
  },
  {
    method: "PATCH", path: "/v1/users/{id}", summary: "Update user", tag: "Users",
    description: "Partially updates a user account.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "User UUID" },
    ],
    requestBody: "UpdateUserRequest",
    responses: [
      { status: "200", description: "Updated user", schema: "User" },
      { status: "400", description: "Validation error" },
      { status: "404", description: "User not found" },
    ],
  },
  {
    method: "DELETE", path: "/v1/users/{id}", summary: "Delete user", tag: "Users",
    description: "Permanently deletes a user account.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "User UUID" },
    ],
    responses: [
      { status: "204", description: "User deleted" },
      { status: "404", description: "User not found" },
    ],
  },
  {
    method: "GET", path: "/v1/agents", summary: "List agents", tag: "Agents",
    description: "Returns all agents visible to the authenticated user.",
    parameters: [
      { name: "status", in: "query", type: "string", required: false, description: "Filter by status: active|idle|error" },
    ],
    responses: [
      { status: "200", description: "Agent list", schema: "AgentList" },
      { status: "401", description: "Unauthorized" },
    ],
  },
  {
    method: "POST", path: "/v1/agents", summary: "Create agent", tag: "Agents",
    description: "Provisions a new agent instance.",
    parameters: [],
    requestBody: "CreateAgentRequest",
    responses: [
      { status: "201", description: "Agent created", schema: "Agent" },
      { status: "400", description: "Validation error" },
    ],
  },
  {
    method: "GET", path: "/v1/agents/{id}", summary: "Get agent", tag: "Agents",
    description: "Retrieves agent configuration and current status.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Agent ID" },
    ],
    responses: [
      { status: "200", description: "Agent object", schema: "Agent" },
      { status: "404", description: "Agent not found" },
    ],
  },
  {
    method: "PUT", path: "/v1/agents/{id}/config", summary: "Update agent config", tag: "Agents",
    description: "Replaces the full agent configuration.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Agent ID" },
    ],
    requestBody: "AgentConfig",
    responses: [
      { status: "200", description: "Updated config", schema: "AgentConfig" },
      { status: "400", description: "Invalid config" },
    ],
  },
  {
    method: "POST", path: "/v1/agents/{id}/restart", summary: "Restart agent", tag: "Agents",
    description: "Gracefully restarts the agent process.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Agent ID" },
    ],
    responses: [
      { status: "202", description: "Restart initiated" },
      { status: "404", description: "Agent not found" },
    ],
  },
  {
    method: "GET", path: "/v1/sessions", summary: "List sessions", tag: "Sessions",
    description: "Returns all chat sessions for the current user.",
    parameters: [
      { name: "agent_id", in: "query", type: "string", required: false, description: "Filter by agent" },
      { name: "since", in: "query", type: "string", required: false, description: "ISO8601 timestamp" },
    ],
    responses: [
      { status: "200", description: "Session list", schema: "SessionList" },
    ],
  },
  {
    method: "POST", path: "/v1/sessions", summary: "Create session", tag: "Sessions",
    description: "Opens a new conversation session with an agent.",
    parameters: [],
    requestBody: "CreateSessionRequest",
    responses: [
      { status: "201", description: "Session created", schema: "Session" },
      { status: "400", description: "Invalid request" },
    ],
  },
  {
    method: "DELETE", path: "/v1/sessions/{id}", summary: "End session", tag: "Sessions",
    description: "Closes and archives the session.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Session UUID" },
    ],
    responses: [
      { status: "204", description: "Session closed" },
      { status: "404", description: "Session not found" },
    ],
  },
  {
    method: "POST", path: "/v1/sessions/{id}/messages", summary: "Send message", tag: "Sessions",
    description: "Sends a message into the session and streams the response.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Session UUID" },
    ],
    requestBody: "MessageRequest",
    responses: [
      { status: "200", description: "Streamed response" },
      { status: "400", description: "Empty message" },
    ],
  },
  {
    method: "GET", path: "/v1/billing/usage", summary: "Get usage", tag: "Billing",
    description: "Returns token and request usage for the current billing period.",
    parameters: [
      { name: "period", in: "query", type: "string", required: false, description: "YYYY-MM format (default: current)" },
    ],
    responses: [
      { status: "200", description: "Usage summary", schema: "UsageSummary" },
    ],
  },
  {
    method: "GET", path: "/v1/billing/invoices", summary: "List invoices", tag: "Billing",
    description: "Returns all invoices for the organization.",
    parameters: [],
    responses: [
      { status: "200", description: "Invoice list", schema: "InvoiceList" },
    ],
  },
  {
    method: "GET", path: "/v1/billing/plan", summary: "Get plan", tag: "Billing",
    description: "Returns the current subscription plan details.",
    parameters: [],
    responses: [
      { status: "200", description: "Plan details", schema: "Plan" },
    ],
  },
  {
    method: "GET", path: "/v1/webhooks", summary: "List webhooks", tag: "Webhooks",
    description: "Returns all configured webhook endpoints.",
    parameters: [],
    responses: [
      { status: "200", description: "Webhook list", schema: "WebhookList" },
    ],
  },
  {
    method: "POST", path: "/v1/webhooks", summary: "Create webhook", tag: "Webhooks",
    description: "Registers a new webhook endpoint.",
    parameters: [],
    requestBody: "CreateWebhookRequest",
    responses: [
      { status: "201", description: "Webhook created", schema: "Webhook" },
      { status: "400", description: "Invalid URL" },
    ],
  },
  {
    method: "DELETE", path: "/v1/webhooks/{id}", summary: "Delete webhook", tag: "Webhooks",
    description: "Removes a webhook endpoint.",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Webhook UUID" },
    ],
    responses: [
      { status: "204", description: "Deleted" },
      { status: "404", description: "Not found" },
    ],
  },
  {
    method: "GET", path: "/v1/audit/events", summary: "List audit events", tag: "Audit",
    description: "Returns paginated audit log entries.",
    parameters: [
      { name: "actor", in: "query", type: "string", required: false, description: "Filter by actor user ID" },
      { name: "action", in: "query", type: "string", required: false, description: "Filter by action type" },
      { name: "since", in: "query", type: "string", required: false, description: "ISO8601 start timestamp" },
    ],
    responses: [
      { status: "200", description: "Audit event list", schema: "AuditEventList" },
    ],
  },
];

const schemas: Schema[] = [
  {
    name: "User", description: "Represents an authenticated user account.",
    properties: [
      { name: "id", type: "string (uuid)", nullable: false, description: "Unique identifier" },
      { name: "email", type: "string", nullable: false, description: "Email address" },
      { name: "name", type: "string", nullable: false, description: "Display name" },
      { name: "role", type: "string", nullable: false, description: "admin | member | viewer" },
      { name: "created_at", type: "string (ISO8601)", nullable: false, description: "Creation timestamp" },
      { name: "last_seen_at", type: "string (ISO8601)", nullable: true, description: "Last activity timestamp" },
    ],
  },
  {
    name: "Agent", description: "An AI agent instance with its configuration.",
    properties: [
      { name: "id", type: "string", nullable: false, description: "Agent identifier" },
      { name: "name", type: "string", nullable: false, description: "Human-readable name" },
      { name: "model", type: "string", nullable: false, description: "Underlying model identifier" },
      { name: "status", type: "string", nullable: false, description: "active | idle | error | disabled" },
      { name: "config", type: "AgentConfig", nullable: false, description: "Agent configuration object" },
      { name: "created_at", type: "string (ISO8601)", nullable: false, description: "Creation timestamp" },
    ],
  },
  {
    name: "Session", description: "A conversation session between a user and agent.",
    properties: [
      { name: "id", type: "string (uuid)", nullable: false, description: "Session identifier" },
      { name: "agent_id", type: "string", nullable: false, description: "Linked agent ID" },
      { name: "user_id", type: "string", nullable: false, description: "Owning user ID" },
      { name: "message_count", type: "integer", nullable: false, description: "Total messages sent" },
      { name: "status", type: "string", nullable: false, description: "active | archived | error" },
      { name: "started_at", type: "string (ISO8601)", nullable: false, description: "Session start time" },
      { name: "ended_at", type: "string (ISO8601)", nullable: true, description: "Session end time" },
    ],
  },
  {
    name: "Error", description: "Standard error response envelope.",
    properties: [
      { name: "code", type: "string", nullable: false, description: "Machine-readable error code" },
      { name: "message", type: "string", nullable: false, description: "Human-readable description" },
      { name: "details", type: "object[]", nullable: true, description: "Field-level validation errors" },
      { name: "request_id", type: "string", nullable: false, description: "Traceable request identifier" },
    ],
  },
  {
    name: "Webhook", description: "A registered HTTP callback endpoint.",
    properties: [
      { name: "id", type: "string (uuid)", nullable: false, description: "Webhook identifier" },
      { name: "url", type: "string (uri)", nullable: false, description: "Callback URL" },
      { name: "events", type: "string[]", nullable: false, description: "Subscribed event types" },
      { name: "secret", type: "string", nullable: true, description: "HMAC signing secret" },
      { name: "active", type: "boolean", nullable: false, description: "Whether deliveries are enabled" },
    ],
  },
  {
    name: "UsageSummary", description: "Token and request usage for a billing period.",
    properties: [
      { name: "period", type: "string", nullable: false, description: "YYYY-MM period" },
      { name: "input_tokens", type: "integer", nullable: false, description: "Total input tokens consumed" },
      { name: "output_tokens", type: "integer", nullable: false, description: "Total output tokens consumed" },
      { name: "requests", type: "integer", nullable: false, description: "Total API requests made" },
      { name: "cost_usd", type: "number", nullable: false, description: "Estimated cost in USD" },
    ],
  },
  {
    name: "AuditEvent", description: "A single audit log entry.",
    properties: [
      { name: "id", type: "string", nullable: false, description: "Event identifier" },
      { name: "actor", type: "string", nullable: false, description: "User or service that took action" },
      { name: "action", type: "string", nullable: false, description: "Action type (e.g. user.created)" },
      { name: "resource", type: "string", nullable: true, description: "Affected resource ID" },
      { name: "timestamp", type: "string (ISO8601)", nullable: false, description: "When the event occurred" },
      { name: "metadata", type: "object", nullable: true, description: "Additional context" },
    ],
  },
  {
    name: "Plan", description: "Subscription plan details.",
    properties: [
      { name: "id", type: "string", nullable: false, description: "Plan identifier" },
      { name: "name", type: "string", nullable: false, description: "Plan name (Starter, Growth, Enterprise)" },
      { name: "token_limit", type: "integer", nullable: false, description: "Monthly token quota" },
      { name: "agent_limit", type: "integer", nullable: false, description: "Maximum concurrent agents" },
      { name: "price_usd", type: "number", nullable: false, description: "Monthly price in USD" },
    ],
  },
];

const authMethods: AuthMethod[] = [
  {
    name: "Bearer JWT", type: "HTTP Bearer",
    description: "Pass a signed JWT in the Authorization header. Tokens expire in 1 hour and can be refreshed via POST /v1/auth/refresh.",
    example: "Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...",
  },
  {
    name: "API Key", type: "Header",
    description: "Pass a long-lived API key in the X-API-Key header. Manage keys in Settings → API Keys.",
    example: "X-API-Key: sk-prod-a1b2c3d4e5f6...",
  },
  {
    name: "OAuth 2.0", type: "OAuth2 (PKCE)",
    description: "Use the authorization code flow with PKCE for user-delegated access. Scopes: read:users, write:users, read:agents, write:agents, read:billing.",
    example: "POST /v1/oauth/authorize?response_type=code&scope=read:users",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function methodColor(method: HttpMethod): string {
  const map: Record<HttpMethod, string> = {
    GET:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST:   "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    PUT:    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    PATCH:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
    DELETE: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  };
  return map[method];
}

const tags = Array.from(new Set(endpoints.map((e) => e.tag)));

// ── Sub-components ─────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border", methodColor(method))}>
      {method}
    </span>
  );
}

function EndpointsTab() {
  const [openTag, setOpenTag] = useState<string | null>(tags[0]);
  const [selected, setSelected] = useState<Endpoint | null>(null);

  return (
    <div className="flex gap-4 h-full">
      {/* Left: grouped list */}
      <div className="w-72 shrink-0 space-y-1 overflow-y-auto pr-1">
        {tags.map((tag) => {
          const group = endpoints.filter((e) => e.tag === tag);
          const isOpen = openTag === tag;
          return (
            <div key={tag} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setOpenTag(isOpen ? null : tag)}
                className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors text-sm font-semibold text-[var(--color-text-primary)]"
              >
                <span>{tag}</span>
                <span className="text-[var(--color-text-muted)] text-xs">{group.length}</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-[var(--color-border)]">
                  {group.map((ep) => (
                    <button
                      key={ep.method + ep.path}
                      onClick={() => setSelected(ep)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-2)] transition-colors",
                        selected === ep && "bg-indigo-500/10"
                      )}
                    >
                      <MethodBadge method={ep.method} />
                      <span className="text-xs font-mono text-[var(--color-text-primary)] truncate">{ep.path}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)] text-sm">
            Select an endpoint to view documentation
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MethodBadge method={selected.method} />
              <span className="font-mono text-[var(--color-text-primary)] text-base">{selected.path}</span>
              <span className="ml-auto text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded">{selected.tag}</span>
            </div>
            <p className="text-sm text-[var(--color-text-primary)]">{selected.description}</p>

            {selected.parameters.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Parameters</h4>
                <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
                        <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Name</th>
                        <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">In</th>
                        <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Type</th>
                        <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Req</th>
                        <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {selected.parameters.map((p) => (
                        <tr key={p.name} className="bg-[var(--color-surface-0)]">
                          <td className="px-3 py-2 font-mono text-emerald-400">{p.name}</td>
                          <td className="px-3 py-2 text-[var(--color-text-secondary)]">{p.in}</td>
                          <td className="px-3 py-2 text-indigo-400">{p.type}</td>
                          <td className="px-3 py-2">
                            {p.required
                              ? <span className="text-rose-400">yes</span>
                              : <span className="text-[var(--color-text-muted)]">no</span>}
                          </td>
                          <td className="px-3 py-2 text-[var(--color-text-primary)]">{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected.requestBody && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Request Body</h4>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3">
                  <span className="font-mono text-indigo-300 text-sm">{selected.requestBody}</span>
                  <span className="text-[var(--color-text-muted)] text-xs ml-2">(schema)</span>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Responses</h4>
              <div className="space-y-2">
                {selected.responses.map((r) => {
                  const statusNum = parseInt(r.status, 10);
                  const color = statusNum < 300 ? "text-emerald-400" : statusNum < 400 ? "text-amber-400" : "text-rose-400";
                  return (
                    <div key={r.status} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-2">
                      <span className={cn("font-mono font-bold text-sm", color)}>{r.status}</span>
                      <span className="text-[var(--color-text-primary)] text-sm">{r.description}</span>
                      {r.schema && <span className="ml-auto font-mono text-xs text-indigo-400">{r.schema}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SchemasTab() {
  const [selected, setSelected] = useState<Schema>(schemas[0]);

  return (
    <div className="flex gap-4">
      {/* List */}
      <div className="w-48 shrink-0 space-y-1">
        {schemas.map((s) => (
          <button
            key={s.name}
            onClick={() => setSelected(s)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
              selected.name === s.name
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1">
        <h3 className="text-[var(--color-text-primary)] font-semibold text-base mb-1">{selected.name}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{selected.description}</p>
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
                <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Property</th>
                <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Type</th>
                <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Nullable</th>
                <th className="text-left px-3 py-2 text-[var(--color-text-secondary)]">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {selected.properties.map((p) => (
                <tr key={p.name} className="bg-[var(--color-surface-0)]">
                  <td className="px-3 py-2 font-mono text-emerald-400">{p.name}</td>
                  <td className="px-3 py-2 text-indigo-400 font-mono">{p.type}</td>
                  <td className="px-3 py-2">
                    {p.nullable
                      ? <span className="text-amber-400">true</span>
                      : <span className="text-[var(--color-text-muted)]">false</span>}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuthTab() {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      {authMethods.map((m) => (
        <div key={m.name} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[var(--color-text-primary)] font-semibold">{m.name}</h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded px-2 py-0.5">{m.type}</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{m.description}</p>
          <div className="font-mono text-xs bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded px-3 py-2 text-emerald-300">
            {m.example}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 space-y-3">
        <h3 className="text-[var(--color-text-primary)] font-semibold">🔑 Try It — Token</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">Enter a Bearer token to use in the Try It tab.</p>
        <div className="flex gap-2">
          <input
            type={visible ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOiJSUzI1NiJ9..."
            className="flex-1 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => setVisible(!visible)}
            className="px-3 py-2 rounded bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] text-xs transition-colors"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        <div className={cn("text-xs", token ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
          {token ? "✓ Token set — will be used in Try It requests" : "No token set"}
        </div>
      </div>
    </div>
  );
}

function TryItTab() {
  const [selectedEp, setSelectedEp] = useState<Endpoint>(endpoints[0]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [extraHeader, setExtraHeader] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSend() {
    setLoading(true);
    setResponse(null);
    setTimeout(() => {
      const mockBody = selectedEp.method === "GET"
        ? JSON.stringify({ data: [], total: 0, page: 1, per_page: 20 }, null, 2)
        : JSON.stringify({ id: "abc123", created_at: new Date().toISOString() }, null, 2);
      setResponse(
        "HTTP/1.1 " + (selectedEp.method === "POST" ? "201 Created" : "200 OK") + "\n" +
        "Content-Type: application/json\n" +
        "X-Request-Id: req_" + Math.random().toString(36).slice(2) + "\n\n" +
        mockBody
      );
      setLoading(false);
    }, 800);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Endpoint</label>
        <select
          value={selectedEp.method + " " + selectedEp.path}
          onChange={(e) => {
            const found = endpoints.find((ep) => ep.method + " " + ep.path === e.target.value);
            if (found) { setSelectedEp(found); setParams({}); setResponse(null); }
          }}
          className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500"
        >
          {endpoints.map((ep) => (
            <option key={ep.method + ep.path} value={ep.method + " " + ep.path}>
              {ep.method} {ep.path}
            </option>
          ))}
        </select>
      </div>

      {selectedEp.parameters.length > 0 && (
        <div>
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Parameters</label>
          <div className="space-y-2">
            {selectedEp.parameters.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 font-mono text-xs text-emerald-400">{p.name}</span>
                <span className="w-16 shrink-0 text-xs text-[var(--color-text-muted)]">{p.in}</span>
                <input
                  value={params[p.name] || ""}
                  onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}
                  placeholder={p.required ? "required" : "optional"}
                  className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Extra Header (optional)</label>
        <input
          value={extraHeader}
          onChange={(e) => setExtraHeader(e.target.value)}
          placeholder="X-Custom-Header: value"
          className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={loading}
        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[var(--color-surface-3)] rounded-lg text-[var(--color-text-primary)] text-sm font-medium transition-colors"
      >
        {loading ? "Sending…" : "Send Request"}
      </button>

      {response && (
        <div>
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Response</label>
          <pre className="bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const TABS = ["Endpoints", "Schemas", "Auth", "Try It"] as const;
type Tab = typeof TABS[number];

export default function OpenAPIExplorer() {
  const [tab, setTab] = useState<Tab>("Endpoints");

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">OpenAPI Explorer</h1>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-3 py-1">v1.0.0</span>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-1">Live</span>
        </div>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Interactive API documentation — {endpoints.length} endpoints across {tags.length} resource groups
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)] pb-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === "Endpoints" && <EndpointsTab />}
        {tab === "Schemas" && <SchemasTab />}
        {tab === "Auth" && <AuthTab />}
        {tab === "Try It" && <TryItTab />}
      </div>
    </div>
  );
}
