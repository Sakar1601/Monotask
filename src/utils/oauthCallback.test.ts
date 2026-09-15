import { describe, expect, it } from 'vitest';
import {
  isStateOwner,
  oauthRedirectUriFor,
} from '../../supabase/functions/integration-oauth-callback/oauthCallbackSecurity.ts';

describe('oauthRedirectUriFor', () => {
  it('uses an app-origin callback so OAuth completion carries the current Monotask session', () => {
    expect(oauthRedirectUriFor({
      appOrigin: 'https://app.example.com/',
      oauthCallbackUrl: undefined,
      supabaseUrl: 'https://project.supabase.co',
    })).toBe('https://app.example.com/oauth/callback');
  });

  it('allows an explicit registered callback override', () => {
    expect(oauthRedirectUriFor({
      appOrigin: 'https://app.example.com',
      oauthCallbackUrl: 'https://custom.example.com/oauth/finish',
      supabaseUrl: 'https://project.supabase.co',
    })).toBe('https://custom.example.com/oauth/finish');
  });
});

describe('isStateOwner', () => {
  it('rejects a consumed OAuth state owned by a different Monotask user', () => {
    expect(isStateOwner({ stateUserId: 'attacker-user', authenticatedUserId: 'victim-user' })).toBe(false);
  });

  it('accepts a consumed OAuth state owned by the authenticated Monotask user', () => {
    expect(isStateOwner({ stateUserId: 'same-user', authenticatedUserId: 'same-user' })).toBe(true);
  });
});
