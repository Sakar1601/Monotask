import { describe, expect, it } from 'vitest';
import { authorizeScheduledRequest } from '../../supabase/functions/_shared/scheduledRequestAuth.ts';

describe('authorizeScheduledRequest', () => {
  const secret = 'server-only-scheduler-secret';

  it('rejects a request with no scheduler credential', () => {
    const request = new Request('https://example.test/functions/v1/scan-messages', {
      method: 'POST',
    });

    const response = authorizeScheduledRequest(request, secret);

    expect(response?.status).toBe(401);
  });

  it('fails closed when the server scheduler credential is not configured', () => {
    const request = new Request('https://example.test/functions/v1/scan-messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer anything' },
    });

    const response = authorizeScheduledRequest(request, undefined);

    expect(response?.status).toBe(500);
  });

  it('rejects a request with the wrong scheduler credential', () => {
    const request = new Request('https://example.test/functions/v1/scan-messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer attacker-controlled-value' },
    });

    const response = authorizeScheduledRequest(request, secret);

    expect(response?.status).toBe(401);
  });

  it('rejects an authenticated request using an unsupported method', () => {
    const request = new Request('https://example.test/functions/v1/scan-messages', {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    });

    const response = authorizeScheduledRequest(request, secret);

    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('POST, OPTIONS');
  });

  it('allows a POST carrying the exact scheduler credential', () => {
    const request = new Request('https://example.test/functions/v1/scan-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    });

    expect(authorizeScheduledRequest(request, secret)).toBeNull();
  });
});
