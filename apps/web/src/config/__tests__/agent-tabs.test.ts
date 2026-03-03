import { describe, it, expect } from 'vitest';
import {
  AGENT_TABS,
  DEFAULT_TAB,
  TAB_REDIRECTS,
  isValidTab,
  resolveTab,
} from '../agent-tabs';

describe('AGENT_TABS', () => {
  it('has exactly 5 items', () => {
    expect(AGENT_TABS).toHaveLength(5);
  });

  it('contains tabs in the correct order', () => {
    const ids = AGENT_TABS.map((t) => t.id);
    expect(ids).toEqual(['overview', 'work', 'activity', 'chat', 'configure']);
  });

  it('each tab has required fields: id, label, icon, description, order', () => {
    for (const tab of AGENT_TABS) {
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('label');
      expect(tab).toHaveProperty('icon');
      expect(tab).toHaveProperty('description');
      expect(tab).toHaveProperty('order');
    }
  });

  it('order values match array position', () => {
    AGENT_TABS.forEach((tab, index) => {
      expect(tab.order).toBe(index);
    });
  });
});

describe('isValidTab', () => {
  it('returns true for valid tab IDs', () => {
    expect(isValidTab('overview')).toBe(true);
    expect(isValidTab('work')).toBe(true);
    expect(isValidTab('activity')).toBe(true);
    expect(isValidTab('chat')).toBe(true);
    expect(isValidTab('configure')).toBe(true);
  });

  it('returns false for invalid tab IDs', () => {
    expect(isValidTab('workstreams')).toBe(false);
    expect(isValidTab('rituals')).toBe(false);
    expect(isValidTab('tools')).toBe(false);
    expect(isValidTab('soul')).toBe(false);
    expect(isValidTab('unknown')).toBe(false);
    expect(isValidTab('')).toBe(false);
  });
});

describe('TAB_REDIRECTS', () => {
  it('maps workstreams → work', () => {
    expect(TAB_REDIRECTS['workstreams']).toBe('work');
  });

  it('maps rituals → work', () => {
    expect(TAB_REDIRECTS['rituals']).toBe('work');
  });

  it('maps tools → configure', () => {
    expect(TAB_REDIRECTS['tools']).toBe('configure');
  });

  it('maps soul → configure', () => {
    expect(TAB_REDIRECTS['soul']).toBe('configure');
  });
});

describe('resolveTab', () => {
  it('returns DEFAULT_TAB when tab is undefined', () => {
    expect(resolveTab(undefined)).toBe(DEFAULT_TAB);
  });

  it('returns DEFAULT_TAB for unknown tab names with no redirect', () => {
    expect(resolveTab('bogus')).toBe(DEFAULT_TAB);
  });

  it('returns a valid tab as-is', () => {
    expect(resolveTab('overview')).toBe('overview');
    expect(resolveTab('work')).toBe('work');
    expect(resolveTab('activity')).toBe('activity');
    expect(resolveTab('chat')).toBe('chat');
    expect(resolveTab('configure')).toBe('configure');
  });

  it('maps old tab names via TAB_REDIRECTS', () => {
    expect(resolveTab('workstreams')).toBe('work');
    expect(resolveTab('rituals')).toBe('work');
    expect(resolveTab('tools')).toBe('configure');
    expect(resolveTab('soul')).toBe('configure');
  });

  it('DEFAULT_TAB is overview', () => {
    expect(DEFAULT_TAB).toBe('overview');
  });
});
