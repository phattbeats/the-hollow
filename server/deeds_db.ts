// SQL boundary for the Book of Asphodelia Renown read model. Gameplay keeps
// deed and title truth in characters.state JSONB; these rows support ranked
// deed standings and recent-title reads without scanning every state blob.

import { pool } from './db';

export interface CharacterDeedRow {
  realm: string;
  characterId: number;
  accountId: number;
  deedId: string;
}

export async function insertCharacterDeed(row: CharacterDeedRow): Promise<void> {
  await pool.query(
    `INSERT INTO character_deeds (realm, character_id, account_id, deed_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (character_id, deed_id) DO NOTHING`,
    [row.realm, row.characterId, row.accountId, row.deedId],
  );
}

export interface DeedRarityAggregate {
  totalEligible: number;
  earned: Record<string, number>;
}

const DEED_RARITY_MIN_LEVEL = 5;

export async function deedRarityCounts(): Promise<DeedRarityAggregate> {
  const counts = await pool.query(
    `SELECT cd.deed_id, COUNT(*)::int AS earned
       FROM character_deeds cd
       JOIN characters c ON c.id = cd.character_id
      WHERE c.level >= $1 AND c.state IS NOT NULL
      GROUP BY cd.deed_id`,
    [DEED_RARITY_MIN_LEVEL],
  );
  const eligible = await pool.query(
    'SELECT COUNT(*)::int AS eligible FROM characters WHERE level >= $1 AND state IS NOT NULL',
    [DEED_RARITY_MIN_LEVEL],
  );
  const earned: Record<string, number> = {};
  for (const row of counts.rows) earned[String(row.deed_id)] = Number(row.earned);
  return { totalEligible: Number(eligible.rows[0]?.eligible ?? 0), earned };
}

export interface RecentDeedRow {
  deedId: string;
  earnedAt: string;
}

export async function recentDeedsForCharacter(
  characterId: number,
  limit: number,
): Promise<RecentDeedRow[]> {
  const res = await pool.query(
    `SELECT deed_id, earned_at FROM character_deeds
     WHERE character_id = $1
     ORDER BY earned_at DESC, id DESC
     LIMIT $2`,
    [characterId, limit],
  );
  return res.rows.map((row) => ({
    deedId: String(row.deed_id),
    earnedAt: row.earned_at instanceof Date ? row.earned_at.toISOString() : String(row.earned_at),
  }));
}

export async function earnedDeedIdsForAccount(accountId: number): Promise<string[]> {
  const res = await pool.query(
    'SELECT DISTINCT deed_id FROM character_deeds WHERE account_id = $1',
    [accountId],
  );
  return res.rows.map((row) => String(row.deed_id));
}

export async function getDeedBroadcasts(accountId: number): Promise<boolean> {
  const res = await pool.query('SELECT deed_broadcasts FROM accounts WHERE id = $1', [accountId]);
  return res.rows[0]?.deed_broadcasts ?? true;
}

export async function setDeedBroadcasts(accountId: number, enabled: boolean): Promise<void> {
  await pool.query('UPDATE accounts SET deed_broadcasts = $2 WHERE id = $1', [accountId, enabled]);
}
