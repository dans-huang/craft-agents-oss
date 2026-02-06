/**
 * Zendesk Tools MCP Server
 *
 * Creates an in-process MCP server wrapping all Zendesk tools for a ticket session.
 * Follows the same pattern as `getSessionScopedTools()` in session-scoped-tools.ts.
 *
 * Two categories:
 * - **Auto-execute tools**: AI can call freely (search KB, lookup order, add tags, internal note)
 * - **Confirmation tools**: Return structured JSON for the PendingActions flow
 *   (draft_reply, request_status_change, request_escalation)
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { debug } from '../utils/debug.ts';

// Cache to reuse server instances per session
const zendeskToolsCache = new Map<string, ReturnType<typeof createSdkMcpServer>>();

/**
 * Create all zendesk tools for a session, bound to a specific ticket.
 * Tools don't depend on ZendeskClient directly — auto-execute tools are stubs
 * for now, and confirmation tools return structured JSON for the main process
 * to intercept and present as PendingActions.
 */
function createZendeskTools(ticketId: number) {
  // ============================================================
  // Auto-Execute Tools
  // ============================================================

  const searchKnowledgeBase = tool(
    'search_knowledge_base',
    `Search the knowledge base for articles related to the customer issue.

Use this to find relevant help articles, troubleshooting guides, and documentation
that can help resolve the customer's problem.

**Search types:**
- \`semantic\`: Natural language search — best for understanding intent (e.g., "amp won't turn on")
- \`keyword\`: Exact keyword matching — best for specific terms (e.g., "BIAS FX 2 activation code")

Returns matching articles with titles, excerpts, and relevance scores.`,
    {
      query: z.string().describe('Search query describing the customer issue or topic'),
      type: z.enum(['semantic', 'keyword']).describe('Search type: semantic for natural language, keyword for exact matching'),
    },
    async (args) => {
      // TODO: Wire to real KB search
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            query: args.query,
            type: args.type,
            results: [],
            message: 'Knowledge base search not yet connected',
          }, null, 2),
        }],
      };
    }
  );

  const lookupOrder = tool(
    'lookup_order',
    `Look up an order by order number or customer email.

Use this to find order details including purchase date, items ordered,
shipping status, and payment information.

**Returns:** Order details including status, items, and tracking info.`,
    {
      orderNumber: z.string().optional().describe('Order number to look up'),
      customerEmail: z.string().optional().describe('Customer email to search orders for'),
    },
    async (args) => {
      if (!args.orderNumber && !args.customerEmail) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Provide at least one of orderNumber or customerEmail.' }],
          isError: true,
        };
      }
      // TODO: Wire to real order lookup
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            orderNumber: args.orderNumber,
            customerEmail: args.customerEmail,
            results: [],
            message: 'Order lookup not yet connected',
          }, null, 2),
        }],
      };
    }
  );

  const lookupRegistration = tool(
    'lookup_registration',
    `Check product registration status by serial number or customer email.

**Returns:** Registration details including product, registration date, and warranty status.`,
    {
      serialNumber: z.string().optional().describe('Product serial number to look up'),
      customerEmail: z.string().optional().describe('Customer email to search registrations for'),
    },
    async (args) => {
      if (!args.serialNumber && !args.customerEmail) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Provide at least one of serialNumber or customerEmail.' }],
          isError: true,
        };
      }
      // TODO: Wire to real registration lookup
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            serialNumber: args.serialNumber,
            customerEmail: args.customerEmail,
            results: [],
            message: 'Registration lookup not yet connected',
          }, null, 2),
        }],
      };
    }
  );

  const searchJira = tool(
    'search_jira',
    `Search JIRA for known issues, bugs, or feature requests.

**Returns:** Matching JIRA issues with key, summary, status, and priority.`,
    {
      query: z.string().describe('Search query describing the issue to look for'),
      project: z.string().optional().describe('JIRA project key to search within (e.g., "STFS")'),
    },
    async (args) => {
      // TODO: Wire to real JIRA search
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            query: args.query,
            project: args.project,
            results: [],
            message: 'JIRA search not yet connected',
          }, null, 2),
        }],
      };
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
      // TODO: Wire to ZendeskClient.updateTicket()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            ticketId,
            added: args.tags,
            message: 'Tags added successfully',
          }, null, 2),
        }],
      };
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
      // TODO: Wire to ZendeskClient.updateTicket() with public: false
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
    searchKnowledgeBase,
    lookupOrder,
    lookupRegistration,
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
): ReturnType<typeof createSdkMcpServer> {
  const cacheKey = `${sessionId}::${ticketId}`;
  let cached = zendeskToolsCache.get(cacheKey);
  if (!cached) {
    cached = createSdkMcpServer({
      name: 'zendesk-tools',
      version: '1.0.0',
      tools: createZendeskTools(ticketId),
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
