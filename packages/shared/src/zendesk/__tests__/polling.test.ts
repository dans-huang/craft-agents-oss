import { describe, it, expect, mock } from 'bun:test';
import { TicketPollingService } from '../polling.ts';
import type { ZendeskTicket } from '../types.ts';

const makeTicket = (id: number, updated_at: string): ZendeskTicket =>
  ({ id, updated_at } as unknown as ZendeskTicket);

describe('TicketPollingService.diff()', () => {
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

describe('TicketPollingService.poll() stateful behavior', () => {
  it('emits only new tickets on first poll', async () => {
    const onDiff = mock(() => {});
    const fakeClient = {
      searchAssignedTickets: mock(() =>
        Promise.resolve([makeTicket(1, '2026-01-01'), makeTicket(2, '2026-01-01')])
      ),
    };

    const service = new TicketPollingService(
      fakeClient as any,
      { intervalMs: 60_000, autoProcess: false },
      onDiff,
    );

    await service.poll();

    expect(onDiff).toHaveBeenCalledTimes(1);
    const diff = onDiff.mock.calls[0][0];
    expect(diff.added).toHaveLength(2);
    expect(diff.updated).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('does not emit when nothing changed', async () => {
    const tickets = [makeTicket(1, '2026-01-01')];
    const onDiff = mock(() => {});
    const fakeClient = {
      searchAssignedTickets: mock(() => Promise.resolve(tickets)),
    };

    const service = new TicketPollingService(
      fakeClient as any,
      { intervalMs: 60_000, autoProcess: false },
      onDiff,
    );

    await service.poll(); // first poll — adds ticket 1
    await service.poll(); // second poll — same data, no diff

    expect(onDiff).toHaveBeenCalledTimes(1); // only called once
  });

  it('emits correct diff on subsequent polls', async () => {
    const onDiff = mock(() => {});
    let pollCount = 0;
    const fakeClient = {
      searchAssignedTickets: mock(() => {
        pollCount++;
        if (pollCount === 1) {
          return Promise.resolve([makeTicket(1, '2026-01-01'), makeTicket(2, '2026-01-01')]);
        }
        // Second poll: ticket 1 updated, ticket 2 removed, ticket 3 added
        return Promise.resolve([makeTicket(1, '2026-01-02'), makeTicket(3, '2026-01-01')]);
      }),
    };

    const service = new TicketPollingService(
      fakeClient as any,
      { intervalMs: 60_000, autoProcess: false },
      onDiff,
    );

    await service.poll(); // first poll
    await service.poll(); // second poll with changes

    expect(onDiff).toHaveBeenCalledTimes(2);

    const secondDiff = onDiff.mock.calls[1][0];
    expect(secondDiff.added.map((t: ZendeskTicket) => t.id)).toEqual([3]);
    expect(secondDiff.updated.map((t: ZendeskTicket) => t.id)).toEqual([1]);
    expect(secondDiff.removed).toEqual([2]);
  });
});
