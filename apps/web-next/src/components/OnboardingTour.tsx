import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ChevronRight, ChevronLeft, X, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTourStore } from '../stores/tourStore';

export interface TourStep {
  id: string;
  target?: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
}

interface OnboardingTourProps {
  steps: TourStep[];
}

export function OnboardingTour({ steps }: OnboardingTourProps) {
  const { 
    isTourOpen, 
    currentStepIndex, 
    nextStep, 
    prevStep, 
    completeTour, 
    skipTour 
  } = useTourStore();
  
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!isTourOpen || !currentStep?.target) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      const el = document.querySelector(currentStep.target!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setCoords(null); // Center if target not found
      }
    };

    // Small delay to ensure DOM is ready/animations finished
    const timeout = setTimeout(updateCoords, 100);
    
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords);
    };
  }, [isTourOpen, currentStep]);

  if (!isTourOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      nextStep();
    } else {
      completeTour();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      prevStep();
    }
  };

  // Simplified positioning logic
  const getPopoverStyle = () => {
    if (!coords) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' as const };

    const padding = 16;
    switch (currentStep.placement) {
      case 'bottom':
        return { top: coords.top + coords.height + padding, left: coords.left + coords.width / 2, transform: 'translateX(-50%)', position: 'absolute' as const };
      case 'top':
        return { top: coords.top - padding, left: coords.left + coords.width / 2, transform: 'translate(-50%, -100%)', position: 'absolute' as const };
      case 'right':
        return { top: coords.top + coords.height / 2, left: coords.left + coords.width + padding, transform: 'translateY(-50%)', position: 'absolute' as const };
      case 'left':
        return { top: coords.top + coords.height / 2, left: coords.left - padding, transform: 'translate(-100%, -50%)', position: 'absolute' as const };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' as const };
      default:
        return { top: coords.top + coords.height + padding, left: coords.left + coords.width / 2, transform: 'translateX(-50%)', position: 'absolute' as const };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Spotlight Overlay */}
      <AnimatePresence>
        {isTourOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 pointer-events-auto"
            style={coords ? {
              clipPath: `polygon(
                0% 0%, 0% 100%, 
                ${coords.left - 8}px 100%, 
                ${coords.left - 8}px ${coords.top - 8}px, 
                ${coords.left + coords.width + 8}px ${coords.top - 8}px, 
                ${coords.left + coords.width + 8}px ${coords.top + coords.height + 8}px, 
                ${coords.left - 8}px ${coords.top + coords.height + 8}px, 
                ${coords.left - 8}px 100%, 
                100% 100%, 100% 0%
              )`,
            } : {}}
            onClick={skipTour}
          />
        )}
      </AnimatePresence>

      {/* Popover */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="pointer-events-auto w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5"
        style={getPopoverStyle()}
      >
        <button
          onClick={skipTour}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400 shrink-0">
            {currentStep?.icon || <Info className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-white font-bold">{currentStep?.title}</h3>
            <p className="text-xs text-gray-400">Step {currentStepIndex + 1} of {steps.length}</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
          {currentStep?.content}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={skipTour}
            className="text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                onClick={handleBack}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold py-2 px-4 rounded-xl transition-all shadow-lg shadow-violet-900/20"
            >
              {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
