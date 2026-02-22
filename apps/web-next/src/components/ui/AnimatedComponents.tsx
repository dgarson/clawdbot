import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { StatusBadgeVariant, AnimatedCounterProps, TimeSeriesChartProps } from '../../types';

// ============================================================================
// Animation Utilities
// ============================================================================

/**
 * Easing function - ease out cubic
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Count up animation using requestAnimationFrame
 */
export function animateCount(
  start: number,
  end: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void
): () => void {
  const startTime = performance.now();
  let cancelled = false;

  function tick(currentTime: number) {
    if (cancelled) return;
    
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);
    const currentValue = start + (end - start) * easedProgress;
    
    onUpdate(currentValue);
    
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  }

  requestAnimationFrame(tick);
  
  return () => {
    cancelled = true;
  };
}

// ============================================================================
// Animated Counter
// ============================================================================

export function AnimatedCounter({
  value,
  duration = 500,
  formatter = (v) => v.toLocaleString(),
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (value === previousValueRef.current) return;
    
    const cancel = animateCount(
      previousValueRef.current,
      value,
      duration,
      setDisplayValue
    );
    
    previousValueRef.current = value;
    
    return cancel;
  }, [value, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {formatter(displayValue)}
    </span>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<StatusBadgeVariant, {
  bg: string;
  text: string;
  dot: string;
  icon?: string;
}> = {
  connected: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  not_connected: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-500' },
  expired: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  active: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  idle: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' },
  loading: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  success: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  offline: { bg: 'bg-gray-500/10', text: 'text-gray-500', dot: 'bg-gray-600' },
  healthy: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  degraded: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  enabled: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  disabled: { bg: 'bg-gray-500/10', text: 'text-gray-500', dot: 'bg-gray-600' },
};

const defaultLabels: Record<StatusBadgeVariant, string> = {
  connected: 'Connected',
  not_connected: 'Not Connected',
  expired: 'Expired',
  error: 'Error',
  active: 'Active',
  idle: 'Idle',
  loading: 'Loading...',
  success: 'Success',
  warning: 'Warning',
  offline: 'Offline',
  healthy: 'Healthy',
  degraded: 'Degraded',
  running: 'Running',
  enabled: 'Enabled',
  disabled: 'Disabled',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

export function StatusBadge({
  variant,
  label,
  animated = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = statusConfig[variant];
  const displayLabel = label || defaultLabels[variant];
  const shouldPulse = animated && (variant === 'loading' || variant === 'active');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.bg,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          config.dot,
          shouldPulse && 'animate-pulse'
        )}
      />
      {displayLabel}
    </span>
  );
}

// ============================================================================
// Sparkline Chart (Mini inline chart)
// ============================================================================

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  animated?: boolean;
  className?: string;
  showArea?: boolean;
}

export function SparklineChart({
  data,
  width = 80,
  height = 20,
  color = 'rgb(139, 92, 246)', // violet-500
  animated = true,
  className,
  showArea = true,
}: SparklineChartProps) {
  const [animatedWidth, setAnimatedWidth] = useState(animated ? 0 : 100);
  
  useEffect(() => {
    if (!animated) return;
    const timeout = setTimeout(() => setAnimatedWidth(100), 50);
    return () => clearTimeout(timeout);
  }, [animated, data]);

  const { pathD, areaD } = useMemo(() => {
    if (data.length === 0) return { pathD: '', areaD: '' };
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, i) => ({
      x: (i / (data.length - 1)) * width,
      y: height - ((value - min) / range) * height * 0.8 - height * 0.1,
    }));
    
    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
    
    const areaD = pathD + ` L ${width} ${height} L 0 ${height} Z`;
    
    return { pathD, areaD };
  }, [data, width, height]);

  if (data.length === 0) {
    return <div className={cn('opacity-30', className)} style={{ width, height }} />;
  }

  return (
    <svg
      className={cn('overflow-visible', className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Clip path for animation */}
      <clipPath id={`sparkline-clip-${width}-${height}`}>
        <rect
          x="0"
          y="0"
          width={(width * animatedWidth) / 100}
          height={height}
        />
      </clipPath>
      
      <g clipPath={`url(#sparkline-clip-${width}-${height})`}>
        {showArea && areaD && (
          <path
            d={areaD}
            fill={`url(#sparkline-gradient-${color})`}
          />
        )}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// ============================================================================
// Time Series Chart
// ============================================================================

export function TimeSeriesChart({
  data,
  color = 'rgb(139, 92, 246)',
  height = 200,
  showAxis = true,
  animated = true,
  className,
}: TimeSeriesChartProps) {
  const [animatedProgress, setAnimatedProgress] = useState(animated ? 0 : 100);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  
  useEffect(() => {
    if (!animated) return;
    const timeout = setTimeout(() => setAnimatedProgress(100), 100);
    return () => clearTimeout(timeout);
  }, [animated, data]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { bars, maxValue, minTime, maxTime } = useMemo(() => {
    if (data.length === 0) return { bars: [], maxValue: 0, minTime: 0, maxTime: 0 };
    
    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const times = data.map(d => new Date(d.timestamp ?? d.date ?? "").getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const timeRange = maxT - minT || 1;
    
    const padding = 16;
    const chartWidth = width - padding * 2;
    const chartHeight = height - (showAxis ? 40 : padding * 2);
    
    const calculatedBars = data.map((point, i) => {
      const t = new Date(point.timestamp ?? point.date ?? "").getTime();
      const x = padding + ((t - minT) / timeRange) * chartWidth;
      const barHeight = (point.value / max) * chartHeight;
      const y = height - (showAxis ? 20 : padding) - barHeight;
      
      return {
        x,
        y,
        height: barHeight,
        width: 4,
        value: point.value,
        label: point.label,
        timestamp: point.timestamp ?? point.date ?? "",
      };
    });
    
    return { bars: calculatedBars, maxValue: max, minTime: minT, maxTime: maxT };
  }, [data, width, height, showAxis]);

  if (data.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn('bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-center', className)}
        style={{ height }}
      >
        <span className="text-sm text-gray-500">No data</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ height }}
    >
      <svg width="100%" height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`timeseries-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Bars */}
        <g>
          {bars.map((bar, i) => (
            <g key={i} className="group">
              {/* Bar */}
              <rect
                x={bar.x - bar.width / 2}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={color}
                rx="2"
                className="transition-all duration-300 group-hover:brightness-125"
                style={{
                  transform: `scaleX(${animatedProgress / 100})`,
                  transformOrigin: `${bar.x}px bottom`,
                }}
              />
              
              {/* Tooltip */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <rect
                  x={bar.x - 30}
                  y={bar.y - 35}
                  width={60}
                  height={30}
                  fill="rgb(31, 41, 55)"
                  stroke="rgb(55, 65, 81)"
                  rx="6"
                />
                <text
                  x={bar.x}
                  y={bar.y - 20}
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="500"
                >
                  {bar.value.toLocaleString()}
                </text>
                <text
                  x={bar.x}
                  y={bar.y - 8}
                  textAnchor="middle"
                  fill="rgb(156, 163, 175)"
                  fontSize="9"
                >
                  {bar.label || new Date(bar.timestamp ?? "").toLocaleDateString()}
                </text>
              </g>
            </g>
          ))}
        </g>
        
        {/* X axis labels */}
        {showAxis && data.length > 0 && (
          <g>
            <text
              x={16}
              y={height - 4}
              fill="rgb(107, 114, 128)"
              fontSize="10"
            >
              {new Date(minTime).toLocaleDateString()}
            </text>
            <text
              x={width - 16}
              y={height - 4}
              textAnchor="end"
              fill="rgb(107, 114, 128)"
              fontSize="10"
            >
              {new Date(maxTime).toLocaleDateString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// Provider Card (Base component for reuse)
// ============================================================================

interface ProviderCardProps {
  id: string;
  name: string;
  icon: string;
  description?: string;
  status: StatusBadgeVariant;
  sparklineData?: number[];
  onConnect?: () => void;
  onManage?: () => void;
  className?: string;
}

export function ProviderCard({
  name,
  icon,
  description,
  status,
  sparklineData,
  onConnect,
  onManage,
  className,
}: ProviderCardProps) {
  return (
    <div
      className={cn(
        'bg-gray-900 rounded-xl border border-gray-800 p-4',
        'transition-all duration-200 hover:border-gray-700',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-xl">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{name}</h3>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <StatusBadge variant={status} size="sm" />
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="mb-3">
          <SparklineChart
            data={sparklineData}
            width={120}
            height={24}
            color={status === 'connected' ? 'rgb(34, 197, 94)' : 'rgb(139, 92, 246)'}
          />
        </div>
      )}

      <div className="flex gap-2">
        {status === 'connected' ? (
          <button
            type="button"
            onClick={onManage}
            className="flex-1 py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
          >
            Manage
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors',
              status === 'expired'
                ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                : 'bg-violet-600 text-white hover:bg-violet-500'
            )}
          >
            {status === 'expired' ? 'Reconnect' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Card (Base component for reuse)
// ============================================================================

interface AgentCardBaseProps {
  id: string;
  name: string;
  emoji: string;
  role?: string;
  status: 'active' | 'idle' | 'error' | 'offline';
  activitySparkline?: number[];
  lastActive?: string;
  onClick?: () => void;
  className?: string;
}

export function AgentCardBase({
  name,
  emoji,
  role,
  status,
  activitySparkline,
  lastActive,
  onClick,
  className,
}: AgentCardBaseProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-gray-900 rounded-xl border border-gray-800 p-4',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:border-gray-700 hover:bg-gray-800/50',
        className
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center text-2xl">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
            <StatusBadge 
              variant={status === 'active' ? 'active' : status === 'error' ? 'error' : 'idle'} 
              size="sm" 
            />
          </div>
          {role && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{role}</p>
          )}
        </div>
      </div>

      {activitySparkline && activitySparkline.length > 0 && (
        <div className="mb-2">
          <SparklineChart
            data={activitySparkline}
            width={100}
            height={16}
            showArea={false}
            color={status === 'active' ? 'rgb(34, 197, 94)' : 'rgb(139, 92, 246)'}
          />
        </div>
      )}

      {lastActive && (
        <p className="text-xs text-gray-600">
          Last active: {lastActive}
        </p>
      )}
    </div>
  );
}

export default {
  AnimatedCounter,
  StatusBadge,
  SparklineChart,
  TimeSeriesChart,
  ProviderCard,
  AgentCardBase,
};
