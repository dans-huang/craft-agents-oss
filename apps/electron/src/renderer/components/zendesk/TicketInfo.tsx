/**
 * TicketInfo - Ticket metadata summary displayed at the top of the detail panel
 *
 * Shows customer name/email, Zendesk status, priority, and tags.
 * Uses theme tokens from the design system for consistent styling.
 */

import * as React from 'react'
import type { TicketQueueItem } from '@/types/ticket'

export function TicketInfo({ item }: { item: TicketQueueItem }) {
  const { ticket, requester } = item

  return (
    <div data-slot="ticket-info" className="space-y-3 p-3">
      {/* Customer */}
      <div>
        <div className="text-xs text-muted-foreground">Customer</div>
        <div className="text-sm text-foreground">{requester?.name ?? 'Unknown'}</div>
        <div className="text-xs text-muted-foreground/60">{requester?.email ?? ''}</div>
      </div>

      {/* Status & Priority */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="text-sm text-foreground capitalize">{ticket.status}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Priority</div>
          <div className="text-sm text-foreground capitalize">{ticket.priority ?? 'None'}</div>
        </div>
      </div>

      {/* Tags */}
      {ticket.tags.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground">Tags</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {ticket.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-foreground/5 text-muted-foreground px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
