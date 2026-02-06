/**
 * Zendesk Polling Hook
 *
 * Bridges the IPC layer (main process polling via Task 14) to the Jotai
 * ticket queue atoms in the renderer (Task 5).
 *
 * On mount:
 * 1. Checks for saved Zendesk credentials
 * 2. If found, sets zendeskModeAtom → true (switches sidebar to TicketQueue)
 * 3. Starts polling via IPC
 * 4. Listens for ticket-update events from the main process
 * 5. Updates ticketQueueAtom with incoming ticket data
 * 6. Listens for session events to update ticket status
 * 7. Listens for pending action events from zendesk tool results
 *
 * On unmount: removes the IPC listener and stops polling.
 */

import { useEffect, useCallback } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  ticketQueueAtom,
  pollingStatusAtom,
  zendeskModeAtom,
  setTicketStatusAtom,
  addPendingActionAtom,
  ticketBySessionIdAtom,
} from '@/atoms/tickets'
import type { ZendeskTicket } from '@craft-agent/shared/zendesk'
import type { TicketQueueItem } from '@/types/ticket'
import type { SessionEvent } from '../../shared/types'

/**
 * Build a fresh TicketQueueItem for a newly-discovered ticket.
 */
function createQueueItem(ticket: ZendeskTicket): TicketQueueItem {
  return {
    ticket,
    status: 'pending',
    sessionId: null,
    requester: null,
    comments: [],
    pendingActions: [],
    error: null,
    addedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  }
}

export function useZendeskPolling() {
  const setQueue = useSetAtom(ticketQueueAtom)
  const setPollingStatus = useSetAtom(pollingStatusAtom)
  const setZendeskMode = useSetAtom(zendeskModeAtom)
  const setTicketStatus = useSetAtom(setTicketStatusAtom)
  const addPendingAction = useSetAtom(addPendingActionAtom)
  const ticketBySessionId = useAtomValue(ticketBySessionIdAtom)

  // -----------------------------------------------------------------------
  // Handle incoming ticket diff from main process
  // -----------------------------------------------------------------------

  const handleTicketDiff = useCallback(
    (diff: { added: unknown[]; updated: unknown[]; removed: number[] }) => {
      setQueue((prev) => {
        const next = new Map(prev)

        // Add new tickets (only if not already in queue)
        const added = (diff.added ?? []) as ZendeskTicket[]
        for (const ticket of added) {
          if (!next.has(ticket.id)) {
            next.set(ticket.id, createQueueItem(ticket))
          }
        }

        // Update existing tickets (preserve local processing state)
        const updated = (diff.updated ?? []) as ZendeskTicket[]
        for (const ticket of updated) {
          const existing = next.get(ticket.id)
          if (existing) {
            next.set(ticket.id, { ...existing, ticket, lastUpdatedAt: Date.now() })
          } else {
            // Updated ticket we haven't seen yet — treat as new
            next.set(ticket.id, createQueueItem(ticket))
          }
        }

        // Remove tickets that are no longer assigned
        // (unless actively being worked on by the AI)
        const removed = diff.removed ?? []
        for (const id of removed) {
          const item = next.get(id)
          if (item && item.status !== 'working') {
            next.delete(id)
          }
        }

        return next
      })
    },
    [setQueue],
  )

  // -----------------------------------------------------------------------
  // Handle session events (update ticket status based on AI session state)
  // -----------------------------------------------------------------------

  const handleSessionEvent = useCallback(
    (event: SessionEvent) => {
      const ticketId = ticketBySessionId.get(event.sessionId)
      if (!ticketId) return // Not a zendesk session

      switch (event.type) {
        case 'text_complete':
          // AI is still working (intermediate messages)
          break
        case 'complete':
          // AI turn completed — if there are pending actions, status is 'ready'
          // The pending action events will handle setting 'ready' status
          break
        case 'error':
          setTicketStatus({ ticketId, status: 'error', error: event.error })
          break
      }
    },
    [ticketBySessionId, setTicketStatus],
  )

  // -----------------------------------------------------------------------
  // Handle pending action events from main process
  // -----------------------------------------------------------------------

  const handlePendingAction = useCallback(
    (data: { ticketId: number; action: { id: string; type: string; label: string; description: string; payload: Record<string, unknown> } }) => {
      addPendingAction({
        ticketId: data.ticketId,
        action: {
          id: data.action.id,
          type: data.action.type as any,
          label: data.action.label,
          description: data.action.description,
          payload: data.action.payload,
          confirmed: false,
        },
      })
    },
    [addPendingAction],
  )

  // -----------------------------------------------------------------------
  // Setup: check credentials, start polling, listen for updates
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Check if Zendesk credentials exist
    window.electronAPI?.getZendeskCredentials?.().then((creds) => {
      if (creds) {
        setZendeskMode(true)
        // Start polling
        window.electronAPI?.startZendeskPolling?.()
      }
    })

    // Listen for ticket update events from the main process
    const cleanupTickets = window.electronAPI?.onZendeskTicketUpdate?.((diff) => {
      handleTicketDiff(diff)
      setPollingStatus('idle')
    })

    // Listen for session events (to update ticket status)
    const cleanupSession = window.electronAPI?.onSessionEvent?.(handleSessionEvent)

    // Listen for pending action events from zendesk tool results
    const cleanupPendingAction = window.electronAPI?.onZendeskPendingAction?.(handlePendingAction)

    return () => {
      cleanupTickets?.()
      cleanupSession?.()
      cleanupPendingAction?.()
      window.electronAPI?.stopZendeskPolling?.()
    }
  }, [handleTicketDiff, handleSessionEvent, handlePendingAction, setPollingStatus, setZendeskMode])

  // -----------------------------------------------------------------------
  // Manual refresh
  // -----------------------------------------------------------------------

  const refresh = useCallback(() => {
    setPollingStatus('polling')
    window.electronAPI?.pollZendeskNow?.()
  }, [setPollingStatus])

  return { refresh }
}
