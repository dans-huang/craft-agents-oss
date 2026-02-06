/**
 * TicketQueueItem - Single ticket row in the ticket queue sidebar
 *
 * Displays the ticket's processing status, Zendesk ID, subject line,
 * and requester name. Highlights when selected as the active ticket.
 *
 * Follows the same layout patterns as SessionItem in SessionList.tsx
 * but optimized for the Zendesk ticket workflow.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import type { TicketQueueItem as TicketQueueItemType } from '@/types/ticket'

interface Props {
  item: TicketQueueItemType
  isActive: boolean
  onClick: () => void
}

export function TicketQueueItem({ item, isActive, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-[8px] transition-[background-color] duration-75',
        'hover:bg-foreground/[0.03]',
        isActive && 'bg-foreground/5 hover:bg-foreground/7',
      )}
    >
      <div className="flex items-center gap-2">
        <StatusBadge status={item.status} />
        <span className="text-xs text-muted-foreground">#{item.ticket.id}</span>
      </div>
      <div className="text-sm text-foreground truncate mt-0.5">
        {item.ticket.subject}
      </div>
      <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
        {item.requester?.name ?? 'Unknown'}
      </div>
    </button>
  )
}
