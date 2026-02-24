import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from "../lib/utils";

/**
 * DEVELOPER CONSOLE
 * 
 * A comprehensive developer utility for Horizon UI.
 * Includes:
 * 1. API Tester: REST client with history and pretty-printing.
 * 2. Log Stream: Simulated real-time gateway logs with filtering.
 * 3. Gateway Inspector: Status metrics and WebSocket frame monitoring.
 */

// --- Types ---

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Header {
  key: string;
  value: string;
}

interface ApiRequest {
  id: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: string;
  timestamp: number;
}

interface ApiResponse {
  status: number;
  time: number;
  data: unknown;
  headers: Record<string, string>;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface WsFrame {
  id: string;
  type: 'ping' | 'pong' | 'message' | 'event';
  direction: 'in' | 'out';
  payload: string;
  timestamp: string;
}

interface GatewayEvent {
  id: string;
  type: string;
  timestamp: string;
}

// --- Constants & Seeds ---

const SEED_REQUESTS: ApiRequest[] = [
  {
    id: 'seed-1',
    method: 'GET',
    url: '/api/agents',
    headers: [{ key: 'Authorization', value: 'Bearer horizon_token_abc123' }],
    body: '',
    timestamp: Date.now() - 5000,
  },
  {
    id: 'seed-2',
    method: 'POST',
    url: '/api/sessions',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer horizon_token_abc123' }
    ],
    body: JSON.stringify({ label: 'new-session', model: 'gemini-2.0-flash' }, null, 2),
    timestamp: Date.now() - 10000,
  },
  {
    id: 'seed-3',
    method: 'GET',
    url: '/api/health',
    headers: [],
    body: '',
    timestamp: Date.now() - 15000,
  }
];

const INITIAL_LOGS: LogEntry[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `log-seed-${i}`,
  timestamp: new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString(),
  level: (['INFO', 'DEBUG', 'WARN', 'ERROR'] as LogLevel[])[Math.floor(Math.random() * 4)],
  message: [
    'Gateway daemon started on port 3001',
    'Session agent:luis:123 initialized',
    'Received heartbeat from agent:reed',
    'WebSocket connection established',
    'Failed to resolve peer: node-882 (timeout)',
    'Database migration completed',
    'Authenticated user: david@horizon.ai',
    'Broadcasting event: session.update',
    'Rate limit warning for IP 192.168.1.1',
    'Cleaning up expired sessions...'
  ][Math.floor(Math.random() * 10)] + ` (Iteration ${i})`,
}));

const INITIAL_FRAMES: WsFrame[] = [
  { id: 'f1', type: 'message', direction: 'in', payload: '{"action":"subscribe","channel":"logs"}', timestamp: '12:00:01' },
  { id: 'f2', type: 'event', direction: 'out', payload: '{"event":"subscribed","channel":"logs"}', timestamp: '12:00:01' },
  { id: 'f3', type: 'ping', direction: 'out', payload: 'heartbeat', timestamp: '12:00:15' },
  { id: 'f4', type: 'pong', direction: 'in', payload: 'heartbeat', timestamp: '12:00:15' },
];

const INITIAL_EVENTS: GatewayEvent[] = [
  { id: 'e1', type: 'session.create', timestamp: '12:05:10' },
  { id: 'e2', type: 'agent.heartbeat', timestamp: '12:05:15' },
  { id: 'e3', type: 'cron.fire', timestamp: '12:06:00' },
  { id: 'e4', type: 'agent.heartbeat', timestamp: '12:06:15' },
];

// --- Components ---

/**
 * Syntax highlighted JSON viewer
 */
const JsonViewer: React.FC<{ data: unknown }> = ({ data }) => {
  const formatValue = (val: unknown) => {
    if (typeof val === 'string') {return <span className="text-emerald-400">"{val}"</span>;}
    if (typeof val === 'number') {return <span className="text-amber-400">{val}</span>;}
    if (typeof val === 'boolean') {return <span className="text-indigo-400">{val.toString()}</span>;}
    if (val === null) {return <span className="text-rose-400">null</span>;}
    return val;
  };

  const prettyJson = JSON.stringify(data, null, 2);
  
  // Very basic regex-based highlighting for the demo UI
  const lines = prettyJson.split('\n');

  return (
    <pre className="font-mono text-sm overflow-x-auto whitespace-pre p-4 bg-zinc-950 rounded border border-zinc-800">
      {lines.map((line, i) => {
        // This is a naive highlight, but meets the "colored strings/numbers/etc" requirement
        const keyMatch = line.match(/^(\s*)"([^"]+)":/);
        const valueMatch = line.match(/:\s*(.*)$/);
        
        if (keyMatch && valueMatch) {
          const indent = keyMatch[1];
          const key = keyMatch[2];
          const valRaw = valueMatch[1].replace(/,$/, '');
          const hasComma = valueMatch[1].endsWith(',');
          
          let valElement: React.ReactNode = valRaw;
          if (valRaw === 'null') {valElement = <span className="text-rose-400">null</span>;}
          else if (valRaw === 'true' || valRaw === 'false') {valElement = <span className="text-indigo-400">{valRaw}</span>;}
          else if (!isNaN(Number(valRaw)) && valRaw !== '') {valElement = <span className="text-amber-400">{valRaw}</span>;}
          else if (valRaw.startsWith('"')) {valElement = <span className="text-emerald-400">{valRaw}</span>;}

          return (
            <div key={i}>
              {indent}"<span className="text-white opacity-80">{key}</span>": {valElement}{hasComma && ','}
            </div>
          );
        }
        return <div key={i}>{line}</div>;
      })}
    </pre>
  );
};

export default function DeveloperConsole() {
  const [activeTab, setActiveTab] = useState<'api' | 'logs' | 'gateway'>('api');

  // API Tester State
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('/api/agents');
  const [headers, setHeaders] = useState<Header[]>([{ key: '', value: '' }]);
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [history, setHistory] = useState<ApiRequest[]>(SEED_REQUESTS);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);
  const [isRespHeadersOpen, setIsRespHeadersOpen] = useState(false);

  // Logs State
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [logFilter, setLogFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Gateway State
  const [frames] = useState<WsFrame[]>(INITIAL_FRAMES);
  const [events] = useState<GatewayEvent[]>(INITIAL_EVENTS);

  // Simulated log injection
  useEffect(() => {
    const interval = setInterval(() => {
      const levels: LogLevel[] = ['INFO', 'DEBUG', 'WARN', 'ERROR'];
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        level: levels[Math.floor(Math.random() * levels.length)],
        message: `Simulated gateway activity: ${Math.random().toString(36).substring(7)}`,
      };
      setLogs(prev => [...prev.slice(-99), newLog]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Actions
  const handleSendRequest = () => {
    // Simulated API call
    const start = Date.now();
    setTimeout(() => {
      const mockResponse: ApiResponse = {
        status: url.includes('error') ? 500 : url.includes('404') ? 404 : 200,
        time: Date.now() - start + Math.floor(Math.random() * 50),
        data: {
          success: !url.includes('error'),
          timestamp: new Date().toISOString(),
          request: { method, url, body: body ? JSON.parse(body) : null },
          items: method === 'GET' ? [{ id: 1, name: 'Agent Alpha' }, { id: 2, name: 'Agent Beta' }] : undefined
        },
        headers: {
          'content-type': 'application/json',
          'x-request-id': crypto.randomUUID(),
          'server': 'Horizon-Gateway/1.0.0'
        }
      };
      setResponse(mockResponse);
      
      const newHistoryItem: ApiRequest = {
        id: crypto.randomUUID(),
        method,
        url,
        headers: [...headers],
        body,
        timestamp: Date.now()
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 5));
    }, 400);
  };

  const restoreRequest = (req: ApiRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers);
    setBody(req.body);
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index));
  const updateHeader = (index: number, field: keyof Header, val: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = val;
    setHeaders(newHeaders);
  };

  const filteredLogs = logs.filter(l => logFilter === 'ALL' || l.level === logFilter);

  return (
    <div className="flex flex-col h-full min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Tabs Nav */}
      <nav className="flex items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-900" role="tablist">
        {(['api', 'logs', 'gateway'] as const).map(tab => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === tab 
                ? "bg-zinc-800 text-indigo-400" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {tab.toUpperCase()} {tab === 'api' ? 'Tester' : tab === 'logs' ? 'Stream' : 'Inspector'}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-4">
        {activeTab === 'api' && (
          <div className="flex gap-4 h-full animate-in fade-in duration-300">
            {/* Left: Client */}
            <div className="flex-1 flex flex-col gap-4">
              <section className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-xl">
                <div className="flex gap-2 mb-4">
                  <select 
                    value={method}
                    onChange={(e) => setMethod(e.target.value as HttpMethod)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="HTTP Method"
                  >
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://api.horizon.ai/v1/..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Request URL"
                  />
                  <button 
                    onClick={handleSendRequest}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded text-sm font-bold transition-all shadow-lg active:scale-95"
                  >
                    SEND
                  </button>
                </div>

                {/* Headers */}
                <div className="mb-4">
                  <button 
                    onClick={() => setIsHeadersOpen(!isHeadersOpen)}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 mb-2 uppercase tracking-widest"
                    aria-expanded={isHeadersOpen}
                  >
                    {isHeadersOpen ? '▼' : '▶'} Headers ({headers.length})
                  </button>
                  {isHeadersOpen && (
                    <div className="space-y-2 border-l-2 border-zinc-800 pl-4 py-2">
                      {headers.map((h, i) => (
                        <div key={i} className="flex gap-2">
                          <input 
                            placeholder="Key" 
                            value={h.key} 
                            onChange={(e) => updateHeader(i, 'key', e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
                          />
                          <input 
                            placeholder="Value" 
                            value={h.value} 
                            onChange={(e) => updateHeader(i, 'value', e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
                          />
                          <button 
                            onClick={() => removeHeader(i)}
                            className="text-rose-400 hover:bg-rose-900/20 w-8 h-8 rounded"
                            aria-label="Remove Header"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={addHeader}
                        className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded"
                      >
                        + ADD HEADER
                      </button>
                    </div>
                  )}
                </div>

                {/* Body */}
                {(['POST', 'PUT', 'PATCH'] as HttpMethod[]).includes(method) && (
                  <div>
                    <label className="text-xs font-bold text-zinc-500 mb-2 block uppercase tracking-widest">Request Body (JSON)</label>
                    <textarea 
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      spellCheck={false}
                    />
                  </div>
                )}
              </section>

              {/* Response Panel */}
              {response && (
                <section className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-xl flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold uppercase",
                        response.status < 300 ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800" :
                        response.status < 500 ? "bg-amber-900/30 text-amber-400 border border-amber-800" :
                        "bg-rose-900/30 text-rose-400 border border-rose-800"
                      )}>
                        Status: {response.status}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">{response.time}ms</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    <JsonViewer data={response.data} />
                    
                    <button 
                      onClick={() => setIsRespHeadersOpen(!isRespHeadersOpen)}
                      className="text-xs font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 my-4 uppercase tracking-widest"
                      aria-expanded={isRespHeadersOpen}
                    >
                      {isRespHeadersOpen ? '▼' : '▶'} Response Headers
                    </button>
                    {isRespHeadersOpen && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded p-2">
                        {Object.entries(response.headers).map(([k, v]) => (
                          <div key={k} className="flex text-xs font-mono py-1 border-b border-zinc-900 last:border-0">
                            <span className="text-indigo-400 w-32 shrink-0">{k}:</span>
                            <span className="text-zinc-400 break-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar: History */}
            <aside className="w-64 flex flex-col gap-4">
              <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-xl flex-1 overflow-hidden">
                <h2 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest">History</h2>
                <div className="space-y-2 overflow-y-auto h-[calc(100%-2rem)]">
                  {history.map(req => (
                    <button
                      key={req.id}
                      onClick={() => restoreRequest(req)}
                      className="w-full text-left p-2 rounded bg-zinc-950 border border-zinc-800 hover:border-indigo-500 transition-colors group"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn(
                          "text-[10px] font-bold px-1 rounded",
                          req.method === 'GET' ? 'text-emerald-400 bg-emerald-400/10' :
                          req.method === 'POST' ? 'text-indigo-400 bg-indigo-400/10' :
                          'text-amber-400 bg-amber-400/10'
                        )}>
                          {req.method}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 truncate group-hover:text-white">
                        {req.url}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Toolbar */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="log-filter" className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Level:</label>
                  <select 
                    id="log-filter"
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value as LogLevel | 'ALL')}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="ALL">ALL LEVELS</option>
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={autoScroll} 
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  AUTO-SCROLL
                </label>
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] bg-zinc-800 hover:bg-rose-900/30 hover:text-rose-400 text-zinc-400 px-3 py-1 rounded transition-colors border border-zinc-700"
              >
                CLEAR LOGS
              </button>
            </div>

            {/* Log Output */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1 bg-zinc-950">
              {filteredLogs.map(log => (
                <div key={log.id} className="group flex gap-3 leading-relaxed hover:bg-zinc-900/50 px-2 rounded -mx-2 transition-colors">
                  <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <span className={cn(
                    "font-bold shrink-0 w-16",
                    log.level === 'DEBUG' ? "text-indigo-400" :
                    log.level === 'INFO' ? "text-emerald-400" :
                    log.level === 'WARN' ? "text-amber-400" :
                    "text-rose-400"
                  )}>
                    {log.level}
                  </span>
                  <span className="text-zinc-300 break-all">{log.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
              {filteredLogs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <div className="text-4xl opacity-20">No logs found</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gateway' && (
          <div className="grid grid-cols-12 gap-4 h-full animate-in slide-in-from-bottom-4 duration-300">
            {/* Stats Overview */}
            <div className="col-span-12 grid grid-cols-4 gap-4">
              {[
                { label: 'Status', value: 'Connected', color: 'text-emerald-400' },
                { label: 'Uptime', value: '4d 12h 05m', color: 'text-white' },
                { label: 'Active Sessions', value: '12', color: 'text-indigo-400' },
                { label: 'Active Agents', value: '8', color: 'text-amber-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg shadow-xl">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{stat.label}</div>
                  <div className={cn("text-xl font-bold font-mono", stat.color)}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* WebSocket Frame Log */}
            <div className="col-span-8 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col overflow-hidden shadow-xl">
              <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">WebSocket Frames</h3>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-zinc-500 font-bold">STREAMING</span>
                </span>
              </div>
              <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-zinc-600 border-b border-zinc-800">
                      <th className="pb-2 font-medium w-24 text-center">Dir</th>
                      <th className="pb-2 font-medium w-24">Type</th>
                      <th className="pb-2 font-medium">Payload</th>
                      <th className="pb-2 font-medium w-24 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {frames.map(f => (
                      <tr key={f.id} className="hover:bg-zinc-900/50">
                        <td className="py-2 text-center">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-sm font-bold text-[9px]",
                            f.direction === 'in' ? "bg-indigo-900/30 text-indigo-400" : "bg-emerald-900/30 text-emerald-400"
                          )}>
                            {f.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="text-zinc-400 uppercase">{f.type}</span>
                        </td>
                        <td className="py-2 font-mono text-zinc-500 truncate max-w-0">
                          {f.payload}
                        </td>
                        <td className="py-2 text-right text-zinc-600">
                          {f.timestamp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Events & Performance */}
            <div className="col-span-4 flex flex-col gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-xl flex-1">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Recent Events</h3>
                <div className="space-y-3">
                  {events.map(e => (
                    <div key={e.id} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-indigo-500/50 rounded-full" />
                        <span className="font-mono text-zinc-300">{e.type}</span>
                      </div>
                      <span className="text-zinc-600 font-mono">{e.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-xl">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Performance</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold mb-1 uppercase">
                      <span>Messages / Min</span>
                      <span>42</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full" style={{ width: '42%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold mb-1 uppercase">
                      <span>Error Rate</span>
                      <span className="text-rose-400">0.02%</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: '2%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
