// Pure view model for the Discord HUD widget.
//
// DOM-free and i18n-free: it takes the raw external state (link + presence +
// feature flag) and returns the structure the widget draws (which mode, the
// account line, the voice roster). The thin consumer (discord_widget.ts) maps
// the stable keys to t() and paints. Unit-tested in
// tests/discord_widget_view.test.ts. Mirrors src/ui/vendor_view.ts.
import type {
  DiscordAccountStatus,
  DiscordPresenceState,
  DiscordVoiceMember,
} from './discord_status';

export type DiscordWidgetMode = 'disabled' | 'unlinked' | 'linked';

export interface DiscordWidgetView {
  mode: DiscordWidgetMode;
  username: string | null;
  /** Discord profile-picture URL, or null for a default avatar. */
  avatar: string | null;
  /** The player's current character name, for the profile link (null if unknown). */
  characterName: string | null;
  /** Public profile URL for the current character (/c/<name>), or null. */
  characterUrl: string | null;
  guildMember: boolean;
  /** Linked but not in the guild -> show a "join the Discord" nudge. */
  showJoinCta: boolean;
  onlineCount: number;
  voiceChannelName: string | null;
  voice: DiscordVoiceMember[];
  inviteUrl: string;
}

export function buildDiscordWidgetView(input: {
  enabled: boolean;
  status: DiscordAccountStatus;
  presence: DiscordPresenceState;
  inviteUrl: string;
  /** Current character name (the widget links it to its public profile). */
  characterName?: string | null;
  /** Origin for building the character profile URL (defaults to '' in tests). */
  origin?: string;
}): DiscordWidgetView {
  const { enabled, status, presence, inviteUrl } = input;
  const characterName = input.characterName?.trim() || null;
  const origin = input.origin ?? '';
  const characterUrl = characterName ? `${origin}/c/${encodeURIComponent(characterName)}` : null;

  const mode: DiscordWidgetMode = !enabled ? 'disabled' : status.linked ? 'linked' : 'unlinked';

  return {
    mode,
    username: status.username,
    avatar: status.avatar,
    characterName: status.linked ? characterName : null,
    characterUrl: status.linked ? characterUrl : null,
    guildMember: status.guildMember,
    showJoinCta: status.linked && !status.guildMember,
    onlineCount: Math.max(0, presence.onlineCount),
    voiceChannelName: presence.voiceChannelName,
    voice: presence.voice,
    inviteUrl,
  };
}
