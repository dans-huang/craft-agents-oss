/**
 * ZendeskSetupPage
 *
 * Settings page for configuring Zendesk, JIRA, and n8n integrations.
 * Each section allows users to enter credentials, test the connection,
 * and save. Saved credentials are pre-filled on page load.
 *
 * The window.electronAPI calls use optional chaining for safety,
 * backed by the IPC bridge implemented in Task 14.
 */

import * as React from 'react'
import { useState, useCallback, useEffect } from 'react'
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

type TestResult = 'success' | 'error' | null

/** Small "Configured" badge shown next to section title when credentials are loaded */
function ConfiguredBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
      <Check className="h-3 w-3" />
      Configured
    </span>
  )
}

/** Inline connection status feedback */
function ConnectionStatus({ result }: { result: TestResult }) {
  if (!result) return null
  return (
    <div className="pl-1 mt-2">
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
  )
}

export default function ZendeskSetupPage() {
  // ── Zendesk state ────────────────────────────────────────────────
  const [subdomain, setSubdomain] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [zdTesting, setZdTesting] = useState(false)
  const [zdSaving, setZdSaving] = useState(false)
  const [zdResult, setZdResult] = useState<TestResult>(null)
  const [zdSaved, setZdSaved] = useState(false)
  const [zdConfigured, setZdConfigured] = useState(false)

  // ── JIRA state ───────────────────────────────────────────────────
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraApiToken, setJiraApiToken] = useState('')
  const [jiraTesting, setJiraTesting] = useState(false)
  const [jiraSaving, setJiraSaving] = useState(false)
  const [jiraResult, setJiraResult] = useState<TestResult>(null)
  const [jiraSaved, setJiraSaved] = useState(false)
  const [jiraConfigured, setJiraConfigured] = useState(false)

  // ── n8n state ────────────────────────────────────────────────────
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [n8nTesting, setN8nTesting] = useState(false)
  const [n8nSaving, setN8nSaving] = useState(false)
  const [n8nResult, setN8nResult] = useState<TestResult>(null)
  const [n8nSaved, setN8nSaved] = useState(false)
  const [n8nConfigured, setN8nConfigured] = useState(false)

  // ── Pre-fill saved credentials on mount ──────────────────────────
  useEffect(() => {
    // Zendesk
    window.electronAPI?.getZendeskCredentials?.().then((creds) => {
      if (creds) {
        setSubdomain(creds.subdomain)
        setEmail(creds.email)
        setApiToken(creds.apiToken)
        setZdConfigured(true)
      }
    })
    // JIRA
    window.electronAPI?.getZendeskJiraCredentials?.().then((creds) => {
      if (creds) {
        setJiraBaseUrl(creds.baseUrl)
        setJiraEmail(creds.email)
        setJiraApiToken(creds.apiToken)
        setJiraConfigured(true)
      }
    })
    // n8n
    window.electronAPI?.getZendeskN8nApiKey?.().then((key) => {
      if (key) {
        setN8nApiKey(key)
        setN8nConfigured(true)
      }
    })
  }, [])

  // ── Zendesk handlers ─────────────────────────────────────────────
  const canTestZd = subdomain.trim() !== '' && email.trim() !== '' && apiToken.trim() !== ''

  const handleTestZd = useCallback(async () => {
    setZdTesting(true)
    setZdResult(null)
    setZdSaved(false)
    try {
      const success = await window.electronAPI?.testZendeskConnection?.({
        subdomain: subdomain.trim(),
        email: email.trim(),
        apiToken,
      })
      setZdResult(success ? 'success' : 'error')
    } catch {
      setZdResult('error')
    }
    setZdTesting(false)
  }, [subdomain, email, apiToken])

  const handleSaveZd = useCallback(async () => {
    setZdSaving(true)
    try {
      await window.electronAPI?.saveZendeskCredentials?.({
        subdomain: subdomain.trim(),
        email: email.trim(),
        apiToken,
      })
      setZdSaved(true)
      setZdConfigured(true)
    } catch {
      // Save failed silently - user can retry
    }
    setZdSaving(false)
  }, [subdomain, email, apiToken])

  // ── JIRA handlers ────────────────────────────────────────────────
  const canTestJira = jiraBaseUrl.trim() !== '' && jiraEmail.trim() !== '' && jiraApiToken.trim() !== ''

  const handleTestJira = useCallback(async () => {
    setJiraTesting(true)
    setJiraResult(null)
    setJiraSaved(false)
    try {
      const success = await window.electronAPI?.testJiraConnection?.({
        baseUrl: jiraBaseUrl.trim(),
        email: jiraEmail.trim(),
        apiToken: jiraApiToken,
      })
      setJiraResult(success ? 'success' : 'error')
    } catch {
      setJiraResult('error')
    }
    setJiraTesting(false)
  }, [jiraBaseUrl, jiraEmail, jiraApiToken])

  const handleSaveJira = useCallback(async () => {
    setJiraSaving(true)
    try {
      await window.electronAPI?.saveZendeskJiraCredentials?.({
        baseUrl: jiraBaseUrl.trim(),
        email: jiraEmail.trim(),
        apiToken: jiraApiToken,
      })
      setJiraSaved(true)
      setJiraConfigured(true)
    } catch {
      // Save failed silently
    }
    setJiraSaving(false)
  }, [jiraBaseUrl, jiraEmail, jiraApiToken])

  // ── n8n handlers ─────────────────────────────────────────────────
  const canTestN8n = n8nApiKey.trim() !== ''

  const handleTestN8n = useCallback(async () => {
    setN8nTesting(true)
    setN8nResult(null)
    setN8nSaved(false)
    try {
      const success = await window.electronAPI?.testN8nConnection?.(n8nApiKey.trim())
      setN8nResult(success ? 'success' : 'error')
    } catch {
      setN8nResult('error')
    }
    setN8nTesting(false)
  }, [n8nApiKey])

  const handleSaveN8n = useCallback(async () => {
    setN8nSaving(true)
    try {
      await window.electronAPI?.saveZendeskN8nApiKey?.(n8nApiKey.trim())
      setN8nSaved(true)
      setN8nConfigured(true)
    } catch {
      // Save failed silently
    }
    setN8nSaving(false)
  }, [n8nApiKey])

  // ── Shared Test / Save button renderer ───────────────────────────
  function TestSaveButtons({
    testing,
    saving,
    saved,
    result,
    canTest,
    onTest,
    onSave,
  }: {
    testing: boolean
    saving: boolean
    saved: boolean
    result: TestResult
    canTest: boolean
    onTest: () => void
    onSave: () => void
  }) {
    return (
      <SettingsCardFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
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
            onClick={onSave}
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
    )
  }

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

              {/* ── Zendesk Connection ──────────────────────────── */}
              <SettingsSection
                title="Zendesk Connection"
                description="Connect your Zendesk account to start receiving tickets."
                action={zdConfigured ? <ConfiguredBadge /> : undefined}
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
                  <TestSaveButtons
                    testing={zdTesting}
                    saving={zdSaving}
                    saved={zdSaved}
                    result={zdResult}
                    canTest={canTestZd}
                    onTest={handleTestZd}
                    onSave={handleSaveZd}
                  />
                </SettingsCard>
                <ConnectionStatus result={zdResult} />
              </SettingsSection>

              {/* ── JIRA ───────────────────────────────────────── */}
              <SettingsSection
                title="JIRA"
                description="Connect JIRA for known issue lookup."
                action={jiraConfigured ? <ConfiguredBadge /> : undefined}
              >
                <SettingsCard divided>
                  <SettingsInput
                    label="Base URL"
                    description="Your Atlassian instance URL."
                    value={jiraBaseUrl}
                    onChange={setJiraBaseUrl}
                    placeholder="https://yourteam.atlassian.net"
                    type="url"
                    inCard
                  />
                  <SettingsInput
                    label="Email"
                    description="The email address of your Atlassian account."
                    value={jiraEmail}
                    onChange={setJiraEmail}
                    placeholder="you@yourcompany.com"
                    type="email"
                    inCard
                  />
                  <SettingsSecretInput
                    label="API Token"
                    description="Generate at id.atlassian.com/manage-profile/security/api-tokens."
                    value={jiraApiToken}
                    onChange={setJiraApiToken}
                    placeholder="Enter your API token..."
                    inCard
                  />
                  <TestSaveButtons
                    testing={jiraTesting}
                    saving={jiraSaving}
                    saved={jiraSaved}
                    result={jiraResult}
                    canTest={canTestJira}
                    onTest={handleTestJira}
                    onSave={handleSaveJira}
                  />
                </SettingsCard>
                <ConnectionStatus result={jiraResult} />
              </SettingsSection>

              {/* ── n8n ────────────────────────────────────────── */}
              <SettingsSection
                title="n8n"
                description="Connect n8n for KB search, order & registration lookup."
                action={n8nConfigured ? <ConfiguredBadge /> : undefined}
              >
                <SettingsCard divided>
                  <SettingsSecretInput
                    label="API Key"
                    description="Your n8n instance API key."
                    value={n8nApiKey}
                    onChange={setN8nApiKey}
                    placeholder="Enter your n8n API key..."
                    inCard
                  />
                  <TestSaveButtons
                    testing={n8nTesting}
                    saving={n8nSaving}
                    saved={n8nSaved}
                    result={n8nResult}
                    canTest={canTestN8n}
                    onTest={handleTestN8n}
                    onSave={handleSaveN8n}
                  />
                </SettingsCard>
                <ConnectionStatus result={n8nResult} />
              </SettingsSection>

            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
