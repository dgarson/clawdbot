import { useCallback } from 'react';
import { useGateway } from './useGateway';

export interface HorizonBrief {
  title: string;
  summary: string;
  bullets: string[];
}

export interface HorizonContextBudget {
  session: string;
  usedTokens: number;
  maxTokens: number;
  risk: 'low' | 'medium' | 'high';
}

/**
 * Horizon-focused RPC wrapper.
 * Falls back to deterministic local data when backend RPCs are not available yet.
 */
export function useHorizonOps() {
  const { call } = useGateway();

  const composeBrief = useCallback(async (): Promise<HorizonBrief> => {
    try {
      return await call<HorizonBrief>('horizon.brief.compose', {});
    } catch {
      return {
        title: 'OpenClaw Morning Brief',
        summary: 'Gateway stable; focus on queue triage and cost containment.',
        bullets: [
          'Resolve one stale approval queue item.',
          'Rebalance one over-utilized agent to support coverage.',
          'Audit two high-cost sessions for routing opportunities.',
        ],
      };
    }
  }, [call]);

  const getContextBudgets = useCallback(async (): Promise<HorizonContextBudget[]> => {
    try {
      return await call<HorizonContextBudget[]>('horizon.context.budgets', {});
    } catch {
      return [
        { session: 'agent:luis:main', usedTokens: 56000, maxTokens: 128000, risk: 'low' },
        { session: 'agent:xavier:main', usedTokens: 104000, maxTokens: 128000, risk: 'high' },
        { session: 'agent:harry:ops', usedTokens: 74000, maxTokens: 128000, risk: 'medium' },
      ];
    }
  }, [call]);

  return { composeBrief, getContextBudgets };
}
