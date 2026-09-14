// src/utils/tokenRefresh.test.ts
import { describe, expect, it, vi } from 'vitest';
import '../types/deno';

const { refreshTokenMock } = vi.hoisted(() => ({
  refreshTokenMock: vi.fn().mockResolvedValue({
    accessToken: 'new-token',
    refreshToken: '',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    scope: 'https://www.googleapis.com/auth/calendar',
  }),
}));

vi.mock('../../supabase/functions/_shared/integrations/registry.ts', () => ({
  providers: {
    google: { refreshToken: refreshTokenMock },
  },
}));

import { ensureFreshToken } from '../../supabase/functions/_shared/integrations/tokenRefresh.ts';

describe('ensureFreshToken', () => {
  it('returns the existing access token unchanged when it is not close to expiring', async () => {
    const updateMock = vi.fn();
    const adminClient = {
      from: () => ({ update: updateMock, eq: () => ({}) }),
    } as unknown as Parameters<typeof ensureFreshToken>[0];

    const connection = {
      id: 'conn-1',
      provider: 'google' as const,
      access_token: 'still-valid-token',
      refresh_token: 'refresh-1',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const token = await ensureFreshToken(adminClient, connection);

    expect(token).toBe('still-valid-token');
    expect(updateMock).not.toHaveBeenCalled();
    expect(refreshTokenMock).not.toHaveBeenCalled();
  });

  it('refreshes and persists a new token when the current one is expired', async () => {
    const eqMock = vi.fn();
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const adminClient = {
      from: () => ({ update: updateMock }),
    } as unknown as Parameters<typeof ensureFreshToken>[0];

    const connection = {
      id: 'conn-1',
      provider: 'google' as const,
      access_token: 'expired-token',
      refresh_token: 'refresh-1',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    };

    const token = await ensureFreshToken(adminClient, connection);

    expect(token).toBe('new-token');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'new-token' }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'conn-1');
  });
});
