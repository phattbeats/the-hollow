// Pure helpers for hotbar slot arithmetic, kept out of the DOM-heavy Hud so
// they can be unit-tested without a document.

export function placeAbilityOnSlot(
  slotMap: readonly (string | null)[],
  abilityId: string,
  targetIndex: number,
): (string | null)[] {
  const next = slotMap.slice();
  if (targetIndex < 0 || targetIndex >= next.length) return next;
  const sourceIndex = next.indexOf(abilityId);
  if (sourceIndex === targetIndex) return next;
  if (sourceIndex !== -1) {
    // already on the bar: swap so we never duplicate an ability across slots
    [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
    return next;
  }
  // off the bar (e.g. dragged from the spellbook): drop it on the target,
  // replacing whatever occupied that slot — this is how a full bar accepts a
  // freshly learned spell.
  next[targetIndex] = abilityId;
  return next;
}

export function clearSlot(
  slotMap: readonly (string | null)[],
  targetIndex: number,
): (string | null)[] {
  const next = slotMap.slice();
  if (targetIndex < 0 || targetIndex >= next.length) return next;
  next[targetIndex] = null;
  return next;
}
