import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentConfigureTab } from './AgentConfigureTab';

vi.mock('@/hooks/queries/useAgents', () => ({
  useAgent: () => ({ data: { name: 'Test Agent' } }),
}));

vi.mock('@/hooks/queries/useAgentFiles', () => ({
  useAgentFiles: () => ({ files: [], isLoading: false }),
  useAgentFileSave: () => ({ save: vi.fn() }),
}));

vi.mock('@/components/domain/assist/LLMAssistPanel', () => ({
  LLMAssistPanel: ({ open }: { open: boolean }) => (
    <div data-testid="llm-assist-panel" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('@/components/domain/assist/AutoReviewPanel', () => ({
  AutoReviewPanel: () => <div data-testid="auto-review-panel" />,
}));

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

  it('renders AI Assist button', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByRole('button', { name: /ai assist/i })).toBeInTheDocument();
  });

  it('renders Auto Review button when on builder tab', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    expect(screen.getByRole('button', { name: /auto review/i })).toBeInTheDocument();
  });

  it('does not render Auto Review button when on rituals tab', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    clickTab(screen.getByRole('tab', { name: /rituals/i }));
    expect(screen.queryByRole('button', { name: /auto review/i })).not.toBeInTheDocument();
  });

  it('clicking AI Assist button toggles the panel open', () => {
    render(<AgentConfigureTab agentId="agent-1" />);
    const panel = screen.getByTestId('llm-assist-panel');
    expect(panel).toHaveAttribute('data-open', 'false');
    fireEvent.click(screen.getByRole('button', { name: /ai assist/i }));
    expect(panel).toHaveAttribute('data-open', 'true');
  });
});
