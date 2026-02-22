import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentConfigureTab } from './AgentConfigureTab';

vi.mock('./AgentConfigPage', () => ({
  AgentConfigPage: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="agent-config-page" data-embedded={embedded ? 'true' : 'false'}>
      Agent Builder Content
    </div>
  ),
}));

vi.mock('./AgentRitualsTab', () => ({
  AgentRitualsTab: () => <div data-testid="agent-rituals-tab">Rituals Content</div>,
}));

vi.mock('./AgentToolsTab', () => ({
  AgentToolsTab: () => <div data-testid="agent-tools-tab">Tools Content</div>,
}));

/** Simulate a Radix UI tab click (requires pointer events sequence in jsdom) */
function clickTab(tab: HTMLElement) {
  fireEvent.pointerDown(tab);
  fireEvent.mouseDown(tab);
  fireEvent.pointerUp(tab);
  fireEvent.mouseUp(tab);
  fireEvent.click(tab);
}

describe('AgentConfigureTab', () => {
  it('renders Agent Builder sub-tab by default', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByTestId('agent-config-page')).toBeInTheDocument();
  });

  it('passes embedded=true to AgentConfigPage', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByTestId('agent-config-page')).toHaveAttribute('data-embedded', 'true');
  });

  it('shows all three sub-tab triggers', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByRole('tab', { name: /agent builder/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /rituals/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tools/i })).toBeInTheDocument();
  });

  it('switches to Rituals tab on click', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    clickTab(screen.getByRole('tab', { name: /rituals/i }));
    expect(screen.getByTestId('agent-rituals-tab')).toBeInTheDocument();
  });

  it('switches to Tools tab on click', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    clickTab(screen.getByRole('tab', { name: /tools/i }));
    expect(screen.getByTestId('agent-tools-tab')).toBeInTheDocument();
  });
});
