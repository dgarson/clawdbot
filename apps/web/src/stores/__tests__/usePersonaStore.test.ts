import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonaStore } from '../usePersonaStore';

beforeEach(() => {
  usePersonaStore.setState({ tier: 'casual', hasSeenTierPrompt: false });
});

describe('usePersonaStore', () => {
  it('has a default tier of "casual"', () => {
    const { result } = renderHook(() => usePersonaStore());
    expect(result.current.tier).toBe('casual');
  });

  it('setTier updates the tier value', () => {
    const { result } = renderHook(() => usePersonaStore());
    act(() => {
      result.current.setTier('engaged');
    });
    expect(result.current.tier).toBe('engaged');
  });

  it('setTier can set tier to "expert"', () => {
    const { result } = renderHook(() => usePersonaStore());
    act(() => {
      result.current.setTier('expert');
    });
    expect(result.current.tier).toBe('expert');
  });

  it('hasSeenTierPrompt defaults to false', () => {
    const { result } = renderHook(() => usePersonaStore());
    expect(result.current.hasSeenTierPrompt).toBe(false);
  });

  it('setHasSeenTierPrompt updates the flag to true', () => {
    const { result } = renderHook(() => usePersonaStore());
    act(() => {
      result.current.setHasSeenTierPrompt(true);
    });
    expect(result.current.hasSeenTierPrompt).toBe(true);
  });

  it('setHasSeenTierPrompt can toggle back to false', () => {
    const { result } = renderHook(() => usePersonaStore());
    act(() => {
      result.current.setHasSeenTierPrompt(true);
    });
    act(() => {
      result.current.setHasSeenTierPrompt(false);
    });
    expect(result.current.hasSeenTierPrompt).toBe(false);
  });
});
