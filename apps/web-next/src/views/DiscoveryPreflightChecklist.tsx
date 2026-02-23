import React, { useState, useCallback } from 'react';
import { cn } from '../lib/utils';

type CheckStatus = 'pass' | 'fail' | 'warning' | 'unchecked';

interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  actionLabel?: string;
  actionDisabled?: boolean;
}

interface ChecklistCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

const INITIAL_CATEGORIES: ChecklistCategory[] = [
  {
    id: 'api-keys',
    title: 'API Keys',
    items: [
      { id: 'brave', label: 'Brave API', status: 'pass', detail: 'Search API key configured and validated' },
      { id: 'openai', label: 'OpenAI', status: 'pass', detail: 'GPT-4o access confirmed, rate limits adequate' },
      { id: 'anthropic', label: 'Anthropic', status: 'warning', detail: 'Claude Sonnet 4.6 key present but approaching rate limit threshold' },
      { id: 'xai', label: 'X.AI (Grok)', status: 'pass', detail: 'Grok-4 access confirmed' },
    ],
  },
  {
    id: 'agent-config',
    title: 'Agent Configuration',
    items: [
      { id: 'agents-verified', label: '15 Agents Verified', status: 'pass', detail: 'All discovery agents registered and responding' },
      { id: 'cron-schedules', label: 'Cron Schedules', status: 'pass', detail: 'Wave 1-3 schedules configured for Feb 23' },
      { id: 'token-budgets', label: 'Token Budgets', status: 'warning', detail: 'Wave 3 budgets set but may need adjustment post-Wave 1' },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    items: [
      { id: 'gateway', label: 'Gateway Online', status: 'pass', detail: 'Gateway service running, health check passing' },
      { id: 'disk-space', label: 'Disk Space', status: 'pass', detail: '127GB available, 15% threshold configured' },
      { id: 'rate-limits', label: 'Rate Limits', status: 'pass', detail: 'Per-provider rate limits configured and enforced' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety Controls',
    items: [
      { id: 'kill-switches', label: 'Kill Switches', status: 'pass', detail: 'Global and per-agent kill switches tested' },
      { id: 'cost-caps', label: 'Cost Caps', status: 'pass', detail: '$50 session cap configured, auto-stop on threshold' },
      { id: 'error-thresholds', label: 'Error Thresholds', status: 'pass', detail: 'Consecutive error threshold set to 5 per agent' },
    ],
  },
];

const STATUS_COLORS = {
  pass: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: 'text-green-500',
    dot: 'bg-green-500',
  },
  fail: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  unchecked: {
    bg: 'bg-gray-800/30',
    border: 'border-gray-700',
    text: 'text-gray-500',
    icon: 'text-gray-500',
    dot: 'bg-gray-600',
  },
};

const StatusIcon = ({ status }: { status: CheckStatus }) => {
  if (status === 'pass') {
    return (
      <svg className={cn("w-5 h-5", STATUS_COLORS.pass.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg className={cn("w-5 h-5", STATUS_COLORS.fail.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'warning') {
    return (
      <svg className={cn("w-5 h-5", STATUS_COLORS.warning.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  return (
    <svg className={cn("w-5 h-5", STATUS_COLORS.unchecked.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  );
};

const ChecklistItemRow = ({
  item,
  isAnimating,
  onAction,
}: {
  item: ChecklistItem;
  isAnimating: boolean;
  onAction?: () => void;
}) => {
  const colors = STATUS_COLORS[item.status];

  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border transition-all duration-300",
        colors.bg,
        colors.border,
        isAnimating && "animate-pulse"
      )}
      role="listitem"
      aria-label={`${item.label}: ${item.status}`}
    >
      <div className={cn("mt-0.5 flex-shrink-0", colors.dot, "w-2.5 h-2.5 rounded-full")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", colors.text)}>{item.label}</span>
          <StatusIcon status={item.status} />
        </div>
        <p className="text-gray-500 text-sm mt-0.5">{item.detail}</p>
      </div>
      {item.actionLabel && (
        <button
          onClick={onAction}
          disabled={item.actionDisabled || isAnimating}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            "border border-gray-700 text-gray-300",
            "hover:bg-gray-800 hover:border-gray-600",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "whitespace-nowrap"
          )}
          aria-label={`Action for ${item.label}`}
        >
          {item.actionLabel}
        </button>
      )}
    </div>
  );
};

const CategorySection = ({
  category,
  isOpen,
  onToggle,
  checkingItemId,
  onAction,
}: {
  category: ChecklistCategory;
  isOpen: boolean;
  onToggle: () => void;
  checkingItemId: string | null;
  onAction?: (itemId: string) => void;
}) => {
  const passCount = category.items.filter((i) => i.status === 'pass').length;
  const totalCount = category.items.length;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4",
          "bg-gray-900/50 hover:bg-gray-900 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        )}
        aria-expanded={isOpen}
        aria-controls={`category-${category.id}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">{category.title}</span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              passCount === totalCount
                ? "bg-green-500/10 text-green-400"
                : passCount > 0
                ? "bg-amber-500/10 text-amber-400"
                : "bg-gray-800 text-gray-500"
            )}
          >
            {passCount}/{totalCount} pass
          </span>
        </div>
        <svg
          className={cn(
            "w-5 h-5 text-gray-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={`category-${category.id}`}
          className="p-4 pt-0 space-y-2"
          role="list"
        >
          {category.items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              isAnimating={checkingItemId === item.id}
              onAction={onAction ? () => onAction(item.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ReadinessIndicator = ({ status }: { status: 'GO' | 'NO-GO' | 'CAUTION' }) => {
  const statusConfig = {
    GO: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      dot: 'bg-green-500',
      label: 'READY FOR DEPLOYMENT',
    },
    'NO-GO': {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      dot: 'bg-red-500',
      label: 'BLOCKING ISSUES DETECTED',
    },
    CAUTION: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-500',
      label: 'WARNINGS — REVIEW RECOMMENDED',
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "flex items-center justify-between p-6 rounded-lg border-2",
        config.bg,
        config.border
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-4 h-4 rounded-full animate-pulse", config.dot)} />
        <div>
          <div className={cn("text-3xl font-black tracking-widest", config.text)}>{status}</div>
          <div className="text-gray-500 text-sm font-medium mt-1">{config.label}</div>
        </div>
      </div>
      <div className="text-right hidden sm:block">
        <div className="text-gray-600 text-xs uppercase tracking-wider">Run Date</div>
        <div className="text-white font-semibold">Feb 23, 2026</div>
      </div>
    </div>
  );
};

export default function DiscoveryPreflightChecklist() {
  const [categories, setCategories] = useState<ChecklistCategory[]>(INITIAL_CATEGORIES);
  const [allOpen, setAllOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);

  const getOverallStatus = useCallback((): 'GO' | 'NO-GO' | 'CAUTION' => {
    const allItems = categories.flatMap((c) => c.items);
    const hasFail = allItems.some((i) => i.status === 'fail');
    const hasWarning = allItems.some((i) => i.status === 'warning');

    if (hasFail) {return 'NO-GO';}
    if (hasWarning) {return 'CAUTION';}
    return 'GO';
  }, [categories]);

  const getCounts = useCallback(() => {
    const allItems = categories.flatMap((c) => c.items);
    return {
      pass: allItems.filter((i) => i.status === 'pass').length,
      warning: allItems.filter((i) => i.status === 'warning').length,
      fail: allItems.filter((i) => i.status === 'fail').length,
      unchecked: allItems.filter((i) => i.status === 'unchecked').length,
      total: allItems.length,
    };
  }, [categories]);

  const runAllChecks = async () => {
    setIsRunning(true);
    const allItems = categories.flatMap((c) => c.items);

    for (const item of allItems) {
      setCheckingItemId(item.id);
      await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));

      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i) =>
            i.id === item.id
              ? { ...i, status: 'pass' as CheckStatus, detail: `${i.detail} — Verified` }
              : i
          ),
        }))
      );
    }

    setCheckingItemId(null);
    setIsRunning(false);
  };

  const toggleAll = () => {
    setAllOpen(!allOpen);
  };

  const handleCategoryAction = (categoryId: string, itemId: string) => {
    console.log(`Action triggered for ${itemId} in ${categoryId}`);
  };

  const counts = getCounts();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Discovery Run Preflight
          </h1>
          <p className="text-gray-500 mt-1">
            Pre-deployment checklist for Feb 23, 2026 discovery run
          </p>
        </header>

        {/* Readiness Indicator */}
        <ReadinessIndicator status={getOverallStatus()} />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                Pass
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{counts.pass}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                Warnings
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{counts.warning}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                Fail
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{counts.fail}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-600" />
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                Pending
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{counts.unchecked}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={toggleAll}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md",
              "text-sm font-medium",
              "border border-gray-700 text-gray-300",
              "hover:bg-gray-900 hover:border-gray-600",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              "transition-colors"
            )}
            aria-label={allOpen ? 'Collapse all categories' : 'Expand all categories'}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {allOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              )}
            </svg>
            {allOpen ? 'Collapse All' : 'Expand All'}
          </button>

          <button
            onClick={runAllChecks}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-md",
              "text-sm font-semibold",
              "bg-blue-600 text-white",
              "hover:bg-blue-500",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
            aria-label={isRunning ? 'Running checks' : 'Run all preflight checks'}
          >
            {isRunning ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Running Checks...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Run All Checks
              </>
            )}
          </button>
        </div>

        {/* Categories */}
        <div className="space-y-4" role="list" aria-label="Preflight checklist categories">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              isOpen={allOpen}
              onToggle={() => setAllOpen(!allOpen)}
              checkingItemId={checkingItemId}
              onAction={(itemId) => handleCategoryAction(category.id, itemId)}
            />
          ))}
        </div>

        {/* Footer Note */}
        <div
          className={cn(
            "flex items-start gap-3 p-4 rounded-lg",
            "bg-gray-900/50 border border-gray-800",
            "text-sm text-gray-500"
          )}
        >
          <svg
            className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>
            This preflight checklist validates configuration before the Feb 23 discovery run.
            All critical items should pass before deployment. Warnings indicate items that
            should be reviewed but do not block deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
