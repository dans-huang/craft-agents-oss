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
import type { TicketQueueItem, TicketProcessingStatus } from '@/types/ticket'

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
