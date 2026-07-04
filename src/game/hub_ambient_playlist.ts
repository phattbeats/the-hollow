// PHAA-435: the hub ambient music cycler's track list + pure selection logic.
// Empty until Brandon drops real ambient mixes under public/audio/hub_ambient/;
// MusicDirector (music.ts) treats an empty list as "no override" and keeps the
// existing biome fallback, so the hub is never silent. Once populated here,
// nothing else needs to change: MusicDirector starts cycling automatically.
export interface HubAmbientTrack {
  id: string;
  src: string;
}

// Populate with entries like { id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' }
// once the files land (see PHAA-435 for the drop location).
export const HUB_AMBIENT_TRACKS: HubAmbientTrack[] = [];

/** Picks the next track to cycle to, avoiding an immediate repeat when more
 *  than one track is available. Pure and host-agnostic so it is unit-tested
 *  without an AudioContext. */
export function pickNextHubAmbientTrack(
  tracks: readonly HubAmbientTrack[],
  currentId: string | null,
  rng: () => number = Math.random,
): HubAmbientTrack | null {
  if (tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];
  const candidates = tracks.filter((t) => t.id !== currentId);
  const pool = candidates.length > 0 ? candidates : tracks;
  return pool[Math.floor(rng() * pool.length)];
}

/** True once a playing track is close enough to its end that the next one
 *  should start crossfading in. */
export function shouldStartHubAmbientCrossfade(
  currentTimeSeconds: number,
  durationSeconds: number,
  crossfadeSeconds: number,
): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  return durationSeconds - currentTimeSeconds <= crossfadeSeconds;
}
