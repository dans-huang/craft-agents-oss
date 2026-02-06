import { describe, it, expect } from 'bun:test';
import { JiraClient } from '../jira-client.ts';

describe('JiraClient', () => {
  const creds = {
    baseUrl: 'https://mycompany.atlassian.net',
    email: 'dev@test.com',
    apiToken: 'jira-token-123',
  };

  it('builds correct auth header (Basic base64 of email:apiToken)', () => {
    const client = new JiraClient(creds);
    expect(client.getAuthHeader()).toBe(
      'Basic ' + btoa('dev@test.com:jira-token-123')
    );
  });

  it('strips trailing slash from baseUrl', () => {
    const client = new JiraClient({
      ...creds,
      baseUrl: 'https://mycompany.atlassian.net/',
    });
    expect(client.baseUrl).toBe('https://mycompany.atlassian.net');
  });

  it('strips multiple trailing slashes from baseUrl', () => {
    const client = new JiraClient({
      ...creds,
      baseUrl: 'https://mycompany.atlassian.net///',
    });
    expect(client.baseUrl).toBe('https://mycompany.atlassian.net');
  });

  describe('buildSearchJql', () => {
    it('builds text search JQL without project', () => {
      const client = new JiraClient(creds);
      const jql = client.buildSearchJql('Spark 40 power issue');
      expect(jql).toBe('text ~ "Spark 40 power issue" ORDER BY updated DESC');
    });

    it('builds text search JQL with project filter', () => {
      const client = new JiraClient(creds);
      const jql = client.buildSearchJql('audio crackling', 'STFS');
      expect(jql).toBe('project = "STFS" AND text ~ "audio crackling" ORDER BY updated DESC');
    });

    it('escapes double quotes in query', () => {
      const client = new JiraClient(creds);
      const jql = client.buildSearchJql('error "invalid token"');
      expect(jql).toBe('text ~ "error \\"invalid token\\"" ORDER BY updated DESC');
    });
  });
});
