import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInheritanceStore } from '../useInheritanceStore';

beforeEach(() => {
  useInheritanceStore.setState({ agentOverrides: {} });
});

describe('useInheritanceStore', () => {
  it('isUsingDefault returns true when no override has been set', () => {
    const { result } = renderHook(() => useInheritanceStore());
    expect(result.current.isUsingDefault('agent-1', 'systemPrompt')).toBe(true);
  });

  it('setOverride with isCustom=true marks field as custom, isUsingDefault returns false', () => {
    const { result } = renderHook(() => useInheritanceStore());
    act(() => {
      result.current.setOverride('agent-1', 'systemPrompt', true);
    });
    expect(result.current.isUsingDefault('agent-1', 'systemPrompt')).toBe(false);
  });

  it('setOverride with isCustom=false reverts field to default, isUsingDefault returns true', () => {
    const { result } = renderHook(() => useInheritanceStore());
    act(() => {
      result.current.setOverride('agent-1', 'systemPrompt', true);
    });
    act(() => {
      result.current.setOverride('agent-1', 'systemPrompt', false);
    });
    expect(result.current.isUsingDefault('agent-1', 'systemPrompt')).toBe(true);
  });

  it('clearOverrides removes all overrides for an agent', () => {
    const { result } = renderHook(() => useInheritanceStore());
    act(() => {
      result.current.setOverride('agent-1', 'systemPrompt', true);
      result.current.setOverride('agent-1', 'model', true);
    });
    expect(result.current.isUsingDefault('agent-1', 'systemPrompt')).toBe(false);
    expect(result.current.isUsingDefault('agent-1', 'model')).toBe(false);

    act(() => {
      result.current.clearOverrides('agent-1');
    });

    expect(result.current.isUsingDefault('agent-1', 'systemPrompt')).toBe(true);
    expect(result.current.isUsingDefault('agent-1', 'model')).toBe(true);
  });

  it('clearOverrides for one agent does not affect another agent', () => {
    const { result } = renderHook(() => useInheritanceStore());
    act(() => {
      result.current.setOverride('agent-1', 'systemPrompt', true);
      result.current.setOverride('agent-2', 'model', true);
    });
    act(() => {
      result.current.clearOverrides('agent-1');
    });
    expect(result.current.isUsingDefault('agent-2', 'model')).toBe(false);
  });

  it('overrides for different agents are tracked independently', () => {
    const { result } = renderHook(() => useInheritanceStore());
    act(() => {
      result.current.setOverride('agent-1', 'systemPrompt', true);
    });
    expect(result.current.isUsingDefault('agent-1', 'systemPrompt')).toBe(false);
    expect(result.current.isUsingDefault('agent-2', 'systemPrompt')).toBe(true);
  });
});
