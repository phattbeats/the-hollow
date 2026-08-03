// The scripted cast id updateChannelHealerHold puts on a channelHeal mob
// (Spirit of Malric, the Heroic Nythraxis add) so its heal renders a real cast
// bar even though it resolves to no ABILITIES def. The channel itself breaks
// on stun/silence/lockout in Sim's per-tick channelHeal mechanic block, not
// through a player interrupt-ability effect (this fork has no Kick/Pummel/
// Counterspell-style interrupt yet; stun alone is a complete, working answer).
export const NYTHRAXIS_SPIRIT_MENDING_CAST_ID = 'nythraxis_spirit_mending';
