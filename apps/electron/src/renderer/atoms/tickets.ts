/**
 * Ticket Queue State (Jotai Atoms)
 *
 * Core state management for the Zendesk ticket processing queue.
 * Provides atoms for the ticket map, sorting, filtering, and selection.
 *
 * Architecture:
 * - ticketQueueAtom: source of truth (Map<ticketId, TicketQueueItem>)
 * - Derived atoms compute sorted/filtered views without duplication
 * - Action atoms (to be added) will handle mutations
 */

import { atom } from 'jotai'
import type { TicketQueueItem, TicketProcessingStatus, PendingAction } from '@/types/ticket'

// ---------------------------------------------------------------------------
// Core state
// ---------------------------------------------------------------------------

/** Primary ticket queue — keyed by Zendesk ticket ID */
export const ticketQueueAtom = atom<Map<number, TicketQueueItem>>(new Map())

// ---------------------------------------------------------------------------
// Derived: sorted ticket list
// ---------------------------------------------------------------------------

/** Status display priority (lower = shown first) */
const STATUS_ORDER: Record<TicketProcessingStatus, number> = {
  ready: 0,
  needs_input: 1,
  working: 2,
  pending: 3,
  error: 4,
  paused: 5,
  done: 6,
}

/** All tickets sorted by status priority */
export const sortedTicketsAtom = atom((get) => {
  const queue = get(ticketQueueAtom)
  return Array.from(queue.values()).sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
  )
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/** Currently selected ticket ID */
export const activeTicketIdAtom = atom<number | null>(null)

/** Derived: full data for the active ticket */
export const activeTicketAtom = atom((get) => {
  const id = get(activeTicketIdAtom)
  if (id === null) return null
  return get(ticketQueueAtom).get(id) ?? null
})

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/** Ticket polling connection status */
export const pollingStatusAtom = atom<'idle' | 'polling' | 'error'>('idle')

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** UI filter for ticket list */
export const ticketFilterAtom = atom<'all' | 'ready' | 'needs_input'>('all')

/** Sorted tickets with the active filter applied */
export const filteredTicketsAtom = atom((get) => {
  const tickets = get(sortedTicketsAtom)
  const filter = get(ticketFilterAtom)
  if (filter === 'all') return tickets
  return tickets.filter((t) => t.status === filter)
})

// ---------------------------------------------------------------------------
// Zendesk Mode
// ---------------------------------------------------------------------------

/**
 * Whether the app is operating in "Zendesk mode".
 *
 * True when Zendesk credentials are configured and polling is active
 * (i.e., polling status is not idle) OR there are tickets in the queue.
 * Used by the sidebar to conditionally show the TicketQueue panel.
 */
export const zendeskModeAtom = atom<boolean>(false)

// ---------------------------------------------------------------------------
// Action atoms: ticket mutations
// ---------------------------------------------------------------------------

/** Update a ticket's sessionId (after session creation) */
export const setTicketSessionIdAtom = atom(
  null,
  (_get, set, { ticketId, sessionId }: { ticketId: number; sessionId: string }) => {
    set(ticketQueueAtom, (prev) => {
      const next = new Map(prev)
      const item = next.get(ticketId)
      if (item) {
        next.set(ticketId, { ...item, sessionId, status: 'working', lastUpdatedAt: Date.now() })
      }
      return next
    })
  },
)

/** Update a ticket's processing status */
export const setTicketStatusAtom = atom(
  null,
  (_get, set, { ticketId, status, error }: { ticketId: number; status: TicketProcessingStatus; error?: string }) => {
    set(ticketQueueAtom, (prev) => {
      const next = new Map(prev)
      const item = next.get(ticketId)
      if (item) {
        next.set(ticketId, {
          ...item,
          status,
          error: error ?? item.error,
          lastUpdatedAt: Date.now(),
        })
      }
      return next
    })
  },
)

/** Add a pending action to a ticket */
export const addPendingActionAtom = atom(
  null,
  (_get, set, { ticketId, action }: { ticketId: number; action: PendingAction }) => {
    set(ticketQueueAtom, (prev) => {
      const next = new Map(prev)
      const item = next.get(ticketId)
      if (item) {
        next.set(ticketId, {
          ...item,
          pendingActions: [...item.pendingActions, action],
          status: 'ready',
          lastUpdatedAt: Date.now(),
        })
      }
      return next
    })
  },
)

/** Remove a pending action from a ticket (after confirm/cancel) */
export const removePendingActionAtom = atom(
  null,
  (_get, set, { ticketId, actionId }: { ticketId: number; actionId: string }) => {
    set(ticketQueueAtom, (prev) => {
      const next = new Map(prev)
      const item = next.get(ticketId)
      if (item) {
        const actions = item.pendingActions.filter((a) => a.id !== actionId)
        next.set(ticketId, {
          ...item,
          pendingActions: actions,
          status: actions.length > 0 ? 'ready' : 'done',
          lastUpdatedAt: Date.now(),
        })
      }
      return next
    })
  },
)

/** Clear all pending actions from a ticket */
export const clearPendingActionsAtom = atom(
  null,
  (_get, set, ticketId: number) => {
    set(ticketQueueAtom, (prev) => {
      const next = new Map(prev)
      const item = next.get(ticketId)
      if (item) {
        next.set(ticketId, {
          ...item,
          pendingActions: [],
          status: 'done',
          lastUpdatedAt: Date.now(),
        })
      }
      return next
    })
  },
)

/** Find ticket ID by session ID */
export const ticketBySessionIdAtom = atom((get) => {
  const queue = get(ticketQueueAtom)
  const map = new Map<string, number>()
  for (const [ticketId, item] of queue) {
    if (item.sessionId) {
      map.set(item.sessionId, ticketId)
    }
  }
  return map
})
