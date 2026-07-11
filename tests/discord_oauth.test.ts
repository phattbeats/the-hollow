import { describe, expect, it } from 'vitest';
import {
  buildAuthorizeUrl,
  buildTokenRequestBody,
  discordAvatarUrl,
  discordDisplayName,
  isDiscordLinkMode,
  isDiscordSnowflake,
  isMemberOfGuild,
  parseDiscordUser,
  parseGuildIds,
  parseTokenResponse,
  pkceChallengeFromVerifier,
} from '../server/discord_oauth';

describe('pkce', () => {
  it('matches the RFC 7636 S256 test vector', () => {
    // The canonical example from RFC 7636 Appendix B.
    expect(pkceChallengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('is deterministic and url-safe (no +/=)', () => {
    const a = pkceChallengeFromVerifier('verifier-one');
    const b = pkceChallengeFromVerifier('verifier-one');
    expect(a).toBe(b);
    expect(a).not.toMatch(/[+/=]/);
  });
});

describe('buildAuthorizeUrl', () => {
  it('encodes all required OAuth params', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: '123',
        redirectUri: 'https://thehollow.world/api/auth/discord/callback',
        state: 'nonce-abc',
        codeChallenge: 'chal',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://thehollow.world/api/auth/discord/callback',
    );
    expect(url.searchParams.get('scope')).toBe('identify email guilds');
    expect(url.searchParams.get('state')).toBe('nonce-abc');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('buildTokenRequestBody', () => {
  it('produces a form body with the verifier and grant type', () => {
    const body = new URLSearchParams(
      buildTokenRequestBody({
        clientId: '123',
        clientSecret: 'sek',
        code: 'the-code',
        redirectUri: 'https://x/cb',
        codeVerifier: 'ver',
      }),
    );
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('ver');
    expect(body.get('client_secret')).toBe('sek');
  });
});

describe('response parsers', () => {
  it('parses a valid token response and rejects a bad one', () => {
    expect(
      parseTokenResponse({
        access_token: 'tok',
        token_type: 'Bearer',
        scope: 'identify',
        expires_in: 604800,
      }),
    ).toEqual({ accessToken: 'tok', tokenType: 'Bearer', scope: 'identify', expiresIn: 604800 });
    expect(parseTokenResponse({ error: 'invalid_grant' })).toBeNull();
    expect(parseTokenResponse(null)).toBeNull();
  });

  it('parses a valid user and rejects a non-snowflake id', () => {
    expect(
      parseDiscordUser({
        id: '80351110224678912',
        username: 'nelly',
        global_name: 'Nelly',
        avatar: 'abc',
      }),
    ).toEqual({
      id: '80351110224678912',
      username: 'nelly',
      globalName: 'Nelly',
      avatar: 'abc',
      email: null,
      emailVerified: false,
    });
    expect(parseDiscordUser({ id: 'not-a-snowflake', username: 'x' })).toBeNull();
    expect(parseDiscordUser({})).toBeNull();
  });

  it('captures a verified email only when the email scope granted a well-shaped address', () => {
    expect(
      parseDiscordUser({
        id: '80351110224678912',
        username: 'nelly',
        email: 'nelly@example.com',
        verified: true,
      }),
    ).toMatchObject({ email: 'nelly@example.com', emailVerified: true });
    // Discord's own `verified` flag is false: the address is captured but not trusted.
    expect(
      parseDiscordUser({
        id: '80351110224678912',
        username: 'nelly',
        email: 'nelly@example.com',
        verified: false,
      }),
    ).toMatchObject({ email: 'nelly@example.com', emailVerified: false });
    // Malformed or over-length addresses are dropped, not passed through.
    expect(
      parseDiscordUser({ id: '80351110224678912', username: 'nelly', email: 'not-an-email' }),
    ).toMatchObject({ email: null, emailVerified: false });
    expect(
      parseDiscordUser({
        id: '80351110224678912',
        username: 'nelly',
        email: `${'a'.repeat(250)}@example.com`,
      }),
    ).toMatchObject({ email: null, emailVerified: false });
  });

  it('prefers the global display name over the legacy username', () => {
    expect(discordDisplayName({ username: 'legacy', globalName: 'Display' })).toBe('Display');
    expect(discordDisplayName({ username: 'legacy', globalName: null })).toBe('legacy');
    expect(discordDisplayName({ username: '', globalName: '  ' })).toBe('Discord user');
  });

  it('builds CDN avatar urls and detects animated avatars', () => {
    expect(discordAvatarUrl('80351110224678912', 'abc')).toContain(
      '/avatars/80351110224678912/abc.png',
    );
    expect(discordAvatarUrl('80351110224678912', 'a_anim')).toContain('.gif');
    expect(discordAvatarUrl('80351110224678912', null)).toBeNull();
  });

  it('extracts guild ids and checks membership', () => {
    const ids = parseGuildIds([{ id: '111111111111111111' }, { nope: true }, { id: 'bad' }]);
    expect(ids).toEqual(['111111111111111111']);
    expect(isMemberOfGuild(ids, '111111111111111111')).toBe(true);
    expect(isMemberOfGuild(ids, '222222222222222222')).toBe(false);
    expect(parseGuildIds('not an array')).toEqual([]);
  });
});

describe('guards', () => {
  it('validates snowflakes and link modes', () => {
    expect(isDiscordSnowflake('80351110224678912')).toBe(true);
    expect(isDiscordSnowflake('123')).toBe(false);
    expect(isDiscordSnowflake(12345 as unknown)).toBe(false);
    expect(isDiscordLinkMode('login')).toBe(true);
    expect(isDiscordLinkMode('link')).toBe(true);
    expect(isDiscordLinkMode('hack')).toBe(false);
  });
});
