import { describe, it, expect } from 'bun:test';
import { ZendeskClient } from '../client.ts';

describe('ZendeskClient', () => {
  it('builds correct auth header', () => {
    const client = new ZendeskClient({
      subdomain: 'test',
      email: 'agent@test.com',
      apiToken: 'abc123',
    });
    // Base64 of "agent@test.com/token:abc123"
    expect(client.getAuthHeader()).toBe(
      'Basic ' + btoa('agent@test.com/token:abc123')
    );
  });

  it('builds correct base URL', () => {
    const client = new ZendeskClient({
      subdomain: 'mycompany',
      email: 'a@b.com',
      apiToken: 'x',
    });
    expect(client.baseUrl).toBe('https://mycompany.zendesk.com/api/v2');
  });

  it('searchAssignedTickets builds correct query', () => {
    const client = new ZendeskClient({
      subdomain: 'test',
      email: 'agent@test.com',
      apiToken: 'x',
    });
    const query = client.buildSearchQuery('agent@test.com');
    expect(query).toBe('type:ticket assignee:agent@test.com status<solved');
  });
});
