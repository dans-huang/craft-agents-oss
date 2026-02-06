import { describe, it, expect } from 'bun:test';
import { serializeCredentials, deserializeCredentials } from '../credentials.ts';

describe('ZendeskCredentials', () => {
  it('round-trips credentials', () => {
    const creds = {
      subdomain: 'positivegrid',
      email: 'agent@positivegrid.com',
      apiToken: 'secret123',
    };
    const serialized = serializeCredentials(creds);
    const deserialized = deserializeCredentials(serialized);
    expect(deserialized).toEqual(creds);
  });

  it('serializes to valid JSON string', () => {
    const creds = {
      subdomain: 'test',
      email: 'user@test.com',
      apiToken: 'token456',
    };
    const serialized = serializeCredentials(creds);
    expect(typeof serialized).toBe('string');
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('deserializes preserves all fields', () => {
    const json = JSON.stringify({
      subdomain: 'mycompany',
      email: 'admin@mycompany.com',
      apiToken: 'abc-def-ghi',
    });
    const result = deserializeCredentials(json);
    expect(result.subdomain).toBe('mycompany');
    expect(result.email).toBe('admin@mycompany.com');
    expect(result.apiToken).toBe('abc-def-ghi');
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializeCredentials('not-json')).toThrow();
  });
});
