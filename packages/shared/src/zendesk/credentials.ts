import type { ZendeskCredentials } from './types.ts';

const CREDENTIAL_KEY = 'zendesk';

export function serializeCredentials(creds: ZendeskCredentials): string {
  return JSON.stringify(creds);
}

export function deserializeCredentials(data: string): ZendeskCredentials {
  return JSON.parse(data) as ZendeskCredentials;
}

export function getCredentialKey(): string {
  return CREDENTIAL_KEY;
}
