import { describe, expect, it } from 'vitest';
import type { DiscordAccountStatus, DiscordPresenceState } from '../src/ui/discord_status';
import { buildDiscordWidgetView } from '../src/ui/discord_widget_view';

const UNLINKED: DiscordAccountStatus = {
  linked: false,
  username: null,
  avatar: null,
  guildMember: false,
  passwordSet: true,
};

const NO_PRESENCE: DiscordPresenceState = {
  onlineCount: 0,
  memberTotal: 0,
  voiceChannelName: null,
  voice: [],
};

function linked(over: Partial<DiscordAccountStatus> = {}): DiscordAccountStatus {
  return { ...UNLINKED, linked: true, username: 'maxp', guildMember: true, ...over };
}

describe('avatar + character profile link', () => {
  it('passes the Discord avatar through and builds a character profile URL when linked', () => {
    const v = buildDiscordWidgetView({
      enabled: true,
      status: linked({ avatar: 'https://cdn.discordapp.com/avatars/1/abc.png' }),
      presence: NO_PRESENCE,
      inviteUrl: 'u',
      characterName: 'Aldric',
      origin: 'https://woc',
    });
    expect(v.avatar).toBe('https://cdn.discordapp.com/avatars/1/abc.png');
    expect(v.characterName).toBe('Aldric');
    expect(v.characterUrl).toBe('https://woc/c/Aldric');
  });

  it('has no character link when unlinked or no character name', () => {
    expect(
      buildDiscordWidgetView({
        enabled: true,
        status: UNLINKED,
        presence: NO_PRESENCE,
        inviteUrl: 'u',
        characterName: 'Aldric',
      }).characterUrl,
    ).toBeNull();
    expect(
      buildDiscordWidgetView({
        enabled: true,
        status: linked(),
        presence: NO_PRESENCE,
        inviteUrl: 'u',
      }).characterUrl,
    ).toBeNull();
  });

  it('url-encodes the character name', () => {
    const v = buildDiscordWidgetView({
      enabled: true,
      status: linked(),
      presence: NO_PRESENCE,
      inviteUrl: 'u',
      characterName: 'Sir Lancelot',
      origin: 'https://woc',
    });
    expect(v.characterUrl).toBe('https://woc/c/Sir%20Lancelot');
  });
});

describe('buildDiscordWidgetView modes', () => {
  it('is disabled when the feature flag is off', () => {
    const v = buildDiscordWidgetView({
      enabled: false,
      status: linked(),
      presence: NO_PRESENCE,
      inviteUrl: 'u',
    });
    expect(v.mode).toBe('disabled');
  });

  it('is unlinked when enabled but no account link', () => {
    const v = buildDiscordWidgetView({
      enabled: true,
      status: UNLINKED,
      presence: NO_PRESENCE,
      inviteUrl: 'u',
    });
    expect(v.mode).toBe('unlinked');
  });

  it('is linked and surfaces the username when linked', () => {
    const v = buildDiscordWidgetView({
      enabled: true,
      status: linked(),
      presence: NO_PRESENCE,
      inviteUrl: 'u',
    });
    expect(v.mode).toBe('linked');
    expect(v.username).toBe('maxp');
  });
});

describe('join CTA + presence', () => {
  it('shows the join nudge only when linked and not a guild member', () => {
    expect(
      buildDiscordWidgetView({
        enabled: true,
        status: linked({ guildMember: false }),
        presence: NO_PRESENCE,
        inviteUrl: 'u',
      }).showJoinCta,
    ).toBe(true);
    expect(
      buildDiscordWidgetView({
        enabled: true,
        status: linked({ guildMember: true }),
        presence: NO_PRESENCE,
        inviteUrl: 'u',
      }).showJoinCta,
    ).toBe(false);
    expect(
      buildDiscordWidgetView({
        enabled: true,
        status: UNLINKED,
        presence: NO_PRESENCE,
        inviteUrl: 'u',
      }).showJoinCta,
    ).toBe(false);
  });

  it('passes presence + voice through and clamps a negative online count', () => {
    const presence: DiscordPresenceState = {
      onlineCount: -3,
      memberTotal: 42,
      voiceChannelName: 'The Tavern',
      voice: [{ id: '1', name: 'Aldric', speaking: true, selfMute: false }],
    };
    const v = buildDiscordWidgetView({ enabled: true, status: linked(), presence, inviteUrl: 'u' });
    expect(v.onlineCount).toBe(0);
    expect(v.voiceChannelName).toBe('The Tavern');
    expect(v.voice).toHaveLength(1);
  });
});
