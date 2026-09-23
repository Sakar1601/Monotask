import { describe, expect, it } from 'vitest';
import { providerHttpError } from '../../supabase/functions/_shared/integrations/providerErrors.ts';

describe('providerHttpError', () => {
  it('keeps status context without including provider response bodies', () => {
    const error = providerHttpError('Google', 'calendar fetch', new Response(
      JSON.stringify({ access_token: 'secret-token', message: 'private event title' }),
      { status: 403 },
    ));

    expect(error.message).toBe('Google calendar fetch failed: HTTP 403');
    expect(error.message).not.toContain('secret-token');
    expect(error.message).not.toContain('private event title');
  });
});
