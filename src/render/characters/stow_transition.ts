// Sheathe-transition state machine (pure, three-free; anim_state.ts pattern).
// Ported from upstream PR #1765 (the Z-key weapon sheathing feature).
//
// The visual swap of held props between the hands and the back is deferred to
// the midpoint of the arm gesture (CharacterVisual plays the ClipMap `stow`
// one-shot), so the re-parent lands while the hand passes the shoulder instead
// of teleporting the weapon. This module owns only the timing/target logic so
// rapid retoggles and mid-flight reversals are Node-testable; visual.ts stays
// the thin consumer that plays the clip and performs the swap.
//
// Fork notes (PHAA-737 Row J, upstream #1765 ADAPT):
// - The state machine itself is a port-as-is; the upstream tests assert the
//   same three output events ('none' | 'expired' | 'swap') and the same timer
//   semantics.
// - The arm-gesture clip (`clips.stow`) and the additive arm raise are NOT
//   ported in this commit: the fork's ClipMap factories do not ship a `stow`
//   clip yet (authoring that one-shot is a separate slice, see PHAA-585). With
//   no clip to play, `setWeaponStowed` falls back to `forceStow` (snap), and
//   `applyStowArmLift` is a no-op. The state-machine plumbing stays so a future
//   patch that adds the clip only needs to flip the snap to a deferred swap.

export interface StowTransition {
  /** The pose the model currently shows (props attached to hands or back). */
  attached: boolean;
  /** The latest requested pose (the sim's weaponStowed bit). */
  target: boolean;
  /** Seconds until the pending swap lands; 0 = nothing pending. */
  timer: number;
}

export function createStowTransition(): StowTransition {
  return { attached: false, target: false, timer: 0 };
}

/** Request a new pose with a deferred swap. Returns true when the caller should
 *  (re)play the arm gesture: any actual target change replays it, including a
 *  mid-flight reversal (the arm reaches again, the swap lands on the final
 *  state once). A same-target request is a no-op. */
export function requestStow(t: StowTransition, stowed: boolean, swapDelay: number): boolean {
  if (stowed === t.target) return false;
  t.target = stowed;
  t.timer = Math.max(1e-6, swapDelay);
  return true;
}

/** Snap to a pose with no gesture (spawn-in sync, dead rigs, clip-less defs).
 *  Cancels any pending swap. Returns true when the caller must re-attach now. */
export function forceStow(t: StowTransition, stowed: boolean): boolean {
  t.target = stowed;
  t.timer = 0;
  if (t.attached === stowed) return false;
  t.attached = stowed;
  return true;
}

/** Per-frame tick. 'swap' exactly when the deferred re-parent must be applied
 *  (the caller re-attaches props to `t.attached` AND cuts the gesture clip);
 *  'expired' when the timer lapsed but a mid-flight reversal landed back on the
 *  already-attached pose (cut the gesture, skip the rebuild); 'none' otherwise. */
export function tickStow(t: StowTransition, dt: number): 'none' | 'expired' | 'swap' {
  if (t.timer <= 0) return 'none';
  t.timer = Math.max(0, t.timer - dt);
  if (t.timer > 0) return 'none';
  if (t.attached === t.target) return 'expired';
  t.attached = t.target;
  return 'swap';
}