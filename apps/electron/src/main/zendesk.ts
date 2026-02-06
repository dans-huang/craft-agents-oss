/**
 * Zendesk IPC handlers for Electron main process
 *
 * Handles Zendesk credential management, connection testing, and ticket polling.
 * Bridges the renderer (React) and main (Node) processes for all Zendesk operations.
 */
import { ipcMain } from 'electron'
import { mainLog } from './logger'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import {
  ZendeskClient,
  TicketPollingService,
  DEFAULT_POLLING_CONFIG,
  serializeCredentials,
  deserializeCredentials,
  getCredentialKey,
} from '@craft-agent/shared/zendesk'
import type { ZendeskCredentials } from '@craft-agent/shared/zendesk'
import { IPC_CHANNELS } from '../shared/types'
import type { TicketContext } from '@craft-agent/shared/zendesk'
import type { WindowManager } from './window-manager'
import type { SessionManager } from './sessions'

// Module-level state for the polling service
let pollingService: TicketPollingService | null = null

/**
 * Load saved Zendesk credentials from the encrypted credential store.
 * Returns null if no credentials are saved.
 */
async function loadZendeskCredentials(): Promise<ZendeskCredentials | null> {
  const credManager = getCredentialManager()
  const stored = await credManager.get({ type: 'source_apikey', name: getCredentialKey() })
  if (!stored?.value) return null
  try {
    return deserializeCredentials(stored.value)
  } catch (err) {
    mainLog.error('[zendesk] Failed to deserialize credentials:', err)
    return null
  }
}

/**
 * Save Zendesk credentials to the encrypted credential store.
 */
async function saveZendeskCredentials(creds: ZendeskCredentials): Promise<void> {
  const credManager = getCredentialManager()
  await credManager.set(
    { type: 'source_apikey', name: getCredentialKey() },
    { value: serializeCredentials(creds) },
  )
}

/**
 * Broadcast ticket diff to all renderer windows.
 */
function broadcastTicketUpdate(
  windowManager: WindowManager,
  diff: { added: unknown[]; updated: unknown[]; removed: number[] },
): void {
  for (const { window } of windowManager.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.ZENDESK_TICKET_UPDATE, diff)
    }
  }
}

// ============================================
// IPC Handlers
// ============================================

export function registerZendeskHandlers(windowManager: WindowManager, sessionManager: SessionManager): void {
  // Test Zendesk connection with provided credentials
  ipcMain.handle(IPC_CHANNELS.ZENDESK_TEST_CONNECTION, async (_event, creds: ZendeskCredentials) => {
    mainLog.info('[zendesk] Testing connection for', creds.subdomain)
    try {
      const client = new ZendeskClient(creds)
      const success = await client.testConnection()
      mainLog.info('[zendesk] Connection test result:', success)
      return success
    } catch (err) {
      mainLog.error('[zendesk] Connection test failed:', err)
      return false
    }
  })

  // Save Zendesk credentials to encrypted store
  ipcMain.handle(IPC_CHANNELS.ZENDESK_SAVE_CREDENTIALS, async (_event, creds: ZendeskCredentials) => {
    mainLog.info('[zendesk] Saving credentials for', creds.subdomain)
    await saveZendeskCredentials(creds)
    mainLog.info('[zendesk] Credentials saved successfully')
  })

  // Get saved Zendesk credentials (for pre-filling the setup form)
  ipcMain.handle(IPC_CHANNELS.ZENDESK_GET_CREDENTIALS, async () => {
    const creds = await loadZendeskCredentials()
    return creds
  })

  // Start ticket polling
  ipcMain.handle(IPC_CHANNELS.ZENDESK_START_POLLING, async () => {
    if (pollingService) {
      mainLog.info('[zendesk] Polling already active, ignoring start request')
      return
    }

    const creds = await loadZendeskCredentials()
    if (!creds) {
      mainLog.warn('[zendesk] Cannot start polling: no credentials saved')
      throw new Error('No Zendesk credentials configured. Please save credentials first.')
    }

    const client = new ZendeskClient(creds)
    pollingService = new TicketPollingService(
      client,
      DEFAULT_POLLING_CONFIG,
      (diff) => {
        broadcastTicketUpdate(windowManager, diff)
      },
    )
    pollingService.start()
    mainLog.info('[zendesk] Polling started (interval:', DEFAULT_POLLING_CONFIG.intervalMs, 'ms)')
  })

  // Stop ticket polling
  ipcMain.handle(IPC_CHANNELS.ZENDESK_STOP_POLLING, async () => {
    if (pollingService) {
      pollingService.stop()
      pollingService = null
      mainLog.info('[zendesk] Polling stopped')
    }
  })

  // Poll immediately (manual refresh)
  ipcMain.handle(IPC_CHANNELS.ZENDESK_POLL_NOW, async () => {
    if (!pollingService) {
      // If not polling, do a one-shot poll
      const creds = await loadZendeskCredentials()
      if (!creds) {
        throw new Error('No Zendesk credentials configured.')
      }
      const client = new ZendeskClient(creds)
      const tickets = await client.searchAssignedTickets()
      broadcastTicketUpdate(windowManager, { added: tickets, updated: [], removed: [] })
      return
    }

    await pollingService.poll()
  })

  // ============================================
  // Session Creation & Action Confirmation
  // ============================================

  // Create a Zendesk AI session linked to a ticket
  ipcMain.handle(
    IPC_CHANNELS.ZENDESK_CREATE_SESSION,
    async (_event, data: { ticketId: number; workspaceId: string; ticketContext: TicketContext }) => {
      mainLog.info(`[zendesk] Creating session for ticket #${data.ticketId}`)
      const session = await sessionManager.createSession(data.workspaceId, {
        systemPromptPreset: 'zendesk',
        hidden: true,
        workingDirectory: 'none',
        zendeskTicketId: data.ticketId,
        zendeskTicketContext: data.ticketContext,
      })
      mainLog.info(`[zendesk] Session created: ${session.id} for ticket #${data.ticketId}`)
      return session
    },
  )

  // Confirm a pending action (execute via Zendesk API)
  ipcMain.handle(
    IPC_CHANNELS.ZENDESK_CONFIRM_ACTION,
    async (_event, data: { ticketId: number; actionId: string; actionPayload: Record<string, unknown> }) => {
      mainLog.info(`[zendesk] Confirming action ${data.actionId} for ticket #${data.ticketId}`)
      try {
        const creds = await loadZendeskCredentials()
        if (!creds) {
          return { success: false, error: 'No Zendesk credentials configured' }
        }

        const client = new ZendeskClient(creds)
        const payload = data.actionPayload
        const action = payload.action as string

        if (action === 'draft_reply') {
          // Send the reply to the customer
          await client.updateTicket(data.ticketId, {
            ticket: {
              comment: {
                body: payload.body as string,
                public: true,
              },
              ...(payload.setStatus ? { status: payload.setStatus as any } : {}),
            },
          })
        } else if (action === 'request_status_change') {
          await client.updateTicket(data.ticketId, {
            ticket: {
              status: payload.requestedStatus as any,
            },
          })
        } else if (action === 'request_escalation') {
          // Add internal note with escalation reason
          await client.updateTicket(data.ticketId, {
            ticket: {
              comment: {
                body: `**Escalation requested:** ${payload.reason}${payload.targetGroup ? `\nTarget group: ${payload.targetGroup}` : ''}`,
                public: false,
              },
            },
          })
        }

        mainLog.info(`[zendesk] Action ${data.actionId} confirmed successfully`)
        return { success: true }
      } catch (err) {
        mainLog.error(`[zendesk] Action ${data.actionId} failed:`, err)
        return { success: false, error: String(err) }
      }
    },
  )

  // Cancel a pending action (just acknowledge — renderer removes from atoms)
  ipcMain.handle(
    IPC_CHANNELS.ZENDESK_CANCEL_ACTION,
    async (_event, _data: { ticketId: number; actionId: string }) => {
      mainLog.info(`[zendesk] Action cancelled`)
    },
  )
}
