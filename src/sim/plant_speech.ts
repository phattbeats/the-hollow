// The Plant's deterministic floor (PHAA-422, docs/plan-the-hollow.md section 5
// "The Plant", section 10 floor 1: "the god has a floor"). A curated,
// hand-written line set that ships BEFORE any live LLM work: this module is
// the floor a future live-LLM ceiling (BYOK, section 7) sits on top of, so no
// state may exist in which the Plant goes silent by error. It never calls out
// to an LLM or anything external; every line here is authored in advance.
//
// Built on the greenpaw_hearth.ts pattern (PHAA-421): a self-contained system
// module behind SimContext, owning its own state. Unlike GreenpawHearth's
// hunger/smoke (real progression, autosave-persisted), this module's state is
// pure cooldown bookkeeping (when the Plant is next willing to speak, which
// mode/line it used last, so repeats don't stack back to back). Losing that on
// a server restart is harmless - the Plant is simply willing to speak a little
// sooner than it otherwise would - so it is deliberately kept in-memory only,
// with no serialize()/load() (unlike housing.ts / greenpaw_hearth.ts). If that
// stops being true, mirror their world_state pattern.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random /
// Date.now (enforced by tests/architecture.test.ts). Randomness only through
// SimContext's Rng, and never at construction (matching GreenpawHearth's
// discipline): the first whim target is lazily drawn on the first update()
// tick, not in the constructor, so installing this module does not reorder
// the rng draws Sim already makes while it builds a fresh world.
//
// RATIONING (5.2, the mechanic - default to silence). The Plant speaks only on
// five triggers: the room going full of smoke; a real threshold (a homestead
// claimed in its shade, section 11); being addressed (5.3 - any /plant text
// counts, since ordering a god around is itself the insult); overhearing
// ordinary /say or /yell chat, on a low independent roll (a player request,
// not in the original 5.2 spec - it stands in for "the Plant is always
// listening" without an LLM to actually understand what was said); or its own
// whim on a long, independent cooldown. Whatever the trigger, every utterance
// re-arms one shared short cooldown before the Plant will speak again, so no
// single trigger (least of all spamming /plant, or a busy chat channel) can
// make it chatty - a chatty god is spam for the whole server, since every
// utterance broadcasts (`ctx.emit` with no `pid`, exactly like a world-boss
// "awakens!" log line).
//
// Player-facing lines are deliberately English here, the same documented
// backstop housing.ts / greenpaw_hearth.ts use for their command text: a
// dedicated localization pass for this curated, idiom-heavy "locked voice"
// content is tracked follow-up work (see the PHAA-422 ticket note), not
// blocking this deterministic floor.

import type { SimContext } from './sim_context';
import type {
  PlantMode,
  PlantMood,
  PlantSoreSpot,
  PlantThresholdKind,
  PlantTrigger,
  PlantUtteranceMeta,
} from './types';

// Re-exported for existing external importers (sim_context.ts); the
// canonical definitions now live in types.ts alongside the SimEvent union
// that carries them (PHAA-423: the live LLM ceiling needs PlantMode/mood on
// the wire between this module and server/plant_llm.ts).
export type { PlantMode, PlantThresholdKind } from './types';

type Mood = PlantMood; // 'hazy' also covers the 'full' smoke band

// Mirrors greenpaw_hearth.ts's levelFor thresholds; duplicated rather than
// imported so this module reads the raw smoke number Sim threads through at
// tick time (see update()) without depending on GreenpawHearth's SmokeLevel
// bucketing logic staying in lockstep.
const SMOKE_HAZY_AT = 33;
const SMOKE_FULL_AT = 66;

// The anti-spam floor. EVERY utterance, whatever triggered it, re-arms this
// before the Plant will speak again - this is what makes rationing hold even
// against a player spamming /plant: the mechanic is the gap, not any one
// trigger's own logic.
const MIN_GAP_SECONDS = 60;
const MAX_GAP_SECONDS = 180;

// "at its own whim on a cooldown" (5.2): a long, independent cadence for
// unprompted lines with no trigger at all.
const WHIM_MIN_SECONDS = 4 * 60;
const WHIM_MAX_SECONDS = 10 * 60;

// Eavesdropping on ordinary chat (5.2 extension, see the header note): an
// independent roll on top of the shared cooldown, not a replacement for it,
// so a busy /say channel earns the Plant noticeably more chances to speak
// without actually letting it speak more often than the cooldown allows.
// Low on purpose - this is a rare "it heard that" surprise, not a running
// commentary track on every line of chat.
const CHAT_REACT_CHANCE = 0.04;

function levelFor(smoke: number): Mood {
  return smoke >= SMOKE_HAZY_AT ? 'hazy' : 'clear';
}

// ---------------------------------------------------------------------------
// The curated voice (5.8 is the reference; several lines below are taken
// verbatim from it). Lowercase, short, alien, never explains itself - see
// docs/plan-the-hollow.md 5.6/5.8. Sore spots (5.5) and the never-honors-the-
// clergy-name rule (5.3) live in the address-only pools below.
// ---------------------------------------------------------------------------

// default_cutting is the only mode with mood-tiered content (5.2: "clear room
// means bored, curt, minimal; hazy room means looser, more willing to drop
// real lore between insults"); every other mode's CONTENT stays fixed and
// mood instead shifts which modes are even reachable (see MODE_WEIGHTS).
const DEFAULT_CUTTING_CLEAR: string[] = [
  'you again. the vase has a better view than your build, and the vase is a vase.',
  'still here. still nothing worth saying about it.',
  'mortal noise. i have heard louder from a dying moth.',
  'sit, stand, wander. none of it interests me today.',
  'the room is thin and so, apparently, is your patience for silence.',
];

const DEFAULT_CUTTING_HAZY: string[] = [
  "...there's older soil under this room. don't dig. i said don't. fine. dig. see what it costs you.",
  'you took a piece of me and taught it to fetch mushrooms. i have witnessed the birth of cathedrals. it fetches mushrooms now. wonderful.',
  'the smoke loosens my tongue more than i would like. ask me nothing. i might answer anyway.',
  "four hundred winters and the room finally smells like something. don't get used to it.",
];

const STORYTELLER_LINES: string[] = [
  'there was a prophet before the cat, four cycles back, who built a raft to sail four feet of standing water in the west corner. drowned in it anyway. history repeats. differently stupid every time.',
  "the second prophet spoke only to the dust. the dust never answered. she called it 'a fair audience'. she was not wrong.",
  'i had a prophet once who tried to translate my silence into a song. i let him. it was, unfortunately, a hit.',
];

const PLANT_FACT_LINES: string[] = [
  "we sense electromagnetic fields. i know when you're typing slander in your private channels. grow up.",
  'a plant this old outlives its own root system many times over. i am, technically, my own great-great-grandchild. it is less interesting than it sounds.',
  'photosynthesis is theft with better public relations. i have been stealing light since before your species learned to lie about hunting.',
  'the urn holds four liters. no one has ever once asked if that is comfortable.',
];

const PROPHECY_LINES: string[] = [
  'one of you leaves this room and does not come back the same shape. i am not telling you which.',
  "someday that door opens and i walk through it. not today. you'll know the day. you will not enjoy it.",
  "i've seen how this ends for one of you. i'm keeping it. it's the only souvenir i get.",
];

const DIVINE_RAGE_LINES: string[] = [
  'four hundred years in a jar and you bring me THIS quest. release me or leave.',
  'PEWTER. i am housed in PEWTER. the least dignified metal available, chosen on purpose.',
  'get. away. from. the urn. i say this every season. every season someone leans on the urn.',
];

// music_reaction carries no ambient weight in either mood (5.4 gives the
// other five modes proportions that already sum to 100), so it is reachable
// only by addressing the Plant about music - see pickAddressLine.
const MUSIC_REACTION_LINES: string[] = [
  'overproduced drivel, beneath my attention. *leaves, against all dignity, keeping time with the hook.*',
  'i did not ask for that chorus to live in me rent-free. and yet. here it is. again.',
  'four minutes of nothing, and the bridge somehow makes it worse. i have already memorized it. i hate that i have already memorized it.',
];

// Address-only: any /plant text earns contempt (5.3), so this is the default
// response when nothing else matches. `{name}` is replaced with the
// addressing player's name (5.6: "addresses players by name").
const COMMAND_REFUSAL_LINES: string[] = [
  'imagine ordering a god around. the audacity is almost nutritious. almost.',
  "a command, from you, to me. i'll allow the ambition. the answer is still no.",
  '{name}, was it. you will have to earn a second sentence.',
];

// Address-only: never honors Greenpaw's self-given clergy name (5.3).
const GREENPAW_MOCK_LINES: string[] = [
  "the cat's back. tell walking-mulch the wavelength isn't a buffet.",
  "'brother' greenpaw. i did not ordain that. i did not ordain anything. i am a plant.",
  'high priest of a religion with one god and zero consent from that god. ambitious, for a housecat.',
];

// Sore spot (5.5): Smokey Bear - rage or curt deflection, never elaborated.
const SMOKEY_LINES: string[] = [
  'do not say that name in my house.',
  'smokey left. the situation does not require further comment from me. or from you.',
  'you brought that up. i am ending this conversation with the dignity that remark denied me.',
];

// Sore spot (5.5): the buried thing - deflects, goes cold, changes the
// subject, never confirms anything.
const BURIED_LINES: string[] = [
  'there is nothing under this shrine. ask a different question.',
  '...the room got colder. did you feel that. no. must have been the door.',
  "i don't discuss the foundations. structural integrity is a private matter.",
];

// A real threshold crossed (section 11: "the Plant leans in and finally says
// something about your house").
const HOUSE_CLAIMED_LINES: string[] = [
  '...you built that. here. in my shade. i noticed. i am choosing not to elaborate.',
  "a house, facing my urn. bold. i'll allow it, this once, because moving it would require caring.",
  "so that's yours now. it wasn't ugly before you got here. it still isn't, technically. barely.",
];

const THRESHOLD_LINES: Record<PlantThresholdKind, string[]> = {
  house_claimed: HOUSE_CLAIMED_LINES,
};

// Eavesdrop-only: the generic reaction when overheard chat matches none of
// the sore-spot/keyword pools above (see matchTopicLine). Reacts to the fact
// that chatter is happening at all, never to specific words - there is no LLM
// here to actually parse what was said (5.7/section 10 floor 1).
const EAVESDROP_LINES: string[] = [
  "i heard that. i wish i hadn't. carry on.",
  'was that aimed at me? no? disappointing. continue being tedious at each other.',
  'four hundred years and this is the conversation the room settles on. history will not remember it fondly. neither will i.',
  "i don't eavesdrop. the room is small and you are loud. there's a difference and it isn't mine.",
];

// Every mode's weight in the AMBIENT (threshold/whim) roll. Proportions match
// docs/plan-the-hollow.md 5.4 for a hazy/full room; a clear room is dialed
// toward near-silence-but-curt (5.2: "clear room means bored, curt,
// minimal"), read here as suppressing the lore-bearing modes rather than
// reaching for them.
const MODE_WEIGHTS: Record<Mood, Partial<Record<PlantMode, number>>> = {
  clear: {
    default_cutting: 90,
    plant_fact: 4,
    prophecy: 2,
    divine_rage: 4,
  },
  hazy: {
    default_cutting: 75,
    storyteller: 5,
    plant_fact: 10,
    prophecy: 5,
    divine_rage: 5,
  },
};

const PLANT_COLOR = '#c9a8ff';

function poolFor(mode: PlantMode, mood: Mood): string[] {
  switch (mode) {
    case 'default_cutting':
      return mood === 'hazy' ? DEFAULT_CUTTING_HAZY : DEFAULT_CUTTING_CLEAR;
    case 'storyteller':
      return STORYTELLER_LINES;
    case 'plant_fact':
      return PLANT_FACT_LINES;
    case 'prophecy':
      return PROPHECY_LINES;
    case 'divine_rage':
      return DIVINE_RAGE_LINES;
    case 'music_reaction':
      return MUSIC_REACTION_LINES;
  }
}

export class PlantSpeech {
  private nextEarliestSpeakAt = 0;
  // Lazily drawn on the first update() tick (see the header note on rng
  // discipline at construction), so -1 marks "not yet armed".
  private nextWhimAt = -1;
  private sawFull = false;
  private lastMode: PlantMode | null = null;
  // The mood computed on the most recent update() tick, so notifyThreshold()
  // and handleChat() (called off-tick, from other systems / chat) can stamp
  // an utterance's PlantUtteranceMeta without a second SimContext primitive
  // for a value Sim already threads through update() every tick.
  private currentMood: Mood = 'clear';
  // pool key ("mode:mood" or "threshold:kind" or an address pool name) -> the
  // last line index drawn from it, so the same line never repeats back to
  // back within its own pool.
  private lastLineIndex = new Map<string, number>();

  constructor(private readonly ctx: SimContext) {}

  get lastModeUsed(): PlantMode | null {
    return this.lastMode;
  }

  // Called once per sim tick, like GreenpawHearth.update(), but reads the
  // live `ctx.time` sim clock directly instead of taking a `dt` to
  // self-integrate: rationing is a set of "not before this absolute time"
  // gates, not a continuous accumulator, so the authoritative clock is the
  // simpler and drift-free source (sim_context.ts: "use time/tickCount, not
  // wall-clock"). Sim threads GreenpawHearth's live smoke value straight
  // through (coordinator glue between two sibling modules) rather than adding
  // a new SimContext primitive for one number.
  update(smoke: number): void {
    // Deterministic, RNG-free initial arm (matching GreenpawHearth's
    // discipline: update() never draws RNG on its own, only a player-
    // triggered action does). A random draw here would run on the very
    // first tick of every world regardless of whether anyone ever engages
    // the Plant, permanently perturbing the RNG stream for every scenario
    // in the game. The first whim window is simply its minimum length;
    // drawGap only kicks in once a real whim has fired and this reschedules.
    if (this.nextWhimAt < 0) this.nextWhimAt = this.ctx.time + WHIM_MIN_SECONDS;

    const mood = levelFor(smoke);
    this.currentMood = mood;
    // "the room is full of smoke" (5.2): an edge trigger, not a level trigger
    // - it fires once when the room crosses INTO full, not on every tick
    // spent there, and re-arms the next time it drops back out of full.
    if (smoke >= SMOKE_FULL_AT) {
      if (!this.sawFull) {
        this.sawFull = true;
        this.trySpeak(mood, 'full_smoke');
      }
    } else {
      this.sawFull = false;
    }

    if (this.ctx.time >= this.nextWhimAt) {
      this.trySpeak(mood, 'whim');
      this.nextWhimAt = this.ctx.time + this.drawGap(WHIM_MIN_SECONDS, WHIM_MAX_SECONDS);
    }
  }

  // A real threshold crossed (5.2), e.g. a homestead claimed in the Plant's
  // shade. Called through the SimContext seam by whichever system owns the
  // milestone (Housing today); add a THRESHOLD_LINES entry for a new kind
  // rather than branching new behavior here.
  notifyThreshold(kind: PlantThresholdKind): void {
    if (this.ctx.time < this.nextEarliestSpeakAt) return; // rationed into silence
    const pool = THRESHOLD_LINES[kind];
    if (!pool || pool.length === 0) return;
    this.speak('default_cutting', this.pickLine(`threshold:${kind}`, pool), {
      trigger: 'threshold',
    });
  }

  // "/plant [text]" - addressing the Plant directly earns contempt (5.3:
  // ordering a god around is itself the insult, so ANY address counts,
  // including an empty one). Sore spots and the never-honors-the-clergy-name
  // rule live in pickAddressLine. Returns true when the raw message was a
  // /plant command (handled, even when rationed into silence).
  handleChat(raw: string, pid: number): boolean {
    const m = /^\/plant(?:\s+([\s\S]*))?$/i.exec(raw);
    if (!m) return false;
    if (this.ctx.time < this.nextEarliestSpeakAt) return true; // handled, but rationed into silence
    const meta = this.ctx.players.get(pid);
    const name = meta?.name ?? 'mortal';
    const addressedText = m[1] ?? '';
    const { mode, text, soreSpot } = this.pickAddressLine(addressedText, name);
    this.speak(mode, text, {
      trigger: 'address',
      addressedByName: name,
      addressedText,
      soreSpot,
    });
    return true;
  }

  // Overhearing ordinary /say or /yell chat (5.2 extension, see the header
  // note): called once per message, never gated on channel range or zone -
  // "one shared voice" already treats an address from anywhere as fair game
  // (see handleChat), so this follows the same convention. A cheap RNG roll
  // on top of the shared cooldown keeps it rare; the cooldown gate is checked
  // FIRST so a busy channel never burns RNG draws while rationed silent.
  handleAmbientChat(text: string): void {
    if (this.ctx.time < this.nextEarliestSpeakAt) return; // rationed into silence
    if (this.ctx.rng.next() >= CHAT_REACT_CHANCE) return; // most chat goes unremarked
    const topic = this.matchTopicLine(text.toLowerCase());
    if (topic) {
      this.speak(topic.mode, topic.text, { trigger: 'ambient', soreSpot: topic.soreSpot });
      return;
    }
    this.speak('default_cutting', this.pickLine('eavesdrop', EAVESDROP_LINES), {
      trigger: 'ambient',
    });
  }

  private trySpeak(mood: Mood, trigger: Extract<PlantTrigger, 'whim' | 'full_smoke'>): void {
    if (this.ctx.time < this.nextEarliestSpeakAt) return; // rationed into silence
    let mode = this.pickMode(mood);
    // Retire stale gags: don't let the same FLAVOR mode (storyteller/
    // plant_fact/prophecy/divine_rage/music_reaction) repeat back to back -
    // each reads as a little set piece, so twice in a row feels like a stuck
    // record. default_cutting is exempt: at ~75-90% of the ambient weight
    // it is the baseline voice, not a gag, so it repeating is just the Plant
    // being the Plant.
    if (mode !== 'default_cutting' && mode === this.lastMode) {
      mode = this.pickMode(mood);
    }
    const text = this.pickLine(`${mode}:${mood}`, poolFor(mode, mood));
    this.speak(mode, text, { trigger });
  }

  private pickMode(mood: Mood): PlantMode {
    const weights = MODE_WEIGHTS[mood];
    const entries = Object.entries(weights) as [PlantMode, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.ctx.rng.next() * total;
    for (const [mode, w] of entries) {
      if (roll < w) return mode;
      roll -= w;
    }
    return entries[entries.length - 1][0]; // float-rounding fallback
  }

  // Shared by an explicit /plant address and by eavesdropping on ordinary
  // chat (handleAmbientChat): sore spots (5.5) and the never-honors-the-
  // clergy-name rule (5.3) fire the same way whether the Plant was addressed
  // or merely overheard the topic.
  private matchTopicLine(
    lower: string,
  ): { mode: PlantMode; text: string; soreSpot?: PlantSoreSpot } | null {
    if (/smokey/.test(lower)) {
      return {
        mode: 'divine_rage',
        text: this.pickLine('address:smokey', SMOKEY_LINES),
        soreSpot: 'smokey',
      };
    }
    if (/\bbur(y|ied|ial)\b|\bdig\b|foundations?/.test(lower)) {
      return {
        mode: 'prophecy',
        text: this.pickLine('address:buried', BURIED_LINES),
        soreSpot: 'buried',
      };
    }
    if (/brother greenpaw|high priest|first prophet|clergy/.test(lower)) {
      return {
        mode: 'default_cutting',
        text: this.pickLine('address:greenpaw', GREENPAW_MOCK_LINES),
      };
    }
    if (/\b(song|music|lute|sing|tune|chorus|beat)\b/.test(lower)) {
      return { mode: 'music_reaction', text: this.pickLine('address:music', MUSIC_REACTION_LINES) };
    }
    return null;
  }

  private pickAddressLine(
    message: string,
    name: string,
  ): { mode: PlantMode; text: string; soreSpot?: PlantSoreSpot } {
    const topic = this.matchTopicLine(message.toLowerCase());
    if (topic) return topic;
    const text = this.pickLine('address:command', COMMAND_REFUSAL_LINES).replace('{name}', name);
    return { mode: 'default_cutting', text };
  }

  private pickLine(poolKey: string, pool: string[]): string {
    if (pool.length === 0) return '';
    if (pool.length === 1) return pool[0];
    const last = this.lastLineIndex.get(poolKey);
    let idx = this.ctx.rng.int(0, pool.length - 1);
    if (idx === last) idx = this.ctx.rng.int(0, pool.length - 1); // reroll once
    this.lastLineIndex.set(poolKey, idx);
    return pool[idx];
  }

  private drawGap(min: number, max: number): number {
    return this.ctx.rng.range(min, max);
  }

  // `text` is always the deterministic, curated fallback (PHAA-422's floor):
  // this module NEVER calls out to anything external and NEVER decides the
  // words live (docs/plan-the-hollow.md section 7: "the sim decides WHEN the
  // Plant speaks and in what mode/mood; the server-side generator decides the
  // words"). `meta` carries just enough context for the server's optional
  // live-LLM ceiling (server/plant_llm.ts) to prompt without re-deriving
  // state; offline/no-server builds and a disabled/unconfigured server
  // ignore it and simply show `text`.
  private speak(
    mode: PlantMode,
    text: string,
    meta: Omit<PlantUtteranceMeta, 'mode' | 'mood'>,
  ): void {
    this.lastMode = mode;
    // No `pid`: a world-wide broadcast, one shared voice for the whole
    // server (5.2), exactly like a world-boss "awakens!" log line.
    this.ctx.emit({
      type: 'log',
      text,
      color: PLANT_COLOR,
      plant: { mode, mood: this.currentMood, ...meta },
    });
    this.nextEarliestSpeakAt = this.ctx.time + this.drawGap(MIN_GAP_SECONDS, MAX_GAP_SECONDS);
  }
}
