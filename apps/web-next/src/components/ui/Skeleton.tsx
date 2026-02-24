import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  style?: React.CSSProperties;
}

/**
 * Reusable skeleton loading placeholder.
 *
 * Variants:
 *  - `rect`   (default) — rounded rectangle block
 *  - `text`   — narrower, single-line text height
 *  - `circle` — perfectly circular
 */
export function Skeleton({ className, variant = 'rect', style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-zinc-800 animate-pulse',
        variant === 'rect' && 'rounded-lg',
        variant === 'text' && 'rounded h-3 max-w-[70%]',
        variant === 'circle' && 'rounded-full aspect-square',
        className,
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

export default Skeleton;
