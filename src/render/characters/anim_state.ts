/** Renderer-derived animation inputs (same facts the old pose machine used). */
export interface AnimState {
  /** horizontal speed, world units/sec */
  speed: number;
  moving: boolean;
  airborne: boolean;
  /** moving against facing (players backpedaling) */
  backwards: boolean;
  /** use reversed forward locomotion instead of an authored walkBack clip */
  reverseBackpedal?: boolean;
  dead: boolean;
  casting: boolean;
  swimming: boolean;
  sitting: boolean;
}

export type BaseState = 'idle' | 'walk' | 'walkBack' | 'run' | 'cast' | 'swim' | 'sit' | 'jump';

const RUN_SPEED_THRESHOLD = 4.5; // u/s — sim walk/wander sits well below
const DEFAULT_WALK_REF = 2.2;
const DEFAULT_RUN_REF = 7;

// Opacity target for a clip-less rig (a fully procedural build with no armature
// yet, see manifest.ts's npc_greenpaw/npc_zebediah/npc_faddick entries) while it
// is moving. With no walk cycle to switch to, a fully opaque static pose
// translating across the ground reads as ice-skating; fading it toward
// translucent in transit and back to solid at rest reads as a deliberate glide
// instead. Fallback for a rig with no baked animation, not a fake walk cycle.
export const NO_CLIP_MOVE_FADE_OPACITY = 0.5;

export function noClipMoveFadeTarget(s: Pick<AnimState, 'moving' | 'dead'>): number {
  return s.moving && !s.dead ? NO_CLIP_MOVE_FADE_OPACITY : 1;
}

export function desiredBaseState(s: AnimState, hasWalkBackClip: boolean): BaseState {
  if (s.swimming) return 'swim';
  if (s.airborne) return 'jump';
  if (s.casting) return 'cast';
  if (s.sitting) return 'sit';
  if (s.moving) {
    if (s.backwards && hasWalkBackClip && !s.reverseBackpedal) return 'walkBack';
    return s.speed >= RUN_SPEED_THRESHOLD ? 'run' : 'walk';
  }
  return 'idle';
}

export function locomotionTimeScale(
  baseState: BaseState,
  s: Pick<AnimState, 'speed' | 'backwards' | 'reverseBackpedal'>,
  walkRef = DEFAULT_WALK_REF,
  runRef = DEFAULT_RUN_REF,
): number | null {
  let timeScale: number;
  if (baseState === 'walk' || baseState === 'walkBack') {
    timeScale = clamp(s.speed / walkRef, 0.6, 1.8);
  } else if (baseState === 'run') {
    timeScale = clamp(s.speed / runRef, 0.6, 1.6);
  } else {
    return null;
  }
  return s.reverseBackpedal && s.backwards && baseState !== 'walkBack' ? -timeScale : timeScale;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
