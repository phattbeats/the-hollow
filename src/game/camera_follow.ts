export interface CameraFollowInput {
  camYaw: number;
  interpFacing: number;
  frameDt: number;
  lastInterpFacing: number | null;
  mouselook: boolean;
  moving: boolean;
  orbiting: boolean;
}

export interface CameraFollowResult {
  camYaw: number;
  lastInterpFacing: number;
}

const SETTLE_RATE = 6;
const MAX_SETTLE_STEP = 0.16;

export function wrapAngle(d: number): number {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function updateFollowCameraYaw(input: CameraFollowInput): CameraFollowResult {
  let camYaw = input.camYaw;
  if (!input.mouselook) {
    if (input.orbiting) return { camYaw, lastInterpFacing: input.interpFacing };
    if (input.lastInterpFacing !== null) camYaw += wrapAngle(input.interpFacing - input.lastInterpFacing);
    if (input.moving && !input.orbiting) {
      const delta = wrapAngle(input.interpFacing - camYaw);
      const step = delta * (1 - Math.exp(-Math.max(0, input.frameDt) * SETTLE_RATE));
      camYaw += Math.max(-MAX_SETTLE_STEP, Math.min(MAX_SETTLE_STEP, step));
    }
  }
  return { camYaw, lastInterpFacing: input.interpFacing };
}
