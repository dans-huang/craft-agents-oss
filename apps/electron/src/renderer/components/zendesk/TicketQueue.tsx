/**
 * TicketQueue - Scrollable sidebar panel listing all assigned tickets
 *
 * Reads from Jotai atoms (filteredTicketsAtom, activeTicketIdAtom) to
 * display tickets sorted by processing-status priority. Clicking a
 * ticket sets it as the active selection for the detail panel.
 *
 * Layout:
 * - Fixed header with ticket count
 * - Scrollable body (Radix ScrollArea) with TicketQueueItem rows
 * - Empty state when no tickets are assigned
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { filteredTicketsAtom, activeTicketIdAtom } from '@/atoms/tickets'
import { TicketQueueItem } from './TicketQueueItem'
import { ScrollArea } from '@/components/ui/scroll-area'

export function TicketQueue() {
  const tickets = useAtomValue(filteredTicketsAtom)
  const activeId = useAtomValue(activeTicketIdAtom)
  const setActiveId = useSetAtom(activeTicketIdAtom)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-3 h-[40px] border-b border-foreground/[0.06]">
        <span className="text-sm font-semibold text-foreground">
          Tickets ({tickets.length})
        </span>
      </div>

      {/* Scrollable ticket list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tickets.map((item) => (
            <TicketQueueItem
              key={item.ticket.id}
              item={item}
              isActive={activeId === item.ticket.id}
              onClick={() => setActiveId(item.ticket.id)}
            />
          ))}
          {tickets.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No tickets assigned
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
