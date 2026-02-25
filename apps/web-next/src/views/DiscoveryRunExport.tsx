import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  Check,
  FileJson2,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Download,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'json' | 'csv' | 'markdown';
type ExportState = 'idle' | 'preparing' | 'ready';

interface ExportOptions {
  includeEvidence: boolean;
  includeAttribution: boolean;
  includeRawTools: boolean;
  includeRemediation: boolean;
}

interface RunSummary {
  runId: string;
  date: string;
  agentCount: number;
  findingCount: number;
  duration: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RUN: RunSummary = {
  runId: 'disc-run-2026-0223-a7f3',
  date: 'Feb 23, 2026 at 10:00 AM MST',
  agentCount: 15,
  findingCount: 247,
  duration: '4h 22m',
};

// ─── Format Previews ─────────────────────────────────────────────────────────

const JSON_PREVIEW = `{
  "run_id": "disc-run-2026-0223-a7f3",
  "generated_at": "2026-02-23T17:22:00Z",
  "agent_count": 15,
  "findings": [
    {
      "id": "f-001",
      "agent": "Atlas",
      "severity": "high",
      "title": "Unpatched CVE in auth layer",
      "evidence": "...",
      "remediation": "..."
    }
  ]
}`;

const CSV_PREVIEW = `finding_id, agent_name, domain, severity, title, evidence, tool_call, remediation
f-001,      Atlas,      AI Infra, high,   Unpatched CVE in auth layer, ..., ..., ...
f-002,      Beacon,     Dev Tools, medium, Stale API key in config,     ..., ..., ...`;

const MD_PREVIEW = `# Discovery Run Report — disc-run-2026-0223-a7f3
**Date:** Feb 23, 2026  |  **Agents:** 15  |  **Findings:** 247

## High Severity (12)
### [Atlas] Unpatched CVE in auth layer
> Evidence: Token validation bypass possible via malformed JWT...`;

// ─── Format Card ─────────────────────────────────────────────────────────────

interface FormatCardProps {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  preview: string;
  selected: boolean;
  onSelect: (id: ExportFormat) => void;
}

function FormatCard({ id, label, description, icon, preview, selected, onSelect }: FormatCardProps) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        'relative w-full text-left rounded-xl border p-4 transition-all duration-150',
        'bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]/80',
        selected
          ? 'border-primary ring-1 ring-violet-500/40'
          : 'border-[var(--color-border)] hover:border-[var(--color-border)]',
      )}
    >
      {/* Selected checkmark */}
      {selected && (
        <span className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-primary">
          <Check className="w-3 h-3 text-[var(--color-text-primary)]" />
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className={cn('text-[var(--color-text-secondary)]', selected && 'text-primary')}>{icon}</span>
        <span className="font-semibold text-[var(--color-text-primary)] text-sm">{label}</span>
      </div>
      <p className="text-[var(--color-text-secondary)] text-xs mb-3">{description}</p>

      {/* Preview */}
      <pre className="rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {preview}
      </pre>
    </button>
  );
}

// ─── Checkbox Option ──────────────────────────────────────────────────────────

interface CheckboxOptionProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  warning?: string;
}

function CheckboxOption({ id, label, checked, onChange, warning }: CheckboxOptionProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer group"
    >
      <div className="mt-0.5 relative flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={cn(
            'w-4 h-4 rounded border transition-colors',
            checked
              ? 'bg-primary border-primary'
              : 'bg-[var(--color-surface-2)] border-[var(--color-border)] group-hover:border-[var(--color-surface-3)]',
          )}
        >
          {checked && <Check className="w-3 h-3 text-[var(--color-text-primary)] absolute top-0.5 left-0.5" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
        {warning && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-400">{warning}</span>
          </div>
        )}
      </div>
    </label>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ExportProgressBar({ state }: { state: ExportState }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (state !== 'preparing') {
      setProgress(0);
      return;
    }
    setProgress(0);
    const start = performance.now();
    const duration = 1500;
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(Math.round(pct * 100));
      if (pct < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  if (state === 'idle') return null;

  if (state === 'ready') {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4" />
        Export ready ✓
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
          <span>Preparing export…</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── File Size Estimate ───────────────────────────────────────────────────────

function estimateSize(format: ExportFormat, options: ExportOptions): string {
  let base = format === 'json' ? 1.8 : format === 'csv' ? 0.6 : 0.4;
  if (options.includeEvidence) base += 0.5;
  if (options.includeAttribution) base += 0.1;
  if (options.includeRawTools) base += 2.2;
  if (options.includeRemediation) base += 0.3;
  return `~${base.toFixed(1)} MB`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiscoveryRunExport() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [options, setOptions] = useState<ExportOptions>({
    includeEvidence: true,
    includeAttribution: true,
    includeRawTools: false,
    includeRemediation: true,
  });

  const handleExport = () => {
    if (exportState !== 'idle') return;
    console.log('export', selectedFormat, options);
    setExportState('preparing');
    setTimeout(() => setExportState('ready'), 1500);
    setTimeout(() => setExportState('idle'), 4000);
  };

  const patchOption = (key: keyof ExportOptions) => (val: boolean) =>
    setOptions((prev) => ({ ...prev, [key]: val }));

  const formatLabel: Record<ExportFormat, string> = {
    json: 'JSON',
    csv: 'CSV',
    markdown: 'Markdown',
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => console.log('back')}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1 flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Export Discovery Run</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-primary)]">
              {MOCK_RUN.runId}
            </span>
          </div>
        </div>

        {/* ── Run Summary Card ── */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">Run Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Run ID', value: MOCK_RUN.runId.slice(-8), mono: true },
              { label: 'Date', value: MOCK_RUN.date },
              { label: 'Agents', value: MOCK_RUN.agentCount.toString() },
              { label: 'Findings', value: MOCK_RUN.findingCount.toString() },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <div className="text-xs text-[var(--color-text-muted)] mb-1">{label}</div>
                <div className={cn('text-sm text-[var(--color-text-primary)] font-medium', mono && 'font-mono')}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Duration</div>
            <div className="text-sm text-[var(--color-text-primary)] font-medium">{MOCK_RUN.duration}</div>
          </div>
        </div>

        {/* ── Format Selector ── */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Export Format</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormatCard
              id="json"
              label="JSON"
              description="Full structured data. Best for programmatic use."
              icon={<FileJson2 className="w-4 h-4" />}
              preview={JSON_PREVIEW}
              selected={selectedFormat === 'json'}
              onSelect={setSelectedFormat}
            />
            <FormatCard
              id="csv"
              label="CSV"
              description="Findings table. Opens in Excel/Sheets."
              icon={<FileSpreadsheet className="w-4 h-4" />}
              preview={CSV_PREVIEW}
              selected={selectedFormat === 'csv'}
              onSelect={setSelectedFormat}
            />
            <FormatCard
              id="markdown"
              label="Markdown"
              description="Human-readable report. Good for sharing."
              icon={<FileText className="w-4 h-4" />}
              preview={MD_PREVIEW}
              selected={selectedFormat === 'markdown'}
              onSelect={setSelectedFormat}
            />
          </div>
        </section>

        {/* ── Export Options ── */}
        <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">Export Options</h2>
          <div className="space-y-3">
            <CheckboxOption
              id="opt-evidence"
              label="Include evidence text"
              checked={options.includeEvidence}
              onChange={patchOption('includeEvidence')}
            />
            <CheckboxOption
              id="opt-attribution"
              label="Include agent attribution"
              checked={options.includeAttribution}
              onChange={patchOption('includeAttribution')}
            />
            <CheckboxOption
              id="opt-raw"
              label="Include raw tool outputs"
              checked={options.includeRawTools}
              onChange={patchOption('includeRawTools')}
              warning="Large file — adds ~2.2 MB to export"
            />
            <CheckboxOption
              id="opt-remediation"
              label="Include remediation suggestions"
              checked={options.includeRemediation}
              onChange={patchOption('includeRemediation')}
            />
          </div>
        </section>

        {/* ── Export Button & Status ── */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleExport}
            disabled={exportState === 'preparing'}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all',
              exportState === 'preparing'
                ? 'bg-violet-800 text-violet-300 cursor-not-allowed'
                : 'bg-primary hover:bg-primary text-[var(--color-text-primary)]',
            )}
          >
            <Download className="w-4 h-4" />
            Download {formatLabel[selectedFormat]} Export
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ExportProgressBar state={exportState} />
          </div>

          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap ml-auto">
            Est. size: <span className="text-[var(--color-text-primary)] font-mono">{estimateSize(selectedFormat, options)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
