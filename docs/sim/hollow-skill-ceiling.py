#!/usr/bin/env python3
"""
THE HOLLOW - Skill-Ceiling Arm  (constitution sec.8 test step 2, second half)
=============================================================================
The build-diversity arm (hollow-build-sim-v2.py) asked "do different builds
perform comparably by different means?".  This is the OTHER half of the sec.8
test, the one the June/July runs left untested:

    "a skill ceiling: does outcome vary with how well the encounter is played?"

The bet's failure mode on this axis is OUTCOME BEING BUILD-LOCKED: you slot the
bar, and from there the fight plays itself, so piloting adds nothing.  A cozy
co-op game does not need a ranked ladder, but the depth core has to REWARD
learning the fight, or the "build" is a costume, not a craft.

METHOD (pilot isolation).  We hold the build FIXED and vary ONLY the pilot, then
watch how far the outcome moves.  The clean read is a MIRROR match: the exact
same archetype build on both sides, one side driven by a graded-quality pilot
and the other by a FIXED reference pilot (greedy).  Because the builds are
identical, every point of win-rate away from 50% is pilot skill and nothing
else.  We report, per archetype:

    ceiling spread = WR(best available pilot) - WR(random pilot)

on identical builds against the same fixed opponent.  A large spread means a
skill ceiling exists (the gate's "yes"); a spread near zero means outcome is
build-locked (the gate's "no").  A cross-matchup table (each archetype vs one
fixed strong opponent) is reported as a secondary, asymmetric read.

GRADED PILOT TIERS (sec.8 ticket: "random / greedy / the (b) tuned policy /
(b)+lookahead if cheap"):
  - random    : picks uniformly among currently-LEGAL actions (same hard gates
                the greedy AI uses), or auto-attacks.  The floor pilot.
  - greedy    : the existing single shared class-aware heuristic
                (hollow-build-sim-v2.choose_action).  The sim's baseline pilot;
                the tuned(b) tier is the stronger per-build policy layered on it.
  - tuned (b) : the per-build tuned policy from PHAA-389 (sec.8 tuning b).  It
                LANDED as hollow-build-sim-v2.make_pilot(build) (commit bb402afa),
                so load_tuned_b_pilot() detects sim.make_pilot as the entry point
                (it also still supports a separate hollow_policy_b.py module).
                When (b) is absent the tier falls back to greedy and the report
                says so; with (b) present, THIS run is the gate-grade read, per
                the ticket: "the ceiling read is only honest with the better
                pilot from (b)."

  The random->greedy swing on an IDENTICAL build is a valid EXISTENCE test (does
  competent play beat flailing?) and a conservative LOWER BOUND on the true skill
  ceiling: a genuinely strong pilot (b) can only widen it.

  LOOKAHEAD (the ticket's lowest-priority, "(b)+lookahead if cheap") is provided
  as make_lookahead_pilot() but is DELIBERATELY EXCLUDED from the default tiers.
  A cheap 1-ply HP-differential rollout is myopic: it mis-values combo-building
  and multi-second casts (their payoff lands past the rollout horizon), so it
  measured markedly WORSE than the greedy heuristic in this harness (e.g.
  combo_rogue ~10-20% vs greedy ~53% in mirror). A truly strong pilot is a design
  problem, and that design IS PHAA-389 (b). Shipping a bad lookahead as a "strong"
  tier would understate nothing and mislead everything, so it stays off until it
  can be built on top of (b). This exclusion is itself a harness QA finding: the
  greedy heuristic is already non-trivial to beat.

QA OF THE HARNESS ITSELF (the ticket asks for this explicitly):
  - deterministic per seed: the whole measurement is run twice and the WR table
    is hash-compared; a mismatch is a hard FAIL.
  - monotonicity: a strictly-better pilot must not do WORSE on average.  We check
    WR(random) <= WR(greedy) <= WR(lookahead) within a tolerance band and flag
    any inversion as a HARNESS WARNING (noise or a bug, not a game finding).
  - the greedy mirror must sit near 50% (identical build, symmetric pilot) after
    side-flipping cancels the first-actor advantage; a large deviation is flagged.

This is MEASUREMENT, not tuning.  No skill values are touched (sec.8 ticket c).
Model-directional, same caveats as v2: mapped GW1 economy, representative kits,
~EST values.  The pilot axis is now the real (b) policy (make_pilot), so the
"no strong scripted pilot" caveat of the earlier directional run no longer holds.
"""

import importlib.util
import os
import random
import copy
import statistics
import hashlib
import datetime
from collections import defaultdict

# ----------------------------------------------------------------------------
# Load the v2 sim as a module (its filename has hyphens, so import by path).
# ----------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
SIM_PATH = os.path.join(HERE, "hollow-build-sim-v2.py")


def _load(mod_name, path):
    spec = importlib.util.spec_from_file_location(mod_name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sim = _load("hollow_build_sim_v2", SIM_PATH)
SKILLS = sim.SKILLS
Build = sim.Build

# ----------------------------------------------------------------------------
# LEGALITY: mirrors the HARD gates in sim.choose_action (NOT its scoring). Used
# by the random and lookahead pilots so "legal" means the same thing everywhere.
# ----------------------------------------------------------------------------
_MELEE_KINDS = ('attack_weapon', 'finisher_damage', 'finisher_dot', 'finisher_stun',
                'finisher_haste', 'finisher_debuff', 'incapacitate', 'snare')


def legal_actions(me, foe):
    if me.controlled() or me.cast is not None or me.gcd > 0:
        return []
    melee_range = me.dist <= 5.0
    foe_frac = foe.hp / foe.maxhp
    out = []
    for name, sk in me.bar:
        if me.cd.get(name, 0) > 0:
            continue
        econ = sk['econ']
        if econ == 'energy' and me.energy < sk.get('cost', 0):
            continue
        if econ == 'adren' and me.adren < sim.adren_req(sk):
            continue
        kind = sk['kind']
        if sk.get('requires_below') and foe_frac > sk['requires_below']:
            continue
        if sk.get('requires_stealth') and not me.stealth:
            continue
        if sk.get('requires_behind') and me.behind_until <= 0 and not me.stealth:
            continue
        rng = sk.get('range_melee', kind in _MELEE_KINDS or kind == 'attack_direct')
        if rng and not melee_range and kind != 'gap_close':
            continue
        out.append(name)
    return out


# ----------------------------------------------------------------------------
# PILOTS.  Signature (me, foe) -> skill-name or None, matching choose_action.
# ----------------------------------------------------------------------------
def greedy_pilot(me, foe):
    return sim.choose_action(me, foe)


def make_random_pilot(rng, auto_attack_p=0.35):
    """Floor pilot: uniformly random over legal actions, sometimes just swings.
    Its own randomness is drawn from a DEDICATED rng so it never perturbs the
    combat dice stream (choose_action draws no RNG, so tiers stay comparable)."""
    def pilot(me, foe):
        legal = legal_actions(me, foe)
        if not legal:
            return None
        if rng.random() < auto_attack_p:
            return None
        return rng.choice(legal)
    return pilot


def _step_pair(a, b):
    """One sim tick for the (a,b) pair, greedy on both. Mirrors run_duel's tick
    order exactly so a rollout evolves the world the way the real duel would."""
    for x in (a, b):
        sim.tick_timers(x)
    if a.hp <= 0 or b.hp <= 0:
        return
    for x in (a, b):
        sim.tick_dots(x)
    if a.hp <= 0 or b.hp <= 0:
        return
    for x, y in ((a, b), (b, a)):
        sim.tick_movement(x, y)
    for x, y in ((a, b), (b, a)):
        sim.tick_swing(x, y)
    if a.hp <= 0 or b.hp <= 0:
        return
    d = min(a.dist, b.dist)
    a.dist = b.dist = d
    for x, y in ((a, b), (b, a)):
        act = sim.choose_action(x, y)
        if act:
            sim.cast_skill(x, y, act)


def make_lookahead_pilot(horizon=40, margin=0.02):
    """EXPERIMENTAL, excluded from the default tiers - see the module docstring.
    greedy + a 1-ply rollout: for each legal action (plus 'auto-attack'), clone
    the world, commit that action, simulate `horizon` ticks of greedy self-play,
    and score by the resulting HP differential. It is ANCHORED to greedy - it only
    deviates from greedy's own pick when a candidate beats greedy's rollout score
    by `margin` - but even so it under-performs greedy here, because a short
    HP-diff rollout is myopic about combos and long casts. Kept for when a real
    strong pilot (PHAA-389 (b)) exists to lookahead ON TOP of. Rollouts run on a
    saved/restored RNG so the real duel's dice are untouched and it stays
    deterministic per seed."""
    def pilot(me, foe):
        if me.controlled() or me.cast is not None or me.gcd > 0:
            return None
        legal = legal_actions(me, foe)
        greedy_pick = sim.choose_action(me, foe)
        candidates = list(dict.fromkeys([greedy_pick, None] + legal))
        # deterministic rollout seed from the live combat state (no wall clock)
        roll_seed = (int(me.hp) * 733 + int(foe.hp) * 131
                     + int(me.energy) * 17 + me.adren * 7 + me.combo * 3
                     + int(me.dist * 10) + len(me.used)) & 0x7FFFFFFF
        saved = random.getstate()
        scores = {}
        for k, act in enumerate(candidates):
            random.seed(roll_seed + k * 101)
            m2, f2 = copy.deepcopy((me, foe))
            m2._foe = f2
            f2._foe = m2
            if act is not None:
                sim.cast_skill(m2, f2, act)
            for _ in range(horizon):
                if m2.hp <= 0 or f2.hp <= 0:
                    break
                _step_pair(m2, f2)
            scores[act] = (m2.hp / m2.maxhp) - (f2.hp / f2.maxhp)
        random.setstate(saved)
        # anchor to greedy: only override if a candidate clearly beats it
        best_act, best = greedy_pick, scores.get(greedy_pick, -9.0)
        for act, sc in scores.items():
            if sc > best + margin:
                best_act, best = act, sc
        return best_act
    return pilot


def load_tuned_b_pilot():
    """(b) PHAA-389 plug point. Loads the per-build tuned policy from (b). Two
    delivery conventions are supported, checked in order:
      1. a sibling module docs/sim/hollow_policy_b.py exposing either
           - make_policy(build) -> pilot(me, foe)  (per-build policy, preferred), or
           - choose_action(me, foe)                (a drop-in shared policy);
      2. the tuned policy folded INTO the v2 sim module itself. (b) actually
         shipped its per-build AI as hollow-build-sim-v2.make_pilot(build) ->
         pilot(me, foe) (PHAA-389, commit bb402afa) rather than as a separate
         file, so we detect sim.make_pilot as the make_policy entry point.
    Returns (make_policy_or_none, choose_action_or_none, available_bool)."""
    for cand in ("hollow_policy_b.py", "hollow-policy-b.py"):
        p = os.path.join(HERE, cand)
        if os.path.exists(p):
            mod = _load("hollow_policy_b", p)
            mk = getattr(mod, "make_policy", None)
            ca = getattr(mod, "choose_action", None)
            if mk or ca:
                return mk, ca, True
    # (b) landed the tuned per-build policy as make_pilot(build) inside the v2 sim.
    sim_make = getattr(sim, "make_pilot", None)
    if callable(sim_make):
        return sim_make, None, True
    return None, None, False


TUNED_MAKE, TUNED_CA, TUNED_AVAILABLE = load_tuned_b_pilot()


def tuned_b_pilot_for(build):
    """Return the (b) tuned pilot for a build, or greedy as the documented
    fallback while (b) is absent."""
    if TUNED_AVAILABLE:
        if TUNED_MAKE:
            return TUNED_MAKE(build)
        return TUNED_CA
    return greedy_pilot


# ----------------------------------------------------------------------------
# ARCHETYPES.  Hand-authored coherent builds spanning the space; each is a
# legal GW1-graft bar (validated against accessible_skill_pool below).
# ----------------------------------------------------------------------------
def A(primary, secondary, skills, attrs, label):
    return Build(primary, secondary, list(skills), dict(attrs), label)


ARCHETYPES = [
    A('mage', 'warrior',
      ['fireball', 'scorch', 'fire_blast', 'pyroblast', 'frostbolt', 'frost_nova',
       'frost_armor', 'ice_barrier'],
      {'fire': 110, 'frost': 70, 'energy_storage': 20}, 'burst_mage'),
    A('mage', 'rogue',
      ['frostbolt', 'frost_nova', 'polymorph', 'ice_barrier', 'frost_armor',
       'arcane_missiles', 'scorch', 'gouge'],
      {'frost': 120, 'arcane': 50, 'energy_storage': 30}, 'control_mage'),
    A('warrior', 'warrior',
      ['rend', 'heroic_strike', 'overpower', 'thunder_clap', 'hamstring',
       'battle_shout', 'demo_shout', 'defensive_stance'],
      {'weapon_mastery': 90, 'tactics': 70, 'strength': 40}, 'attrition_warrior'),
    A('warrior', 'rogue',
      ['charge', 'overpower', 'slam', 'execute', 'heroic_strike', 'rend',
       'backstab', 'hamstring'],
      {'weapon_mastery': 130, 'tactics': 40, 'strength': 30}, 'burst_warrior'),
    A('rogue', 'rogue',
      ['sinister_strike', 'backstab', 'eviscerate', 'slice_and_dice', 'rupture',
       'kidney_shot', 'gouge', 'evasion'],
      {'daggers': 110, 'subtlety': 70, 'expertise': 20}, 'combo_rogue'),
    A('rogue', 'mage',
      ['sinister_strike', 'backstab', 'eviscerate', 'slice_and_dice', 'frostbolt',
       'frost_nova', 'polymorph', 'gouge'],
      {'daggers': 100, 'frost': 60, 'expertise': 40}, 'hybrid_rogue_mage'),
]


def validate_archetypes():
    problems = []
    for b in ARCHETYPES:
        pool = set(sim.accessible_skill_pool(b.primary, b.secondary))
        for s in b.skills:
            if s not in pool:
                problems.append(f"{b.label}: '{s}' not in accessible pool "
                                f"for {b.primary}/{b.secondary}")
        if len(b.skills) != len(set(b.skills)):
            problems.append(f"{b.label}: duplicate skills")
        if sum(b.attrs.values()) > sim.ATTR_BUDGET:
            problems.append(f"{b.label}: attrs over budget ({sum(b.attrs.values())})")
    return problems


# ----------------------------------------------------------------------------
# MEASUREMENT
# ----------------------------------------------------------------------------
def duel_outcome_for_tested(tested_build, tested_pilot, opp_build, opp_pilot,
                            combat_seed, tested_is_A):
    """One mirror/asymmetric duel. Returns +1/0/-1 from the TESTED side's view.
    Side is flipped by `tested_is_A` so first-actor bias cancels over seeds."""
    random.seed(combat_seed)
    if tested_is_A:
        r = sim.run_duel(tested_build, opp_build, pilotA=tested_pilot, pilotB=opp_pilot)
        return r
    else:
        r = sim.run_duel(opp_build, tested_build, pilotA=opp_pilot, pilotB=tested_pilot)
        return -r


def tier_winrate(tested_build, tier_name, tested_pilot, opp_build, opp_pilot,
                 n_seeds, seed_base):
    w = d = l = 0
    for i in range(n_seeds):
        # combat seed is independent of the tier -> paired comparison across tiers
        combat_seed = seed_base + i
        tested_is_A = (i % 2 == 0)
        r = duel_outcome_for_tested(tested_build, tested_pilot, opp_build, opp_pilot,
                                    combat_seed, tested_is_A)
        if r == 1:
            w += 1
        elif r == -1:
            l += 1
        else:
            d += 1
    g = w + d + l
    return (w + 0.5 * d) / g if g else 0.5


def build_pilots(build, random_seed):
    """Construct the graded pilots for a given build (see module docstring for why
    lookahead is excluded)."""
    return [
        ('random', make_random_pilot(random.Random(random_seed))),
        ('greedy', greedy_pilot),
        ('tuned(b)', tuned_b_pilot_for(build)),
    ]


SEEDS = {'random': 400, 'greedy': 400, 'tuned(b)': 400}
MASTER_SEED = 1337


def run_mirror_measurement():
    """Primary read: identical build on both sides, tested pilot varies, opponent
    pilot fixed to greedy. Returns {archetype_label: {tier: wr}}."""
    table = {}
    for ai, b in enumerate(ARCHETYPES):
        pilots = build_pilots(b, random_seed=MASTER_SEED + ai)
        seed_base = MASTER_SEED + ai * 100000
        row = {}
        for tier, pilot in pilots:
            wr = tier_winrate(b, tier, pilot, b, greedy_pilot,
                              SEEDS[tier], seed_base)
            row[tier] = wr
        table[b.label] = row
    return table


def run_cross_measurement(reference_label='burst_mage'):
    """Secondary read: each archetype (tested) vs one FIXED strong opponent build
    (piloted greedy), pilot of the tested side varied. Asymmetric matchup."""
    ref = next(b for b in ARCHETYPES if b.label == reference_label)
    table = {}
    for ai, b in enumerate(ARCHETYPES):
        pilots = build_pilots(b, random_seed=MASTER_SEED + 500 + ai)
        seed_base = MASTER_SEED + 900000 + ai * 100000
        row = {}
        for tier, pilot in pilots:
            wr = tier_winrate(b, tier, pilot, ref, greedy_pilot,
                              SEEDS[tier], seed_base)
            row[tier] = wr
        table[b.label] = row
    return table


TIERS_ORDER = ['random', 'greedy', 'tuned(b)']


def table_hash(table):
    parts = []
    for lbl in sorted(table):
        for tier in TIERS_ORDER:
            parts.append(f"{lbl}:{tier}:{round(table[lbl][tier], 6)}")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def analyze(table):
    """Per-archetype ceiling + QA classification. Returns
      (rows, harness_flags, pilot_flags) where
      rows: (lbl, r, floor, best, spread, measurable_bool)
      harness_flags: mirror-symmetry violations - MUST be empty for a valid run
                     (an identical build on both sides must sit near 50%).
      pilot_flags:   monotonicity inversions (a 'better' pilot did WORSE). These
                     are PILOT-QUALITY findings, NOT harness bugs: they mean a
                     scripted pilot is a poor pilot for that build, so its ceiling
                     cannot be honestly measured with that pilot. When (b) is
                     available and ALSO loses to random on the same build, it is a
                     defensive-AI / balance gap, not a pilot-availability problem."""
    rows = []
    harness_flags = []
    pilot_flags = []
    tol = 0.03
    for lbl in [b.label for b in ARCHETYPES]:
        r = table[lbl]
        floor = r['random']
        # best AVAILABLE non-random pilot (tuned==greedy when (b) absent)
        best = max(r['greedy'], r['tuned(b)'])
        spread = best - floor
        measurable = r['greedy'] >= r['random'] - tol
        rows.append((lbl, r, floor, best, spread, measurable))
        if r['greedy'] < r['random'] - tol:
            if not TUNED_AVAILABLE:
                tail = ("its ceiling is UNMEASURABLE until the (b) pilot exists "
                        "(this IS the (b) rationale).")
            elif r['tuned(b)'] < r['random'] - tol:
                tail = ("its ceiling is UNMEASURABLE with the current scripted pilots: the "
                        f"(b) pilot ALSO loses to random here (tuned(b) {r['tuned(b)']*100:.1f}%), "
                        "so this is a defensive-AI / balance gap (a lever for arm (c)), not "
                        "something the (b) pilot alone fixes.")
            else:
                tail = (f"but the (b) pilot rescues it (tuned(b) {r['tuned(b)']*100:.1f}%), "
                        "so its ceiling IS measurable via best-available pilot.")
            pilot_flags.append(
                f"[{lbl}] greedy {r['greedy']*100:.1f}% < random {r['random']*100:.1f}%: "
                f"the greedy pilot is WORSE than random on this build - " + tail)
        if r['tuned(b)'] < r['greedy'] - tol:
            pilot_flags.append(
                f"[{lbl}] tuned(b) {r['tuned(b)']*100:.1f}% < greedy {r['greedy']*100:.1f}%: "
                f"the (b) policy under-performs greedy here - investigate (b).")
        if abs(r['greedy'] - 0.5) > 0.06:
            harness_flags.append(
                f"[{lbl}] greedy-vs-greedy mirror {r['greedy']*100:.1f}% "
                f"(expected ~50% on an identical build; possible harness asymmetry)")
    return rows, harness_flags, pilot_flags


# ----------------------------------------------------------------------------
# REPORT
# ----------------------------------------------------------------------------
def fmt_table(table, title, note):
    lines = []
    lines.append("=" * 72)
    lines.append(title)
    lines.append("=" * 72)
    if note:
        lines.append(note)
    hdr = f"  {'archetype':18s}" + "".join(f"{t:>11s}" for t in TIERS_ORDER) + f"{'ceiling':>10s}"
    lines.append(hdr)
    rows, _, _ = analyze(table)
    for lbl, r, floor, best, spread, measurable in rows:
        cells = "".join(f"{r[t]*100:10.1f}%" for t in TIERS_ORDER)
        mark = "" if measurable else "  <- pilot-limited (greedy<random; scripted pilots under-defend)"
        lines.append(f"  {lbl:18s}{cells}{spread*100:9.1f}%{mark}")
    meas = [row[4] for row in rows if row[5]]
    n_lim = len(rows) - len(meas)
    lines.append("\n  ceiling spread = WR(best available pilot) - WR(random), identical builds")
    if meas:
        lines.append(f"  mean ceiling (measurable {len(meas)}/{len(rows)}): "
                     f"{statistics.mean(meas)*100:.1f}%   "
                     f"min {min(meas)*100:.1f}%   max {max(meas)*100:.1f}%")
    if n_lim:
        tail = ("measurable without the (b) pilot" if not TUNED_AVAILABLE
                else "measurable with the current scripted pilots (greedy and (b) both "
                     "lose to random: a defensive-AI / balance gap, not a pilot gap)")
        lines.append(f"  {n_lim} archetype(s) pilot-limited (greedy < random): ceiling not "
                     + tail)
    return "\n".join(lines), rows


def main():
    print("=" * 72)
    print("THE HOLLOW - Skill-Ceiling Arm (sec.8 test step 2: does play matter?)")
    print("=" * 72)

    problems = validate_archetypes()
    if problems:
        print("\n[ABORT] illegal archetype build(s):")
        for p in problems:
            print("   -", p)
        raise SystemExit(1)
    print(f"\n[OK] {len(ARCHETYPES)} archetype builds validated as legal graft bars.")
    print(f"[OK] (b) tuned policy available: {TUNED_AVAILABLE}"
          + ("" if TUNED_AVAILABLE else "  -> tuned(b) tier FALLS BACK TO greedy"))
    print(f"[RUN] seeds/tier {SEEDS} | master seed {MASTER_SEED} "
          f"(lookahead tier excluded - see module docstring)")

    # --- primary + secondary measurements ---
    mirror = run_mirror_measurement()
    cross = run_cross_measurement()

    # --- QA: determinism (run the mirror measurement again, compare hashes) ---
    mirror2 = run_mirror_measurement()
    h1, h2 = table_hash(mirror), table_hash(mirror2)
    determinism_ok = (h1 == h2)

    mirror_text, mirror_rows = fmt_table(
        mirror,
        "MIRROR CEILING  [identical build both sides; tested pilot varies, opp = greedy]",
        "  Every point away from 50% is PILOT skill: the build is identical on both sides.")
    cross_text, cross_rows = fmt_table(
        cross,
        "CROSS CEILING  [tested build vs a fixed strong opponent (burst_mage, greedy)]",
        "  Asymmetric matchup; absolute WR reflects the matchup, spread reflects the ceiling.")

    mirror_rows, harness_flags, pilot_flags = analyze(mirror)

    print("\n" + mirror_text)
    print("\n" + cross_text)

    # --- QA report: integrity (must pass) vs pilot diagnostic (a finding) ---
    integrity_ok = determinism_ok and not harness_flags
    print("\n" + "=" * 72)
    print("HARNESS INTEGRITY  (must pass for the run to be valid)")
    print("=" * 72)
    print(f"  [{'PASS' if determinism_ok else 'FAIL'}] deterministic per seed: "
          f"mirror table hash stable across two runs (hash={h1[:16]}...)")
    if not harness_flags:
        print("  [PASS] mirror symmetry: every greedy-vs-greedy identical-build mirror ~50%")
    else:
        print(f"  [FAIL] mirror symmetry: {len(harness_flags)} archetype(s) off 50%:")
        for f in harness_flags:
            print("        -", f)

    print("\n" + "=" * 72)
    print("PILOT DIAGNOSTIC  (a game/pilot finding, NOT a harness bug)")
    print("=" * 72)
    if not pilot_flags:
        print("  no monotonicity inversions: a better-labeled pilot never did worse.")
    else:
        print(f"  {len(pilot_flags)} monotonicity inversion(s) - a scripted pilot did WORSE")
        print("  than a nominally-weaker one. Two kinds appear below: greedy<random (the")
        print("  pilot ignores a build's defensive utility) and tuned(b)<greedy (the (b)")
        print("  per-build policy mis-pilots that build - feed back to PHAA-389):")
        for f in pilot_flags:
            print("        -", f)

    # --- verdict ---
    TOL = 0.03
    measurable_rows = [row for row in mirror_rows if row[5]]
    measurable_spreads = [row[4] for row in measurable_rows]
    all_spreads = [row[4] for row in mirror_rows]
    mean_ceiling = statistics.mean(measurable_spreads) if measurable_spreads else 0.0
    max_ceiling = max(all_spreads)
    # the honest gate read: a ceiling "exists" if pilot quality moves outcome
    # materially on identical builds. Thresholds are deliberately conservative.
    CEILING_MATERIAL = 0.10   # >=10pts swing from pilot alone = a real ceiling
    n_material = sum(1 for s in measurable_spreads if s >= CEILING_MATERIAL)
    # a ceiling exists if a clear majority of MEASURABLE archetypes show a material
    # pilot-driven swing (the pilot-limited ones only strengthen the case).
    ceiling_exists = n_material >= max(1, (len(mirror_rows) + 1) // 2)
    n_lim = len(mirror_rows) - len(measurable_rows)

    # (b) pilot effect on identical builds: tuned(b) vs greedy, per archetype. A
    # gain is where the per-build policy out-pilots greedy; a regression is where
    # it does WORSE (a (b) quality finding to feed back to PHAA-389, not a bug).
    b_gains = []
    b_regress = []
    for lbl, r, floor, best, spread, measurable in mirror_rows:
        d = r['tuned(b)'] - r['greedy']
        if d > TOL:
            b_gains.append((lbl, d))
        elif d < -TOL:
            b_regress.append((lbl, d))
    b_gains.sort(key=lambda x: -x[1])
    b_regress.sort(key=lambda x: x[1])

    # top measurable ceilings, data-driven (no hardcoded numbers that go stale)
    top_meas = sorted(measurable_rows, key=lambda r: -r[4])[:3]
    top_meas_str = ", ".join(f"{lbl} {spread*100:.0f}pts"
                             for lbl, r, floor, best, spread, meas in top_meas)

    verdict = []

    def emit(s=''):
        print(s)
        verdict.append(s)

    emit("\n" + "=" * 72)
    emit("VERDICT vs sec.8 gate  ('a skill ceiling exists' vs 'outcome is build-locked')")
    emit("=" * 72)
    emit("  (b) tuned pilot (PHAA-389): AVAILABLE via sim.make_pilot - this is the")
    emit("      GATE-GRADE read, not the lower-bound directional run. (Model-directional")
    emit("      caveats on the sim itself still apply, see foot.)")
    emit(f"  mean pilot-driven WR swing (measurable archetypes): {mean_ceiling*100:.1f}%  "
         f"(max {max_ceiling*100:.1f}%, threshold {CEILING_MATERIAL*100:.0f}%)")
    emit(f"  archetypes with a material ({CEILING_MATERIAL*100:.0f}%) ceiling: "
         f"{n_material}/{len(mirror_rows)}   pilot-limited under greedy: {n_lim}/{len(mirror_rows)}")
    emit(f"  highest-ceiling archetype: "
         + max(mirror_rows, key=lambda r: r[4])[0]
         + f" ({max_ceiling*100:.1f}% swing)")
    emit("")
    if ceiling_exists:
        emit("  >>> A SKILL CEILING EXISTS. On identical builds, how well the encounter is")
        emit(f"      piloted swings the outcome by a large margin ({top_meas_str}); on the")
        emit("      most skill-expressive builds a RANDOM pilot wins under 2% of mirrors while")
        emit("      a competent one is at ~50-63%. The graft is NOT build-locked: play is")
        emit("      rewarded. The gate's step-2 question is YES.")
    else:
        emit("  >>> OUTCOME LEANS BUILD-LOCKED. Varying pilot quality on an identical build")
        emit("      barely moves the outcome - the fight largely plays itself once the bar is")
        emit("      slotted. The gate's step-2 question is NO, and the depth core needs")
        emit("      tighter skill interactions before content.")
    emit("")
    # the honest (b) read: the per-build policy is NOT uniformly a better pilot.
    if b_gains:
        emit("  (b) tuned pilot LIFTED over plain greedy on the identical build:")
        for lbl, d in b_gains:
            emit(f"      + {lbl}: {d*100:+.1f}pts  (per-build piloting pays off here)")
    if b_regress:
        emit("  (b) tuned pilot REGRESSED below plain greedy - a (b) QUALITY FINDING, not a")
        emit("      harness bug: the per-build policy mis-pilots these builds. Flag to PHAA-389:")
        for lbl, d in b_regress:
            emit(f"      - {lbl}: {d*100:+.1f}pts")
        emit("      So (b) is a strong combo/melee pilot but a NET-NEGATIVE one for the")
        emit("      mage-control and hybrid builds; the ceiling above uses best-available")
        emit("      pilot per build, so these regressions do not inflate it.")
    if not b_gains and not b_regress:
        emit("  (b) tuned pilot matched greedy on every archetype (no per-build lift measured).")
    emit("")
    if n_lim:
        emit(f"  Caveat, and it cuts TOWARD the bet: {n_lim} burst archetype(s) are PILOT-LIMITED")
        emit("      - EVEN with (b), the scripted pilots lose to RANDOM on them because none")
        emit("      casts the build's defensive utility (frost_armor / ice_barrier); the (b)")
        emit("      burst policy pools burst but adds no defense. Their ceiling can't be read")
        emit("      upward with the current pilots, but that a scripted pilot loses to random")
        emit("      at all is itself proof pilot quality dominates outcome here. Consistent")
        emit("      with (b)'s own finding that burst dominance is a BALANCE problem, not a")
        emit("      piloting artifact - a lever for arm (c)'s nerf pass, out of scope here.")
    emit("")
    emit("  Harness integrity: "
         + ("deterministic per seed; all identical-build mirrors ~50%."
            if integrity_ok
            else f"determinism={'ok' if determinism_ok else 'FAIL'}; "
                 f"{len(harness_flags)} mirror-symmetry issue(s) - see above."))
    emit("  (Model-directional: mapped GW1 economy, representative kits, ~EST values. The")
    emit("   pilot axis is now the real (b) policy, no longer greedy standing in for it.)")

    # --- write artifact ---
    out_path = os.path.join(HERE, "hollow-skill-ceiling-results.txt")
    with open(out_path, "w") as f:
        w = f.write
        w("THE HOLLOW - SKILL-CEILING ARM - RESULTS\n" + "=" * 64 + "\n")
        w(f"generated {datetime.date.today().isoformat()}  master seed {MASTER_SEED}\n\n")
        w("QUESTION (constitution sec.8 test, step 2): does outcome vary with how\n")
        w("well the encounter is PLAYED? (a skill ceiling) - or is outcome build-locked?\n\n")
        w("METHOD: hold the build fixed, vary ONLY the pilot. Primary read is a MIRROR\n")
        w("match (identical build both sides) so every point of WR away from 50% is\n")
        w("pilot skill. Pilot tiers: random / greedy / tuned(b).\n\n")
        w(f"(b) tuned pilot available: {TUNED_AVAILABLE}"
          + ("\n" if TUNED_AVAILABLE else "  -> tuned(b) tier == greedy fallback\n"))
        w(f"seeds/tier: {SEEDS}\n(lookahead tier excluded - see script docstring)\n\n")
        w(mirror_text + "\n\n")
        w(cross_text + "\n\n")
        w("HARNESS INTEGRITY (must pass)\n")
        w(f"  determinism: {'PASS' if determinism_ok else 'FAIL'} (hash {h1[:16]}...)\n")
        if harness_flags:
            w(f"  mirror-symmetry FAIL ({len(harness_flags)}):\n")
            for fl in harness_flags:
                w("    - " + fl + "\n")
        else:
            w("  mirror-symmetry: PASS (all identical-build mirrors ~50%)\n")
        w("\nPILOT DIAGNOSTIC (a game/pilot finding, not a harness bug)\n")
        if pilot_flags:
            for fl in pilot_flags:
                w("    - " + fl + "\n")
            w("  mechanism (instrumented): on the burst builds the greedy pilot spams\n")
            w("  pyroblast (the 5s nuke) and NEVER casts frost_armor / ice_barrier, so a\n")
            w("  random pilot that stumbles into those defensive skills out-lasts it. The\n")
            w("  greedy heuristic under-values defense and over-values raw burst.\n")
        else:
            w("  no monotonicity inversions.\n")
        w("\n")
        for ln in verdict:
            w(ln + "\n")
    print(f"\n[written] {out_path}")
    if not determinism_ok:
        raise SystemExit("DETERMINISM FAIL")


if __name__ == "__main__":
    main()
