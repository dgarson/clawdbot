import { useState, useCallback } from 'react';
import type {
  UseWizardReturn,
  WizardStep,
  WizardSession,
  WizardStartParams,
  WizardAnswer,
} from '../types';

/**
 * React hook for driving wizard flows via Gateway RPC.
 * 
 * Wraps wizard.start/next/cancel/status methods and manages wizard state.
 * 
 * @param gateway - Gateway instance with call method
 * 
 * @example
 * ```tsx
 * const gateway = useGateway();
 * const { currentStep, loading, submitAnswer, start } = useWizard(gateway);
 * 
 * const handleConnect = async () => {
 *   await start({ mode: 'add-provider', provider: 'anthropic' });
 * };
 * 
 * const handleSubmit = async (value: string) => {
 *   if (currentStep) {
 *     await submitAnswer({ stepId: currentStep.id, value });
 *   }
 * };
 * ```
 */
export function useWizard(gateway: {
  call: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
}): UseWizardReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStep | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  /**
   * Start a new wizard session
   */
  const start = useCallback(async (params: WizardStartParams) => {
    setLoading(true);
    setError(null);
    setDone(false);
    setCurrentStep(null);
    setStatus(null);

    try {
      const result = await gateway.call<WizardSession>('wizard.start', {
        mode: params.mode,
        workspace: params.workspace,
        provider: params.provider,
      });

      setSessionId(result.sessionId);
      setDone(result.done || false);
      
      if (result.step) {
        setCurrentStep(result.step);
      }
      
      if (result.status) {
        setStatus(result.status);
      }
      
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start wizard');
      setSessionId(null);
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  /**
   * Submit answer for current step and get next step
   */
  const submitAnswer = useCallback(async (answer: WizardAnswer) => {
    if (!sessionId) {
      setError('No active wizard session');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await gateway.call<WizardSession>('wizard.next', {
        sessionId,
        answer: {
          stepId: answer.stepId,
          value: answer.value,
        },
      });

      setDone(result.done || false);
      
      if (result.step) {
        setCurrentStep(result.step);
      } else {
        setCurrentStep(null);
      }
      
      if (result.status) {
        setStatus(result.status);
      }
      
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setLoading(false);
    }
  }, [gateway, sessionId]);

  /**
   * Cancel current wizard session
   */
  const cancel = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await gateway.call('wizard.cancel', { sessionId });
      setSessionId(null);
      setCurrentStep(null);
      setDone(false);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel wizard');
    } finally {
      setLoading(false);
    }
  }, [gateway, sessionId]);

  /**
   * Refresh wizard status
   */
  const refresh = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await gateway.call<WizardSession>('wizard.status', {
        sessionId,
      });

      setDone(result.done || false);
      
      if (result.step) {
        setCurrentStep(result.step);
      }
      
      if (result.status) {
        setStatus(result.status);
      }
      
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh wizard status');
    } finally {
      setLoading(false);
    }
  }, [gateway, sessionId]);

  return {
    sessionId,
    currentStep,
    done,
    loading,
    error,
    status,
    start,
    submitAnswer,
    cancel,
    refresh,
  };
}

/**
 * Helper to format wizard step type for display
 */
export function getStepTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Enter text',
    select: 'Select an option',
    confirm: 'Confirm',
    note: 'Information',
    progress: 'Processing',
  };
  return labels[type] || type;
}

/**
 * Helper to check if a step requires user input
 */
export function stepRequiresInput(step: WizardStep | null): boolean {
  if (!step) return false;
  return ['text', 'select', 'confirm'].includes(step.type);
}

export default useWizard;
