// PHAA-435: the hub ambient music cycler's track list + pure selection logic.
// Empty until Brandon drops real ambient mixes under public/audio/hub_ambient/;
// MusicDirector (music.ts) treats an empty list as "no override" and keeps the
// existing biome fallback, so the hub is never silent. Once populated here,
// nothing else needs to change: MusicDirector starts cycling automatically.
export interface HubAmbientTrack {
  id: string;
  src: string;
}

// Brandon's ambient beds for the Hollow Reaches hub (PHAA-435), transcoded from
// his 48 kHz stereo WAV masters to MP3. ids trace back to the source filenames on
// Nextcloud (/PHATT-STUDIO/the-hollow/music) so the mapping stays obvious; rename
// or prune any line freely, the cycler just rotates whatever is listed here.
export const HUB_AMBIENT_TRACKS: HubAmbientTrack[] = [
  { id: 'ambient-1-world', src: '/audio/hub_ambient/ambient-1-world.mp3' },
  { id: 'ambient-2-world', src: '/audio/hub_ambient/ambient-2-world.mp3' },
  { id: 'ambient-3-world', src: '/audio/hub_ambient/ambient-3-world.mp3' },
  { id: 'ambient-4-world', src: '/audio/hub_ambient/ambient-4-world.mp3' },
  { id: 'ambient-5-world', src: '/audio/hub_ambient/ambient-5-world.mp3' },
  { id: 'ambient-6-world', src: '/audio/hub_ambient/ambient-6-world.mp3' },
  { id: 'ambient-7-world', src: '/audio/hub_ambient/ambient-7-world.mp3' },
  { id: 'the-hollow-ambient-1', src: '/audio/hub_ambient/the-hollow-ambient-1.mp3' },
];

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
