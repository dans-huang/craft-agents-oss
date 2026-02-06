import type { ZendeskTicket } from './types.ts';
import { ZendeskClient } from './client.ts';

export interface PollingConfig {
  intervalMs: number; // default 60000 (60s)
  autoProcess: boolean; // auto-start AI on new tickets
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  intervalMs: 60_000,
  autoProcess: false,
};

interface TicketDiff {
  added: ZendeskTicket[];
  updated: ZendeskTicket[];
  removed: number[]; // ticket IDs
}

export class TicketPollingService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private client: ZendeskClient;
  private config: PollingConfig;
  private onDiff: (diff: TicketDiff) => void;
  private knownTickets: Map<number, { id: number; updated_at: string }> = new Map();

  constructor(
    client: ZendeskClient,
    config: PollingConfig,
    onDiff: (diff: TicketDiff) => void,
  ) {
    this.client = client;
    this.config = config;
    this.onDiff = onDiff;
  }

  static diff(
    existing: Map<number, { id: number; updated_at: string }>,
    incoming: ZendeskTicket[],
  ): TicketDiff {
    const added: ZendeskTicket[] = [];
    const updated: ZendeskTicket[] = [];
    const incomingIds = new Set<number>();

    for (const ticket of incoming) {
      incomingIds.add(ticket.id);
      const prev = existing.get(ticket.id);
      if (!prev) {
        added.push(ticket);
      } else if (prev.updated_at !== ticket.updated_at) {
        updated.push(ticket);
      }
    }

    const removed: number[] = [];
    for (const id of existing.keys()) {
      if (!incomingIds.has(id)) {
        removed.push(id);
      }
    }

    return { added, updated, removed };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.poll(), this.config.intervalMs);
    this.poll(); // poll immediately on start
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll(): Promise<void> {
    try {
      const tickets = await this.client.searchAssignedTickets();
      const diff = TicketPollingService.diff(this.knownTickets, tickets);

      // Update internal state to reflect current snapshot
      this.knownTickets.clear();
      for (const ticket of tickets) {
        this.knownTickets.set(ticket.id, { id: ticket.id, updated_at: ticket.updated_at });
      }

      // Only emit if there are actual changes
      if (diff.added.length || diff.updated.length || diff.removed.length) {
        this.onDiff(diff);
      }
    } catch (error) {
      console.error('[TicketPolling] Error:', error);
    }
  }

  updateConfig(config: Partial<PollingConfig>): void {
    const wasRunning = this.timer !== null;
    if (wasRunning) this.stop();
    this.config = { ...this.config, ...config };
    if (wasRunning) this.start();
  }
}
