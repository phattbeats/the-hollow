import { describe, expect, it } from 'vitest';
import {
  type HubAmbientTrack,
  pickNextHubAmbientTrack,
  shouldStartHubAmbientCrossfade,
} from '../src/game/hub_ambient_playlist';

const tracks: HubAmbientTrack[] = [
  { id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' },
  { id: 'dusk', src: '/audio/hub_ambient/dusk.mp3' },
  { id: 'rain', src: '/audio/hub_ambient/rain.mp3' },
];

describe('pickNextHubAmbientTrack', () => {
  it('returns null for an empty list', () => {
    expect(pickNextHubAmbientTrack([], null)).toBeNull();
  });

  it('returns the only track when the list has exactly one', () => {
    const only = [tracks[0]];
    expect(pickNextHubAmbientTrack(only, null)).toBe(only[0]);
    expect(pickNextHubAmbientTrack(only, only[0].id)).toBe(only[0]);
  });

  it('never repeats the current track when an alternative exists', () => {
    for (let i = 0; i < 50; i++) {
      const rng = () => i / 50;
      const next = pickNextHubAmbientTrack(tracks, 'dawn', rng);
      expect(next).not.toBeNull();
      expect(next?.id).not.toBe('dawn');
    }
  });

  it('picks from the full list when currentId matches nothing (first play)', () => {
    const next = pickNextHubAmbientTrack(tracks, null, () => 0);
    expect(next).toBe(tracks[0]);
  });
});

describe('shouldStartHubAmbientCrossfade', () => {
  it('is false while far from the end', () => {
    expect(shouldStartHubAmbientCrossfade(0, 120, 2.5)).toBe(false);
  });

  it('is true once within the crossfade window', () => {
    expect(shouldStartHubAmbientCrossfade(118, 120, 2.5)).toBe(true);
    expect(shouldStartHubAmbientCrossfade(119.9, 120, 2.5)).toBe(true);
  });

  it('is false when duration is not yet known (NaN/Infinity/0)', () => {
    expect(shouldStartHubAmbientCrossfade(0, NaN, 2.5)).toBe(false);
    expect(shouldStartHubAmbientCrossfade(0, Infinity, 2.5)).toBe(false);
    expect(shouldStartHubAmbientCrossfade(0, 0, 2.5)).toBe(false);
  });
});
