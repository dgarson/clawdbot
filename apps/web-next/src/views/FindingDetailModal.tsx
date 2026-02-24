/**
 * FindingDetailModal — View #290
 * Discovery Finding Detail
 *
 * Full-page modal-style detail view for a single discovery finding.
 * Reed (accessibility specialist) built this with full ARIA roles,
 * keyboard navigation, focus trap semantics, and skip-to-content.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Bot,
  Link2,
  FileText,
  Globe,
  Zap,
  Clock,
  Hash,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface SourceItem {
  type: 'url' | 'file' | 'endpoint';
  label: string;
  value: string;
}

interface AgentAttribution {
  name: string;
  id: string;
  emoji: string;
}

interface SimilarFinding {
  id: string;
  title: string;
  severity: Severity;
  timestamp: string;
}

interface FindingDetail {
  id: string;
  title: string;
  severity: Severity;
  timestamp: string;
  evidence: string;
  sources: SourceItem[];
  confidence: number;
  confidenceExplanation: string;
  agents: AgentAttribution[];
  remediationSummary: string;
  remediationDetail: string;
  similarFindings: SimilarFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — realistic critical finding
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_FINDING: FindingDetail = {
  id: 'FIND-2026-0042',
  title: 'Exposed API Key in Agent SOUL.md',
  severity: 'critical',
  timestamp: '2026-02-22T17:14:30Z',
  evidence: `[SecurityScanner] Scanning agent workspace files for credential leakage...

MATCH FOUND — apps/web-next/agents/SOUL.md:94
Pattern: OPENAI_API_KEY=sk-proj-[A-Za-z0-9]{48}

Raw match:
  OPENAI_API_KEY=sk-proj-T9wHmR2kJqNvXa7YpLzCs8FdOeWbUi3VtAoGcBxQhMnKj6PlEr

Additional context lines:
  92: ## Runtime Environment
  93: # These values are injected at startup
  94: OPENAI_API_KEY=sk-proj-T9wHmR2kJqNvXa7YpLzCs8FdOeWbUi3VtAoGcBxQhMnKj6PlEr
  95: ANTHROPIC_API_KEY=<redacted>
  96: NODE_ENV=production

File was committed to git history at:
  commit a3f7d9e — "feat: add agent persona context" (2026-02-20T09:32:11Z)

Git log confirms key has been in public repo for 2 days.
Stripe-equivalent blast radius: ~$8,400/day API spend possible.

[SecurityScanner] Confidence: 97/100 — direct regex match, valid key format confirmed via checksum.`,

  sources: [
    { type: 'file', label: 'agents/SOUL.md', value: 'agents/SOUL.md' },
    { type: 'file', label: 'git log (commit a3f7d9e)', value: 'git://a3f7d9e' },
    {
      type: 'url',
      label: 'github.com/dgarson/clawdbot/blob/main/SOUL.md',
      value: 'https://github.com/dgarson/clawdbot/blob/main/SOUL.md',
    },
    {
      type: 'endpoint',
      label: 'api.openai.com/v1/models (key validation)',
      value: 'https://api.openai.com/v1/models',
    },
  ],

  confidence: 97,
  confidenceExplanation:
    'Direct regex match against known OpenAI key format (sk-proj-…). Checksum validated. Key confirmed active via test API request. No false-positive indicators.',

  agents: [
    { name: 'SecurityScanner', id: 'sec-001', emoji: '🔐' },
    { name: 'SecretSniffer', id: 'sec-sniff-002', emoji: '🕵️' },
  ],

  remediationSummary:
    'Rotate the exposed OpenAI API key immediately. Remove from file and git history. Add pre-commit hooks to prevent future leakage.',

  remediationDetail: `## Immediate Actions (do now)

1. **Rotate the API key** — Log into platform.openai.com → API Keys → Revoke \`sk-proj-T9wHmR...\` and generate a new key.
2. **Purge from git history** — Use \`git-filter-repo\` or BFG Repo Cleaner to rewrite history. Force-push after.
3. **Update secrets manager** — Store new key in Vault / AWS Secrets Manager / .env.local (gitignored). Never commit directly.

## Prevention (within 48 hrs)

4. **Add \`.gitleaks.toml\`** — Configure Gitleaks pre-commit hook to block credential commits.
5. **Audit for other keys** — Run full workspace scan: \`gitleaks detect --source=.\`
6. **SOUL.md hygiene** — Strip all credential references from agent context files.

## Validation

7. Confirm old key returns 401 on a test request.
8. Confirm new key works in staging before production rollout.`,

  similarFindings: [
    {
      id: 'FIND-2026-0038',
      title: 'Exposed Stripe Secret Key in JavaScript Bundle',
      severity: 'critical',
      timestamp: '2026-02-18T11:20:00Z',
    },
    {
      id: 'FIND-2026-0029',
      title: 'GitHub PAT Embedded in CI Environment Log',
      severity: 'high',
      timestamp: '2026-02-14T08:45:00Z',
    },
    {
      id: 'FIND-2026-0017',
      title: 'Anthropic API Key in Docker Compose Dev File',
      severity: 'critical',
      timestamp: '2026-02-10T16:30:00Z',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Severity config
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  Severity,
  {
    label: string;
    badge: string;
    bar: string;
    ring: string;
    icon: React.ComponentType<{ className?: string }>;
    urgency: string;
  }
> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-950 text-red-400 border border-red-800',
    bar: 'bg-red-500',
    ring: 'text-red-500',
    icon: AlertCircle,
    urgency: '🚨 Immediate action required — resolve within 24 hours.',
  },
  high: {
    label: 'High',
    badge: 'bg-orange-950 text-orange-400 border border-orange-800',
    bar: 'bg-orange-500',
    ring: 'text-orange-500',
    icon: AlertTriangle,
    urgency: '⚠️ High priority — resolve within 72 hours.',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-yellow-950 text-yellow-400 border border-yellow-800',
    bar: 'bg-yellow-500',
    ring: 'text-yellow-500',
    icon: AlertTriangle,
    urgency: '📋 Resolve within the next sprint cycle.',
  },
  low: {
    label: 'Low',
    badge: 'bg-blue-950 text-blue-400 border border-blue-800',
    bar: 'bg-blue-500',
    ring: 'text-blue-500',
    icon: Info,
    urgency: '📌 Address in backlog — low risk.',
  },
  info: {
    label: 'Info',
    badge: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
    bar: 'bg-[var(--color-surface-3)]',
    ring: 'text-[var(--color-text-secondary)]',
    icon: Info,
    urgency: '💡 Informational — no immediate action required.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({
  severity,
  size = 'md',
}: {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeClasses,
        config.badge
      )}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} aria-hidden="true" />
      {config.label}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
        copied
          ? 'bg-green-900/40 text-green-400'
          : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]'
      )}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" aria-hidden="true" />
          Copy
        </>
      )}
    </button>
  );
}

function SourceChip({ source }: { source: SourceItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(source.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    },
    [source.value]
  );

  const Icon =
    source.type === 'url'
      ? Globe
      : source.type === 'file'
        ? FileText
        : Link2;

  const isLink = source.type === 'url';

  const baseClasses =
    'group inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 max-w-full';

  const inner = (
    <>
      <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]" aria-hidden="true" />
      <span className="truncate font-mono text-xs">{source.label}</span>
      {isLink && (
        <ExternalLink
          className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
      )}
      <button
        onClick={handleCopy}
        aria-label={copied ? `${source.label} value copied` : `Copy ${source.label}`}
        className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        tabIndex={0}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" aria-hidden="true" />
        ) : (
          <Copy className="w-3 h-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-hidden="true" />
        )}
      </button>
    </>
  );

  if (isLink) {
    return (
      <a
        href={source.value}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
        aria-label={`Open ${source.label} in new tab`}
      >
        {inner}
      </a>
    );
  }

  return (
    <span className={baseClasses} role="listitem">
      {inner}
    </span>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  // Color steps
  const color =
    clampedScore >= 90
      ? 'text-green-400'
      : clampedScore >= 70
        ? 'text-yellow-400'
        : clampedScore >= 50
          ? 'text-orange-400'
          : 'text-red-400';

  const barColor =
    clampedScore >= 90
      ? 'bg-green-500'
      : clampedScore >= 70
        ? 'bg-yellow-500'
        : clampedScore >= 50
          ? 'bg-orange-500'
          : 'bg-red-500';

  // SVG ring gauge
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      {/* Ring */}
      <div
        className="relative shrink-0"
        role="img"
        aria-label={`Confidence score: ${clampedScore} out of 100`}
      >
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
          {/* Background track */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 48 48)"
            className={cn(
              'transition-[stroke-dashoffset] duration-700',
              clampedScore >= 90
                ? 'stroke-green-500'
                : clampedScore >= 70
                  ? 'stroke-yellow-500'
                  : clampedScore >= 50
                    ? 'stroke-orange-500'
                    : 'stroke-red-500'
            )}
          />
        </svg>
        <div className={cn('absolute inset-0 flex flex-col items-center justify-center', color)}>
          <span className="text-2xl font-bold leading-none">{clampedScore}</span>
          <span className="text-xs text-[var(--color-text-muted)] mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Bar + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Confidence Score</span>
          <span className={cn('text-sm font-bold tabular-nums', color)}>{clampedScore}%</span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden"
          role="progressbar"
          aria-valuenow={clampedScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${clampedScore}% confidence`}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          {clampedScore >= 90 ? 'Very High' : clampedScore >= 70 ? 'High' : clampedScore >= 50 ? 'Moderate' : 'Low'}{' '}
          confidence
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function FindingDetailModal() {
  const finding = MOCK_FINDING;
  const config = SEVERITY_CONFIG[finding.severity];
  const Icon = config.icon;

  const [evidenceExpanded, setEvidenceExpanded] = useState(true);
  const [remediationExpanded, setRemediationExpanded] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Focus trap: ref to modal region so keyboard users stay in-context
  const modalRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Skip-to-main-content: focus main content on activation
  const handleSkipToContent = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') {return;}
    e.preventDefault();
    mainContentRef.current?.focus();
  }, []);

  // Mock "Mark as Resolved" — simulates async state
  const handleMarkResolved = useCallback(async () => {
    if (resolved || resolving) {return;}
    setResolving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setResolving(false);
    setResolved(true);
  }, [resolved, resolving]);

  // Keyboard: Escape announces "would close modal"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // In a real app this would call onClose(). Here we just handle the key.
        e.preventDefault();
      }
    };
    modalRef.current?.addEventListener('keydown', handleKeyDown);
    return () => modalRef.current?.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formattedDate = new Date(finding.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div
      ref={modalRef}
      className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finding-title"
      aria-describedby="finding-summary"
    >
      {/* ── Skip-to-content link (visible on focus) ─────────────────────── */}
      <a
        href="#finding-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-[var(--color-text-primary)] focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
        onClick={handleSkipToContent}
        onKeyDown={handleSkipToContent as unknown as React.KeyboardEventHandler}
      >
        Skip to main content
      </a>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface-0)]/95 backdrop-blur-sm"
        role="banner"
      >
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-start gap-4">
            {/* Back button */}
            <button
              aria-label="Back to Discovery Findings"
              className="shrink-0 mt-0.5 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <SeverityBadge severity={finding.severity} size="md" />
                <span className="text-[var(--color-text-muted)]" aria-hidden="true">•</span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] font-mono">
                  <Hash className="w-3 h-3" aria-hidden="true" />
                  <span aria-label={`Finding ID: ${finding.id}`}>{finding.id}</span>
                </span>
              </div>
              <h1
                id="finding-title"
                className="text-xl font-bold text-[var(--color-text-primary)] leading-tight sm:text-2xl"
              >
                {finding.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <time dateTime={finding.timestamp} aria-label={`Detected on ${formattedDate}`}>
                    {formattedDate}
                  </time>
                </span>
                {resolved && (
                  <span
                    className="inline-flex items-center gap-1 text-green-400"
                    role="status"
                    aria-live="polite"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Resolved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Urgency banner for critical/high */}
          {(finding.severity === 'critical' || finding.severity === 'high') && !resolved && (
            <div
              className={cn(
                'mt-3 rounded-lg px-4 py-2 text-sm font-medium',
                finding.severity === 'critical'
                  ? 'bg-red-950/60 text-red-400 border border-red-900'
                  : 'bg-orange-950/60 text-orange-400 border border-orange-900'
              )}
              role="alert"
              aria-live="assertive"
            >
              {config.urgency}
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main
        id="finding-main"
        ref={mainContentRef}
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6 focus-visible:outline-none"
        aria-label="Finding detail"
      >
        {/* Hidden summary for screen readers */}
        <p id="finding-summary" className="sr-only">
          {finding.severity} severity finding: {finding.title}, detected{' '}
          {formattedDate}, confidence {finding.confidence}%.
          {resolved ? ' This finding has been marked as resolved.' : ' Not yet resolved.'}
        </p>

        {/* ── Section 1: Evidence Panel ──────────────────────────────────── */}
        <section
          aria-labelledby="evidence-heading"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden"
        >
          <button
            id="evidence-toggle"
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[var(--color-surface-2)]/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
            aria-expanded={evidenceExpanded}
            aria-controls="evidence-body"
            onClick={() => setEvidenceExpanded((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" aria-hidden="true" />
              <h2 id="evidence-heading" className="text-sm font-semibold text-[var(--color-text-primary)]">
                Evidence
              </h2>
              <span className="text-xs text-[var(--color-text-muted)] ml-1">— raw agent output</span>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton text={finding.evidence} label="evidence" />
              {evidenceExpanded ? (
                <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              )}
            </div>
          </button>

          <div
            id="evidence-body"
            role="region"
            aria-labelledby="evidence-heading"
            hidden={!evidenceExpanded}
          >
            <div className="px-5 pb-5">
              <pre
                className="rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-primary)] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"
                tabIndex={0}
                aria-label="Raw evidence output from discovery agent"
              >
                {finding.evidence}
              </pre>
            </div>
          </div>
        </section>

        {/* ── Section 2: Sources ─────────────────────────────────────────── */}
        <section
          aria-labelledby="sources-heading"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-5 py-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <h2 id="sources-heading" className="text-sm font-semibold text-[var(--color-text-primary)]">
              Sources
            </h2>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              {finding.sources.length} source{finding.sources.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Sources used to generate this finding"
          >
            {finding.sources.map((source, i) => (
              <li key={i} className="max-w-full">
                <SourceChip source={source} />
              </li>
            ))}
          </ul>
        </section>

        {/* ── Section 3: Confidence ──────────────────────────────────────── */}
        <section
          aria-labelledby="confidence-heading"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-5 py-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <h2 id="confidence-heading" className="text-sm font-semibold text-[var(--color-text-primary)]">
              Confidence
            </h2>
          </div>
          <ConfidenceGauge score={finding.confidence} />
          <p className="mt-4 text-sm text-[var(--color-text-secondary)] leading-relaxed border-t border-[var(--color-border)] pt-4">
            {finding.confidenceExplanation}
          </p>
        </section>

        {/* ── Section 4: Agent Attribution ───────────────────────────────── */}
        <section
          aria-labelledby="agents-heading"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-5 py-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <h2 id="agents-heading" className="text-sm font-semibold text-[var(--color-text-primary)]">
              Agent Attribution
            </h2>
          </div>
          <ul
            className="space-y-3"
            role="list"
            aria-label="Agents that generated this finding"
          >
            {finding.agents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-0)] px-4 py-3"
              >
                <span
                  className="text-2xl"
                  role="img"
                  aria-label={`${agent.name} agent icon`}
                >
                  {agent.emoji}
                </span>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{agent.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] font-mono">{agent.id}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Section 5: Remediation ─────────────────────────────────────── */}
        <section
          aria-labelledby="remediation-heading"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden"
        >
          {/* Summary always visible */}
          <div className="px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-violet-400" aria-hidden="true" />
              <h2 id="remediation-heading" className="text-sm font-semibold text-[var(--color-text-primary)]">
                Remediation
              </h2>
            </div>

            {/* Urgency framing */}
            <div
              className={cn(
                'mb-4 rounded-lg px-4 py-3 text-sm font-medium border',
                finding.severity === 'critical'
                  ? 'bg-red-950/40 text-red-400 border-red-900'
                  : finding.severity === 'high'
                    ? 'bg-orange-950/40 text-orange-400 border-orange-900'
                    : finding.severity === 'medium'
                      ? 'bg-yellow-950/40 text-yellow-400 border-yellow-900'
                      : 'bg-blue-950/40 text-blue-400 border-blue-900'
              )}
              role="note"
              aria-label="Urgency"
            >
              {config.urgency}
            </div>

            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-4">
              {finding.remediationSummary}
            </p>

            {/* Expand full detail */}
            <button
              aria-expanded={remediationExpanded}
              aria-controls="remediation-detail"
              onClick={() => setRemediationExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {remediationExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  Hide detailed steps
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  Show detailed steps
                </>
              )}
            </button>
          </div>

          {/* Detail (collapsible) */}
          <div id="remediation-detail" hidden={!remediationExpanded}>
            <div className="px-5 pb-5 border-t border-[var(--color-border)] pt-4">
              <pre
                className="text-sm text-[var(--color-text-primary)] font-mono leading-relaxed whitespace-pre-wrap break-words bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg p-4 overflow-x-auto"
                tabIndex={0}
                aria-label="Detailed remediation steps"
              >
                {finding.remediationDetail}
              </pre>
            </div>
          </div>

          {/* Mark as Resolved CTA */}
          <div className="px-5 pb-5">
            <button
              onClick={handleMarkResolved}
              disabled={resolved || resolving}
              aria-pressed={resolved}
              aria-busy={resolving}
              aria-label={
                resolved
                  ? 'Finding marked as resolved'
                  : resolving
                    ? 'Marking as resolved…'
                    : 'Mark this finding as resolved'
              }
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
                resolved
                  ? 'bg-green-900/40 text-green-400 border border-green-800 cursor-default'
                  : resolving
                    ? 'bg-violet-700 text-[var(--color-text-primary)] opacity-70 cursor-wait focus-visible:ring-violet-500'
                    : 'bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] focus-visible:ring-violet-500'
              )}
            >
              {resolved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Resolved
                </>
              ) : resolving ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                    aria-hidden="true"
                  />
                  Resolving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Mark as Resolved
                </>
              )}
            </button>
          </div>
        </section>

        {/* ── Section 6: Similar Findings ────────────────────────────────── */}
        <section
          aria-labelledby="similar-heading"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-5 py-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <h2 id="similar-heading" className="text-sm font-semibold text-[var(--color-text-primary)]">
              Similar Findings
            </h2>
          </div>

          <ul
            className="space-y-2"
            role="list"
            aria-label="Related findings"
          >
            {finding.similarFindings.map((sf) => {
              const sfDate = new Date(sf.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              return (
                <li key={sf.id}>
                  <button
                    className="group w-full flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-0)] px-4 py-3 text-left hover:border-[var(--color-border)] hover:bg-[var(--color-surface-1)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                    aria-label={`View finding: ${sf.title}, severity ${SEVERITY_CONFIG[sf.severity].label}, detected ${sfDate}`}
                  >
                    <SeverityBadge severity={sf.severity} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] truncate transition-colors">
                        {sf.title}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                        <Hash className="w-3 h-3" aria-hidden="true" />
                        <span className="font-mono">{sf.id}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={sf.timestamp}>{sfDate}</time>
                      </div>
                    </div>
                    <ExternalLink
                      className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Bottom padding for scroll breathing room */}
        <div aria-hidden="true" className="h-8" />
      </main>
    </div>
  );
}
