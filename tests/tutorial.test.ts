import { describe, expect, it } from 'vitest';
import { computeTutorialStep, type TutorialSnapshot } from '../src/ui/tutorial';

// The overlay's rendering is DOM-bound, but the step progression is a pure
// function over observed IWorld state — that's what we pin here.
const base: TutorialSnapshot = {
  moved: false,
  nearGiver: false,
  questActive: false,
  questReady: false,
  questDone: false,
};

describe('computeTutorialStep', () => {
  it('starts on move for a fresh, motionless character', () => {
    expect(computeTutorialStep(base)).toBe('move');
  });

  it('advances to seek once the player has moved', () => {
    expect(computeTutorialStep({ ...base, moved: true })).toBe('seek');
  });

  it('advances to talk when standing by the giver', () => {
    expect(computeTutorialStep({ ...base, moved: true, nearGiver: true })).toBe('talk');
  });

  it('advances to slay once the quest is accepted', () => {
    expect(computeTutorialStep({ ...base, moved: true, questActive: true })).toBe('slay');
  });

  it('advances to return when objectives are complete', () => {
    expect(computeTutorialStep({ ...base, questActive: true, questReady: true })).toBe('return');
  });

  it('reaches done after the quest is turned in', () => {
    expect(computeTutorialStep({ ...base, questDone: true })).toBe('done');
  });

  it('keeps guiding to slay even while standing on the giver mid-hunt', () => {
    // nearGiver must not pull the player back to "talk" once the quest is live.
    expect(computeTutorialStep({ ...base, moved: true, nearGiver: true, questActive: true })).toBe('slay');
  });

  it('treats a turned-in quest as done regardless of position', () => {
    expect(computeTutorialStep({ moved: true, nearGiver: true, questActive: true, questReady: true, questDone: true })).toBe('done');
  });
});
