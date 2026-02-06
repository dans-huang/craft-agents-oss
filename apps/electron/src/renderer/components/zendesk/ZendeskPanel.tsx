/**
 * ZendeskPanel - Composite ticket detail view (right-hand panel)
 *
 * Assembles TicketInfo and ConversationThread into a single panel that
 * displays the full detail of the currently selected ticket. Shows an
 * empty-state placeholder when no ticket is selected.
 *
 * Reads from activeTicketAtom (Jotai) — selection is driven by the
 * TicketQueue sidebar on the left.
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { activeTicketAtom } from '@/atoms/tickets'
import { TicketInfo } from './TicketInfo'
import { ConversationThread } from './ConversationThread'
import { Separator } from '@/components/ui/separator'

export function ZendeskPanel() {
  const activeTicket = useAtomValue(activeTicketAtom)

  if (!activeTicket) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a ticket to view details
      </div>
    )
  }

  return (
    <div data-slot="zendesk-panel" className="flex flex-col h-full">
      {/* Header: ticket ID and subject */}
      <div className="shrink-0 px-3 py-2 border-b border-foreground/[0.06]">
        <div className="text-sm font-medium text-foreground">
          #{activeTicket.ticket.id}: {activeTicket.ticket.subject}
        </div>
      </div>

      {/* Ticket metadata */}
      <TicketInfo item={activeTicket} />

      <Separator />

      {/* Conversation section */}
      <div className="text-xs text-muted-foreground px-3 py-1">Conversation</div>
      <ConversationThread comments={activeTicket.comments} />
    </div>
  )
}
