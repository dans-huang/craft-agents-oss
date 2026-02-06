/**
 * Ticket Queue Types
 *
 * Type definitions for the ticket processing queue.
 * Used by Jotai atoms and UI components to track ticket state
 * as they flow through the AI-assisted support workflow.
 */

import type { ZendeskTicket, ZendeskComment, ZendeskUser } from '@craft-agent/shared/zendesk'

export type TicketProcessingStatus =
  | 'pending'     // In queue, not yet processed
  | 'working'     // AI is processing
  | 'ready'       // AI done, waiting for review
  | 'needs_input' // AI needs human decision
  | 'paused'      // Manually paused
  | 'error'       // Error occurred
  | 'done'        // Completed

export interface TicketQueueItem {
  ticket: ZendeskTicket
  status: TicketProcessingStatus
  /** Linked AI session ID */
  sessionId: string | null
  requester: ZendeskUser | null
  comments: ZendeskComment[]
  pendingActions: PendingAction[]
  error: string | null
  addedAt: number
  lastUpdatedAt: number
}

export interface PendingAction {
  id: string
  type: 'send_reply' | 'update_status' | 'add_tags' | 'escalate' | 'other'
  label: string
  description: string
  payload: Record<string, unknown>
  confirmed: boolean
}
