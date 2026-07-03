// Pure decision for the landing-page cinematic backdrop. Kept DOM-free so it can
// be unit-tested and reused by main.ts: given the device/preference signals it
// answers ONE question — should we show the static poster instead of fetching &
// playing the looping trailer video?
//
// Static-only wins when ANY of these hold, because each is a reason a moving
// 5.7 MB video is unwelcome:
//   - phone: small touch device — battery + cellular data + decode cost.
//   - saveData: the user asked their browser to conserve data (Save-Data hint).
//   - reducedMotion: prefers-reduced-motion — drifting video is a motion trigger.
//   - highContrast: the explicit landingHighContrast setting (legibility choice).

export interface BackdropSignals {
  phone: boolean;
  saveData: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export function shouldUseStaticBackdrop(s: BackdropSignals): boolean {
  return s.phone || s.saveData || s.reducedMotion || s.highContrast;
}

// Candidate login-screen backdrops (PHAA-406): the board flagged the licensed
// trailer video (public/home-bg.mp4, undocumented provenance) as unwanted
// regardless of license. These are original, license-free replacements to
// preview side by side before one is picked. 'video' is the unchanged default.
export type LandingBackgroundVariant = 'video' | 'spore-drift' | 'root-pulse' | 'canopy-sway';

const BACKGROUND_VARIANTS: readonly LandingBackgroundVariant[] = [
  'video',
  'spore-drift',
  'root-pulse',
  'canopy-sway',
];

// Reads ?bg=<variant> so each candidate can be compared live in a browser
// without deciding the pick in code. Unset or unrecognized falls back to
// 'video', so normal play is unaffected.
export function pickLandingBackgroundVariant(search: string): LandingBackgroundVariant {
  const raw = new URLSearchParams(search).get('bg') ?? '';
  return (BACKGROUND_VARIANTS as readonly string[]).includes(raw)
    ? (raw as LandingBackgroundVariant)
    : 'video';
}
