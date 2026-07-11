// Greenpaw's hunger loop and the smoke it feeds into the vase hub room
// (PHAA-421, docs/plan-the-hollow.md section 5 Greenpaw, section 9 Phase 2).
// Built on the housing.ts pattern (SESSION S0b's Housing v0): a self-contained
// system module behind SimContext, owning its own state, exposed to the
// renderer through IWorld. Unlike Housing (a rare-change ownership book saved
// on rev-diff), this state drifts every tick (hunger rises, smoke decays), so
// it is loaded/saved on the server's autosave cadence like market.ts.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random /
// Date.now (enforced by tests/architecture.test.ts). The one draw of
// randomness (which of Greenpaw's in-voice feed lines plays) goes through
// SimContext's Rng.
//
// Greenpaw's feed-response lines emit in English here (the sim core stays
// language-agnostic); the client re-localizes them through src/ui/sim_i18n.ts's
// RULES against the sim.hearth.* catalog keys (PHAA-428), the same matcher
// pattern housing.ts uses for its housing text. Feeding is triggered from
// Greenpaw's dialogue menu (feedGreenpaw(), an IWorld command; PHAA-482), not
// a typed /feed chat command.

import type { SimContext } from './sim_context';
import { dist2d, type Entity, INTERACT_RANGE } from './types';

export type SmokeLevel = 'clear' | 'hazy' | 'full';

const HUNGER_MAX = 100;
const SMOKE_MAX = 100;
const SMOKE_HAZY_AT = 33;
const SMOKE_FULL_AT = 66;

// He drifts back to starving over roughly twenty minutes if never fed, so
// "perpetually hungry" is a real gradient, not a fixed line of dialogue.
const HUNGER_RISE_PER_SEC = HUNGER_MAX / (20 * 60);
// The room clears back to nothing over roughly ten minutes if the furnace
// goes untended, so the loop renews rather than staying maxed forever.
const SMOKE_DECAY_PER_SEC = SMOKE_MAX / (10 * 60);

// You must be standing this close to Greenpaw to feed him (matches the quest
// turn-in NPC-proximity radius, quests/quest_commands.ts questNpcFor).
const FEED_RANGE = INTERACT_RANGE + 2;

interface FeedItemConfig {
  hungerRelief: number;
  smokeGain: number;
  // Greenpaw's in-voice response to this resupply; one is drawn at random
  // through ctx.rng so repeat feeds don't read like a stuck record.
  lines: string[];
}

// "The thing that burns" stokes the furnace (mostly smoke, some relief);
// "the thing that fills" feeds Greenpaw himself (mostly relief, some smoke).
// Both are the same emberbulb / cave_morsel the first-run quests farm
// (hollow.ts); PHAA-421 adds an unconditional (non-quest-gated) loot line for
// each on their source mobs so the resupply loop stays farmable after the
// one-time quest chain completes.
const FEED_ITEMS: Record<string, FeedItemConfig> = {
  emberbulb: {
    hungerRelief: 8,
    smokeGain: 22,
    lines: [
      "now THAT'S fuel... watch her breathe, friend...",
      'the furnace takes it slow and clean, just like she likes it...',
      "stoked and smokin'... the wavelength's openin' up already, i can feel it.",
    ],
  },
  cave_morsel: {
    hungerRelief: 22,
    smokeGain: 8,
    lines: [
      '...oh, bless you, friend. bless you and the ground you walk on.',
      "stomach quits singin' hymns for a minute. much obliged...",
      'a good morsel, is like a good friend... rare, and worth the walk.',
    ],
  },
};

const NO_ITEMS_LINES = [
  "...you're empty-handed, friend. bring me what burns or what fills, and we'll talk.",
  "nothin' on you but good intentions, huh... intentions don't stoke a furnace.",
];

const TOO_FAR_LINE = 'You need to be near Brother Greenpaw to feed him.';

export interface GreenpawHearthInfo {
  smoke: number; // 0..100, rounded (the wire value)
  level: SmokeLevel;
}

// Persistable hearth state (the world_state 'greenpaw_hearth' JSONB blob).
export interface GreenpawHearthSave {
  hunger: number;
  smoke: number;
  // Optional (added PHAA-484): absent in older saves, load() tolerates that.
  lastFeeder?: string | null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function levelFor(smoke: number): SmokeLevel {
  if (smoke >= SMOKE_FULL_AT) return 'full';
  if (smoke >= SMOKE_HAZY_AT) return 'hazy';
  return 'clear';
}

export class GreenpawHearth {
  // He starts already a little hungry: the loop should feel live from a
  // character's first minute in the hub, not need twenty minutes to matter.
  private hunger = HUNGER_MAX * 0.6;
  private smoke = 0;
  // The player who most recently fed him (PHAA-484): PlantSpeech's sustained-
  // smoke lean-in names the keeper who earned the room its haze.
  private lastFeeder: string | null = null;

  constructor(private readonly ctx: SimContext) {}

  // Called once per sim tick (DT seconds), like Market.update().
  update(dt: number): void {
    this.hunger = clamp(this.hunger + HUNGER_RISE_PER_SEC * dt, 0, HUNGER_MAX);
    this.smoke = clamp(this.smoke - SMOKE_DECAY_PER_SEC * dt, 0, SMOKE_MAX);
  }

  get hungerValue(): number {
    return this.hunger;
  }

  get smokeValue(): number {
    return this.smoke;
  }

  get lastFeederName(): string | null {
    return this.lastFeeder;
  }

  info(): GreenpawHearthInfo {
    const smoke = Math.round(this.smoke);
    return { smoke, level: levelFor(smoke) };
  }

  private nearGreenpaw(p: Entity): boolean {
    for (const e of this.ctx.entities.values()) {
      if (e.kind !== 'npc' || e.templateId !== 'brother_greenpaw') continue;
      if (dist2d(p.pos, e.pos) <= FEED_RANGE) return true;
    }
    return false;
  }

  feed(pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e } = r;
    if (e.dead) return;
    if (!this.nearGreenpaw(e)) {
      this.ctx.error(meta.entityId, TOO_FAR_LINE);
      return;
    }
    let fed = false;
    for (const [itemId, cfg] of Object.entries(FEED_ITEMS)) {
      if (this.ctx.countItem(itemId, meta.entityId) < 1) continue;
      this.ctx.removeItem(itemId, 1, meta.entityId);
      fed = true;
      // Feeding matters more when he is actually hungry (a floor of 25% so a
      // feed is never wasted): spam-feeding back to back yields fast-shrinking
      // returns, which is what makes this a loop that renews over time rather
      // than a one-shot smoke-maxing button.
      const hungerFrac = this.hunger / HUNGER_MAX;
      const smokeGain = cfg.smokeGain * (0.25 + 0.75 * hungerFrac);
      this.hunger = clamp(this.hunger - cfg.hungerRelief, 0, HUNGER_MAX);
      this.smoke = clamp(this.smoke + smokeGain, 0, SMOKE_MAX);
      this.ctx.emit({
        type: 'log',
        text: this.ctx.rng.pick(cfg.lines),
        color: '#8dc86a',
        pid: meta.entityId,
      });
    }
    if (fed) {
      this.lastFeeder = meta.name;
      // PHAA-484: credits a 'feed' quest objective (q_the_wavelength), one
      // credit per successful feed() call regardless of how many item types
      // it consumed.
      this.ctx.onGreenpawFedForQuests(meta);
    } else {
      this.ctx.emit({
        type: 'log',
        text: this.ctx.rng.pick(NO_ITEMS_LINES),
        color: '#8dc86a',
        pid: meta.entityId,
      });
    }
  }

  serialize(): GreenpawHearthSave {
    return { hunger: this.hunger, smoke: this.smoke, lastFeeder: this.lastFeeder };
  }

  load(save: GreenpawHearthSave | null | undefined): void {
    if (!save) return;
    if (typeof save.hunger === 'number' && Number.isFinite(save.hunger)) {
      this.hunger = clamp(save.hunger, 0, HUNGER_MAX);
    }
    if (typeof save.smoke === 'number' && Number.isFinite(save.smoke)) {
      this.smoke = clamp(save.smoke, 0, SMOKE_MAX);
    }
    if (typeof save.lastFeeder === 'string' && save.lastFeeder.length > 0) {
      this.lastFeeder = save.lastFeeder;
    }
  }
}
