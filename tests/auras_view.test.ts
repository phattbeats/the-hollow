// P12b auras core (auras_view): the debuff allowlist classification, same-input ->
// same-output determinism, the ClientWorld-vs-Sim parity assertion (decision 15: the
// online wire omits stacks when 1), and the reused-buffer allocation budget (the P12a
// proxy). The DOM half (the keyed pool, the mutable-slot tooltip) is in
// tests/auras_painter.test.ts.

import { describe, expect, it } from 'vitest';
import {
  type AuraInput,
  type AuraMode,
  type AurasDeps,
  type AurasEntityInput,
  createAurasView,
  DEBUFF_AURA_KINDS,
  isAuraDebuff,
} from '../src/ui/auras_view';
import { assertAllocationStable } from './util/alloc_probe';

// Deterministic deps: the icon id mirrors the host (ability id, else `aura_<kind>`),
// the name echoes the source name, the stack formatter is a plain String() (the real
// host wraps formatNumber). No randomness/time, so same input -> same output.
function deps(): AurasDeps {
  return {
    iconId: (a) => (a.id.startsWith('aura_') ? `aura_${a.kind}` : a.id),
    auraName: (a) => `name:${a.name}`,
    formatStacks: (n) => String(n),
  };
}

function aura(over: Partial<AuraInput> & { id: string }): AuraInput {
  return {
    name: over.id,
    kind: 'buff_ap',
    remaining: 10,
    value: 1,
    ...over,
  };
}

function entity(auras: AuraInput[]): AurasEntityInput {
  return { auras };
}

describe('isAuraDebuff: the allowlist classification (lifted into the core)', () => {
  it('classifies every allowlisted debuff kind as a debuff', () => {
    for (const kind of DEBUFF_AURA_KINDS) {
      expect(isAuraDebuff(aura({ id: 'x', kind }))).toBe(true);
    }
  });

  it('classifies a plain buff as not a debuff, but a NEGATIVE-value buff_* as a debuff', () => {
    expect(isAuraDebuff(aura({ id: 'x', kind: 'buff_ap', value: 50 }))).toBe(false);
    expect(isAuraDebuff(aura({ id: 'x', kind: 'buff_armor', value: 100 }))).toBe(false);
    // A buff_* kind whose value saps (a stat-draining curse) reads as a debuff.
    expect(isAuraDebuff(aura({ id: 'x', kind: 'buff_ap', value: -50 }))).toBe(true);
    expect(isAuraDebuff(aura({ id: 'x', kind: 'buff_int', value: -20 }))).toBe(true);
  });

  it('matches the exact set of kinds the old inline allowlist named', () => {
    expect([...DEBUFF_AURA_KINDS].sort()).toEqual(
      [
        'attackspeed',
        'blind',
        'cost_tax',
        'critvuln',
        'debuff_ap',
        'disarm',
        'dot',
        'expose',
        'heal_absorb',
        'hex',
        'incapacitate',
        'lockout',
        'mortal_wound',
        'polymorph',
        'root',
        'silence',
        'slow',
        'spellvuln',
        'stun',
        'sunder',
        'tongues',
        'vulnerability',
      ].sort(),
    );
  });
});

describe('createAurasView: derivation per mode', () => {
  it("mode 'all' keeps every aura; mode 'debuffs' keeps only debuffs", () => {
    const auras = [
      aura({ id: 'might', kind: 'buff_ap', value: 50 }),
      aura({ id: 'rend', kind: 'dot', value: 5 }),
      aura({ id: 'sunder', kind: 'sunder', value: 0, stacks: 3 }),
    ];
    const all = createAurasView('all', deps()).tick(entity(auras));
    expect(all.count).toBe(3);

    const debuffs = createAurasView('debuffs', deps()).tick(entity(auras));
    expect(debuffs.count).toBe(2);
    expect(debuffs.slots.slice(0, 2).map((s) => s.key)).toEqual(['rend', 'sunder']);
  });

  it('derives icon key, debuff flag, duration text, stacks text, name, and remaining', () => {
    const state = createAurasView('all', deps()).tick(
      entity([
        aura({ id: 'rend', name: 'Rend', kind: 'dot', remaining: 4.2, value: 5, stacks: 5 }),
      ]),
    );
    const s = state.slots[0];
    expect(s.key).toBe('rend');
    expect(s.iconKey).toBe('rend');
    expect(s.isDebuff).toBe(true);
    expect(s.durationText).toBe('5s'); // ceil(4.2) = 5
    expect(s.stacksText).toBe('5');
    expect(s.name).toBe('name:Rend');
    expect(s.remaining).toBe(4.2);
  });

  it('hides the duration label at/above the permanent threshold (>= 99s)', () => {
    const v = createAurasView('all', deps());
    expect(v.tick(entity([aura({ id: 'a', remaining: 98 })])).slots[0].durationText).toBe('98s');
    expect(v.tick(entity([aura({ id: 'a', remaining: 99 })])).slots[0].durationText).toBe('');
    expect(v.tick(entity([aura({ id: 'a', remaining: 9999 })])).slots[0].durationText).toBe('');
  });

  it('shows a stacks label only when stacks > 1', () => {
    const v = createAurasView('all', deps());
    expect(v.tick(entity([aura({ id: 'a', stacks: undefined })])).slots[0].stacksText).toBe('');
    expect(v.tick(entity([aura({ id: 'a', stacks: 1 })])).slots[0].stacksText).toBe('');
    expect(v.tick(entity([aura({ id: 'a', stacks: 4 })])).slots[0].stacksText).toBe('4');
  });

  it('is deterministic: identical inputs produce deep-equal slot state', () => {
    const build = () => {
      const state = createAurasView('all', deps()).tick(
        entity([aura({ id: 'might', value: 50 }), aura({ id: 'rend', kind: 'dot', value: 5 })]),
      );
      // Snapshot the PRIMITIVE fields (the slots are reused objects, so deep-compare
      // values, never the slot references).
      return state.slots.slice(0, state.count).map((s) => ({ ...s }));
    };
    expect(build()).toEqual(build());
  });
});

describe('decision 15: Sim-shaped and ClientWorld-mirror-shaped auras derive identically', () => {
  it('a Sim aura {stacks:1} and a ClientWorld-mirror aura {stacks:undefined} yield the same slot', () => {
    // The wire omits stacks when 1 (server_i18n: WireAura.stacks sent only > 1), so the
    // online mirror presents stacks:undefined where the Sim presents stacks:1. Both must
    // render no stacks badge and otherwise identical state.
    const simShaped = aura({
      id: 'rend',
      name: 'Rend',
      kind: 'dot',
      remaining: 6,
      value: 5,
      stacks: 1,
    });
    const clientShaped = aura({ id: 'rend', name: 'Rend', kind: 'dot', remaining: 6, value: 5 });
    const fromSim = createAurasView('all', deps()).tick(entity([simShaped])).slots[0];
    const fromClient = createAurasView('all', deps()).tick(entity([clientShaped])).slots[0];
    expect({ ...fromClient }).toEqual({ ...fromSim });
    expect(fromSim.stacksText).toBe('');
  });

  it('value-based debuff classification is OFFLINE-ONLY: the wire zeroes aura.value (pre-existing, byte-faithful)', () => {
    // A negative-value buff_* aura (a mob stat-sap, e.g. enfeeble on buff_int or
    // Withering Wail on buff_ap) reads as a debuff via the value < 0 branch. The Sim
    // presents the real negative value; the ClientWorld mirror decodes value:0 (the
    // server omits it, online.ts zeroes it). So isDebuff DIVERGES across the wire. This
    // is PRE-EXISTING (the old inline renderAuras used the identical classification) and
    // a wire-fidelity gap, NOT a P12b change; the test MODELS the mirror honestly (cf.
    // P11b modeling absorb as offline-only) instead of giving false confidence by
    // varying only a parity-safe field.
    const simSap = aura({
      id: 'enfeeble',
      name: 'Enfeeble',
      kind: 'buff_int',
      remaining: 8,
      value: -30,
    });
    const clientSap = aura({
      id: 'enfeeble',
      name: 'Enfeeble',
      kind: 'buff_int',
      remaining: 8,
      value: 0,
    });
    expect(isAuraDebuff(simSap)).toBe(true); // offline: debuff border
    expect(isAuraDebuff(clientSap)).toBe(false); // online: value zeroed by the wire
    // Allowlisted kinds do NOT depend on value, so they stay a debuff under BOTH shapes
    // (the parity-safe path the rest of the strip relies on).
    expect(isAuraDebuff(aura({ id: 'rip', kind: 'dot', value: 0 }))).toBe(true);
    expect(isAuraDebuff(aura({ id: 'sap', kind: 'debuff_ap', value: 0 }))).toBe(true);
  });
});

describe('allocation budget (the P12a reused-reference proxy)', () => {
  const drive = (mode: AuraMode) => {
    const view = createAurasView(mode, deps());
    // Vary the aura data each call (remaining ticks down, stacks change) so the probe
    // proves the reused slots are mutated in place, not reallocated.
    let frame = 0;
    return () => {
      frame += 1;
      return view.tick(
        entity([
          aura({ id: 'might', value: 50, remaining: 30 - frame * 0.1 }),
          aura({ id: 'rend', kind: 'dot', value: 5, remaining: 12 - frame * 0.05, stacks: frame }),
        ]),
      );
    };
  };

  it("the 'all' view reuses its container AND its slot array across frames", () => {
    const tick = drive('all');
    expect(() => assertAllocationStable(tick)).not.toThrow();
    expect(() => assertAllocationStable(() => tick().slots)).not.toThrow();
  });

  it("the 'debuffs' view reuses its container AND its slot array across frames", () => {
    const tick = drive('debuffs');
    expect(() => assertAllocationStable(tick)).not.toThrow();
    expect(() => assertAllocationStable(() => tick().slots)).not.toThrow();
  });
});
