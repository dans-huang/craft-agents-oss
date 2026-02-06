import { describe, it, expect } from 'bun:test';
import { TicketPollingService } from '../polling.ts';

describe('TicketPollingService', () => {
  it('detects new tickets', () => {
    const existing = new Map([[100, { id: 100, updated_at: '2026-01-01' }]]);
    const incoming = [
      { id: 100, updated_at: '2026-01-01' },
      { id: 101, updated_at: '2026-01-02' },
    ];
    const { added, updated, removed } = TicketPollingService.diff(existing, incoming as any);
    expect(added.map(t => t.id)).toEqual([101]);
    expect(updated).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it('detects updated tickets', () => {
    const existing = new Map([[100, { id: 100, updated_at: '2026-01-01' }]]);
    const incoming = [
      { id: 100, updated_at: '2026-01-02' }, // updated
    ];
    const { added, updated, removed } = TicketPollingService.diff(existing, incoming as any);
    expect(added).toHaveLength(0);
    expect(updated.map(t => t.id)).toEqual([100]);
    expect(removed).toHaveLength(0);
  });

  it('detects removed tickets', () => {
    const existing = new Map([
      [100, { id: 100, updated_at: '2026-01-01' }],
      [101, { id: 101, updated_at: '2026-01-01' }],
    ]);
    const incoming = [
      { id: 100, updated_at: '2026-01-01' },
    ];
    const { added, updated, removed } = TicketPollingService.diff(existing, incoming as any);
    expect(added).toHaveLength(0);
    expect(updated).toHaveLength(0);
    expect(removed).toEqual([101]);
  });
});
