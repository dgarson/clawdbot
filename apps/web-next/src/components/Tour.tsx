import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

export interface TourStep {
  /** Unique identifier for the step */
  id: string;
  /** CSS selector for the target element */
  target: string;
  /** Title shown in the tour popover */
  title: string;
  /** Content/description shown in the tour popover */
  content: string;
  /** Position of the popover relative to target */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Allow skipping the tour */
  allowSkip?: boolean;
}

export interface TourOptions {
  /** Unique tour identifier for persistence */
  tourId: string;
  /** Steps in the tour */
  steps: TourStep[];
  /** Callback when tour is completed */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Callback when step changes */
  onStepChange?: (step: TourStep, index: number) => void;
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Whether the tour can be paused */
  pausable?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}

const DEFAULT_OPTIONS: Partial<TourOptions> = {
  showProgress: true,
  pausable: true,
  storageKey: 'openclaw-tour-state',
};

/**
 * Hook to manage tour state with persistence
 */
export function useTour(tourOptions: TourOptions) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [hasCompleted, setHasCompleted] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  const { tourId, storageKey = DEFAULT_OPTIONS.storageKey!, onComplete, onSkip, onStepChange } = tourOptions;
  
  // Load completion state from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}-${tourId}`);
      if (stored) {
        const { completed } = JSON.parse(stored);
        setHasCompleted(completed);
      }
    } catch {
      console.warn('Failed to load tour state');
    }
  }, [tourId, storageKey]);
  
  // Save completion state
  const saveState = useCallback((completed: boolean) => {
    try {
      localStorage.setItem(`${storageKey}-${tourId}`, JSON.stringify({ completed }));
    } catch {
      console.warn('Failed to save tour state');
    }
  }, [tourId, storageKey]);
  
  // Start the tour
  const startTour = useCallback(() => {
    if (hasCompleted) {
      return;
    }
    setCurrentStep(0);
    setIsActive(true);
    setIsPaused(false);
  }, [hasCompleted]);
  
  // Stop the tour
  const stopTour = useCallback((completed: boolean = false) => {
    setIsActive(false);
    if (completed) {
      setHasCompleted(true);
      saveState(true);
      onComplete?.();
    }
  }, [saveState, onComplete]);
  
  // Skip the tour
  const skipTour = useCallback(() => {
    setIsActive(false);
    onSkip?.();
  }, [onSkip]);
  
  // Go to next step
  const nextStep = useCallback(() => {
    const steps = tourOptions.steps;
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      onStepChange?.(steps[next], next);
    } else {
      stopTour(true);
    }
  }, [currentStep, tourOptions.steps, onStepChange, stopTour]);
  
  // Go to previous step
  const prevStep = useCallback(() => {
    const steps = tourOptions.steps;
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      onStepChange?.(steps[prev], prev);
    }
  }, [currentStep, tourOptions.steps, onStepChange]);
  
  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);
  
  // Reset tour (for testing or re-running)
  const resetTour = useCallback(() => {
    setHasCompleted(false);
    saveState(false);
    setCurrentStep(0);
    setIsActive(true);
  }, [saveState]);
  
  return {
    isActive,
    currentStep,
    hasCompleted,
    isPaused,
    startTour,
    stopTour,
    skipTour,
    nextStep,
    prevStep,
    togglePause,
    resetTour,
  };
}

/**
 * TourOverlay - The main tour component that highlights elements and shows tooltips
 */
export function TourOverlay({
  isActive,
  steps,
  onComplete,
  onSkip,
  onStepChange,
  showProgress = true,
  allowSkip = true,
  tourId,
  storageKey = 'openclaw-tour-state',
}: TourOptions & { isActive: boolean; allowSkip?: boolean; showProgress?: boolean }) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<TourStep['placement']>('bottom');
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const step = steps[currentStep];
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  // Find and measure target element
  const updateTargetPosition = useCallback(() => {
    if (!step?.target || !isActive) {
      setTargetRect(null);
      return;
    }
    
    // Handle center placement
    if (step.placement === 'center') {
      setTargetRect(null);
      setPosition('center');
      return;
    }
    
    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      setPosition(step.placement || 'bottom');
      
      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight class
      element.classList.add('tour-highlight');
    } else {
      setTargetRect(null);
    }
  }, [step, isActive]);
  
  // Update position when step changes
  useEffect(() => {
    if (isActive && step) {
      setIsVisible(false);
      // Small delay to allow DOM to settle
      const timer = setTimeout(() => {
        updateTargetPosition();
        setIsVisible(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentStep, step, isActive, updateTargetPosition]);
  
  // Handle escape key
  useEffect(() => {
    if (!isActive) {return;}
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (allowSkip) {
          onSkip?.();
        }
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, allowSkip, onSkip]);
  
  // Cleanup highlights on unmount
  useEffect(() => {
    return () => {
      document.querySelectorAll('.tour-highlight').forEach((el) => {
        el.classList.remove('tour-highlight');
      });
    };
  }, []);
  
  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      // Remove highlight from current element
      document.querySelectorAll('.tour-highlight').forEach((el) => {
        el.classList.remove('tour-highlight');
      });
      setCurrentStep((s) => s + 1);
      onStepChange?.(steps[currentStep + 1], currentStep + 1);
    } else {
      // Tour complete
      try {
        localStorage.setItem(`${storageKey}-${tourId}`, JSON.stringify({ completed: true }));
      } catch {
        // Storage error - tour will restart on next visit
      }
      onComplete?.();
    }
  }, [currentStep, totalSteps, steps, onStepChange, onComplete, storageKey, tourId]);
  
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      document.querySelectorAll('.tour-highlight').forEach((el) => {
        el.classList.remove('tour-highlight');
      });
      setCurrentStep((s) => s - 1);
      onStepChange?.(steps[currentStep - 1], currentStep - 1);
    }
  }, [currentStep, steps, onStepChange]);
  
  const handleSkip = useCallback(() => {
    document.querySelectorAll('.tour-highlight').forEach((el) => {
      el.classList.remove('tour-highlight');
    });
    onSkip?.();
  }, [onSkip]);
  
  // Calculate tooltip position
  const getTooltipStyle = useCallback((): React.CSSProperties => {
    if (!targetRect) {
      // Center position
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
      };
    }
    
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const gap = 12;
    const padding = 16;
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - gap;
        left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipHeight) / 2;
        left = targetRect.left - tooltipWidth - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipHeight) / 2;
        left = targetRect.right + gap;
        break;
      default:
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
    }
    
    // Keep within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left < padding) {left = padding;}
    if (left + tooltipWidth > viewportWidth - padding) {left = viewportWidth - tooltipWidth - padding;}
    if (top < padding) {top = padding;}
    if (top + tooltipHeight > viewportHeight - padding) {top = viewportHeight - tooltipHeight - padding;}
    
    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    };
  }, [targetRect, position]);
  
  if (!isActive || !step) {return null;}
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300"
        style={{ opacity: isVisible ? 1 : 0 }}
        aria-hidden="true"
      />
      
      {/* Highlight cutout effect */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[9997]"
          style={{
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
          }}
        />
      )}
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "bg-slate-800 text-white rounded-lg shadow-xl p-4 transition-all duration-300",
          "min-w-[280px] max-w-[360px]",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
        style={getTooltipStyle()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-title-${step.id}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {currentStep + 1} of {totalSteps}
            </span>
          </div>
          {allowSkip && (
            <button
              onClick={handleSkip}
              className="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <h3 
          id={`tour-title-${step.id}`}
          className="text-lg font-semibold mb-2"
        >
          {step.title}
        </h3>
        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          {step.content}
        </p>
        
        {/* Progress bar */}
        {showProgress && (
          <div className="mb-4">
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={cn(
              "flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors",
              currentStep === 0 
                ? "text-slate-600 cursor-not-allowed" 
                : "text-slate-300 hover:text-white hover:bg-slate-700"
            )}
            aria-label="Previous step"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center gap-2">
            {/* Step indicators */}
            {showProgress && (
              <div className="flex items-center gap-1" role="group" aria-label="Tour steps">
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      document.querySelectorAll('.tour-highlight').forEach((el) => {
                        el.classList.remove('tour-highlight');
                      });
                      setCurrentStep(idx);
                      onStepChange?.(s, idx);
                    }}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentStep 
                        ? "bg-amber-400 w-4" 
                        : idx < currentStep 
                          ? "bg-green-400" 
                          : "bg-slate-600 hover:bg-slate-500"
                    )}
                    aria-label={`Go to step ${idx + 1}`}
                    aria-current={idx === currentStep ? 'step' : undefined}
                  />
                ))}
              </div>
            )}
            
            <button
              onClick={handleNext}
              className={cn(
                "flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors",
                currentStep === totalSteps - 1
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium"
              )}
              aria-label={currentStep === totalSteps - 1 ? 'Finish tour' : 'Next step'}
            >
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
              {currentStep < totalSteps - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * TourContext - React Context for managing tour state globally
 */
interface TourContextValue {
  startTour: (tourId: string) => void;
  endTour: (tourId: string, completed?: boolean) => void;
  isTourActive: (tourId: string) => boolean;
  currentTourStep: (tourId: string) => number;
}

const TourContext = React.createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [activeTours, setActiveTours] = useState<Map<string, number>>(new Map());
  
  const startTour = useCallback((tourId: string) => {
    setActiveTours((prev) => {
      const next = new Map(prev);
      next.set(tourId, 0);
      return next;
    });
  }, []);
  
  const endTour = useCallback((tourId: string, completed: boolean = false) => {
    setActiveTours((prev) => {
      const next = new Map(prev);
      if (completed) {
        try {
          localStorage.setItem(`openclaw-tour-${tourId}`, JSON.stringify({ completed: true }));
        } catch {
          // Storage error - state will not persist
        }
      }
      next.delete(tourId);
      return next;
    });
  }, []);
  
  const isTourActive = useCallback((tourId: string) => {
    return activeTours.has(tourId);
  }, [activeTours]);
  
  const currentTourStep = useCallback((tourId: string) => {
    return activeTours.get(tourId) ?? 0;
  }, [activeTours]);
  
  return (
    <TourContext.Provider value={{ startTour, endTour, isTourActive, currentTourStep }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const context = React.useContext(TourContext);
  if (!context) {
    throw new Error('useTourContext must be used within a TourProvider');
  }
  return context;
}

/**
 * Default tour steps for the main dashboard
 */
export const DEFAULT_DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: '.brand',
    title: 'Welcome to OpenClaw!',
    content: 'This is your Gateway Dashboard. Here you can manage agents, channels, and monitor your AI-powered workflows.',
    placement: 'bottom',
  },
  {
    id: 'chat',
    target: '[data-tab="chat"]',
    title: 'Chat with Agents',
    content: 'Interact with your AI agents here. Send messages, receive responses, and manage conversations.',
    placement: 'right',
  },
  {
    id: 'agents',
    target: '[data-tab="agents"]',
    title: 'Manage Agents',
    content: 'Create and configure your AI agents. Each agent can have different personalities and capabilities.',
    placement: 'right',
  },
  {
    id: 'channels',
    target: '[data-tab="channels"]',
    title: 'Connect Channels',
    content: 'Link your communication channels like Slack, Discord, or Telegram to receive messages.',
    placement: 'right',
  },
  {
    id: 'skills',
    target: '[data-tab="skills"]',
    title: 'Add Skills',
    content: 'Extend your agents with skills like file management, GitHub integration, and more.',
    placement: 'right',
  },
  {
    id: 'cron',
    target: '[data-tab="cron"]',
    title: 'Schedule Automations',
    content: 'Set up recurring tasks and cron jobs to automate your workflows.',
    placement: 'right',
  },
  {
    id: 'settings',
    target: '[data-tab="settings"]',
    title: 'Configure Settings',
    content: 'Fine-tune your gateway, manage API keys, and customize your experience.',
    placement: 'right',
  },
];

export default TourOverlay;
