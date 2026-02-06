/**
 * TicketPage - Split-panel layout for active Zendesk ticket processing
 *
 * When a ticket is selected from the queue, the main content area switches
 * to this split view:
 * - Left panel (2/5): ZendeskPanel showing ticket details and conversation
 * - Right panel (3/5): AI conversation area + PendingActions confirmation bar
 *
 * Reads from activeTicketAtom (Jotai) -- selection is driven by the
 * TicketQueue sidebar. Shows an empty-state placeholder when no ticket
 * is selected (callers should gate on activeTicketIdAtom before rendering).
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { activeTicketAtom } from '@/atoms/tickets'
import { ZendeskPanel } from '@/components/zendesk/ZendeskPanel'
import { PendingActions } from '@/components/zendesk/PendingActions'

export function TicketPage() {
  const activeTicket = useAtomValue(activeTicketAtom)

  if (!activeTicket) {
    return (
      <div
        data-slot="ticket-page-empty"
        className="flex items-center justify-center h-full text-muted-foreground"
      >
        <p className="text-sm">Select a ticket from the queue</p>
      </div>
    )
  }

  return (
    <div data-slot="ticket-page" className="flex h-full">
      {/* Left: Zendesk ticket detail panel */}
      <div className="w-2/5 min-w-[300px] border-r border-foreground/[0.06] overflow-hidden">
        <ZendeskPanel />
      </div>

      {/* Right: AI conversation + pending actions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          AI conversation for #{activeTicket.ticket.id}
          {/* TODO: Wire to actual ChatDisplay with linked sessionId */}
        </div>
        <PendingActions
          actions={activeTicket.pendingActions}
          onConfirm={(id) => console.log('confirm', id)}
          onConfirmAll={() => console.log('confirm all')}
          onCancelAll={() => console.log('cancel all')}
        />
      </div>
    </div>
  )
}
