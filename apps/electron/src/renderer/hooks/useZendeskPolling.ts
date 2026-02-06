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
 *
 * On unmount: removes the IPC listener and stops polling.
 */

import { useEffect, useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { ticketQueueAtom, pollingStatusAtom, zendeskModeAtom } from '@/atoms/tickets'
import type { ZendeskTicket } from '@craft-agent/shared/zendesk'
import type { TicketQueueItem } from '@/types/ticket'

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

  // -----------------------------------------------------------------------
  // Handle incoming ticket diff from main process
  // -----------------------------------------------------------------------

  const handleTicketDiff = useCallback(
    (diff: { added: unknown[]; updated: unknown[]; removed: number[] }) => {
      setQueue((prev) => {
        const next = new Map(prev)

        // Add new tickets
        const added = (diff.added ?? []) as ZendeskTicket[]
        for (const ticket of added) {
          next.set(ticket.id, createQueueItem(ticket))
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
    const cleanup = window.electronAPI?.onZendeskTicketUpdate?.((diff) => {
      handleTicketDiff(diff)
      setPollingStatus('idle')
    })

    return () => {
      cleanup?.()
      window.electronAPI?.stopZendeskPolling?.()
    }
  }, [handleTicketDiff, setPollingStatus, setZendeskMode])

  // -----------------------------------------------------------------------
  // Manual refresh
  // -----------------------------------------------------------------------

  const refresh = useCallback(() => {
    setPollingStatus('polling')
    window.electronAPI?.pollZendeskNow?.()
  }, [setPollingStatus])

  return { refresh }
}
