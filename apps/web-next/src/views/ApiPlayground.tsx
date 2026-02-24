import React, { useState, useCallback, useRef } from 'react';
import { Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

// ============================================================================
// Types
// ============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Header {
  id: string;
  key: string;
  value: string;
}

interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  label: string;
  description: string;
  hasBody: boolean;
}

interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  time: number;
}

// ============================================================================
// Pre-built Endpoints
// ============================================================================

const ENDPOINTS: Endpoint[] = [
  {
    id: 'sessions',
    method: 'GET',
    path: '/sessions',
    label: 'GET /sessions',
    description: 'List active sessions',
    hasBody: false,
  },
  {
    id: 'run-agent',
    method: 'POST',
    path: '/agents/:id/run',
    label: 'POST /agents/:id/run',
    description: 'Run agent',
    hasBody: true,
  },
  {
    id: 'agents',
    method: 'GET',
    path: '/agents',
    label: 'GET /agents',
    description: 'List all agents',
    hasBody: false,
  },
  {
    id: 'usage',
    method: 'GET',
    path: '/usage',
    label: 'GET /usage',
    description: 'Usage stats',
    hasBody: false,
  },
  {
    id: 'delete-session',
    method: 'DELETE',
    path: '/sessions/:id',
    label: 'DELETE /sessions/:id',
    description: 'End session',
    hasBody: false,
  },
  {
    id: 'messages',
    method: 'POST',
    path: '/messages',
    label: 'POST /messages',
    description: 'Send message',
    hasBody: true,
  },
];

// ============================================================================
// Simulated Responses
// ============================================================================

const SIMULATED_RESPONSES: Record<string, { body: unknown; status: number; statusText: string }> = {
  'GET:/sessions': {
    status: 200,
    statusText: 'OK',
    body: {
      sessions: [
        { id: 'sess_abc123', agentId: 'agent_001', status: 'active', startedAt: '2026-02-22T01:30:00Z', messagesCount: 47 },
        { id: 'sess_def456', agentId: 'agent_002', status: 'idle', startedAt: '2026-02-22T01:15:00Z', messagesCount: 12 },
        { id: 'sess_ghi789', agentId: 'agent_003', status: 'active', startedAt: '2026-02-22T00:45:00Z', messagesCount: 183 },
      ],
      total: 3,
      page: 1,
      pageSize: 50,
    },
  },
  'POST:/agents/:id/run': {
    status: 200,
    statusText: 'OK',
    body: {
      runId: 'run_xyz789',
      agentId: 'agent_001',
      status: 'started',
      startedAt: '2026-02-22T02:08:00Z',
      estimatedDuration: '30s',
    },
  },
  'GET:/agents': {
    status: 200,
    statusText: 'OK',
    body: {
      agents: [
        { id: 'agent_001', name: 'Piper', status: 'online', model: 'MiniMax-M2.5', createdAt: '2026-01-15T10:00:00Z' },
        { id: 'agent_002', name: 'Quinn', status: 'online', model: 'MiniMax-M2.5', createdAt: '2026-01-18T14:30:00Z' },
        { id: 'agent_003', name: 'Reed', status: 'offline', model: 'GPT-4', createdAt: '2026-01-20T09:15:00Z' },
        { id: 'agent_004', name: 'Sam', status: 'online', model: 'MiniMax-M2.5', createdAt: '2026-02-01T16:45:00Z' },
      ],
      total: 4,
    },
  },
  'GET:/usage': {
    status: 200,
    statusText: 'OK',
    body: {
      period: '2026-02-01 to 2026-02-22',
      requests: { total: 15420, successful: 15123, failed: 297 },
      tokens: { input: 2847392, output: 5921034, total: 8768426 },
      sessions: { active: 3, total: 127 },
      cost: { total: 42.87, currency: 'USD' },
    },
  },
  'DELETE:/sessions/:id': {
    status: 200,
    statusText: 'OK',
    body: {
      id: 'sess_abc123',
      status: 'ended',
      endedAt: '2026-02-22T02:08:15Z',
      message: 'Session terminated successfully',
    },
  },
  'POST:/messages': {
    status: 201,
    statusText: 'Created',
    body: {
      messageId: 'msg_12345',
      sessionId: 'sess_abc123',
      role: 'user',
      content: 'Hello, agent!',
      timestamp: '2026-02-22T02:08:00Z',
    },
  },
};

const ERROR_RESPONSE = {
  status: 404,
  statusText: 'Not Found',
  body: { error: 'Resource not found', message: 'The requested endpoint does not exist' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function simulateNetworkDelay(): Promise<number> {
  const delay = Math.floor(Math.random() * 1000) + 500;
  return new Promise((resolve) => setTimeout(() => resolve(delay), delay));
}

// ============================================================================
// Main Component
// ============================================================================

export function ApiPlayground() {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('/sessions');
  const [headers, setHeaders] = useState<Header[]>([
    { id: generateId(), key: 'Authorization', value: 'Bearer sk_test_123' },
    { id: generateId(), key: 'Content-Type', value: 'application/json' },
  ]);
  const [body, setBody] = useState('{\n  "prompt": "Hello, world!",\n  "model": "MiniMax-M2.5"\n}');
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState('sessions');

  const sendButtonRef = useRef<HTMLButtonElement>(null);

  const handleEndpointChange = useCallback((endpointId: string) => {
    const endpoint = ENDPOINTS.find((e) => e.id === endpointId);
    if (endpoint) {
      setSelectedEndpoint(endpointId);
      setMethod(endpoint.method);
      setPath(endpoint.path);
    }
  }, []);

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { id: generateId(), key: '', value: '' }]);
  }, []);

  const removeHeader = useCallback((id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const updateHeader = useCallback((id: string, field: 'key' | 'value', value: string) => {
    setHeaders((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  }, []);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResponse(null);

    const delay = await simulateNetworkDelay();
    const endpointKey = `${method}:${path.split(':')[0]}`;
    const result = SIMULATED_RESPONSES[endpointKey] || ERROR_RESPONSE;
    const contentLength = result.body ? JSON.stringify(result.body).length : 0;

    setResponse({
      status: result.status,
      statusText: result.statusText,
      headers: {
        'content-type': 'application/json',
        'x-request-id': `req_${generateId()}`,
        'x-response-time': `${delay}ms`,
        'content-length': contentLength.toString(),
      },
      body: result.body,
      time: delay,
    });

    setLoading(false);
    sendButtonRef.current?.focus();
  }, [method, path]);

  const copyResponse = useCallback(() => {
    if (response) {
      void navigator.clipboard.writeText(JSON.stringify(response.body, null, 2));
    }
  }, [response]);

  const isBodyVisible = method === 'POST' || method === 'PUT' || method === 'PATCH';

  return (
    <div className="min-h-screen bg-surface-0 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-fg-primary">API Playground</h1>
          <p className="text-sm text-fg-secondary mt-1">
            Test OpenClaw API endpoints interactively
          </p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Request Builder */}
          <div className="bg-surface-1 rounded-lg border border-tok-border p-4 space-y-4">
            {/* Endpoint Selector */}
            <div>
              <label htmlFor="endpoint-select" className="block text-xs font-medium text-fg-secondary mb-2">
                Quick Select
              </label>
              <select
                id="endpoint-select"
                value={selectedEndpoint}
                onChange={(e) => handleEndpointChange(e.target.value)}
                className="w-full bg-surface-2 border border-tok-border rounded-md px-3 py-2 text-sm text-fg-primary
                  focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                {ENDPOINTS.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id}>
                    {endpoint.label} — {endpoint.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Method & URL */}
            <div>
              <label className="block text-xs font-medium text-fg-secondary mb-2">Request</label>
              <div className="flex gap-2">
                {/* Method Buttons */}
                <div className="flex rounded-md bg-surface-2 p-1" role="radiogroup" aria-label="HTTP Method">
                  {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => setMethod(m)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                        method === m
                          ? 'bg-indigo-600 text-fg-primary'
                          : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3',
                        'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL Input */}
              <div className="mt-2 flex items-center bg-surface-2 border border-tok-border rounded-md overflow-hidden">
                <span className="px-3 py-2 text-sm text-fg-muted bg-surface-2 border-r border-tok-border select-none">
                  https://api.clawdbot.io/v1
                </span>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  aria-label="API path"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-fg-primary placeholder-zinc-500
                    focus-visible:outline-none"
                  placeholder="/endpoint"
                />
              </div>
            </div>

            {/* Headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-fg-secondary">Headers</label>
                <button
                  onClick={addHeader}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors
                    focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded px-1"
                  aria-label="Add header"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {headers.map((header) => (
                  <div key={header.id} className="flex gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(header.id, 'key', e.target.value)}
                      placeholder="Key"
                      aria-label={`Header key ${header.id}`}
                      className="flex-1 bg-surface-2 border border-tok-border rounded px-2 py-1.5 text-sm text-fg-primary placeholder-zinc-500
                        focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
                      placeholder="Value"
                      aria-label={`Header value ${header.id}`}
                      className="flex-1 bg-surface-2 border border-tok-border rounded px-2 py-1.5 text-sm text-fg-primary placeholder-zinc-500
                        focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    />
                    <button
                      onClick={() => removeHeader(header.id)}
                      className="px-2 text-fg-muted hover:text-red-400 transition-colors
                        focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded"
                      aria-label={`Remove header ${header.key}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            {isBodyVisible && (
              <div>
                <label htmlFor="request-body" className="block text-xs font-medium text-fg-secondary mb-2">
                  Request Body
                </label>
                <textarea
                  id="request-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  aria-label="Request body JSON"
                  className="w-full bg-surface-2 border border-tok-border rounded-md px-3 py-2 text-sm text-fg-primary font-mono
                    placeholder-zinc-500 resize-none
                    focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                  placeholder='{"key": "value"}'
                />
              </div>
            )}

            {/* Send Button */}
            <button
              ref={sendButtonRef}
              onClick={handleSend}
              disabled={loading}
              className={cn(
                'w-full py-2.5 rounded-md font-medium text-sm transition-all',
                loading
                  ? 'bg-surface-3 text-fg-muted cursor-not-allowed'
                  : 'bg-indigo-600 text-fg-primary hover:bg-indigo-500 active:bg-indigo-700',
                'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none'
              )}
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>

          {/* Right Panel - Response */}
          <div className="bg-surface-1 rounded-lg border border-tok-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-fg-primary">Response</h2>
              {response && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      response.status >= 200 && response.status < 300
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    )}
                  >
                    {response.status} {response.statusText}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-2 text-xs text-fg-secondary">
                    {response.time}ms
                  </span>
                </div>
              )}
            </div>

            {/* Response Body */}
            <div className="flex-1 min-h-[300px]">
              {response ? (
                <pre className="bg-surface-2 rounded-md p-3 text-xs font-mono text-green-400 overflow-auto h-full max-h-[400px]">
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              ) : (
                <div className="bg-surface-2 rounded-md h-full min-h-[300px] flex items-center justify-center">
                  <ContextualEmptyState
                    icon={Play}
                    title="Ready to explore"
                    description="Select an endpoint and send a request to see the response here."
                    size="sm"
                  />
                </div>
              )}
            </div>

            {/* Response Headers */}
            {response && (
              <div>
                <button
                  onClick={() => setShowHeaders(!showHeaders)}
                  className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary transition-colors
                    focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded"
                  aria-expanded={showHeaders}
                  aria-controls="response-headers"
                >
                  <span className={cn('transition-transform', showHeaders && 'rotate-90')}>▶</span>
                  Response Headers
                </button>
                {showHeaders && (
                  <div id="response-headers" className="mt-2 bg-surface-2 rounded-md p-3 space-y-1">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="flex text-xs">
                        <span className="text-fg-muted w-32 shrink-0">{key}:</span>
                        <span className="text-fg-primary font-mono truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Copy Button */}
            {response && (
              <button
                onClick={copyResponse}
                className="w-full py-2 bg-surface-2 border border-tok-border rounded-md text-sm text-fg-primary
                  hover:bg-surface-3 hover:text-fg-primary transition-colors
                  focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                📋 Copy Response
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiPlayground;
