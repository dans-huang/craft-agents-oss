import type { JiraCredentials, JiraIssue } from './types.ts';

export class JiraClient {
  readonly baseUrl: string;
  private readonly auth: string;

  constructor(private credentials: JiraCredentials) {
    // Ensure baseUrl doesn't have trailing slash
    this.baseUrl = credentials.baseUrl.replace(/\/+$/, '');
    this.auth = btoa(`${credentials.email}:${credentials.apiToken}`);
  }

  getAuthHeader(): string {
    return `Basic ${this.auth}`;
  }

  /**
   * Build a JQL query for text search, optionally scoped to a project.
   */
  buildSearchJql(query: string, project?: string): string {
    const textSearch = `text ~ "${query.replace(/"/g, '\\"')}"`;
    if (project) {
      return `project = "${project}" AND ${textSearch} ORDER BY updated DESC`;
    }
    return `${textSearch} ORDER BY updated DESC`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/rest/api/3${path}`, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search JIRA issues by text query.
   * Returns up to 10 matching issues.
   */
  async search(query: string, project?: string): Promise<JiraIssue[]> {
    const jql = this.buildSearchJql(query, project);
    const data = await this.request<{
      issues: Array<{
        key: string;
        fields: {
          summary: string;
          status: { name: string };
          priority: { name: string } | null;
          assignee: { displayName: string } | null;
          created: string;
          updated: string;
          issuetype: { name: string };
        };
      }>;
    }>(`/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,priority,assignee,created,updated,issuetype`);

    return data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name ?? null,
      assignee: issue.fields.assignee?.displayName ?? null,
      created: issue.fields.created,
      updated: issue.fields.updated,
      issueType: issue.fields.issuetype.name,
      url: `${this.baseUrl}/browse/${issue.key}`,
    }));
  }

  /**
   * Test the JIRA connection by fetching the current user.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request<{ displayName: string }>('/myself');
      return true;
    } catch {
      return false;
    }
  }
}
