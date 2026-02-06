/**
 * Zendesk Tools MCP Server
 *
 * Creates an in-process MCP server wrapping all Zendesk tools for a ticket session.
 * Follows the same pattern as `getSessionScopedTools()` in session-scoped-tools.ts.
 *
 * Two categories:
 * - **Auto-execute tools**: AI can call freely (search JIRA, add tags, internal note)
 *   KB search, order & registration lookup are provided via n8n MCP server.
 * - **Confirmation tools**: Return structured JSON for the PendingActions flow
 *   (draft_reply, request_status_change, request_escalation)
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { debug } from '../utils/debug.ts';
import type { ZendeskCredentials, JiraCredentials } from '../zendesk/types.ts';
import { ZendeskClient } from '../zendesk/client.ts';
import { JiraClient } from '../zendesk/jira-client.ts';

// Cache to reuse server instances per session
const zendeskToolsCache = new Map<string, ReturnType<typeof createSdkMcpServer>>();

/**
 * Create all zendesk tools for a session, bound to a specific ticket.
 * Auto-execute tools call ZendeskClient/JiraClient directly.
 * Confirmation tools return structured JSON for the main process
 * to intercept and present as PendingActions.
 */
function createZendeskTools(ticketId: number, zendeskCreds?: ZendeskCredentials, jiraCreds?: { baseUrl: string; email: string; apiToken: string }) {
  // ============================================================
  // Auto-Execute Tools
  // ============================================================

  // NOTE: KB search, order lookup, and registration lookup are now provided by
  // the n8n MCP server (workflow_execute). Stubs removed in Phase 3.

  const searchJira = tool(
    'search_jira',
    `Search JIRA for known issues, bugs, or feature requests.

**Returns:** Matching JIRA issues with key, summary, status, and priority.`,
    {
      query: z.string().describe('Search query describing the issue to look for'),
      project: z.string().optional().describe('JIRA project key to search within (e.g., "STFS")'),
    },
    async (args) => {
      if (!jiraCreds) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              query: args.query,
              project: args.project,
              results: [],
              message: 'JIRA is not configured. Ask the agent to set up JIRA credentials in Settings.',
            }, null, 2),
          }],
        };
      }
      try {
        const client = new JiraClient(jiraCreds);
        const results = await client.search(args.query, args.project);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              query: args.query,
              project: args.project,
              results,
              count: results.length,
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error searching JIRA: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  const addTicketTags = tool(
    'add_ticket_tags',
    `Add tags to the current Zendesk ticket (#${ticketId}).

Tags are additive — existing tags are preserved.
**Note:** This modifies the ticket immediately. Tags are visible to all agents.`,
    {
      tags: z.array(z.string()).describe('Array of tags to add to the ticket'),
    },
    async (args) => {
      if (args.tags.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Provide at least one tag to add.' }],
          isError: true,
        };
      }
      if (!zendeskCreds) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Zendesk credentials not configured. Cannot add tags.' }],
          isError: true,
        };
      }
      try {
        const client = new ZendeskClient(zendeskCreds);
        // Fetch existing tags, merge with new ones (additive)
        const ticket = await client.getTicket(ticketId);
        const existingTags = ticket.tags || [];
        const mergedTags = [...new Set([...existingTags, ...args.tags])];
        await client.updateTicket(ticketId, { ticket: { tags: mergedTags } });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ticketId,
              added: args.tags,
              allTags: mergedTags,
              message: 'Tags added successfully',
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error adding tags: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  const addInternalNote = tool(
    'add_internal_note',
    `Add an internal note to ticket #${ticketId} (not visible to customer).

Use this to document findings, leave context for other agents, or record troubleshooting steps.
**Note:** This creates a comment immediately. The note is visible to all agents.`,
    {
      note: z.string().describe('The internal note content (supports markdown)'),
    },
    async (args) => {
      if (!args.note.trim()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Note content cannot be empty.' }],
          isError: true,
        };
      }
      if (!zendeskCreds) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Zendesk credentials not configured. Cannot add note.' }],
          isError: true,
        };
      }
      try {
        const client = new ZendeskClient(zendeskCreds);
        await client.updateTicket(ticketId, {
          ticket: {
            comment: {
              body: args.note,
              public: false,
            },
          },
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ticketId,
              message: 'Internal note added successfully',
              preview: args.note.substring(0, 100) + (args.note.length > 100 ? '...' : ''),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error adding internal note: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Confirmation Tools — return structured JSON for PendingActions
  // ============================================================

  const draftReply = tool(
    'draft_reply',
    `Prepare a draft reply for ticket #${ticketId} for the human agent to review before sending.

This does **NOT** send the reply to the customer. It creates a draft that
the agent can review, edit, and approve through the Pending Actions UI.

**Optional status change:** Set \`setStatus\` to change the ticket status
when the reply is sent (e.g., "pending" after asking for more info).`,
    {
      body: z.string().describe('The draft reply content (supports markdown/HTML)'),
      setStatus: z.enum(['open', 'pending', 'solved']).optional().describe(
        'Optionally set ticket status when reply is sent'
      ),
    },
    async (args) => {
      if (!args.body.trim()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Reply body cannot be empty.' }],
          isError: true,
        };
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __zendesk_action: true,
            action: 'draft_reply',
            ticketId,
            status: 'pending_confirmation',
            body: args.body,
            setStatus: args.setStatus ?? null,
            message: 'Draft reply prepared. Awaiting agent confirmation.',
          }, null, 2),
        }],
      };
    }
  );

  const requestStatusChange = tool(
    'request_status_change',
    `Request to change ticket #${ticketId}'s status.

This does **NOT** change the status immediately. It creates a pending action
for the human agent to review and approve.`,
    {
      status: z.enum(['open', 'pending', 'hold', 'solved']).describe('The requested new ticket status'),
      reason: z.string().describe('Explanation of why this status change is appropriate'),
    },
    async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __zendesk_action: true,
            action: 'request_status_change',
            ticketId,
            status: 'pending_confirmation',
            requestedStatus: args.status,
            reason: args.reason,
            message: 'Status change requested. Awaiting agent confirmation.',
          }, null, 2),
        }],
      };
    }
  );

  const requestEscalation = tool(
    'request_escalation',
    `Request to escalate ticket #${ticketId} to another team or group.

This does **NOT** escalate immediately. It creates a pending action
for the human agent to review and approve.`,
    {
      reason: z.string().describe('Clear explanation of why escalation is needed'),
      targetGroup: z.string().optional().describe('Target group/team to escalate to (e.g., "Engineering", "Tier 2")'),
    },
    async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __zendesk_action: true,
            action: 'request_escalation',
            ticketId,
            status: 'pending_confirmation',
            reason: args.reason,
            targetGroup: args.targetGroup ?? null,
            message: 'Escalation requested. Awaiting agent confirmation.',
          }, null, 2),
        }],
      };
    }
  );

  return [
    searchJira,
    addTicketTags,
    addInternalNote,
    draftReply,
    requestStatusChange,
    requestEscalation,
  ];
}

/** Tool names that produce PendingActions (confirmation required) */
export const ZENDESK_CONFIRMATION_TOOLS = new Set([
  'draft_reply',
  'request_status_change',
  'request_escalation',
]);

/**
 * Get the Zendesk tools MCP server for a session.
 * Cached per session — same session gets the same server instance.
 */
export function getZendeskToolsServer(
  sessionId: string,
  ticketId: number,
  zendeskCreds?: ZendeskCredentials,
  jiraCreds?: { baseUrl: string; email: string; apiToken: string },
): ReturnType<typeof createSdkMcpServer> {
  const cacheKey = `${sessionId}::${ticketId}`;
  let cached = zendeskToolsCache.get(cacheKey);
  if (!cached) {
    cached = createSdkMcpServer({
      name: 'zendesk-tools',
      version: '1.0.0',
      tools: createZendeskTools(ticketId, zendeskCreds, jiraCreds),
    });
    zendeskToolsCache.set(cacheKey, cached);
    debug(`[ZendeskToolsServer] Created tools server for session ${sessionId}, ticket #${ticketId}`);
  }
  return cached;
}

/**
 * Clean up cached zendesk tools server when a session is disposed.
 */
export function cleanupZendeskToolsServer(sessionId: string): void {
  for (const key of zendeskToolsCache.keys()) {
    if (key.startsWith(`${sessionId}::`)) {
      zendeskToolsCache.delete(key);
    }
  }
}
