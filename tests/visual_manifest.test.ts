import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { chibiSkinCount } from '../src/render/characters/chibi_skin_variants';
import {
  type ClipMap,
  manifestUrls,
  manifestUrlsForGraphics,
  skinCount,
  VISUALS,
  visibleAttachmentsForGraphics,
} from '../src/render/characters/manifest';

function expectedClipNames(clips: ClipMap): string[] {
  return [
    clips.idle,
    clips.walk,
    clips.run,
    clips.death,
    clips.cast,
    clips.sitDown,
    clips.sitIdle,
    clips.swim,
    clips.jump,
    clips.walkBack,
    clips.flourish,
    ...clips.attack,
    ...(clips.hit ?? []),
    ...Object.values(clips.emote ?? {}).flatMap((spec) => spec.clips),
  ].filter((name): name is string => !!name);
}

async function glbAnimationNames(path: string): Promise<Set<string>> {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(path);
  return new Set(
    doc
      .getRoot()
      .listAnimations()
      .map((animation) => animation.getName()),
  );
}

describe('character visual manifest', () => {
  it('uses the custom boar death clip without relying on a speed override', () => {
    expect(VISUALS.mob_boar.clips.death).toBe('Dying');
    expect(VISUALS.mob_boar.deathTimeScale).toBeUndefined();
  });

  it('points the Combat Mech manifest at animation clips baked into the GLB', async () => {
    const visual = VISUALS.player_mech;
    const animationNames = await glbAnimationNames(`public/${visual.url}`);

    expect(animationNames.size).toBeGreaterThan(0);
    expect(
      [...new Set(expectedClipNames(visual.clips))].filter((name) => !animationNames.has(name)),
    ).toEqual([]);
  });

  it('bumps Verger Zebediah to near player parity height (board follow-up on PHAA-405)', () => {
    expect(VISUALS.npc_zebediah.height).toBeCloseTo(2.05 * 1.25, 2);
    expect(VISUALS.npc_zebediah.height).toBeLessThan(VISUALS.player_warrior.height);
  });

  it('has no baked animation clips for the prophet-cast heron rig (placeholder clips only)', async () => {
    const animationNames = await glbAnimationNames(`public/${VISUALS.npc_zebediah.url}`);
    expect(animationNames.size).toBe(0);
  });

  it('points the chibi female base manifest at animation clips baked into the GLB (PHAA-557)', async () => {
    const visual = VISUALS.chibi_female_base;
    // chibi_female_base itself stays lazy: no entity resolves to this exact
    // key. Its GLB (the student outfit) IS in the boot sweep regardless,
    // because player_mage_f/player_priest_f (PHAA-587) share the same url
    // and are not lazy.
    expect(visual.lazyPreload).toBe(true);
    expect(manifestUrls()).toContain(visual.url);

    const animationNames = await glbAnimationNames(`public/${visual.url}`);
    expect(animationNames.size).toBeGreaterThan(0);
    expect(
      [...new Set(expectedClipNames(visual.clips))].filter((name) => !animationNames.has(name)),
    ).toEqual([]);
  });

  it('points every female player class at clips baked into its chibi outfit GLB (PHAA-587)', async () => {
    const femaleKeys = [
      'player_warrior_f',
      'player_paladin_f',
      'player_hunter_f',
      'player_druid_f',
      'player_rogue_f',
      'player_mage_f',
      'player_priest_f',
      'player_warlock_f',
      'player_shaman_f',
    ] as const;
    for (const key of femaleKeys) {
      const visual = VISUALS[key];
      expect(visual, key).toBeDefined();
      expect(visual.height).toBeCloseTo(2.29, 2);
      expect(visual.lazyPreload).toBeUndefined(); // boot sweep must preload the roster
      expect(manifestUrls()).toContain(visual.url);

      const animationNames = await glbAnimationNames(`public/${visual.url}`);
      expect(animationNames.size).toBeGreaterThan(0);
      expect(
        [...new Set(expectedClipNames(visual.clips))].filter((name) => !animationNames.has(name)),
      ).toEqual([]);
    }
  });

  it('gives every female player class 2-3 chibi color variants (PHAA-587)', () => {
    const femaleKeys = [
      'player_warrior_f',
      'player_paladin_f',
      'player_hunter_f',
      'player_druid_f',
      'player_rogue_f',
      'player_mage_f',
      'player_priest_f',
      'player_warlock_f',
      'player_shaman_f',
    ];
    for (const key of femaleKeys) {
      expect(chibiSkinCount(key), key).toBeGreaterThanOrEqual(2);
      expect(chibiSkinCount(key), key).toBeLessThanOrEqual(3);
      expect(skinCount(key)).toBe(chibiSkinCount(key));
    }
  });

  it('keeps held weapons and props available on low graphics', () => {
    const allWeaponUrls = manifestUrls().filter((url) => url.startsWith('models/weapons/'));
    expect(allWeaponUrls.length).toBeGreaterThan(0);
    expect(manifestUrlsForGraphics(false)).toEqual(expect.arrayContaining(allWeaponUrls));
    expect(visibleAttachmentsForGraphics(VISUALS.player_warrior).map((a) => a.url)).toContain(
      'models/weapons/sword_1handed.glb',
    );
    expect(visibleAttachmentsForGraphics(VISUALS.player_rogue).map((a) => a.url)).toEqual([
      'models/weapons/dagger.glb',
      'models/weapons/dagger.glb',
    ]);
  });
});
