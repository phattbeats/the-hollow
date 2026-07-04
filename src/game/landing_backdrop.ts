// Pure decision for the landing-page ambient backdrop. Kept DOM-free so it can
// be unit-tested and reused by main.ts: given the device/preference signals it
// answers ONE question: should we drop the animated spore field and keep the
// backdrop a clean, static dark wash instead?
//
// Static-only wins when ANY of these hold, because each is a reason the drifting
// spore motion is unwelcome:
//   - phone: small touch device (battery + compositing cost).
//   - saveData: the user asked their browser to conserve data (Save-Data hint).
//   - reducedMotion: prefers-reduced-motion, so drifting motes are a motion trigger.
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
