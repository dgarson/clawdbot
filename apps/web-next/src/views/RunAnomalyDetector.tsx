import React, { useState, useMemo } from 'react';

// Simple classnames utility (inline since lib/utils doesn't exist)
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Types
interface RunData {
  id: string;
  name: string;
  timestamp: string;
  cost: number;
  findings: number;
  duration: number; // in seconds
}

interface ThresholdConfig {
  cost: { min: number; max: number };
  findings: { min: number; max: number };
  duration: { min: number; max: number };
}

interface Alert {
  id: string;
  type: 'cost' | 'findings' | 'duration';
  severity: 'warning' | 'critical';
  message: string;
  runName: string;
  timestamp: string;
}

// Mock data for runs
const RUNS_DATA: RunData[] = [
  { id: '1', name: 'Discovery-2026-02-20', timestamp: '2026-02-20T08:30:00Z', cost: 12.50, findings: 145, duration: 3420 },
  { id: '2', name: 'Discovery-2026-02-19', timestamp: '2026-02-19T09:15:00Z', cost: 14.20, findings: 189, duration: 3840 },
  { id: '3', name: 'Discovery-2026-02-18', timestamp: '2026-02-18T07:45:00Z', cost: 8.75, findings: 92, duration: 2100 },
  { id: '4', name: 'Discovery-2026-02-17', timestamp: '2026-02-17T10:00:00Z', cost: 45.00, findings: 312, duration: 7200 }, // Anomaly: high cost
  { id: '5', name: 'Discovery-2026-02-16', timestamp: '2026-02-16T08:00:00Z', cost: 11.30, findings: 134, duration: 3180 },
  { id: '6', name: 'Discovery-2026-02-15', timestamp: '2026-02-15T09:30:00Z', cost: 13.80, findings: 12, duration: 3300 }, // Anomaly: low findings
  { id: '7', name: 'Discovery-2026-02-14', timestamp: '2026-02-14T08:45:00Z', cost: 10.90, findings: 156, duration: 2940 },
  { id: '8', name: 'Discovery-2026-02-13', timestamp: '2026-02-13T07:15:00Z', cost: 9.40, findings: 98, duration: 2400 },
  { id: '9', name: 'Discovery-2026-02-12', timestamp: '2026-02-12T10:30:00Z', cost: 52.00, findings: 287, duration: 8100 }, // Anomaly: high cost + duration
  { id: '10', name: 'Discovery-2026-02-11', timestamp: '2026-02-11T08:00:00Z', cost: 12.10, findings: 167, duration: 3600 },
  { id: '11', name: 'Discovery-2026-02-10', timestamp: '2026-02-10T09:00:00Z', cost: 2.50, findings: 8, duration: 600 }, // Anomaly: very low all metrics
  { id: '12', name: 'Discovery-2026-02-09', timestamp: '2026-02-09T08:30:00Z', cost: 11.80, findings: 142, duration: 3120 },
];

// Calculate statistics
function calculateStats(data: RunData[], field: 'cost' | 'findings' | 'duration') {
  const values = data.map(d => d[field]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, median, stdDev, min: Math.min(...values), max: Math.max(...values) };
}

// Detect anomalies based on standard deviation
function detectAnomalies(data: RunData[], thresholds: ThresholdConfig): { outliers: RunData[]; alerts: Alert[] } {
  const outliers: RunData[] = [];
  const alerts: Alert[] = [];
  
  const costStats = calculateStats(data, 'cost');
  const findingsStats = calculateStats(data, 'findings');
  const durationStats = calculateStats(data, 'duration');
  
  data.forEach(run => {
    const isCostOutlier = run.cost > costStats.mean + 2 * costStats.stdDev || run.cost < costStats.mean - 2 * costStats.stdDev;
    const isFindingsOutlier = run.findings > findingsStats.mean + 2 * findingsStats.stdDev || run.findings < findingsStats.mean - 2 * findingsStats.stdDev;
    const isDurationOutlier = run.duration > durationStats.mean + 2 * durationStats.stdDev || run.duration < durationStats.mean - 2 * durationStats.stdDev;
    
    // Check against thresholds
    const isCostThreshold = run.cost > thresholds.cost.max || run.cost < thresholds.cost.min;
    const isFindingsThreshold = run.findings > thresholds.findings.max || run.findings < thresholds.findings.min;
    const isDurationThreshold = run.duration > thresholds.duration.max || run.duration < thresholds.duration.min;
    
    if (isCostOutlier || isCostThreshold) {
      const severity = run.cost > costStats.mean + 3 * costStats.stdDev ? 'critical' : 'warning';
      outliers.push(run);
      alerts.push({
        id: `cost-${run.id}`,
        type: 'cost',
        severity,
        message: `Cost $${run.cost.toFixed(2)} is ${run.cost > costStats.mean ? 'above' : 'below'} normal (avg $${costStats.mean.toFixed(2)})`,
        runName: run.name,
        timestamp: run.timestamp,
      });
    }
    
    if (isFindingsOutlier || isFindingsThreshold) {
      const severity = run.findings > findingsStats.mean + 3 * findingsStats.stdDev || run.findings < findingsStats.mean - 3 * findingsStats.stdDev ? 'critical' : 'warning';
      if (!outliers.includes(run)) outliers.push(run);
      alerts.push({
        id: `findings-${run.id}`,
        type: 'findings',
        severity,
        message: `Findings ${run.findings} is ${run.findings > findingsStats.mean ? 'above' : 'below'} normal (avg ${findingsStats.mean.toFixed(0)})`,
        runName: run.name,
        timestamp: run.timestamp,
      });
    }
    
    if (isDurationOutlier || isDurationThreshold) {
      const severity = run.duration > durationStats.mean + 3 * durationStats.stdDev || run.duration < durationStats.mean - 3 * durationStats.stdDev ? 'critical' : 'warning';
      if (!outliers.includes(run)) outliers.push(run);
      alerts.push({
        id: `duration-${run.id}`,
        type: 'duration',
        severity,
        message: `Duration ${formatDuration(run.duration)} is ${run.duration > durationStats.mean ? 'above' : 'below'} normal (avg ${formatDuration(durationStats.mean)})`,
        runName: run.name,
        timestamp: run.timestamp,
      });
    }
  });
  
  return { outliers, alerts: alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Simple SVG Line Chart Component
function MiniChart({ data, field, color }: { data: RunData[]; field: 'cost' | 'findings' | 'duration'; color: string }) {
  const values = data.map(d => d[field]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  
  const width = 200;
  const height = 40;
  const padding = 4;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d[field] - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((d[field] - min) / range) * (height - 2 * padding);
        const isOutlier = d[field] > max || d[field] < min;
        if (isOutlier) {
          return (
            <circle
              key={d.id}
              cx={x}
              cy={y}
              r="3"
              fill="#ef4444"
              stroke="#fff"
              strokeWidth="1"
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

// Summary Card Component
function SummaryCard({ title, value, subtitle, trend }: { title: string; value: string; subtitle: string; trend?: 'up' | 'down' | 'neutral' }) {
  const trendColors = {
    up: 'text-red-400',
    down: 'text-green-400',
    neutral: 'text-gray-400',
  };
  
  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg shadow-sm">
      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-white">{value}</div>
        {trend && (
          <svg 
            className={cn("w-4 h-4", trend === 'up' && "rotate-180", trendColors[trend])} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        )}
      </div>
      <div className="text-gray-500 text-xs mt-1">{subtitle}</div>
    </div>
  );
}

// Alert Item Component
function AlertItem({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const severityStyles = {
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  };
  
  const typeIcons = {
    cost: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    findings: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    duration: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };
  
  return (
    <div 
      className={cn("flex items-start gap-3 p-3 rounded-lg border", severityStyles[alert.severity])}
      role="alert"
      aria-live={alert.severity === 'critical' ? 'assertive' : 'polite'}
    >
      <div className="flex-shrink-0 mt-0.5">{typeIcons[alert.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{alert.runName}</div>
        <div className="text-xs opacity-90 mt-0.5">{alert.message}</div>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss alert"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Threshold Config Component
function ThresholdPanel({ 
  thresholds, 
  onChange,
  stats 
}: { 
  thresholds: ThresholdConfig;
  onChange: (t: ThresholdConfig) => void;
  stats: { cost: ReturnType<typeof calculateStats>; findings: ReturnType<typeof calculateStats>; duration: ReturnType<typeof calculateStats> };
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Configure Thresholds
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Cost Threshold */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Cost ($)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={thresholds.cost.min}
              onChange={(e) => onChange({ ...thresholds, cost: { ...thresholds.cost, min: Number(e.target.value) } })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              aria-label="Minimum cost threshold"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              value={thresholds.cost.max}
              onChange={(e) => onChange({ ...thresholds, cost: { ...thresholds.cost, max: Number(e.target.value) } })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              aria-label="Maximum cost threshold"
            />
          </div>
          <div className="text-xs text-gray-500">Avg: ${stats.cost.mean.toFixed(2)}</div>
        </div>
        
        {/* Findings Threshold */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Findings</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={thresholds.findings.min}
              onChange={(e) => onChange({ ...thresholds, findings: { ...thresholds.findings, min: Number(e.target.value) } })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              aria-label="Minimum findings threshold"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              value={thresholds.findings.max}
              onChange={(e) => onChange({ ...thresholds, findings: { ...thresholds.findings, max: Number(e.target.value) } })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              aria-label="Maximum findings threshold"
            />
          </div>
          <div className="text-xs text-gray-500">Avg: {stats.findings.mean.toFixed(0)}</div>
        </div>
        
        {/* Duration Threshold */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Duration (min)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={Math.floor(thresholds.duration.min / 60)}
              onChange={(e) => onChange({ ...thresholds, duration: { ...thresholds.duration, min: Number(e.target.value) * 60 } })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              aria-label="Minimum duration threshold in minutes"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              value={Math.floor(thresholds.duration.max / 60)}
              onChange={(e) => onChange({ ...thresholds, duration: { ...thresholds.duration, max: Number(e.target.value) * 60 } })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              aria-label="Maximum duration threshold in minutes"
            />
          </div>
          <div className="text-xs text-gray-500">Avg: {formatDuration(stats.duration.mean)}</div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function RunAnomalyDetector() {
  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    cost: { min: 5, max: 30 },
    findings: { min: 50, max: 250 },
    duration: { min: 1800, max: 5400 },
  });
  
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  
  const stats = useMemo(() => ({
    cost: calculateStats(RUNS_DATA, 'cost'),
    findings: calculateStats(RUNS_DATA, 'findings'),
    duration: calculateStats(RUNS_DATA, 'duration'),
  }), []);
  
  const { outliers, alerts } = useMemo(() => detectAnomalies(RUNS_DATA, thresholds), [thresholds]);
  
  const activeAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));
  const outlierIds = new Set(outliers.map(o => o.id));
  
  const handleDismissAlert = (id: string) => {
    setDismissedAlerts(prev => new Set([...prev, id]));
  };
  
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Run Anomaly Detector</h1>
            <p className="text-gray-500 mt-1">Monitor and detect anomalies in discovery runs</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium">
              {RUNS_DATA.length} runs analyzed
            </span>
          </div>
        </header>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard 
            title="Total Runs" 
            value={RUNS_DATA.length.toString()} 
            subtitle={`${outliers.length} outliers detected`}
            trend="neutral"
          />
          <SummaryCard 
            title="Avg Cost" 
            value={`$${stats.cost.mean.toFixed(2)}`} 
            subtitle={`σ = $${stats.cost.stdDev.toFixed(2)}`}
            trend={stats.cost.mean > 15 ? 'up' : 'neutral'}
          />
          <SummaryCard 
            title="Avg Findings" 
            value={stats.findings.mean.toFixed(0)} 
            subtitle={`σ = ${stats.findings.stdDev.toFixed(0)}`}
            trend="neutral"
          />
          <SummaryCard 
            title="Avg Duration" 
            value={formatDuration(stats.duration.mean)} 
            subtitle={`σ = ${formatDuration(stats.duration.stdDev)}`}
            trend={stats.duration.mean > 3600 ? 'up' : 'neutral'}
          />
        </div>
        
        {/* Alerts Section */}
        {activeAlerts.length > 0 && (
          <section aria-labelledby="alerts-heading">
            <h2 id="alerts-heading" className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true"></span>
              Active Alerts ({activeAlerts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="list">
              {activeAlerts.slice(0, 6).map(alert => (
                <AlertItem key={alert.id} alert={alert} onDismiss={handleDismissAlert} />
              ))}
            </div>
            {activeAlerts.length > 6 && (
              <p className="text-sm text-gray-500 mt-2">
                +{activeAlerts.length - 6} more alerts
              </p>
            )}
          </section>
        )}
        
        {/* Threshold Configuration */}
        <section aria-labelledby="thresholds-heading">
          <h2 id="thresholds-heading" className="text-lg font-semibold text-white mb-3">Threshold Configuration</h2>
          <ThresholdPanel 
            thresholds={thresholds} 
            onChange={setThresholds}
            stats={stats}
          />
        </section>
        
        {/* Charts Section */}
        <section aria-labelledby="charts-heading">
          <h2 id="charts-heading" className="text-lg font-semibold text-white mb-4">Trend Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cost Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">Cost Over Time</h3>
                <span className="text-xs text-gray-500">USD</span>
              </div>
              <MiniChart data={RUNS_DATA} field="cost" color="#3b82f6" />
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>${stats.cost.min.toFixed(2)}</span>
                <span>${stats.cost.max.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Findings Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">Findings Over Time</h3>
                <span className="text-xs text-gray-500">Count</span>
              </div>
              <MiniChart data={RUNS_DATA} field="findings" color="#10b981" />
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>{stats.findings.min}</span>
                <span>{stats.findings.max}</span>
              </div>
            </div>
            
            {/* Duration Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">Duration Over Time</h3>
                <span className="text-xs text-gray-500">Seconds</span>
              </div>
              <MiniChart data={RUNS_DATA} field="duration" color="#8b5cf6" />
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>{formatDuration(stats.duration.min)}</span>
                <span>{formatDuration(stats.duration.max)}</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Runs Table */}
        <section aria-labelledby="runs-heading">
          <h2 id="runs-heading" className="text-lg font-semibold text-white mb-4">All Runs</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800/50 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Run Name</th>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium text-right">Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Findings</th>
                    <th className="px-4 py-3 font-medium text-right">Duration</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {RUNS_DATA.map(run => {
                    const isOutlier = outlierIds.has(run.id);
                    const isSelected = selectedRun === run.id;
                    
                    return (
                      <tr 
                        key={run.id} 
                        className={cn(
                          "hover:bg-gray-800/30 cursor-pointer transition-colors",
                          isOutlier && "bg-red-500/5",
                          isSelected && "bg-blue-500/10"
                        )}
                        onClick={() => setSelectedRun(isSelected ? null : run.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isOutlier && (
                              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Anomaly detected">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            )}
                            <span className="text-white font-medium">{run.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(run.timestamp).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-mono",
                          run.cost > thresholds.cost.max || run.cost < thresholds.cost.min ? "text-red-400" : "text-gray-300"
                        )}>
                          ${run.cost.toFixed(2)}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-mono",
                          run.findings > thresholds.findings.max || run.findings < thresholds.findings.min ? "text-red-400" : "text-gray-300"
                        )}>
                          {run.findings}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-mono",
                          run.duration > thresholds.duration.max || run.duration < thresholds.duration.min ? "text-red-400" : "text-gray-300"
                        )}>
                          {formatDuration(run.duration)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isOutlier ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight bg-red-500/10 text-red-400">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Outlier
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight bg-green-500/10 text-green-400">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        
        {/* Info Note */}
        <div className="flex items-center gap-3 p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-400">
          <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            Anomalies are detected using statistical analysis (2 standard deviations from mean). 
            Red values in the table indicate runs that exceed configured thresholds.
          </p>
        </div>
      </div>
    </div>
  );
}
