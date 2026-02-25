import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

/* ─── Size presets ─────────────────────────────────────────────────────────── */

const SIZE_CONFIG = {
  sm: { icon: 'w-8 h-8', wrapper: 'py-6 px-4 gap-2', title: 'text-sm', desc: 'text-xs', btn: 'h-7 px-3 text-xs' },
  md: { icon: 'w-12 h-12', wrapper: 'py-12 px-6 gap-3', title: 'text-lg', desc: 'text-sm', btn: 'h-9 px-4 text-sm' },
  lg: { icon: 'w-14 h-14', wrapper: 'py-20 px-8 gap-4', title: 'text-xl', desc: 'text-base', btn: 'h-10 px-5 text-sm' },
} as const;

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface ContextualEmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface ContextualEmptyStateProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Headline — keep it short and contextual */
  title: string;
  /** Supporting copy — max 2 lines recommended */
  description: string;
  /** Primary CTA button (violet) */
  primaryAction?: ContextualEmptyStateAction;
  /** Secondary CTA button (ghost/outline) */
  secondaryAction?: ContextualEmptyStateAction;
  /** Visual density */
  size?: 'sm' | 'md' | 'lg';
  /** Extra className */
  className?: string;
}

/* ─── CSS keyframes injected once via <style> ──────────────────────────────── */

const ANIM_ID = 'ces-entrance';
const animStyle = `
@keyframes ${ANIM_ID} {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const tag = document.createElement('style');
  tag.textContent = animStyle;
  document.head.appendChild(tag);
  styleInjected = true;
}

/* ─── Component ────────────────────────────────────────────────────────────── */

/**
 * ContextualEmptyState — a reusable, accessible empty-state block with
 * contextual copy and optional CTA buttons.
 *
 * Renders with a subtle CSS entrance animation (opacity + translateY).
 */
export function ContextualEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
}: ContextualEmptyStateProps) {
  // Inject entrance keyframes once
  React.useEffect(() => { ensureStyle(); }, []);

  const s = SIZE_CONFIG[size];

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        s.wrapper,
        className,
      )}
      style={{ animation: `${ANIM_ID} 0.35s ease-out both` }}
    >
      {/* Icon */}
      <Icon
        className={cn(s.icon, 'text-zinc-600')}
        strokeWidth={1.5}
        aria-hidden="true"
      />

      {/* Title */}
      <h3 className={cn(s.title, 'font-semibold text-zinc-200 mt-1')}>
        {title}
      </h3>

      {/* Description — clamped to 2 lines */}
      <p className={cn(s.desc, 'text-zinc-400 max-w-xs leading-relaxed line-clamp-2')}>
        {description}
      </p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={cn(
                'inline-flex items-center justify-center rounded-md font-medium',
                'bg-primary text-white hover:bg-primary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                'transition-colors duration-150',
                s.btn,
              )}
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={cn(
                'inline-flex items-center justify-center rounded-md font-medium',
                'border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800/50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                'transition-colors duration-150',
                s.btn,
              )}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextualEmptyState;
