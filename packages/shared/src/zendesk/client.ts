import type {
  ZendeskCredentials,
  ZendeskTicket,
  ZendeskComment,
  ZendeskUser,
  ZendeskSearchResponse,
  ZendeskCommentsResponse,
  TicketUpdatePayload,
} from './types.ts';

export class ZendeskClient {
  readonly baseUrl: string;
  private readonly auth: string;
  private readonly email: string;

  constructor(private credentials: ZendeskCredentials) {
    this.baseUrl = `https://${credentials.subdomain}.zendesk.com/api/v2`;
    this.auth = btoa(`${credentials.email}/token:${credentials.apiToken}`);
    this.email = credentials.email;
  }

  getAuthHeader(): string {
    return `Basic ${this.auth}`;
  }

  buildSearchQuery(assigneeEmail: string): string {
    return `type:ticket assignee:${assigneeEmail} status<solved`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Zendesk API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async searchAssignedTickets(): Promise<ZendeskTicket[]> {
    const query = encodeURIComponent(this.buildSearchQuery(this.email));
    const data = await this.request<ZendeskSearchResponse>(
      `/search.json?query=${query}&sort_by=updated_at&sort_order=desc`
    );
    return data.results;
  }

  async getTicket(ticketId: number): Promise<ZendeskTicket> {
    const data = await this.request<{ ticket: ZendeskTicket }>(
      `/tickets/${ticketId}.json`
    );
    return data.ticket;
  }

  async getTicketComments(ticketId: number): Promise<ZendeskComment[]> {
    const data = await this.request<ZendeskCommentsResponse>(
      `/tickets/${ticketId}/comments.json`
    );
    return data.comments;
  }

  async getUser(userId: number): Promise<ZendeskUser> {
    const data = await this.request<{ user: ZendeskUser }>(
      `/users/${userId}.json`
    );
    return data.user;
  }

  async updateTicket(ticketId: number, payload: TicketUpdatePayload): Promise<ZendeskTicket> {
    const data = await this.request<{ ticket: ZendeskTicket }>(
      `/tickets/${ticketId}.json`,
      { method: 'PUT', body: JSON.stringify(payload) }
    );
    return data.ticket;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request<{ user: ZendeskUser }>('/users/me.json');
      return true;
    } catch {
      return false;
    }
  }
}
