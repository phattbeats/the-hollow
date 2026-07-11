import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildReadable } from '../src/render/readables';
import type { ReadableProp, ReadableSupport } from '../src/sim/types';

// Render smoke for the PHAA-552 support variety. buildReadable only constructs
// THREE object graphs (no WebGL context), so it runs headless here. This guards
// that every (prop, support) combination builds a non-degenerate prop: the
// support mesh plus a paper group that sits above the ground, and that the tree
// support tilts the paper upright (leaning) while the flat supports do not.

const PROPS: ReadableProp[] = ['page', 'journal', 'ledger'];
const SUPPORTS: ReadableSupport[] = ['stone', 'table', 'chest', 'tree'];

describe('buildReadable (PHAA-552 support variety)', () => {
  for (const support of SUPPORTS) {
    for (const prop of PROPS) {
      it(`builds a ${prop} on a ${support}`, () => {
        const group = buildReadable(prop, support);
        // Support mesh + paper group.
        expect(group.children.length).toBe(2);
        const [, paper] = group.children;
        // The paper sits above the ground on/against its support.
        expect(paper.position.y).toBeGreaterThan(0.2);
        // Every prop casts real geometry (at least the sheet/cover body).
        let meshes = 0;
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) meshes++;
        });
        expect(meshes).toBeGreaterThan(1);
      });
    }
  }

  it('stands the paper upright only on the tree support', () => {
    expect(buildReadable('page', 'tree').children[1].rotation.x).not.toBe(0);
    for (const flat of ['stone', 'table', 'chest'] as const) {
      expect(buildReadable('page', flat).children[1].rotation.x).toBe(0);
    }
  });
});
