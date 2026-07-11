// Boarball pitch geometry, as plain numbers (dungeon_layout.ts precedent).
// PHAA-572: adapted from upstream's Vale Cup (a whole new Sowfield outdoor
// zone with a stadium, grandstands, and a skybox) onto OUR EXISTING Ashen
// Coliseum arena instance (src/sim/dungeon_layout.ts ARENA_LAYOUT), per the
// ticket's own instruction to land it "on our existing arena/fiesta system"
// rather than build a new zone. The pitch is the arena pit itself, walkable
// interior x in [-22,22] / z in [-19,23] (inside the |x|=23 side walls and the
// z=-20/z=24 end-wall centerlines, DUNGEON_WALL_HW=1 clearance). Goal-to-goal
// runs along z (matching the existing arena's face-off axis: ARENA_SPAWN_A/B
// and the 2v2 spawn pairs already sit near z=-14 / z=18), so team A defends
// the south line and team B the north line, a 90-degree relabeling of
// upstream's east/west layout, not a physics change.
//
// Sim layer: no three.js imports.

export const PITCH = { xMin: -22, xMax: 22, zMin: -19, zMax: 23 };
export const PITCH_CENTER_X = 0;

export const GOAL_HALF_W = 5; // goal mouth half width (10 wide)
export const GOAL_DEPTH = 2; // logical net-pocket depth behind the goal line
export const GOAL_X_MIN = PITCH_CENTER_X - GOAL_HALF_W;
export const GOAL_X_MAX = PITCH_CENTER_X + GOAL_HALF_W;
// Crossbar height: a ball crossing the line at or above this sails over (does
// not score); matches the existing arena's fully-enclosed pit scale.
export const GOAL_HEIGHT = 2.5;

// Goal lines: south belongs to team A (their own goal), north to team B.
export const GOAL_LINE_SOUTH_Z = PITCH.zMin;
export const GOAL_LINE_NORTH_Z = PITCH.zMax;

export interface BbWallSegment {
  // axis-aligned segment the ball reflects off; nx/nz is the INWARD normal
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  nx: number;
  nz: number;
}

// Every board line the ball banks off. The goal mouths are open gaps (no
// segment) so a shot on target rolls through to the goal-line check instead of
// banking; the two long side walls (x = +-22) are solid the whole pitch depth.
export const PITCH_WALLS: BbWallSegment[] = [
  // west side wall (inward normal points east, +x)
  { x1: PITCH.xMin, z1: PITCH.zMin, x2: PITCH.xMin, z2: PITCH.zMax, nx: 1, nz: 0 },
  // east side wall (inward normal points west, -x)
  { x1: PITCH.xMax, z1: PITCH.zMin, x2: PITCH.xMax, z2: PITCH.zMax, nx: -1, nz: 0 },
  // south end wall, two segments flanking the goal mouth (inward normal +z)
  { x1: PITCH.xMin, z1: PITCH.zMin, x2: GOAL_X_MIN, z2: PITCH.zMin, nx: 0, nz: 1 },
  { x1: GOAL_X_MAX, z1: PITCH.zMin, x2: PITCH.xMax, z2: PITCH.zMin, nx: 0, nz: 1 },
  // north end wall, two segments flanking the goal mouth (inward normal -z)
  { x1: PITCH.xMin, z1: PITCH.zMax, x2: GOAL_X_MIN, z2: PITCH.zMax, nx: 0, nz: -1 },
  { x1: GOAL_X_MAX, z1: PITCH.zMax, x2: PITCH.xMax, z2: PITCH.zMax, nx: 0, nz: -1 },
];

// Kickoff spawns: the existing ARENA_SPAWNS_A_2v2/B_2v2 (dungeon_layout.ts)
// already sit at z -14/18 facing each other along z, exactly this pitch's
// goal-to-goal axis, so boarball reuses them verbatim rather than defining a
// bespoke set (they were the family this pitch's orientation was chosen to fit).

// Where the ball sits for kickoff (pitch centre, instance-local; matches the
// arena's own dais at {x:0, z:2}).
export const BB_KICKOFF_SPOT = { x: 0, z: 2 };

/** Inside the playing surface (pitch rules apply). Instance-local coords. */
export function isOnPitch(x: number, z: number): boolean {
  return x >= PITCH.xMin && x <= PITCH.xMax && z >= PITCH.zMin && z <= PITCH.zMax;
}
