/**
 * TicketChatPanel — Lightweight ChatDisplay wrapper for Zendesk ticket sessions
 *
 * Renders the AI conversation for a ticket. Minimal compared to ChatPage:
 * - No session menu, rename, share, flag
 * - No sources, skills, labels, working directory
 * - Just chat messages + input
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { ChatDisplay } from '@/components/app-shell/ChatDisplay'
import { sessionAtomFamily, ensureSessionMessagesLoadedAtom, loadedSessionsAtom } from '@/atoms/sessions'

export interface TicketChatPanelProps {
  sessionId: string
  ticketId: number
}

export const TicketChatPanel = React.memo(function TicketChatPanel({
  sessionId,
  ticketId,
}: TicketChatPanelProps) {
  const session = useAtomValue(sessionAtomFamily(sessionId))
  const loadedSessions = useAtomValue(loadedSessionsAtom)
  const ensureLoaded = useSetAtom(ensureSessionMessagesLoadedAtom)
  const messagesLoaded = loadedSessions.has(sessionId)

  // Lazy-load messages when session is first displayed
  React.useEffect(() => {
    if (!messagesLoaded && sessionId) {
      ensureLoaded(sessionId)
    }
  }, [sessionId, messagesLoaded, ensureLoaded])

  const handleSendMessage = React.useCallback(
    (message: string) => {
      if (session) {
        window.electronAPI.sendMessage(session.id, message)
      }
    },
    [session],
  )

  const handleOpenFile = React.useCallback((path: string) => {
    window.electronAPI.openFile(path)
  }, [])

  const handleOpenUrl = React.useCallback((url: string) => {
    window.electronAPI.openUrl(url)
  }, [])

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading session...
      </div>
    )
  }

  return (
    <ChatDisplay
      session={session}
      onSendMessage={handleSendMessage}
      onOpenFile={handleOpenFile}
      onOpenUrl={handleOpenUrl}
      currentModel={session.model || 'sonnet'}
      onModelChange={() => {}}
      messagesLoading={!messagesLoaded}
    />
  )
})
