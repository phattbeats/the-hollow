// PHAA-609 armor GLB smoke test. Each extracted GLB must:
//  - parse cleanly through three's GLTFLoader (catches malformed buffers,
//    wrong accessor byteOffsets, missing bones, broken skin references).
//  - contain a skinned mesh with vertices and a material that references
//    the original KayKit baseColor texture (proves the re-authored GLB
//    kept the material/texture binding intact).
//  - expose the `head`, `chest`, and `upperleg.r` bones so attachment via
//    VisualDef.attach entries at `bone: 'head' | 'chest' | 'upperleg.r'`
//    resolves at render time.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';

// GLTFLoader's browser-style parser reaches for `self.URL` (image loading)
// and `self.cache` (KHR_lights); both blow up in plain Node. Stub the bare
// minimum on globalThis so the parser proceeds past those branches.
const g = globalThis as any;
if (typeof g.self === 'undefined') {
  g.self = {
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    cache: undefined,
  };
}

const FILES = ['helm_plate.glb', 'chest_cape.glb', 'legs_plate.glb'];

// The KayKit texture uses WebP, which can't decode in Node. Install a
// plugin that stubs `loadImageSource` so the parser reaches its success
// callback. The resulting material still carries the texture reference
// even though the in-process bitmap is empty.
function noopImagePlugin(parser: any) {
  const orig = parser.loadImageSource.bind(parser);
  parser.loadImageSource = (textureDef: unknown, src: unknown) =>
    orig(textureDef, src).catch(() => ({ width: 0, height: 0 }));
  return { name: 'PHAA609NoopImage' };
}

describe('PHAA-609 armor GLB smoke test', () => {
  for (const f of FILES) {
    it(`${f} parses with the right skinned mesh count + texture binding + bones`, async () => {
      const path = resolve(process.cwd(), 'public/models/armor', f);
      const buf = readFileSync(path);
      const loader = new GLTFLoader();
      loader.register(noopImagePlugin);
      const g = await new Promise<any>((res, rej) =>
        loader.parse(
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          '',
          (g2: any) => res(g2),
          rej,
        ),
      );
      // The glTF JSON keeps the texture array intact even when the
      // in-process image fails to decode.
      const jsonTextures: any[] = g.parser.json?.textures ?? [];
      expect(jsonTextures.length, 'GLB should declare at least one texture').toBeGreaterThan(0);
      const jsonMaterials: any[] = g.parser.json?.materials ?? [];
      const matWithMap = jsonMaterials.filter(
        (m: any) => m?.pbrMetallicRoughness?.baseColorTexture,
      );
      expect(
        matWithMap.length,
        'GLB should declare at least one material with a baseColor texture binding',
      ).toBeGreaterThan(0);

      const skinned: Array<{ name: string; v: number; hasMat: boolean }> = [];
      g.scene.traverse((o: any) => {
        if (o.isSkinnedMesh) {
          skinned.push({
            name: o.name,
            v: o.geometry.attributes.position?.count ?? 0,
            hasMat: !!o.material,
          });
        }
      });
      expect(skinned.length).toBeGreaterThan(0);
      for (const m of skinned) {
        expect(m.v, `${m.name} should have vertices`).toBeGreaterThan(0);
        expect(m.hasMat, `${m.name} should have a material`).toBe(true);
      }
      const boneNames = new Set<string>();
      g.scene.traverse((o: any) => {
        if (o.isBone) boneNames.add(o.name);
      });
      // Every extracted GLB carries the full Rig_Medium skeleton so any of
      // the male roster's armorSlots attach entries resolve at render time.
      // GLTFLoader sanitizes dotted bone names (the source uses KayKit's
      // `head`/`chest`/`upperleg.r` etc.); a rigid attach via
      // VisualDef.attach is resolved against the sanitized names
      // (see src/render/characters/assets.ts resolveBone), so we assert on
      // the sanitized form.
      expect(boneNames.has('head'), 'should carry the head bone').toBe(true);
      expect(boneNames.has('chest'), 'should carry the chest bone').toBe(true);
      expect(
        boneNames.has('upperlegr'),
        'should carry the upperlegr bone (sanitized from upperleg.r)',
      ).toBe(true);
    });
  }
});
