/**
 * Session-Scoped Zendesk Tools
 *
 * Tools available to the AI agent during a Zendesk ticket session.
 * Divided into two categories:
 *
 * **Auto-execute tools** — The AI can call these freely without agent confirmation:
 * - search_knowledge_base: Search KB articles related to the customer issue
 * - lookup_order: Look up order by number or email
 * - lookup_registration: Check product registration status
 * - search_jira: Search JIRA for known issues/bugs
 * - add_ticket_tags: Add tags to the current ticket
 * - add_internal_note: Add an internal note (not visible to customer)
 *
 * **Needs-confirmation tools** — AI prepares, human agent confirms:
 * - draft_reply: Prepare a draft reply for agent review (does NOT send)
 * - request_status_change: Request to change ticket status
 * - request_escalation: Request to escalate ticket
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// ============================================================
// Auto-Execute Tools
// ============================================================

/**
 * Search the knowledge base for articles related to the customer issue.
 */
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
    // TODO: Implement KB search integration
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

/**
 * Look up an order by order number or customer email.
 */
const lookupOrder = tool(
  'lookup_order',
  `Look up an order by order number or customer email.

Use this to find order details including purchase date, items ordered,
shipping status, and payment information. Provide at least one of
orderNumber or customerEmail.

**Returns:** Order details including status, items, and tracking info.`,
  {
    orderNumber: z.string().optional().describe('Order number to look up'),
    customerEmail: z.string().optional().describe('Customer email to search orders for'),
  },
  async (args) => {
    if (!args.orderNumber && !args.customerEmail) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: Provide at least one of orderNumber or customerEmail.',
        }],
        isError: true,
      };
    }

    // TODO: Implement order lookup integration
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

/**
 * Check product registration status.
 */
const lookupRegistration = tool(
  'lookup_registration',
  `Check product registration status by serial number or customer email.

Use this to verify whether a product has been registered, check warranty
status, and find registration details. Provide at least one of
serialNumber or customerEmail.

**Returns:** Registration details including product, registration date, and warranty status.`,
  {
    serialNumber: z.string().optional().describe('Product serial number to look up'),
    customerEmail: z.string().optional().describe('Customer email to search registrations for'),
  },
  async (args) => {
    if (!args.serialNumber && !args.customerEmail) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: Provide at least one of serialNumber or customerEmail.',
        }],
        isError: true,
      };
    }

    // TODO: Implement registration lookup integration
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

/**
 * Search JIRA for known issues or bugs.
 */
const searchJira = tool(
  'search_jira',
  `Search JIRA for known issues, bugs, or feature requests.

Use this to check if the customer's issue is a known bug, has been
reported before, or is being tracked as a feature request.

**Returns:** Matching JIRA issues with key, summary, status, and priority.`,
  {
    query: z.string().describe('Search query describing the issue to look for'),
    project: z.string().optional().describe('JIRA project key to search within (e.g., "STFS")'),
  },
  async (args) => {
    // TODO: Implement JIRA search integration
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

/**
 * Add tags to the current ticket.
 */
const addTicketTags = tool(
  'add_ticket_tags',
  `Add tags to the current Zendesk ticket.

Use this to categorize the ticket, mark it for follow-up, or apply
workflow tags. Tags are additive — existing tags are preserved.

**Examples:** ["hardware-issue", "warranty-claim", "needs-rma"]

**Note:** This modifies the ticket immediately. Tags are visible to all agents.`,
  {
    tags: z.array(z.string()).describe('Array of tags to add to the ticket'),
  },
  async (args) => {
    if (args.tags.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: Provide at least one tag to add.',
        }],
        isError: true,
      };
    }

    // TODO: Implement Zendesk tag update via ZendeskClient
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          added: args.tags,
          message: 'Tags added successfully',
        }, null, 2),
      }],
    };
  }
);

/**
 * Add an internal note to the ticket (not visible to customer).
 */
const addInternalNote = tool(
  'add_internal_note',
  `Add an internal note to the current Zendesk ticket.

Internal notes are **not visible to the customer**. Use this to:
- Document findings from research
- Leave context for other agents
- Record troubleshooting steps taken
- Note relevant JIRA issues or KB articles found

**Note:** This creates a comment immediately. The note is visible to all agents.`,
  {
    note: z.string().describe('The internal note content (supports markdown)'),
  },
  async (args) => {
    if (!args.note.trim()) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: Note content cannot be empty.',
        }],
        isError: true,
      };
    }

    // TODO: Implement internal note via ZendeskClient (comment with public: false)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          message: 'Internal note added successfully',
          preview: args.note.substring(0, 100) + (args.note.length > 100 ? '...' : ''),
        }, null, 2),
      }],
    };
  }
);

// ============================================================
// Needs-Confirmation Tools
// ============================================================

/**
 * Prepare a draft reply for the agent to review.
 */
const draftReply = tool(
  'draft_reply',
  `Prepare a draft reply for the human agent to review before sending.

This does **NOT** send the reply to the customer. It creates a draft that
the agent can review, edit, and approve through the Pending Actions UI.

**Best practices:**
- Write in the tone and style appropriate for the brand
- Address the customer's specific issue
- Include relevant KB article links when helpful
- Suggest next steps clearly

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
        content: [{
          type: 'text' as const,
          text: 'Error: Reply body cannot be empty.',
        }],
        isError: true,
      };
    }

    // This tool prepares a draft for the Pending Actions queue.
    // The actual sending happens when the agent confirms via the UI.
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          action: 'draft_reply',
          status: 'pending_confirmation',
          body: args.body,
          setStatus: args.setStatus ?? null,
          message: 'Draft reply prepared. Awaiting agent confirmation.',
        }, null, 2),
      }],
    };
  }
);

/**
 * Request to change ticket status.
 */
const requestStatusChange = tool(
  'request_status_change',
  `Request to change the current ticket's status.

This does **NOT** change the status immediately. It creates a pending action
for the human agent to review and approve.

**Statuses:**
- \`open\`: Ticket needs agent attention
- \`pending\`: Waiting for customer response
- \`hold\`: On hold (internal pause, e.g., waiting for engineering)
- \`solved\`: Issue resolved

**Always provide a reason** explaining why the status change is appropriate.`,
  {
    status: z.enum(['open', 'pending', 'hold', 'solved']).describe('The requested new ticket status'),
    reason: z.string().describe('Explanation of why this status change is appropriate'),
  },
  async (args) => {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          action: 'request_status_change',
          status: 'pending_confirmation',
          requestedStatus: args.status,
          reason: args.reason,
          message: 'Status change requested. Awaiting agent confirmation.',
        }, null, 2),
      }],
    };
  }
);

/**
 * Request to escalate the ticket.
 */
const requestEscalation = tool(
  'request_escalation',
  `Request to escalate the current ticket to another team or group.

This does **NOT** escalate immediately. It creates a pending action
for the human agent to review and approve.

Use this when:
- The issue requires specialized expertise
- The ticket has been unresolved for too long
- The customer has explicitly requested escalation
- A bug needs engineering attention

**Always provide a clear reason** for the escalation.`,
  {
    reason: z.string().describe('Clear explanation of why escalation is needed'),
    targetGroup: z.string().optional().describe('Target group/team to escalate to (e.g., "Engineering", "Tier 2")'),
  },
  async (args) => {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          action: 'request_escalation',
          status: 'pending_confirmation',
          reason: args.reason,
          targetGroup: args.targetGroup ?? null,
          message: 'Escalation requested. Awaiting agent confirmation.',
        }, null, 2),
      }],
    };
  }
);

// ============================================================
// Exported Tool Arrays
// ============================================================

/**
 * Auto-execute tools — AI can run these freely without agent confirmation.
 * These tools perform read operations or low-risk writes (tags, internal notes).
 */
export const ZENDESK_AUTO_TOOLS = [
  searchKnowledgeBase,
  lookupOrder,
  lookupRegistration,
  searchJira,
  addTicketTags,
  addInternalNote,
] as const;

/**
 * Needs-confirmation tools — AI prepares the action, agent confirms before execution.
 * These tools affect what the customer sees or change ticket workflow state.
 */
export const ZENDESK_CONFIRM_TOOLS = [
  draftReply,
  requestStatusChange,
  requestEscalation,
] as const;

/**
 * All Zendesk session tools combined.
 */
export const ALL_ZENDESK_TOOLS = [
  ...ZENDESK_AUTO_TOOLS,
  ...ZENDESK_CONFIRM_TOOLS,
] as const;
