// The authorable zones the placement tool can load: each entry names the zone
// content module's ZonePropsDef and where the fly camera starts. Dev-only.

import { HOLLOW_GATE_POS, HOLLOW_PROPS } from '../../sim/content/hollow';
import { TEMPLE_PROPS } from '../../sim/content/temple';
import { ZONE1_PROPS } from '../../sim/content/zone1';
import { ZONE2_PROPS } from '../../sim/content/zone2';
import { ZONE3_PROPS } from '../../sim/content/zone3';
import type { ZonePropsDef } from '../../sim/types';

export interface AuthorableZone {
  id: string;
  label: string;
  props: ZonePropsDef;
  /** camera start (world XZ; the tool grounds and lifts it) */
  start: { x: number; z: number };
}

export const AUTHORABLE_ZONES: AuthorableZone[] = [
  {
    id: 'hollow',
    label: 'The Hollow (hub, hub-local coords)',
    props: HOLLOW_PROPS,
    start: { x: HOLLOW_GATE_POS.x, z: HOLLOW_GATE_POS.z },
  },
  {
    id: 'temple',
    label: 'Drowned Temple (Glimmermere shore)',
    props: TEMPLE_PROPS,
    start: { x: -70, z: 775 },
  },
  { id: 'zone1', label: 'Zone 1: Eastbrook', props: ZONE1_PROPS, start: { x: 0, z: -10 } },
  { id: 'zone2', label: 'Zone 2: Fenbridge', props: ZONE2_PROPS, start: { x: 0, z: 290 } },
  { id: 'zone3', label: 'Zone 3: Highwatch', props: ZONE3_PROPS, start: { x: 0, z: 650 } },
];
