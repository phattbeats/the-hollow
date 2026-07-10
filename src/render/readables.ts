import * as THREE from 'three';
import { READABLES } from '../sim/data';
import type { ReadableProp, ReadableSupport } from '../sim/types';
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
// book. So a readable is a loose object: a single curled `page` (a dropped
// sheet) or a small open `journal` (a field notebook).
//
// PHAA-552 second follow-up (board asked for variety: "we need other variations,
// like it up against a tree, or on a chest, or a table, that way we can put them
// in many places"): the loose page/journal now rests on one of several SUPPORTS
// (ReadableSupport), so the same paper can be dressed to fit wherever it lands
// instead of every readable being the same rock in the grass:
//   stone  low natural fieldstone (the original dropped-note look)
//   table  lying flat on a small rough field table
//   chest  lying flat on the lid of a closed banded chest
//   tree   propped upright, leaning against the base of a tree trunk
// The page/journal geometry is unchanged; each support just reports how high the
// paper sits (restY) and, for `tree`, that it should be tilted upright (lean).

const PAGE_COLOR = 0xece0c4; // aged cream paper
const PAGE_EMISSIVE = 0xe8dcae; // the faint "come read me" glow on the paper
const COVER_COLOR = 0x7a5a34; // worn tan field-notebook board, not a grand tome
const PEBBLE_COLOR = 0x5b5348; // dark weight-stone on the loose page
const STONE_COLOR = 0x7f7d68; // weathered, faintly mossy fieldstone
const WOOD_COLOR = 0x6b4f31; // rough field-carpentry timber (table, chest body)
const WOOD_DARK = 0x4a3620; // shadowed underside / chest lid wood
const IRON_COLOR = 0x3c3a37; // dark iron banding + hasp on the chest
const BARK_COLOR = 0x4c3b2a; // tree-trunk bark
const BARK_MOSS = 0x5d6b3a; // faint moss at the trunk foot

// A readable's paper rests just clear of the grass ring (blades reach ~0.9u on
// the Reaches) when it sits low, so a stone-sized support keeps it findable.
const STONE_H = 0.42;

function paperMat(): THREE.Material {
  return surfaceMat({
    color: PAGE_COLOR,
    roughness: 0.85,
    emissive: PAGE_EMISSIVE,
    emissiveIntensity: 0.26,
  });
}

// ----- the loose paper (support-independent) --------------------------------
// Both builders return the paper centred on its own origin at y=0, so a support
// can drop it in at whatever height/tilt that support needs. `leaning` omits the
// wind pebble (a stone perched on near-vertical paper reads wrong) for the tree
// support, where the sheet stands rather than lies.

// A single loose sheet, dropped at a careless angle with one torn corner curling
// up off the surface and (when laid flat) a small pebble weighting the other.
function buildPageSheet(leaning = false): THREE.Group {
  const sheet = new THREE.Group();
  sheet.rotation.y = 0.5; // dropped askew, not squared to its support

  const sheetMat = paperMat();

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

  if (!leaning) {
    // A dark pebble pinning the opposite corner against the wind.
    const pebbleMat = surfaceMat({ color: PEBBLE_COLOR, roughness: 0.9, flatShading: true });
    const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), pebbleMat);
    pebble.position.set(-0.15, 0.05, -0.18);
    pebble.scale.set(1, 0.7, 1.1);
    pebble.castShadow = true;
    sheet.add(pebble);
  }

  return sheet;
}

// A small field notebook lying open and face-up: two page halves splayed from a
// central spine into a shallow V, a soft worn cover beneath.
function buildJournalBook(): THREE.Group {
  const open = new THREE.Group();
  open.rotation.y = 0.25; // set down a little off-square

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

  return open;
}

function buildPaper(prop: ReadableProp, leaning = false): THREE.Group {
  return prop === 'journal' ? buildJournalBook() : buildPageSheet(leaning);
}

// ----- the supports ---------------------------------------------------------
// Each returns the support mesh plus how the paper sits on it: `restY` is the
// world-space height the paper's origin drops to, and `lean` (radians about X,
// optional) tilts the paper upright for supports it rests AGAINST rather than
// ON. `offsetZ` nudges the paper toward the support so a leaning sheet meets it.

interface Support {
  mesh: THREE.Object3D;
  restY: number;
  lean?: number;
  offsetZ?: number;
}

// A low, flat, irregular fieldstone (the original support). Sunk a touch into
// the ground so it reads as a rock the world grew around, not a placed plinth;
// its top is narrower than the paper so the sheet/notebook overhangs the edge.
function buildStone(): Support {
  const stoneMat = surfaceMat({ color: STONE_COLOR, roughness: 0.96, flatShading: true });
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.6, STONE_H, 7), stoneMat);
  stone.geometry.scale(1, 1, 0.82); // slightly oval, less machined
  stone.position.y = STONE_H / 2 - 0.08; // sink the base below the surface
  stone.rotation.y = 0.4;
  stone.castShadow = true;
  stone.receiveShadow = true;
  return { mesh: stone, restY: STONE_H - 0.04 };
}

// A small rough field table: a plank top on four splayed legs, the kind a warden
// might set a register down on. The paper lies flat on the top.
function buildTable(): Support {
  const table = new THREE.Group();
  const topH = 0.62;
  const topThick = 0.07;
  const topW = 1.0;
  const topD = 0.72;
  const woodMat = surfaceMat({ color: WOOD_COLOR, roughness: 0.9, flatShading: true });
  const legMat = surfaceMat({ color: WOOD_DARK, roughness: 0.92, flatShading: true });

  const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topThick, topD), woodMat);
  top.position.y = topH;
  top.rotation.y = 0.05; // a plank never sits perfectly square
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);

  const lx = topW / 2 - 0.12;
  const lz = topD / 2 - 0.1;
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, topH, 5), legMat);
      leg.position.set(sx * lx, topH / 2, sz * lz);
      leg.rotation.set(sz * 0.04, 0, -sx * 0.04); // legs splay out a little
      leg.castShadow = true;
      table.add(leg);
    }
  }
  return { mesh: table, restY: topH + topThick / 2 };
}

// A closed, banded field chest. The paper lies flat on its flat-topped lid.
function buildChest(): Support {
  const chest = new THREE.Group();
  const bodyH = 0.4;
  const w = 0.86;
  const d = 0.56;
  const woodMat = surfaceMat({ color: WOOD_COLOR, roughness: 0.88, flatShading: true });
  const bandMat = surfaceMat({
    color: IRON_COLOR,
    roughness: 0.6,
    metalness: 0.35,
    flatShading: true,
  });
  const lidWoodMat = surfaceMat({ color: WOOD_DARK, roughness: 0.86, flatShading: true });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), woodMat);
  body.position.y = bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  chest.add(body);

  // A slightly proud lid slab (kept flat-topped so the paper sits cleanly).
  const lidH = 0.12;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, lidH, d + 0.02), lidWoodMat);
  lid.position.y = bodyH + lidH / 2;
  lid.castShadow = true;
  lid.receiveShadow = true;
  chest.add(lid);

  // Two iron bands over body + lid, and a hasp plate at the front seam.
  for (const bx of [-0.26, 0.26] as const) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, bodyH + lidH, d + 0.03), bandMat);
    band.position.set(bx, (bodyH + lidH) / 2, 0);
    band.castShadow = true;
    chest.add(band);
  }
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.04), bandMat);
  hasp.position.set(0, bodyH, d / 2 + 0.02);
  chest.add(hasp);

  chest.rotation.y = -0.12; // not squared to the road
  return { mesh: chest, restY: bodyH + lidH + 0.01 };
}

// The base of a tree trunk. The paper is propped upright, leaning back against
// the bark, its foot near the ground where someone set it down.
function buildTreeBase(): Support {
  const tree = new THREE.Group();
  const trunkR = 0.26;
  const trunkH = 1.7; // a slim sapling-sized trunk, not a monument column
  const trunkZ = -0.42; // trunk set back so the paper leans on its near face
  const barkMat = surfaceMat({ color: BARK_COLOR, roughness: 0.98, flatShading: true });
  const mossMat = surfaceMat({ color: BARK_MOSS, roughness: 1.0, flatShading: true });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.8, trunkR, trunkH, 8),
    barkMat,
  );
  trunk.position.set(0, trunkH / 2 - 0.08, trunkZ);
  trunk.rotation.z = -0.05; // a natural slight lean
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // A few surface roots flaring at the foot, and a moss skirt.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.42, 5), barkMat);
    root.position.set(Math.cos(a) * trunkR * 0.9, 0.02, trunkZ + Math.sin(a) * trunkR * 0.9);
    root.rotation.set(Math.PI / 2 - 0.5, a, 0);
    root.castShadow = true;
    tree.add(root);
  }
  const moss = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR + 0.03, trunkR + 0.09, 0.14, 8),
    mossMat,
  );
  moss.position.set(0, 0.05, trunkZ);
  tree.add(moss);

  // Paper stands nearly upright, tilted back so it rests against the bark, foot
  // just above the grass at the trunk's near face.
  return { mesh: tree, restY: 0.5, lean: -1.32, offsetZ: -0.02 };
}

function buildSupport(support: ReadableSupport): Support {
  switch (support) {
    case 'table':
      return buildTable();
    case 'chest':
      return buildChest();
    case 'tree':
      return buildTreeBase();
    default:
      return buildStone();
  }
}

// Build one readable (paper + support) centred at its own origin. Exported so a
// render harness / shot script and unit tests can exercise every support kind in
// isolation, without the full-world GLB boot the offline client needs.
export function buildReadable(prop: ReadableProp, support: ReadableSupport): THREE.Group {
  const group = new THREE.Group();
  const s = buildSupport(support);
  group.add(s.mesh);

  const leaning = support === 'tree';
  const paper = buildPaper(prop, leaning);
  paper.position.y = s.restY;
  if (s.offsetZ) paper.position.z += s.offsetZ;
  if (s.lean) paper.rotation.x = s.lean;
  group.add(paper);
  return group;
}

export interface ReadablesView {
  group: THREE.Group;
}

export function buildReadables(seed: number): ReadablesView {
  const group = new THREE.Group();
  group.name = 'readables';
  for (const readable of READABLES) {
    const prop = buildReadable(readable.prop, readable.support ?? 'stone');
    const y = terrainHeight(readable.pos.x, readable.pos.z, seed);
    prop.position.set(readable.pos.x, y, readable.pos.z);
    prop.rotation.y = readable.facing;
    prop.name = readable.id;
    group.add(prop);
  }
  return { group };
}
