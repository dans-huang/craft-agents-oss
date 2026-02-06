/**
 * ConversationThread - Scrollable list of Zendesk ticket comments
 *
 * Renders the full conversation history for the active ticket.
 * Public replies and internal notes are visually distinguished:
 * - Public replies use a subtle foreground background
 * - Internal notes use a warm-tinted background with a border
 */

import * as React from 'react'
import type { ZendeskComment } from '@craft-agent/shared/zendesk'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  comments: ZendeskComment[]
}

export function ConversationThread({ comments }: Props) {
  return (
    <ScrollArea className="flex-1">
      <div data-slot="conversation-thread" className="space-y-3 p-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={
              comment.public
                ? 'rounded-md p-3 text-sm bg-foreground/[0.03]'
                : 'rounded-md p-3 text-sm bg-yellow-900/20 border border-yellow-800/30'
            }
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">
                {comment.public ? 'Public' : 'Internal Note'}
              </span>
              <span className="text-xs text-muted-foreground/60">
                {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-foreground whitespace-pre-wrap">{comment.body}</div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No comments yet
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
