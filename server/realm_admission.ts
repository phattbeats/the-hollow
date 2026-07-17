// Realm admission cap: refuses a brand-new join once the realm is at
// capacity, so a runaway population can't overwhelm the world-tick or memory
// budget. Pure decision core so it is unit-testable without a GameServer.

export function isRealmFull(input: { online: number; cap: number; isAdmin: boolean }): boolean {
  if (input.isAdmin) return false;
  if (input.cap <= 0) return false; // 0 (or unset/negative) disables the cap
  return input.online >= input.cap;
}
