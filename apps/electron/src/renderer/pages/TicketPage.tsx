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
import { useAtomValue, useSetAtom } from 'jotai'
import {
  activeTicketAtom,
  removePendingActionAtom,
  clearPendingActionsAtom,
  setTicketSessionIdAtom,
  setTicketStatusAtom,
} from '@/atoms/tickets'
import { ZendeskPanel } from '@/components/zendesk/ZendeskPanel'
import { PendingActions } from '@/components/zendesk/PendingActions'
import { TicketChatPanel } from '@/components/zendesk/TicketChatPanel'
import { useAppShellContext } from '@/context/AppShellContext'
import type { TicketContext } from '@craft-agent/shared/zendesk'

export function TicketPage() {
  const activeTicket = useAtomValue(activeTicketAtom)
  const removePendingAction = useSetAtom(removePendingActionAtom)
  const clearPendingActions = useSetAtom(clearPendingActionsAtom)
  const setTicketSessionId = useSetAtom(setTicketSessionIdAtom)
  const setTicketStatus = useSetAtom(setTicketStatusAtom)
  const { activeWorkspaceId } = useAppShellContext()

  // Guard against rapid ticket clicks (prevent duplicate session creation)
  const creatingSessionRef = React.useRef<number | null>(null)

  // Auto-create AI session when a ticket is selected and has no session
  React.useEffect(() => {
    if (!activeTicket || activeTicket.sessionId || !activeWorkspaceId) return
    if (creatingSessionRef.current === activeTicket.ticket.id) return

    const ticketId = activeTicket.ticket.id
    creatingSessionRef.current = ticketId

    // Build ticket context
    const ticketContext: TicketContext = {
      ticketId,
      subject: activeTicket.ticket.subject,
      customerName: activeTicket.requester?.name || 'Unknown',
      productTags: activeTicket.ticket.tags,
      conversationHistory: activeTicket.comments
        .map((c) => `[${c.public ? 'Public' : 'Internal'}] ${c.body}`)
        .join('\n---\n') || '(No prior messages)',
    }

    window.electronAPI
      .createZendeskSession({
        ticketId,
        workspaceId: activeWorkspaceId,
        ticketContext,
      })
      .then((session) => {
        setTicketSessionId({ ticketId, sessionId: session.id })
        // Auto-send initial message to start the AI analysis
        window.electronAPI.sendMessage(
          session.id,
          'Analyze this ticket and proceed with intake phase.',
        )
      })
      .catch((err) => {
        console.error('[TicketPage] Failed to create session:', err)
        setTicketStatus({ ticketId, status: 'error', error: String(err) })
      })
      .finally(() => {
        if (creatingSessionRef.current === ticketId) {
          creatingSessionRef.current = null
        }
      })
  }, [activeTicket, activeWorkspaceId, setTicketSessionId, setTicketStatus])

  // Confirm a single pending action
  const handleConfirm = React.useCallback(
    async (actionId: string) => {
      if (!activeTicket) return
      const action = activeTicket.pendingActions.find((a) => a.id === actionId)
      if (!action) return

      const result = await window.electronAPI.confirmZendeskAction({
        ticketId: activeTicket.ticket.id,
        actionId,
        actionPayload: action.payload,
      })
      if (result.success) {
        removePendingAction({ ticketId: activeTicket.ticket.id, actionId })
      }
    },
    [activeTicket, removePendingAction],
  )

  // Confirm all pending actions sequentially
  const handleConfirmAll = React.useCallback(async () => {
    if (!activeTicket) return
    for (const action of activeTicket.pendingActions) {
      await window.electronAPI.confirmZendeskAction({
        ticketId: activeTicket.ticket.id,
        actionId: action.id,
        actionPayload: action.payload,
      })
    }
    clearPendingActions(activeTicket.ticket.id)
  }, [activeTicket, clearPendingActions])

  // Cancel all pending actions
  const handleCancelAll = React.useCallback(() => {
    if (!activeTicket) return
    clearPendingActions(activeTicket.ticket.id)
  }, [activeTicket, clearPendingActions])

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
        <div className="flex-1 overflow-hidden">
          {activeTicket.sessionId ? (
            <TicketChatPanel
              sessionId={activeTicket.sessionId}
              ticketId={activeTicket.ticket.id}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {activeTicket.status === 'error'
                ? `Error: ${activeTicket.error}`
                : 'Starting AI session...'}
            </div>
          )}
        </div>
        <PendingActions
          actions={activeTicket.pendingActions}
          onConfirm={handleConfirm}
          onConfirmAll={handleConfirmAll}
          onCancelAll={handleCancelAll}
        />
      </div>
    </div>
  )
}
