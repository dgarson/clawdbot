import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate } from '../FeatureGate';

vi.mock('@/stores/usePersonaStore', () => ({
  usePersonaStore: vi.fn(),
}));

import { usePersonaStore } from '@/stores/usePersonaStore';

const mockUsePersonaStore = vi.mocked(usePersonaStore);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FeatureGate', () => {
  it('renders children when current tier meets minTier (same tier)', () => {
    mockUsePersonaStore.mockReturnValue({ tier: 'engaged' } as ReturnType<typeof usePersonaStore>);
    render(
      <FeatureGate minTier="engaged">
        <span>Protected Content</span>
      </FeatureGate>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when current tier exceeds minTier', () => {
    mockUsePersonaStore.mockReturnValue({ tier: 'expert' } as ReturnType<typeof usePersonaStore>);
    render(
      <FeatureGate minTier="casual">
        <span>Always Visible</span>
      </FeatureGate>
    );
    expect(screen.getByText('Always Visible')).toBeInTheDocument();
  });

  it('does not render children when tier is below minTier', () => {
    mockUsePersonaStore.mockReturnValue({ tier: 'casual' } as ReturnType<typeof usePersonaStore>);
    render(
      <FeatureGate minTier="expert">
        <span>Expert Only</span>
      </FeatureGate>
    );
    expect(screen.queryByText('Expert Only')).not.toBeInTheDocument();
  });

  it('renders fallback when tier is below minTier and fallback is provided', () => {
    mockUsePersonaStore.mockReturnValue({ tier: 'casual' } as ReturnType<typeof usePersonaStore>);
    render(
      <FeatureGate minTier="engaged" fallback={<span>Upgrade Required</span>}>
        <span>Engaged Content</span>
      </FeatureGate>
    );
    expect(screen.queryByText('Engaged Content')).not.toBeInTheDocument();
    expect(screen.getByText('Upgrade Required')).toBeInTheDocument();
  });

  it('renders nothing (no fallback) when tier is below minTier and no fallback provided', () => {
    mockUsePersonaStore.mockReturnValue({ tier: 'casual' } as ReturnType<typeof usePersonaStore>);
    const { container } = render(
      <FeatureGate minTier="expert">
        <span>Expert Only</span>
      </FeatureGate>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders children when tier is "casual" and minTier is "casual"', () => {
    mockUsePersonaStore.mockReturnValue({ tier: 'casual' } as ReturnType<typeof usePersonaStore>);
    render(
      <FeatureGate minTier="casual">
        <span>Casual Content</span>
      </FeatureGate>
    );
    expect(screen.getByText('Casual Content')).toBeInTheDocument();
  });
});
