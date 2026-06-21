import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  PRESET_ORDER,
  THEME_KNOB_ORDER,
  THEME_PRESETS,
  isValidHex,
  mixHex,
  parseTheme,
  resolveTheme,
  rgba,
  serializeTheme,
  themeCssVars,
} from '../src/ui/theme';

describe('theme pure core', () => {
  it('every preset defines every knob with a valid hex', () => {
    for (const id of PRESET_ORDER) {
      const knobs = THEME_PRESETS[id];
      for (const knob of THEME_KNOB_ORDER) {
        expect(isValidHex(knobs[knob]), `${id}.${knob}`).toBe(true);
      }
    }
  });

  it('classic preset reproduces the shipped gold palette', () => {
    const vars = themeCssVars(THEME_PRESETS.classic);
    expect(vars['--gold']).toBe('#ffd100');
    expect(vars['--border']).toBe('#6f5a2a');
    expect(vars['--color-text-light']).toBe('#f0ebd8');
    expect(vars['--color-hp']).toBe('#1eb838');
  });

  it('expands knobs into the full CSS variable set including derived colours', () => {
    const vars = themeCssVars(THEME_PRESETS.classic);
    // derived from accent
    expect(vars['--gold-dim']).toBe(mixHex('#ffd100', '#000000', 0.22));
    expect(vars['--color-primary-glow']).toBe(rgba('#ffd100', 0.2));
    // panel-bg is a gradient built from the panel knob
    expect(vars['--panel-bg']).toContain('linear-gradient');
    expect(vars['--panel-base']).toBe('#15151f');
    // scrollbar derives from border
    expect(vars['--scrollbar-thumb-hover']).toBe('#6f5a2a');
  });

  it('custom overrides win over the preset; absent knobs fall through', () => {
    const knobs = resolveTheme({ preset: 'midnight', custom: { accent: '#abcdef' } });
    expect(knobs.accent).toBe('#abcdef');
    expect(knobs.border).toBe(THEME_PRESETS.midnight.border);
  });

  it('ignores invalid custom hex values', () => {
    const knobs = resolveTheme({ preset: 'classic', custom: { accent: 'not-a-color' } as never });
    expect(knobs.accent).toBe(THEME_PRESETS.classic.accent);
  });

  it('mixHex and rgba are pure and correct at the endpoints', () => {
    expect(mixHex('#ffffff', '#000000', 0)).toBe('#ffffff');
    expect(mixHex('#ffffff', '#000000', 1)).toBe('#000000');
    expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(rgba('#ff8040', 0.5)).toBe('rgba(255, 128, 64, 0.5)');
  });

  it('parseTheme round-trips a serialized state and rejects junk', () => {
    const state = { preset: 'parchment' as const, custom: { rage: '#112233' } };
    expect(parseTheme(JSON.parse(serializeTheme(state)))).toEqual(state);
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme({ preset: 'bogus', custom: { accent: 'xyz' } }).preset).toBe('classic');
    expect(parseTheme({ preset: 'bogus' }).custom).toEqual({});
  });
});
