/**
 * PendingActions - Confirmation UI for AI-prepared ticket actions
 *
 * Appears below the AI conversation panel showing actions that need
 * agent confirmation before execution. Actions can include draft replies,
 * status changes, tag additions, and escalations.
 *
 * Each action can be confirmed individually, or the agent can confirm
 * or cancel all pending actions at once.
 */

import * as React from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PendingAction } from '@/types/ticket'

interface Props {
  actions: PendingAction[]
  onConfirm: (actionId: string) => void
  onConfirmAll: () => void
  onCancelAll: () => void
}

export function PendingActions({ actions, onConfirm, onConfirmAll, onCancelAll }: Props) {
  if (actions.length === 0) return null

  return (
    <div data-slot="pending-actions" className="border-t border-foreground/[0.06] p-3">
      <div className="text-xs text-muted-foreground mb-2">
        Pending Actions ({actions.length})
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between bg-foreground/[0.03] rounded-md px-3 py-2"
          >
            <div className="min-w-0 flex-1 mr-2">
              <div className="text-sm text-foreground">{action.label}</div>
              {action.description && (
                <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                  {action.description}
                </div>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onConfirm(action.id)}
              className="shrink-0 size-7 text-success"
              aria-label={`Confirm: ${action.label}`}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={onConfirmAll} className="flex-1">
          Confirm All
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancelAll}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel All
        </Button>
      </div>
    </div>
  )
}
