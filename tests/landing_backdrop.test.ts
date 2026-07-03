import { describe, expect, it } from 'vitest';
import {
  type BackdropSignals,
  pickLandingBackgroundVariant,
  shouldUseStaticBackdrop,
} from '../src/game/landing_backdrop';

const NONE: BackdropSignals = {
  phone: false,
  saveData: false,
  reducedMotion: false,
  highContrast: false,
};

describe('shouldUseStaticBackdrop', () => {
  it('plays the trailer (not static) for a desktop user with no preferences', () => {
    expect(shouldUseStaticBackdrop(NONE)).toBe(false);
  });

  it('forces the static poster on phones (battery/data/decode cost)', () => {
    expect(shouldUseStaticBackdrop({ ...NONE, phone: true })).toBe(true);
  });

  it('honors the Save-Data hint', () => {
    expect(shouldUseStaticBackdrop({ ...NONE, saveData: true })).toBe(true);
  });

  it('honors prefers-reduced-motion', () => {
    expect(shouldUseStaticBackdrop({ ...NONE, reducedMotion: true })).toBe(true);
  });

  it('honors the explicit high-contrast setting on desktop', () => {
    expect(shouldUseStaticBackdrop({ ...NONE, highContrast: true })).toBe(true);
  });

  it('stays static when several reasons stack', () => {
    expect(
      shouldUseStaticBackdrop({
        phone: true,
        saveData: true,
        reducedMotion: false,
        highContrast: true,
      }),
    ).toBe(true);
  });
});

describe('pickLandingBackgroundVariant', () => {
  it('defaults to the video when there is no bg param', () => {
    expect(pickLandingBackgroundVariant('')).toBe('video');
  });

  it('defaults to the video for an unrecognized value', () => {
    expect(pickLandingBackgroundVariant('?bg=nonsense')).toBe('video');
  });

  it('picks each known candidate', () => {
    expect(pickLandingBackgroundVariant('?bg=spore-drift')).toBe('spore-drift');
    expect(pickLandingBackgroundVariant('?bg=root-pulse')).toBe('root-pulse');
    expect(pickLandingBackgroundVariant('?bg=canopy-sway')).toBe('canopy-sway');
  });

  it('reads bg alongside other query params', () => {
    expect(pickLandingBackgroundVariant('?realm=test&bg=root-pulse')).toBe('root-pulse');
  });
});
