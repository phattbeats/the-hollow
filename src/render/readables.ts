import * as THREE from 'three';
import { READABLES } from '../sim/data';
import { terrainHeight } from '../sim/world';
import { surfaceMat } from './gfx';

// World-placed readable books (PHAA-552): the standalone journals/books lying
// around The Hollow Reaches that a player walks up to and reads. Placements come
// from sim/content/readables.ts (merged into sim/data.ts's READABLES); this
// module only DRAWS them. Reading is client-only (see src/ui reader + main.ts
// interact), so there is no state or harvest logic here, same static-fixture
// shape as render/gather_nodes.ts.
//
// Procedural-only, no new GLB/texture: each readable is a small open book resting
// on a low stone plinth so it reads as an intentional, interactable object rather
// than litter. The pages carry a faint emissive so the book catches the eye at a
// distance, the same "come read me" cue a WoW readable gives.

const COVER_COLOR = 0x5c2018; // dark oxblood leather
const PAGE_COLOR = 0xefe6cf; // aged cream paper
const PLINTH_COLOR = 0x6a6157; // weathered stone
const BAND_COLOR = 0xb8963f; // tarnished brass clasp band

// Height of the lectern pedestal. The open book sits on top at this height, so
// the pages read at roughly waist height and clear the Reaches' tall grass ring
// (which otherwise swallows a ground-level prop); a reader should stand out as
// an intentional, interactable object, the way a WoW book-stand does.
const PEDESTAL_H = 1.35;

// Build one open-book-on-a-lectern as a group whose local origin sits on the
// ground (y = 0). The caller positions and yaws it in world space.
function buildBook(): THREE.Group {
  const book = new THREE.Group();

  const stoneMat = surfaceMat({ color: PLINTH_COLOR, roughness: 0.95, flatShading: true });

  // A tapered stone pedestal column.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, PEDESTAL_H, 6), stoneMat);
  column.position.y = PEDESTAL_H / 2;
  column.castShadow = true;
  column.receiveShadow = true;
  book.add(column);

  // A wider slab desktop the book rests on, so the silhouette reads as a lectern.
  const desk = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.72), stoneMat);
  desk.position.y = PEDESTAL_H + 0.06;
  desk.castShadow = true;
  desk.receiveShadow = true;
  book.add(desk);

  // The open book rests on the desk, tilted a touch so the pages angle toward a
  // standing player rather than lying dead flat.
  const open = new THREE.Group();
  open.position.y = PEDESTAL_H + 0.13;
  open.rotation.x = -0.34;
  book.add(open);

  const coverMat = surfaceMat({ color: COVER_COLOR, roughness: 0.7 });
  const pageMat = surfaceMat({
    color: PAGE_COLOR,
    roughness: 0.85,
    emissive: 0xe8dcae,
    emissiveIntensity: 0.28,
  });
  const bandMat = surfaceMat({ color: BAND_COLOR, roughness: 0.5, metalness: 0.6 });

  // Two halves splayed from a central gutter into a shallow open V.
  for (const side of [-1, 1] as const) {
    const half = new THREE.Group();
    half.rotation.z = side * 0.16; // pages rise gently away from the gutter
    open.add(half);

    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.72), coverMat);
    cover.position.set(side * 0.29, 0, 0);
    cover.castShadow = true;
    cover.receiveShadow = true;
    half.add(cover);

    const page = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.64), pageMat);
    page.position.set(side * 0.29, 0.055, 0);
    page.castShadow = true;
    page.receiveShadow = true;
    half.add(page);
  }

  // A thin brass band down the gutter/spine to sell the tome silhouette.
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.74), bandMat);
  spine.position.y = 0.03;
  spine.castShadow = true;
  open.add(spine);

  return book;
}

export interface ReadablesView {
  group: THREE.Group;
}

export function buildReadables(seed: number): ReadablesView {
  const group = new THREE.Group();
  group.name = 'readables';
  for (const readable of READABLES) {
    const book = buildBook();
    const y = terrainHeight(readable.pos.x, readable.pos.z, seed);
    book.position.set(readable.pos.x, y, readable.pos.z);
    book.rotation.y = readable.facing;
    book.name = readable.id;
    group.add(book);
  }
  return { group };
}
