/**
 * ZendeskSetupPage
 *
 * Settings page for connecting a Zendesk account.
 * Users enter their subdomain, email, and API token,
 * test the connection, then save credentials.
 *
 * The window.electronAPI calls use optional chaining for safety,
 * backed by the IPC bridge implemented in Task 14.
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { routes } from '@/lib/navigate'
import {
  SettingsSection,
  SettingsCard,
  SettingsCardFooter,
  SettingsInput,
  SettingsSecretInput,
} from '@/components/settings'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'zendesk',
}

export default function ZendeskSetupPage() {
  const [subdomain, setSubdomain] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [saved, setSaved] = useState(false)

  const canTest = subdomain.trim() !== '' && email.trim() !== '' && apiToken.trim() !== ''

  const handleTest = useCallback(async () => {
    setTesting(true)
    setResult(null)
    setSaved(false)
    try {
      const success = await window.electronAPI?.testZendeskConnection?.({
        subdomain: subdomain.trim(),
        email: email.trim(),
        apiToken,
      })
      setResult(success ? 'success' : 'error')
    } catch {
      setResult('error')
    }
    setTesting(false)
  }, [subdomain, email, apiToken])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.electronAPI?.saveZendeskCredentials?.({
        subdomain: subdomain.trim(),
        email: email.trim(),
        apiToken,
      })
      setSaved(true)
    } catch {
      // Save failed silently - user can retry
    }
    setSaving(false)
  }, [subdomain, email, apiToken])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="Zendesk"
        actions={<HeaderMenu route={routes.view.settings('zendesk')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <div className="space-y-8">
              {/* Connection */}
              <SettingsSection
                title="Zendesk Connection"
                description="Connect your Zendesk account to start receiving tickets."
              >
                <SettingsCard divided>
                  <SettingsInput
                    label="Subdomain"
                    description="Your Zendesk subdomain (e.g. yourcompany.zendesk.com)."
                    value={subdomain}
                    onChange={setSubdomain}
                    placeholder="yourcompany"
                    inCard
                    action={
                      <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                        .zendesk.com
                      </span>
                    }
                  />
                  <SettingsInput
                    label="Email"
                    description="The email address of your Zendesk agent account."
                    value={email}
                    onChange={setEmail}
                    placeholder="agent@yourcompany.com"
                    type="email"
                    inCard
                  />
                  <SettingsSecretInput
                    label="API Token"
                    description="Found in Admin > Channels > API in your Zendesk dashboard."
                    value={apiToken}
                    onChange={setApiToken}
                    placeholder="Enter your API token..."
                    inCard
                  />
                  <SettingsCardFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTest}
                      disabled={testing || !canTest}
                    >
                      {testing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                    {result === 'success' && (
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || saved}
                      >
                        {saved ? (
                          <>
                            <Check className="h-4 w-4 mr-1.5" />
                            Saved
                          </>
                        ) : saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                    )}
                  </SettingsCardFooter>
                </SettingsCard>
              </SettingsSection>

              {/* Connection status */}
              {result && (
                <div className="pl-1">
                  {result === 'success' ? (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>Connected successfully</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Connection failed. Check your credentials and try again.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
