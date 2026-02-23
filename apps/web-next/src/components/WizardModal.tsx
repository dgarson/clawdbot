import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { WizardStep, WizardAnswer, WizardSelectOption, WizardStepType } from '../types';

// ============================================================================
// Types
// ============================================================================

interface WizardModalProps {
  open: boolean;
  step: WizardStep | null;
  loading?: boolean;
  error?: string | null;
  progress?: { current: number; total: number };
  title?: string;
  onSubmit: (answer: WizardAnswer) => void;
  onCancel: () => void;
  onDismiss?: () => void;
}

// ============================================================================
// Step Progress Indicator
// ============================================================================

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < current
              ? 'w-6 bg-violet-500'
              : i === current
              ? 'w-6 bg-violet-600 animate-pulse'
              : 'w-2 bg-gray-700'
          )}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Text Step Renderer
// ============================================================================

function TextStepRenderer({
  step,
  onSubmit,
  loading,
}: {
  step: WizardStep;
  onSubmit: (value: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState(step.defaultValue || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.required && !value.trim()) {return;}
    onSubmit(value);
  };

  const inputType = step.validation === 'number' ? 'number' : 
                    step.validation === 'email' ? 'email' : 
                    step.validation === 'url' ? 'url' : 'text';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step.title && (
        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
      )}
      {step.description && (
        <p className="text-sm text-gray-400">{step.description}</p>
      )}
      
      <input
        type={inputType}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={step.placeholder}
        disabled={loading}
        aria-label={step.title || step.placeholder || 'Input'}
        aria-required={step.required}
        className={cn(
          'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3',
          'text-white placeholder-gray-500 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
          'transition-all duration-200',
          loading && 'opacity-50 cursor-not-allowed'
        )}
        autoFocus
      />

      <button
        type="submit"
        disabled={loading || (step.required && !value.trim())}
        className={cn(
          'w-full py-3 rounded-xl font-medium text-sm transition-all duration-200',
          'bg-violet-600 hover:bg-violet-500 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'shadow-lg shadow-violet-900/30'
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </span>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );
}

// ============================================================================
// Select Step Renderer
// ============================================================================

function SelectStepRenderer({
  step,
  onSubmit,
  loading,
}: {
  step: WizardStep;
  onSubmit: (value: string | string[]) => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<string | string[]>(
    step.multi ? (step.defaultValue ? [step.defaultValue] : []) : (step.defaultValue || '')
  );

  const handleSelect = (option: WizardSelectOption) => {
    if (step.multi) {
      const current = selected as string[];
      if (current.includes(option.value)) {
        setSelected(current.filter(v => v !== option.value));
      } else {
        setSelected([...current, option.value]);
      }
    } else {
      setSelected(option.value);
    }
  };

  const handleSubmit = () => {
    onSubmit(selected);
  };

  return (
    <div className="space-y-4">
      {step.title && (
        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
      )}
      {step.description && (
        <p className="text-sm text-gray-400 mb-4">{step.description}</p>
      )}

      <div className="space-y-2">
        {(step.options ?? []).map((option) => {
          const isSelected = step.multi
            ? (selected as string[]).includes(option.value)
            : selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleSelect(option)}
              disabled={option.disabled || loading}
              className={cn(
                'w-full p-4 rounded-xl border text-left transition-all duration-200',
                'flex items-start gap-3',
                isSelected
                  ? 'bg-violet-600/20 border-violet-500/50 shadow-lg shadow-violet-900/20'
                  : 'bg-gray-800/60 border-gray-700 hover:border-gray-600 hover:bg-gray-800',
                option.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Radio indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all duration-200',
                  isSelected
                    ? 'border-violet-500 bg-violet-500'
                    : 'border-gray-600'
                )}
              >
                {isSelected && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{option.label}</p>
                {option.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || (step.multi ? (selected as string[]).length === 0 : !selected)}
        className={cn(
          'w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 mt-6',
          'bg-violet-600 hover:bg-violet-500 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'shadow-lg shadow-violet-900/30'
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </span>
        ) : (
          'Continue'
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Confirm Step Renderer
// ============================================================================

function ConfirmStepRenderer({
  step,
  onSubmit,
  loading,
}: {
  step: WizardStep;
  onSubmit: (value: boolean) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      {step.title && (
        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
      )}
      {step.description && (
        <p className="text-sm text-gray-400">{step.description}</p>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => onSubmit(false)}
          disabled={loading}
          className={cn(
            'flex-1 py-3 rounded-xl font-medium text-sm transition-all duration-200',
            'border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {step.cancelLabel || 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => onSubmit(true)}
          disabled={loading}
          className={cn(
            'flex-1 py-3 rounded-xl font-medium text-sm transition-all duration-200',
            'bg-violet-600 hover:bg-violet-500 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-lg shadow-violet-900/30'
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </span>
          ) : (
            step.confirmLabel || 'Confirm'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Note Step Renderer
// ============================================================================

function NoteStepRenderer({
  step,
  onContinue,
  loading,
}: {
  step: WizardStep;
  onContinue: () => void;
  loading: boolean;
}) {
  const variantStyles = {
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: Info,
      iconColor: 'text-blue-400',
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: AlertTriangle,
      iconColor: 'text-yellow-400',
    },
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: CheckCircle,
      iconColor: 'text-green-400',
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: AlertCircle,
      iconColor: 'text-red-400',
    },
  };

  const style = variantStyles[step.variant || 'info'];
  const Icon = step.icon ? null : style.icon;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'p-4 rounded-xl border',
          style.bg,
          style.border
        )}
      >
        <div className="flex items-start gap-3">
          {step.icon ? (
            <span className="text-2xl">{step.icon}</span>
          ) : Icon ? (
            <Icon className={cn('w-5 h-5 mt-0.5', style.iconColor)} />
          ) : null}
          <div className="flex-1">
            {step.title && (
              <h4 className="text-sm font-semibold text-white mb-1">
                {step.title}
              </h4>
            )}
            {step.description && (
              <p className="text-sm text-gray-300">{step.description}</p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={loading}
        className={cn(
          'w-full py-3 rounded-xl font-medium text-sm transition-all duration-200',
          'bg-violet-600 hover:bg-violet-500 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-lg shadow-violet-900/30'
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </span>
        ) : (
          'Continue'
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Progress Step Renderer
// ============================================================================

function ProgressStepRenderer({
  step,
}: {
  step: WizardStep;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      {step.indeterminate ? (
        <div className="relative">
          <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle
              className="text-gray-800"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="42"
              cx="50"
              cy="50"
            />
            <circle
              className="text-violet-500 transition-all duration-500"
              strokeWidth="8"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="42"
              cx="50"
              cy="50"
              strokeDasharray={`${(step.progress || 0) * 2.64} 264`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white" aria-live="polite" aria-atomic="true">
              {step.progress || 0}%
            </span>
          </div>
        </div>
      )}

      {step.message && (
        <p className="text-sm text-gray-400 text-center animate-pulse">
          {step.message}
        </p>
      )}
      {step.title && !step.message && (
        <p className="text-sm text-gray-400 text-center">{step.title}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Wizard Modal
// ============================================================================

export default function WizardModal({
  open,
  step,
  loading = false,
  error,
  progress,
  title = 'Setup Wizard',
  onSubmit,
  onCancel,
  onDismiss,
}: WizardModalProps) {
  const [stepHistory, setStepHistory] = useState<string[]>([]);

  // Track step history for potential back navigation
  useEffect(() => {
    if (step?.id && stepHistory[stepHistory.length - 1] !== step.id) {
      setStepHistory(prev => [...prev, step.id]);
    }
  }, [step?.id, stepHistory]);

  // Reset history when modal closes
  useEffect(() => {
    if (!open) {
      setStepHistory([]);
    }
  }, [open]);

  // Close on Escape key (WCAG 2.1.2)
  useEffect(() => {
    if (!open) {return;}
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (onDismiss || onCancel)();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onDismiss, onCancel]);

  const handleSubmit = (value: string | boolean | string[]) => {
    if (step) {
      onSubmit({ stepId: step.id, value: value as string });
    }
  };

  const handleNoteContinue = () => {
    if (step) {
      onSubmit({ stepId: step.id, value: '' });
    }
  };

  // Render step content based on type
  const renderStepContent = () => {
    if (!step) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      );
    }

    switch (step.type) {
      case 'text':
        return (
          <TextStepRenderer
            step={step}
            onSubmit={handleSubmit as (v: string) => void}
            loading={loading}
          />
        );
      case 'select':
        return (
          <SelectStepRenderer
            step={step}
            onSubmit={handleSubmit as (v: string | string[]) => void}
            loading={loading}
          />
        );
      case 'confirm':
        return (
          <ConfirmStepRenderer
            step={step}
            onSubmit={handleSubmit as (v: boolean) => void}
            loading={loading}
          />
        );
      case 'note':
        return (
          <NoteStepRenderer
            step={step}
            onContinue={handleNoteContinue}
            loading={loading}
          />
        );
      case 'progress':
        return (
          <ProgressStepRenderer
            step={step}
          />
        );
      default:
        return (
          <div className="text-center text-gray-400 py-8">
            Unknown step type
          </div>
        );
    }
  };

  if (!open) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onDismiss || onCancel}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-modal-title"
        className={cn(
          'relative w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800',
          'shadow-2xl shadow-black/50',
          'animate-in zoom-in-95 fade-in duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {stepHistory.length > 1 && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Go back"
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-400" aria-hidden="true" />
              </button>
            )}
            <h2 id="wizard-modal-title" className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onDismiss || onCancel}
            aria-label="Close wizard"
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Progress indicator */}
        {progress && progress.total > 1 && (
          <div className="px-5 pt-5">
            <StepProgress current={progress.current} total={progress.total} />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          <div
            key={step?.id || 'empty'}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export { StepProgress, TextStepRenderer, SelectStepRenderer, ConfirmStepRenderer, NoteStepRenderer, ProgressStepRenderer };
