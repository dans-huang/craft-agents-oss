/**
 * StatusBadge - Visual indicator for ticket processing status
 *
 * Renders an emoji icon with a semantic color class for each
 * TicketProcessingStatus value. Used in TicketQueueItem and
 * potentially in the detail panel header.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { TicketProcessingStatus } from '@/types/ticket'

const STATUS_CONFIG: Record<
  TicketProcessingStatus,
  { icon: string; color: string; label: string }
> = {
  pending:     { icon: '\u23F3',     color: 'text-muted-foreground', label: 'Pending' },
  working:     { icon: '\uD83D\uDD04', color: 'text-info',          label: 'Working' },
  ready:       { icon: '\uD83D\uDFE2', color: 'text-success',       label: 'Ready' },
  needs_input: { icon: '\uD83D\uDFE1', color: 'text-info',          label: 'Needs Input' },
  paused:      { icon: '\u23F8\uFE0F', color: 'text-muted-foreground', label: 'Paused' },
  error:       { icon: '\uD83D\uDD34', color: 'text-destructive',   label: 'Error' },
  done:        { icon: '\u2705',     color: 'text-success',         label: 'Done' },
}

export function StatusBadge({ status }: { status: TicketProcessingStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      data-slot="status-badge"
      className={cn('text-xs leading-none', config.color)}
      title={config.label}
    >
      {config.icon}
    </span>
  )
}
