import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonaStore } from '../usePersonaStore';

// The persist middleware requires localStorage; provide a simple in-memory mock.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
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
