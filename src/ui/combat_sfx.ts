import { MOBS } from '../sim/data';
import type { Entity } from '../sim/types';

export function shouldPlayCritSfxForTarget(target: Entity): boolean {
  return target.kind !== 'mob' || !MOBS[target.templateId]?.boss;
}

export function shouldPlayMobVoiceSfxForEntity(entity: Entity): boolean {
  return entity.kind === 'mob' && entity.templateId !== 'nythraxis_skeleton_warrior';
}
