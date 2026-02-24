import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InheritanceBadge } from '../InheritanceBadge';

vi.mock('@/stores/useInheritanceStore', () => ({
  useInheritanceStore: vi.fn(),
}));

import { useInheritanceStore } from '@/stores/useInheritanceStore';

const mockUseInheritanceStore = vi.mocked(useInheritanceStore);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InheritanceBadge', () => {
  it('renders "Using System" badge when field uses the default', () => {
    mockUseInheritanceStore.mockReturnValue(true as unknown);
    render(<InheritanceBadge agentId="agent-1" field="systemPrompt" />);
    expect(screen.getByText('Using System')).toBeInTheDocument();
  });

  it('wraps the badge in a Tooltip structure when field uses the default', () => {
    mockUseInheritanceStore.mockReturnValue(true as unknown);
    render(<InheritanceBadge agentId="agent-1" field="systemPrompt" />);
    // With asChild, TooltipTrigger forwards its data-state onto the Badge <div>.
    const badge = screen.getByText('Using System').closest('div');
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute('data-state');
  });

  it('renders "Custom" badge when field has a custom override', () => {
    mockUseInheritanceStore.mockReturnValue(false as unknown);
    render(<InheritanceBadge agentId="agent-1" field="systemPrompt" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('does not render "Using System" when field has a custom override', () => {
    mockUseInheritanceStore.mockReturnValue(false as unknown);
    render(<InheritanceBadge agentId="agent-1" field="systemPrompt" />);
    expect(screen.queryByText(/Using/)).not.toBeInTheDocument();
  });

  it('renders custom defaultSource label when provided', () => {
    mockUseInheritanceStore.mockReturnValue(true as unknown);
    render(<InheritanceBadge agentId="agent-1" field="model" defaultSource="Workspace" />);
    expect(screen.getByText('Using Workspace')).toBeInTheDocument();
  });

  it('defaults to "System" as the defaultSource when not provided', () => {
    mockUseInheritanceStore.mockReturnValue(true as unknown);
    render(<InheritanceBadge agentId="agent-1" field="model" />);
    expect(screen.getByText('Using System')).toBeInTheDocument();
  });
});
