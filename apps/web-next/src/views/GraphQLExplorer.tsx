import React, { useState } from "react";
import { cn } from "../lib/utils";

type OperationType = "query" | "mutation" | "subscription";

interface GQLField {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
  args?: GQLArg[];
}

interface GQLArg {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

interface GQLType {
  name: string;
  kind: "OBJECT" | "INPUT_OBJECT" | "ENUM" | "SCALAR" | "INTERFACE";
  description: string;
  fields: GQLField[];
}

interface SavedQuery {
  id: string;
  name: string;
  type: OperationType;
  query: string;
  variables: string;
  lastRun: string;
}

interface QueryHistoryEntry {
  id: string;
  query: string;
  duration: number;
  status: "success" | "error";
  timestamp: string;
  responseSize: string;
}

const GQL_SCHEMA: GQLType[] = [
  {
    name: "Query",
    kind: "OBJECT",
    description: "Root query type",
    fields: [
      { name: "user", type: "User", nullable: false, description: "Fetch a user by ID", args: [{ name: "id", type: "ID!", required: true }] },
      { name: "users", type: "[User!]!", nullable: false, description: "List all users with pagination", args: [{ name: "limit", type: "Int", required: false, defaultValue: "20" }, { name: "offset", type: "Int", required: false, defaultValue: "0" }] },
      { name: "agent", type: "Agent", nullable: true, description: "Fetch an agent by ID", args: [{ name: "id", type: "ID!", required: true }] },
      { name: "agents", type: "[Agent!]!", nullable: false, description: "List agents with optional status filter", args: [{ name: "status", type: "AgentStatus", required: false }] },
      { name: "session", type: "Session", nullable: true, description: "Fetch a session by key", args: [{ name: "key", type: "String!", required: true }] },
      { name: "metricsSnapshot", type: "MetricsSnapshot!", nullable: false, description: "Current system metrics snapshot", args: [] },
    ],
  },
  {
    name: "Mutation",
    kind: "OBJECT",
    description: "Root mutation type",
    fields: [
      { name: "createAgent", type: "Agent!", nullable: false, description: "Create a new agent", args: [{ name: "input", type: "CreateAgentInput!", required: true }] },
      { name: "updateAgent", type: "Agent!", nullable: false, description: "Update agent config", args: [{ name: "id", type: "ID!", required: true }, { name: "input", type: "UpdateAgentInput!", required: true }] },
      { name: "deleteAgent", type: "Boolean!", nullable: false, description: "Soft-delete an agent", args: [{ name: "id", type: "ID!", required: true }] },
      { name: "createSession", type: "Session!", nullable: false, description: "Start a new session", args: [{ name: "agentId", type: "ID!", required: true }] },
      { name: "inviteUser", type: "Invitation!", nullable: false, description: "Send a user invitation", args: [{ name: "email", type: "String!", required: true }, { name: "role", type: "UserRole!", required: true }] },
    ],
  },
  {
    name: "User",
    kind: "OBJECT",
    description: "Represents a user account",
    fields: [
      { name: "id", type: "ID!", nullable: false, description: "Unique identifier" },
      { name: "email", type: "String!", nullable: false, description: "Email address" },
      { name: "name", type: "String", nullable: true, description: "Display name" },
      { name: "role", type: "UserRole!", nullable: false, description: "User permission role" },
      { name: "createdAt", type: "DateTime!", nullable: false, description: "Account creation timestamp" },
      { name: "agents", type: "[Agent!]!", nullable: false, description: "Agents owned by this user" },
    ],
  },
  {
    name: "Agent",
    kind: "OBJECT",
    description: "An AI agent configuration",
    fields: [
      { name: "id", type: "ID!", nullable: false, description: "Unique identifier" },
      { name: "name", type: "String!", nullable: false, description: "Agent display name" },
      { name: "model", type: "String!", nullable: false, description: "LLM model identifier" },
      { name: "status", type: "AgentStatus!", nullable: false, description: "Current agent status" },
      { name: "createdAt", type: "DateTime!", nullable: false, description: "Creation timestamp" },
      { name: "sessions", type: "[Session!]!", nullable: false, description: "Sessions for this agent" },
      { name: "tokenCount", type: "Int!", nullable: false, description: "Total tokens consumed" },
    ],
  },
];

const SAVED_QUERIES: SavedQuery[] = [
  {
    id: "q1",
    name: "List all agents",
    type: "query",
    query: `query ListAgents($status: AgentStatus) {
  agents(status: $status) {
    id
    name
    model
    status
    createdAt
    tokenCount
  }
}`,
    variables: `{"status": "active"}`,
    lastRun: "2026-02-22T14:20:00Z",
  },
  {
    id: "q2",
    name: "Get user with agents",
    type: "query",
    query: `query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    name
    role
    agents {
      id
      name
      status
    }
  }
}`,
    variables: `{"id": "user_01JMXK3"}`,
    lastRun: "2026-02-22T13:45:00Z",
  },
  {
    id: "q3",
    name: "Create agent",
    type: "mutation",
    query: `mutation CreateAgent($input: CreateAgentInput!) {
  createAgent(input: $input) {
    id
    name
    model
    status
  }
}`,
    variables: `{
  "input": {
    "name": "My New Agent",
    "model": "claude-sonnet-4",
    "description": "General purpose assistant"
  }
}`,
    lastRun: "2026-02-21T18:30:00Z",
  },
  {
    id: "q4",
    name: "Metrics snapshot",
    type: "query",
    query: `query MetricsSnapshot {
  metricsSnapshot {
    activeAgents
    activeSessions
    tokensLastHour
    errorRate
    p99Latency
  }
}`,
    variables: "{}",
    lastRun: "2026-02-22T14:30:00Z",
  },
];

const QUERY_HISTORY: QueryHistoryEntry[] = [
  { id: "h1", query: "query ListAgents { agents { id name status } }", duration: 42, status: "success", timestamp: "2026-02-22T14:31:00Z", responseSize: "2.1 KB" },
  { id: "h2", query: "query GetUser($id: ID!) { user(id: $id) { id email name } }", duration: 38, status: "success", timestamp: "2026-02-22T14:28:00Z", responseSize: "512 B" },
  { id: "h3", query: "mutation DeleteAgent($id: ID!) { deleteAgent(id: $id) }", duration: 91, status: "error", timestamp: "2026-02-22T14:25:00Z", responseSize: "256 B" },
  { id: "h4", query: "query MetricsSnapshot { metricsSnapshot { activeAgents tokensLastHour } }", duration: 27, status: "success", timestamp: "2026-02-22T14:20:00Z", responseSize: "384 B" },
  { id: "h5", query: "subscription OnAgentStatusChange { agentStatusChanged { id status } }", duration: 0, status: "error", timestamp: "2026-02-22T14:15:00Z", responseSize: "0 B" },
];

const MOCK_RESPONSE = `{
  "data": {
    "agents": [
      {
        "id": "agent_01JMXK3",
        "name": "Support Agent",
        "model": "claude-sonnet-4-6",
        "status": "active",
        "createdAt": "2026-01-15T09:00:00Z",
        "tokenCount": 1482930
      },
      {
        "id": "agent_01JMXK4",
        "name": "Data Analyst",
        "model": "claude-opus-4",
        "status": "active",
        "createdAt": "2026-01-22T14:30:00Z",
        "tokenCount": 892410
      },
      {
        "id": "agent_01JMXK5",
        "name": "Code Reviewer",
        "model": "claude-sonnet-4-6",
        "status": "idle",
        "createdAt": "2026-02-01T11:15:00Z",
        "tokenCount": 345670
      }
    ]
  },
  "extensions": {
    "duration": 42,
    "complexity": 8,
    "cacheHit": false
  }
}`;

const TABS = ["Explorer", "Schema", "History", "Saved"] as const;
type Tab = typeof TABS[number];

export default function GraphQLExplorer(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Explorer");
  const [query, setQuery] = useState<string>(SAVED_QUERIES[0].query);
  const [variables, setVariables] = useState<string>(SAVED_QUERIES[0].variables);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<GQLType>(GQL_SCHEMA[0]);
  const [selectedSavedQuery, setSelectedSavedQuery] = useState<SavedQuery | null>(null);
  const [schemaSearch, setSchemaSearch] = useState<string>("");

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
    }, 600);
  };

  const filteredSchema = GQL_SCHEMA.filter((t) =>
    schemaSearch === "" ||
    t.name.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    t.fields.some(f => f.name.toLowerCase().includes(schemaSearch.toLowerCase()))
  );

  const opType: OperationType = query.trim().startsWith("mutation") ? "mutation" : query.trim().startsWith("subscription") ? "subscription" : "query";
  const opColor = opType === "mutation" ? "text-amber-400" : opType === "subscription" ? "text-emerald-400" : "text-primary";

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold">GraphQL Explorer</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Interactive GraphQL schema explorer and query runner</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-[var(--color-text-muted)] font-mono">endpoint: /api/graphql</div>
          <div className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-primary border-primary"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── EXPLORER ── */}
        {tab === "Explorer" && (
          <div className="h-full flex">
            {/* Left: Editor */}
            <div className="flex-1 flex flex-col border-r border-[var(--color-border)]">
              {/* Toolbar */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/50">
                <div className={cn("text-xs font-mono font-bold uppercase", opColor)}>{opType}</div>
                <div className="flex-1" />
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
                    isRunning
                      ? "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] cursor-not-allowed"
                      : "bg-primary hover:bg-primary text-[var(--color-text-primary)]"
                  )}
                >
                  {isRunning ? "Running..." : "▶ Run"}
                </button>
              </div>

              {/* Query area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-[var(--color-surface-1)]/30 border-b border-[var(--color-border)]/50">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Query</span>
                </div>
                <div className="flex-1 relative overflow-hidden">
                  <textarea
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setHasRun(false); }}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full bg-transparent text-sm font-mono text-[var(--color-text-primary)] p-4 resize-none focus:outline-none leading-relaxed"
                    style={{ tabSize: 2 }}
                  />
                </div>
                {/* Variables */}
                <div className="border-t border-[var(--color-border)]">
                  <div className="px-3 py-1.5 bg-[var(--color-surface-1)]/30 border-b border-[var(--color-border)]/50">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Variables</span>
                  </div>
                  <textarea
                    value={variables}
                    onChange={(e) => setVariables(e.target.value)}
                    spellCheck={false}
                    rows={4}
                    className="w-full bg-transparent text-xs font-mono text-[var(--color-text-primary)] p-3 resize-none focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right: Response */}
            <div className="w-96 flex flex-col">
              <div className="px-3 py-1.5 bg-[var(--color-surface-1)]/30 border-b border-[var(--color-border)]/50 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Response</span>
                {hasRun && (
                  <>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">200 OK</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">42ms</span>
                  </>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {!hasRun && !isRunning && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-3">▶</div>
                      <div className="text-sm text-[var(--color-text-muted)]">Run a query to see results</div>
                    </div>
                  </div>
                )}
                {isRunning && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-sm text-[var(--color-text-secondary)] animate-pulse">Executing...</div>
                  </div>
                )}
                {hasRun && !isRunning && (
                  <pre className="text-xs font-mono text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">{MOCK_RESPONSE}</pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEMA ── */}
        {tab === "Schema" && (
          <div className="h-full flex overflow-hidden">
            {/* Type list */}
            <div className="w-56 border-r border-[var(--color-border)] flex flex-col">
              <div className="p-3 border-b border-[var(--color-border)]">
                <input
                  type="text"
                  placeholder="Search schema..."
                  value={schemaSearch}
                  onChange={(e) => setSchemaSearch(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredSchema.map((type) => (
                  <button
                    key={type.name}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm border-b border-[var(--color-border)]/50 transition-colors",
                      selectedType.name === type.name ? "bg-primary/10 text-indigo-300" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/50"
                    )}
                  >
                    <div className="font-medium">{type.name}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{type.kind}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type detail */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold font-mono text-indigo-300">{selectedType.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">{selectedType.kind}</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{selectedType.description}</p>
              </div>

              <div className="space-y-2">
                {selectedType.fields.map((field) => (
                  <div key={field.name} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{field.name}</span>
                        <span className="font-mono text-sm text-indigo-300 ml-2">{field.type}</span>
                        {field.nullable && <span className="text-xs text-[var(--color-text-muted)] ml-2">(nullable)</span>}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{field.description}</p>
                    {field.args && field.args.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">Arguments</div>
                        <div className="space-y-1">
                          {field.args.map((arg) => (
                            <div key={arg.name} className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-amber-300">{arg.name}</span>
                              <span className="font-mono text-[var(--color-text-secondary)]">{arg.type}</span>
                              {!arg.required && arg.defaultValue && (
                                <span className="text-[var(--color-text-muted)]">= {arg.defaultValue}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "History" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="space-y-2">
              {QUERY_HISTORY.map((h) => (
                <div
                  key={h.id}
                  onClick={() => { setQuery(h.query); setTab("Explorer"); }}
                  className="bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-border)] rounded-lg p-4 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", h.status === "success" ? "bg-emerald-400" : "bg-rose-400")} />
                    <span className="text-xs text-[var(--color-text-muted)]">{h.timestamp.slice(0, 19).replace("T", " ")}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{h.duration}ms</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{h.responseSize}</span>
                    <span className={cn("text-xs ml-auto", h.status === "success" ? "text-emerald-400" : "text-rose-400")}>{h.status}</span>
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Load →</span>
                  </div>
                  <pre className="text-xs font-mono text-[var(--color-text-secondary)] truncate">{h.query}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SAVED ── */}
        {tab === "Saved" && (
          <div className="h-full flex overflow-hidden">
            <div className="w-72 border-r border-[var(--color-border)] overflow-y-auto">
              {SAVED_QUERIES.map((sq) => (
                <button
                  key={sq.id}
                  onClick={() => setSelectedSavedQuery(sq)}
                  className={cn(
                    "w-full text-left px-4 py-4 border-b border-[var(--color-border)]/50 transition-colors",
                    selectedSavedQuery?.id === sq.id ? "bg-primary/10" : "hover:bg-[var(--color-surface-2)]/50"
                  )}
                >
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{sq.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] font-mono font-bold uppercase",
                      sq.type === "mutation" ? "text-amber-400" : sq.type === "subscription" ? "text-emerald-400" : "text-primary"
                    )}>{sq.type}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{sq.lastRun.slice(0, 10)}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedSavedQuery ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{selectedSavedQuery.name}</h3>
                    <button
                      onClick={() => { setQuery(selectedSavedQuery.query); setVariables(selectedSavedQuery.variables); setTab("Explorer"); }}
                      className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded-md transition-colors"
                    >
                      Open in Explorer
                    </button>
                  </div>
                  <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2 font-semibold">Query</div>
                    <pre className="text-xs font-mono text-[var(--color-text-primary)] leading-relaxed">{selectedSavedQuery.query}</pre>
                  </div>
                  <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2 font-semibold">Variables</div>
                    <pre className="text-xs font-mono text-[var(--color-text-primary)] leading-relaxed">{selectedSavedQuery.variables}</pre>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">Last run: {selectedSavedQuery.lastRun.slice(0, 19).replace("T", " ")}</div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl mb-3">📋</div>
                    <div className="text-sm text-[var(--color-text-muted)]">Select a saved query</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
