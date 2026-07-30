// Data-as-code for PHAA-660 (see docs/design/daily-rewards.md). Deliberately
// understated: a 7-slot rotating calendar, never a stat item or an XP boost, mixing
// small copper with already-defined common-tier consumables so this never becomes
// a second gearing path. Slot order is cosmetic (which day feels "biggest"), not a
// difficulty ramp; missing a day never resets the index (no streak, see the design
// doc), so the order does not encode any loss-aversion pressure either.

export interface DailyRewardEntry {
  copper: number;
  itemId?: string;
  itemCount?: number;
}

export const DAILY_REWARD_CYCLE: readonly DailyRewardEntry[] = [
  { copper: 15 },
  { copper: 5, itemId: 'baked_bread', itemCount: 2 },
  { copper: 25 },
  { copper: 5, itemId: 'spring_water', itemCount: 2 },
  { copper: 35 },
  { copper: 5, itemId: 'minor_healing_potion', itemCount: 1 },
  { copper: 50 },
];
