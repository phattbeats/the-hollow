import * as THREE from 'three';
import { READABLES } from '../sim/data';
import type { ReadableProp } from '../sim/types';
import { terrainHeight } from '../sim/world';
import { surfaceMat } from './gfx';

// World-placed readable books/journals (PHAA-552): the standalone "random
// journals or books you find lying around" (PHAA-439) that a player walks up to
// and reads. Placements come from sim/content/readables.ts (merged into
// sim/data.ts's READABLES); this module only DRAWS them. Reading is client-only
// (see src/ui reader + main.ts interact), so there is no state or harvest logic
// here, same static-fixture shape as render/gather_nodes.ts.
//
// PHAA-552 follow-up (board note): the first pass drew every readable as an open
// tome on a tall stone lectern, which read as a monument on a pedestal rather
// than something "lying around", and made a torn LEDGER PAGE look like a bound
// book. So a readable is now a loose object resting on a low natural fieldstone:
// a single curled `page` (a dropped sheet) or a small open `journal` (a field
// notebook). The stone lifts the paper just clear of the grass ring so it still
// catches the eye, and the paper carries a faint emissive as the "come read me"
// cue, but nothing about it reads as a display stand.

const PAGE_COLOR = 0xece0c4; // aged cream paper
const PAGE_EMISSIVE = 0xe8dcae; // the faint "come read me" glow on the paper
const COVER_COLOR = 0x7a5a34; // worn tan field-notebook board, not a grand tome
const PEBBLE_COLOR = 0x5b5348; // dark weight-stone on the loose page
const STONE_COLOR = 0x7f7d68; // weathered, faintly mossy fieldstone

// The loose item rests on a low flat fieldstone. It is short (a rock in the
// grass, not a column), but tall enough that the paper on top clears most of the
// Reaches' grass ring (blades reach ~0.9u) so the readable stays findable. Its
// top is narrower than the paper so the sheet/notebook overhangs the edge and
// reads as something DROPPED on a rock, not displayed on a plinth.
const STONE_H = 0.42;
const REST_Y = STONE_H - 0.04; // paper sits just proud of the stone's flat top

function paperMat(): THREE.Material {
  return surfaceMat({
    color: PAGE_COLOR,
    roughness: 0.85,
    emissive: PAGE_EMISSIVE,
    emissiveIntensity: 0.26,
  });
}

// A low, flat, irregular fieldstone the readable rests on. Sunk a touch into the
// ground so it reads as a rock the world grew around, not a placed plinth.
function buildStone(): THREE.Mesh {
  const stoneMat = surfaceMat({ color: STONE_COLOR, roughness: 0.96, flatShading: true });
  // A squat, many-but-not-round drum reads as a weathered flat-topped boulder.
  // The top is smaller than the paper it holds, so the sheet/notebook overhangs.
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.6, STONE_H, 7), stoneMat);
  stone.geometry.scale(1, 1, 0.82); // slightly oval, less machined
  stone.position.y = STONE_H / 2 - 0.08; // sink the base below the surface
  stone.rotation.y = 0.4;
  stone.castShadow = true;
  stone.receiveShadow = true;
  return stone;
}

// A single loose sheet lying on the stone, dropped at a careless angle with one
// torn corner curling up off the surface, a small pebble weighting the other.
function buildPage(): THREE.Group {
  const page = new THREE.Group();
  page.add(buildStone());

  const sheetMat = paperMat();

  const sheet = new THREE.Group();
  sheet.position.y = REST_Y;
  sheet.rotation.y = 0.5; // dropped askew, not squared to the stone
  page.add(sheet);

  // The flat body of the sheet.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.014, 0.6), sheetMat);
  body.castShadow = true;
  body.receiveShadow = true;
  sheet.add(body);

  // One corner curled up off the surface: a small flap tilted off the sheet's
  // edge, so it reads as loose paper, not a rigid tile.
  const curl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.2), sheetMat);
  curl.position.set(0.16, 0.006, 0.22);
  curl.rotation.set(-0.7, 0.2, 0.15);
  curl.castShadow = true;
  sheet.add(curl);

  // A dark pebble pinning the opposite corner against the wind.
  const pebbleMat = surfaceMat({ color: PEBBLE_COLOR, roughness: 0.9, flatShading: true });
  const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), pebbleMat);
  pebble.position.set(-0.15, 0.05, -0.18);
  pebble.scale.set(1, 0.7, 1.1);
  pebble.castShadow = true;
  sheet.add(pebble);

  return page;
}

// A small field notebook lying open and face-up on the stone: two page halves
// splayed from a central spine into a shallow V, a soft worn cover beneath. Lies
// flat where it was set down, never tilted up toward the player like a display.
function buildJournal(): THREE.Group {
  const journal = new THREE.Group();
  journal.add(buildStone());

  const open = new THREE.Group();
  open.position.y = REST_Y;
  open.rotation.y = 0.25; // set down a little off-square
  journal.add(open);

  const coverMat = surfaceMat({ color: COVER_COLOR, roughness: 0.85 });
  const pageMat = paperMat();

  // The soft cover splayed flat under the open pages.
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.56), coverMat);
  cover.castShadow = true;
  cover.receiveShadow = true;
  open.add(cover);

  // Two page halves rising gently away from the central gutter.
  for (const side of [-1, 1] as const) {
    const half = new THREE.Group();
    half.rotation.z = side * -0.08; // a shallow open V, pages barely lifted
    open.add(half);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.5), pageMat);
    leaf.position.set(side * 0.18, 0.03, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    half.add(leaf);
  }

  // A thin worn spine down the gutter to sell the open-notebook silhouette.
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.52), coverMat);
  spine.position.y = 0.03;
  open.add(spine);

  return journal;
}

function buildReadable(prop: ReadableProp): THREE.Group {
  return prop === 'journal' ? buildJournal() : buildPage();
}

export interface ReadablesView {
  group: THREE.Group;
}

export function buildReadables(seed: number): ReadablesView {
  const group = new THREE.Group();
  group.name = 'readables';
  for (const readable of READABLES) {
    const prop = buildReadable(readable.prop);
    const y = terrainHeight(readable.pos.x, readable.pos.z, seed);
    prop.position.set(readable.pos.x, y, readable.pos.z);
    prop.rotation.y = readable.facing;
    prop.name = readable.id;
    group.add(prop);
  }
  return { group };
}
