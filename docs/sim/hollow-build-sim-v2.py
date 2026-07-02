#!/usr/bin/env python3
"""
THE HOLLOW - GW1-on-WoCC Build Diversity Simulator (v1)
========================================================
Tests the load-bearing bet (constitution sec.8): does grafting Guild Wars 1
build-crafting (primary+secondary professions, an 8-skill bar drawn from both,
attribute points spread across both) onto World of ClaudeCraft's WoW-Classic
combat MATH produce real build diversity, or does it collapse to one dominant
build / a bar full of decorative skills?

GROUNDING (real values pulled from levy-street/world-of-claudecraft source):
  - armorReduction(armor, atkLvl) = min(0.75, a/(a + 85*atkLvl + 400))      [types.ts]
  - meleeMissChance same-level = 5%; floor 0.5%                             [types.ts]
  - melee crit x2 ; spell crit x1.5                          [auto_attack.ts/casting]
  - critChance = 0.05 + agi*0.0005 ; spellCrit = 0.05 + int*0.0008          [entity/sim]
  - dodge = 0.05 + agi*0.0005                                               [entity.ts]
  - AP: warrior str*2 ; rogue str+agi ; caster str          [entity.ts apFromStats]
  - spellPower = int*0.5                                     [types SPELL_POWER_PER_INT]
  - auto dmg = (wpnDmg + (AP/14)*wpnSpeed)*mult + bonus, crit, then armor  [auto_attack]
  - spell coeff = clamp(cast,1.5,3.5)/3.5 ; DoT coeff = dur/15             [spell_scaling]
  - GCD 1.5s (rogue 1.0s)                                                  [sim.ts]
  - class base/per-level stats, real ability costs/cd/cast/effects        [classes.ts]

GRAFT CHOICES (documented levers, NOT from source - this is the bet's design):
  - ONE energy bar (base 30) + ADRENALINE track for warrior strike-skills.
  - Energy regen 1.0/s base.  Mage primary "Energy Storage": +3 max/rank, +regen.
    Rogue primary "Expertise": +crit and +energy regen/rank.  Warrior primary
    "Strength": +armor penetration/rank.
  - WoCC resource costs RESCALED to a 5/10/15/25 GW1 energy scale (mapping table
    in SKILLS below).  Warrior attack-skills -> adrenaline (0 energy, charged by
    swings landed/taken); warrior shouts/utility -> energy.
  - Attributes: GW1-style escalating cost, cumulative(rank) = round(0.95*rank^2)
    (=> 137 pts to rank 12, matching GW1), budget 200 pts.  A skill's magnitude
    scales by its line rank: scale = 0.40 + 0.60*rank/12 (rank0=40%, 12=100%,
    runes can push >12).  Primary attribute line is primary-profession-only.
  - HP: baseHp + hpPerLevel*19 + hp_from_sta(sta), where hp_from_sta is
    min(sta,20) + max(0,sta-20)*10 -- VERIFIED against source entity.ts:140
    on 2026-07-01 (was previously a flagged sta*10 guess).

ABSTRACTIONS (documented limitations):
  - 1-D distance (kiting modeled); facing/"behind" modeled as a state set by
    stealth openers and incapacitates.  No line-of-sight, no terrain.
  - A single shared greedy class-aware AI plays BOTH duelists (the optimizer is
    the AI, not a human theorycrafter) -> results are DIRECTIONAL.
  - Modeled ~11 skills/class (a representative kit), not every ability.
  - A handful of base damage values for mage nukes / rogue bleeds were not in the
    grep and are flagged "~EST" below; relative shape preserved.
"""

import random, math, statistics
from collections import defaultdict, Counter

LEVEL = 20
LVLM = LEVEL - 1
random.seed(1337)

# ----------------------------------------------------------------------------
# CLASS BASE DATA (real, classes.ts) -> level-20 stats
# ----------------------------------------------------------------------------
CLASSDATA = {
    'warrior': dict(base=dict(str=23,agi=20,sta=22,int=10,spi=11,armor=50),
                    per =dict(str=2, agi=1, sta=2, int=0, spi=0, armor=12),
                    baseHp=50, hpPer=18, weapon=dict(mn=4,mx=6,spd=2.6)),  # sword ~EST dmg
    'mage':    dict(base=dict(str=10,agi=12,sta=14,int=24,spi=22,armor=25),
                    per =dict(str=0, agi=0, sta=1, int=3, spi=2, armor=4),
                    baseHp=40, hpPer=12, weapon=dict(mn=3,mx=6,spd=1.8)),  # wand (ranged)
    'rogue':   dict(base=dict(str=17,agi=25,sta=17,int=11,spi=12,armor=40),
                    per =dict(str=1, agi=3, sta=1, int=0, spi=0, armor=8),
                    baseHp=45, hpPer=15, weapon=dict(mn=3,mx=5,spd=1.8)),  # dagger ~EST dmg
}

def base_stats(cls):
    d = CLASSDATA[cls]; s = {}
    for k in ('str','agi','sta','int','spi','armor'):
        s[k] = d['base'][k] + d['per'][k]*LVLM
    s['armor'] += s['agi']*2          # entity.ts: armor += agi*2
    return s

def hp_from_sta(sta):
    # CORRECTED 2026-07-01 from source (entity.ts:140-145): first 20 stamina
    # convert 1:1, the remainder at 10:1. The old flat sta*10 guess overstated
    # low-stamina (glass cannon) survivability. Negative sta floors at 0.
    s = max(0, sta)
    return min(s, 20) + max(0, s - 20) * 10

def armor_reduction(armor, atk_lvl=LEVEL):
    a = max(0, armor)
    return min(0.75, a/(a + 85*atk_lvl + 400))

MELEE_MISS = 0.05
SPELL_HIT_MISS = 0.04     # casters: ~4% base resist/miss at level (representative)

# ----------------------------------------------------------------------------
# ATTRIBUTE SYSTEM (GW1 graft)
# ----------------------------------------------------------------------------
ATTR_BUDGET = 200
def cum_cost(rank):  return round(0.95*rank*rank)          # 137 @ rank 12
def rank_for_points(pts):
    r = 0
    while cum_cost(r+1) <= pts and r < 16: r += 1
    return r
def line_scale(rank):  return 0.40 + 0.60*rank/12.0        # magnitude multiplier

# Each profession: attribute lines (offensive lines + a primary-only line).
PROF_LINES = {
    'warrior': dict(lines=['weapon_mastery','tactics'], primary='strength'),
    'mage':    dict(lines=['fire','frost','arcane'],     primary='energy_storage'),
    'rogue':   dict(lines=['daggers','subtlety'],         primary='expertise'),
}

# ----------------------------------------------------------------------------
# SKILLS - modeled kits (real WoCC numbers; ~EST flagged). econ + GW1 cost.
# kind handlers are in the engine. cost=GW1 energy; strikes=adrenaline req.
# ----------------------------------------------------------------------------
def S(**k): return k
SKILLS = {
 # ---------------- WARRIOR ----------------
 'heroic_strike': S(prof='warrior',line='weapon_mastery',econ='adren',strikes=5,recharge=0,cast=0,
                    kind='attack_weapon',bonus=11),
 'overpower':     S(prof='warrior',line='weapon_mastery',econ='adren',strikes=4,recharge=5,cast=0,
                    kind='attack_weapon',bonus=5,cannot_be_dodged=True),
 'slam':          S(prof='warrior',line='weapon_mastery',econ='adren',strikes=5,recharge=0,cast=1.5,
                    kind='attack_weapon',bonus=20),          # ~EST bonus
 'execute':       S(prof='warrior',line='weapon_mastery',econ='adren',strikes=5,recharge=0,cast=0,
                    kind='attack_direct',mn=60,mx=75,requires_below=0.20),
 'rend':          S(prof='warrior',line='weapon_mastery',econ='energy',cost=5,recharge=0,cast=0,
                    kind='dot',total=15,dur=9,interval=3,physical=True),
 'thunder_clap':  S(prof='warrior',line='tactics',econ='energy',cost=10,recharge=4,cast=0,
                    kind='attack_direct',mn=18,mx=22,apply_atkspeed_slow=0.10,slow_dur=10),  # ~EST dmg
 'hamstring':     S(prof='warrior',line='tactics',econ='energy',cost=5,recharge=0,cast=0,
                    kind='snare',value=0.50,dur=15,mn=5,mx=5),
 'charge':        S(prof='warrior',line='tactics',econ='energy',cost=0,recharge=15,cast=0,
                    kind='gap_close',stun=1.0,adrenaline_gain=4),
 'battle_shout':  S(prof='warrior',line='tactics',econ='energy',cost=5,recharge=0,cast=0,
                    kind='buff',stat='ap',value=20,dur=120),
 'demo_shout':    S(prof='warrior',line='tactics',econ='energy',cost=5,recharge=0,cast=0,
                    kind='debuff',stat='ap',value=30,dur=30),
 'defensive_stance':S(prof='warrior',line='tactics',econ='energy',cost=5,recharge=0,cast=0,
                    kind='buff',stat='dmg_reduction',value=0.10,dur=30),
 # ---------------- MAGE ----------------
 'fireball':   S(prof='mage',line='fire',econ='energy',cost=10,recharge=0,cast=1.5,
                 kind='attack_spell',mn=30,mx=45,school='fire'),         # ~EST base
 'scorch':     S(prof='mage',line='fire',econ='energy',cost=5,recharge=0,cast=1.5,
                 kind='attack_spell',mn=20,mx=28,school='fire'),         # ~EST base
 'fire_blast': S(prof='mage',line='fire',econ='energy',cost=10,recharge=8,cast=0,
                 kind='attack_spell',mn=27,mx=35,school='fire'),         # real 27-35
 'pyroblast':  S(prof='mage',line='fire',econ='energy',cost=25,recharge=0,cast=5.0,
                 kind='attack_spell',mn=75,mx=95,school='fire'),         # ~EST base
 'frostbolt':  S(prof='mage',line='frost',econ='energy',cost=10,recharge=0,cast=1.5,
                 kind='attack_spell',mn=25,mx=38,school='frost',apply_snare=0.40,snare_dur=8),  # ~EST
 'frost_nova': S(prof='mage',line='frost',econ='energy',cost=10,recharge=22,cast=0,
                 kind='aoe_root',mn=6,mx=7,dur=8,school='frost'),        # real
 'frost_armor':S(prof='mage',line='frost',econ='energy',cost=5,recharge=0,cast=0,
                 kind='buff',stat='armor',value=120,dur=300,attacker_slow=0.10),# armor ~scaled
 'ice_barrier':S(prof='mage',line='frost',econ='energy',cost=15,recharge=20,cast=0,
                 kind='shield',value=150),                               # ~EST absorb
 'arcane_missiles':S(prof='mage',line='arcane',econ='energy',cost=15,recharge=0,cast=3.0,
                 kind='channel',ticks=3,mn=8,mx=8,school='arcane'),      # real 8/missile
 'polymorph':  S(prof='mage',line='arcane',econ='energy',cost=10,recharge=0,cast=1.5,
                 kind='cc_poly',dur=8,school='arcane'),                  # dur shortened for duel
 # ---------------- ROGUE ----------------
 'sinister_strike':S(prof='rogue',line='daggers',econ='energy',cost=8,recharge=0,cast=0,
                 kind='attack_weapon',bonus=3,builds_combo=1,apply_snare=0.30,snare_dur=4),
 'backstab':   S(prof='rogue',line='daggers',econ='energy',cost=10,recharge=0,cast=0,
                 kind='attack_weapon',bonus=11,weapon_mult=1.5,requires_behind=True,builds_combo=1,apply_snare=0.30,snare_dur=4),
 'ambush':     S(prof='rogue',line='daggers',econ='energy',cost=10,recharge=0,cast=0,
                 kind='attack_weapon',bonus=28,weapon_mult=2.5,requires_stealth=True,builds_combo=2),
 'eviscerate': S(prof='rogue',line='daggers',econ='energy',cost=10,recharge=0,cast=0,
                 kind='finisher_damage',base=4,per_combo=7,variance=4),
 'rupture':    S(prof='rogue',line='subtlety',econ='energy',cost=10,recharge=0,cast=0,
                 kind='finisher_dot',base=5,per_combo=5,dur=8,interval=2),# ~EST
 'kidney_shot':S(prof='rogue',line='subtlety',econ='energy',cost=5,recharge=20,cast=0,
                 kind='finisher_stun',base=1,per_combo=1),
 'slice_and_dice':S(prof='rogue',line='daggers',econ='energy',cost=5,recharge=0,cast=0,
                 kind='finisher_haste',mult=1.30,basedur=9,per_combo=3),
 'gouge':      S(prof='rogue',line='subtlety',econ='energy',cost=10,recharge=10,cast=0,
                 kind='incapacitate',dur=4,sets_behind=True),
 'garrote':    S(prof='rogue',line='subtlety',econ='energy',cost=10,recharge=0,cast=0,
                 kind='dot',total=30,dur=9,interval=3,physical=True,requires_stealth=True,builds_combo=1),# ~EST
 'evasion':    S(prof='rogue',line='subtlety',econ='energy',cost=5,recharge=45,cast=0,
                 kind='buff',stat='dodge',value=0.50,dur=15),
 'expose_armor':S(prof='rogue',line='subtlety',econ='energy',cost=10,recharge=0,cast=0,
                 kind='finisher_debuff',stat='armor_pct',per_combo=0.10,dur=30),
 'adrenaline_rush':S(prof='rogue',line='expertise',econ='energy',cost=0,recharge=180,cast=0,
                 kind='energy_gain',amount=25),
}

PROF_SKILLS = defaultdict(list)
for name, sk in SKILLS.items():
    PROF_SKILLS[sk['prof']].append(name)

# ----------------------------------------------------------------------------
# BUILD: primary, secondary, 8 skills, attribute spread over accessible lines
# ----------------------------------------------------------------------------
class Build:
    __slots__=('primary','secondary','skills','attrs','label')
    def __init__(self, primary, secondary, skills, attrs, label=None):
        self.primary=primary; self.secondary=secondary
        self.skills=skills; self.attrs=attrs
        self.label=label or f"{primary[:2].upper()}/{secondary[:2].upper()}"
    def lines(self):
        ls=list(PROF_LINES[self.primary]['lines'])+[PROF_LINES[self.primary]['primary']]
        if self.secondary!=self.primary:
            ls+=PROF_LINES[self.secondary]['lines']   # secondary primary-attr NOT accessible
        return ls
    def rank(self,line): return rank_for_points(self.attrs.get(line,0))

def accessible_skill_pool(primary, secondary):
    pool=set(PROF_SKILLS[primary])
    if secondary!=primary:
        # secondary cannot use the OTHER prof's primary-attribute skills (none here are
        # primary-locked at skill level except expertise's adrenaline_rush for rogue-primary)
        for n in PROF_SKILLS[secondary]:
            sk=SKILLS[n]
            if sk['line']==PROF_LINES[secondary]['primary']:  # primary-line skill of secondary
                continue
            pool.add(n)
    return sorted(pool)

def random_attr_spread(lines, primary_line):
    """Spend ~ATTR_BUDGET points across lines in a GW1-plausible way: usually
    pour into 1-2 lines.  Returns {line: points}."""
    pts=ATTR_BUDGET
    attrs={l:0 for l in lines}
    # choose 1-3 focus lines
    nfocus=random.choice([1,1,2,2,2,3])
    focus=random.sample(lines, min(nfocus,len(lines)))
    # weighted split
    weights=[random.random()+0.2 for _ in focus]
    tot=sum(weights)
    for l,w in zip(focus,weights):
        attrs[l]=int(pts*w/tot)
    return attrs

def random_build(primary=None, secondary=None):
    profs=['warrior','mage','rogue']
    if primary is None: primary=random.choice(profs)
    if secondary is None:
        secondary=random.choice([p for p in profs])  # allow same = "pure primary"
    lines=list(PROF_LINES[primary]['lines'])+[PROF_LINES[primary]['primary']]
    if secondary!=primary: lines+=PROF_LINES[secondary]['lines']
    pool=accessible_skill_pool(primary, secondary)
    # bias skill pick toward primary's pool a bit, ensure some attacks
    k=min(8,len(pool))
    skills=random.sample(pool,k)
    attrs=random_attr_spread(lines, PROF_LINES[primary]['primary'])
    return Build(primary,secondary,skills,attrs)

# ----------------------------------------------------------------------------
# COMBATANT runtime state
# ----------------------------------------------------------------------------
class Fighter:
    def __init__(self, build):
        self.b=build
        self.cls=build.primary
        st=base_stats(self.cls)
        self.stats=dict(st)
        # primary-attribute passives
        self.armor_pen=0.0; self.energy_regen=1.0; self.crit_bonus=0.0
        es_rank=build.rank('energy_storage'); ex_rank=build.rank('expertise'); str_rank=build.rank('strength')
        self.max_energy=30 + (3*es_rank if build.primary=='mage' else 0)
        # base regen 2.0/s; rogue (Expertise) sustains faster, reflecting WoW's
        # fast rogue-energy origin (a 100-pool at ~10/s) that the single-bar graft
        # would otherwise crush; mage Energy Storage adds a little.
        self.energy_regen=2.0 + (0.10*es_rank if build.primary=='mage' else 0) \
                              + ((1.0 + 0.12*ex_rank) if build.primary=='rogue' else 0)
        if build.primary=='rogue': self.crit_bonus+=0.005*ex_rank
        if build.primary=='warrior': self.armor_pen=min(0.6,0.04*str_rank)
        # derived combat
        s=self.stats
        if self.cls=='warrior': ap=s['str']*2
        elif self.cls=='rogue': ap=s['str']+s['agi']
        else: ap=s['str']
        self.ap=ap
        self.sp=round(s['int']*0.5)
        self.crit=0.05+s['agi']*0.0005+self.crit_bonus
        self.spell_crit=0.05+s['int']*0.0008
        self.dodge=0.05+s['agi']*0.0005
        self.armor=s['armor']
        self.maxhp=CLASSDATA[self.cls]['baseHp']+CLASSDATA[self.cls]['hpPer']*LVLM+hp_from_sta(s['sta'])
        self.hp=self.maxhp
        self.energy=self.max_energy
        self.adren=0           # strikes
        self.combo=0
        self.wpn=CLASSDATA[self.cls]['weapon']
        # timers
        self.gcd=0.0; self.cast=None       # (skill, time_left, target_action)
        self.cd={}                          # skill -> recharge left
        self.swing_t=self.wpn['spd']
        self.atkspeed_mult=1.0
        self.haste_t=0.0
        # statuses
        self.stun=0.0; self.root=0.0; self.poly=0.0; self.incap=0.0
        self.snare=0.0; self.snare_val=0.0
        self.behind_until=0.0
        self.stealth=('stealth' in build.skills)  # start stealthed if slotted
        self.shield=0.0
        self.dots=[]    # list of dict(dmg, ticks, interval, next, physical)
        self.buffs={}   # stat -> (value, expiry)  ; dmg_reduction, ap, armor, dodge
        self.debuffs={} # stat -> (value, expiry)
        self.dist=25.0  # start at range
        self.move=6.5 if self.cls=='rogue' else 6.0   # rogue closes on kiters
        self.used=Counter()
        # skill -> data subset
        self.bar=[ (n,SKILLS[n]) for n in build.skills ]

    # effective ratings with buffs/debuffs
    def eff_ap(self):
        ap=self.ap
        if 'ap' in self.buffs: ap+=self.buffs['ap'][0]
        if 'ap' in self.debuffs: ap-=self.debuffs['ap'][0]
        return max(0,ap)
    def eff_armor(self):
        ar=self.armor
        if 'armor' in self.buffs: ar+=self.buffs['armor'][0]
        return ar
    def eff_dodge(self):
        d=self.dodge
        if 'dodge' in self.buffs: d+=self.buffs['dodge'][0]
        return min(0.75,d)
    def dmg_taken_mult(self):
        m=1.0
        if 'dmg_reduction' in self.buffs: m*=(1-self.buffs['dmg_reduction'][0])
        return m
    def armor_pct_debuff(self):
        if 'armor_pct' in self.debuffs: return self.debuffs['armor_pct'][0]
        return 0.0
    def controlled(self):  # cannot act
        return self.stun>0 or self.poly>0 or self.incap>0
    def rooted(self):
        return self.root>0 or self.stun>0 or self.poly>0 or self.incap>0

def line_mult(fighter, skill):
    r=fighter.b.rank(skill['line'])
    return line_scale(r)

# ----------------------------------------------------------------------------
# COMBAT RESOLUTION (real WoCC math)
# ----------------------------------------------------------------------------
def apply_damage(dst, amount, crit):
    amount=max(1,round(amount))
    amount*=dst.dmg_taken_mult()
    amount=round(amount)
    if dst.shield>0:
        absorbed=min(dst.shield,amount); dst.shield-=absorbed; amount-=absorbed
    if dst.poly>0 and amount>0:   # damage breaks polymorph
        dst.poly=0
    dst.hp-=amount
    return amount

def weapon_swing_damage(src, mult=1.0, bonus=0.0):
    wpn=src.wpn
    base=random.uniform(wpn['mn'],wpn['mx'])
    base+=(src.eff_ap()/14.0)*wpn['spd']
    return base*mult+bonus

def resolve_physical(src,dst,raw,can_dodge=True,can_crit=True):
    if random.random()<MELEE_MISS: src.used['miss']+=1; return 0,False
    if can_dodge and random.random()<dst.eff_dodge(): return 0,False
    crit=can_crit and random.random()<src.crit
    dmg=raw*(2.0 if crit else 1.0)
    mit=armor_reduction(dst.eff_armor()*(1-src.armor_pen), LEVEL)
    mit=max(0.0, mit - dst.armor_pct_debuff()*0)  # armor_pct debuff handled via eff_armor below
    # apply armor_pct debuff as a straight armor reduction
    eff_ar=dst.eff_armor()*(1-src.armor_pen)*(1-dst.armor_pct_debuff())
    dmg*= (1-armor_reduction(eff_ar,LEVEL))
    return apply_damage(dst,dmg,crit),crit

def resolve_spell(src,dst,base,cast,school,aoe=False,can_crit=True):
    if random.random()<SPELL_HIT_MISS: return 0,False
    coeff=max(1.5,min(3.5,cast if cast>0 else 1.5))/3.5
    if aoe: coeff*=0.333
    dmg=base + src.sp*coeff
    crit=can_crit and random.random()<src.spell_crit
    if crit: dmg*=1.5
    return apply_damage(dst,dmg,crit),crit

def adren_req(skill): return skill.get('strikes',0)

# ----------------------------------------------------------------------------
# AI: pick an action for `me` against `foe`. Returns skill-name or None (auto).
# Shared, class-aware, greedy.  Both fighters use it -> fair but not optimal.
# ----------------------------------------------------------------------------
def choose_action(me, foe):
    if me.controlled(): return None
    if me.cast is not None: return None
    if me.gcd>0: return None
    melee_range = me.dist<=5.0
    hp_frac=me.hp/me.maxhp
    foe_frac=foe.hp/foe.maxhp
    cands=[]
    for name,sk in me.bar:
        if me.cd.get(name,0)>0: continue
        econ=sk['econ']
        if econ=='energy' and me.energy<sk.get('cost',0): continue
        if econ=='adren' and me.adren<adren_req(sk): continue
        kind=sk['kind']
        # gating
        if sk.get('requires_below') and foe_frac>sk['requires_below']: continue
        if sk.get('requires_stealth') and not me.stealth: continue
        if sk.get('requires_behind') and me.behind_until<=0 and not me.stealth: continue
        rng = sk.get('range_melee', kind in ('attack_weapon','finisher_damage','finisher_dot',
              'finisher_stun','finisher_haste','finisher_debuff','incapacitate','snare') or
              (kind=='attack_direct'))
        is_caster_atk = kind in ('attack_spell','channel','aoe_root','cc_poly')
        if rng and not melee_range and kind!='gap_close': continue
        # score
        v=0.0
        lm=line_mult(me,sk)
        if kind in('attack_weapon',):
            v=20*lm + sk.get('bonus',0)*lm + (10 if sk.get('builds_combo') and me.combo<5 else 0)
            if name=='backstab' and (me.behind_until>0 or me.stealth): v+=25
            if name=='ambush' and me.stealth: v+=60
        elif kind=='attack_direct':
            v=((sk['mn']+sk['mx'])/2)*lm + 40
        elif kind=='attack_spell':
            v=((sk['mn']+sk['mx'])/2)*lm + me.sp*0.4 + (15 if sk['cast']==0 else 0)
            if name=='pyroblast' and (foe.snare>0 or foe.root>0): v+=30
            elif name=='pyroblast': v-=20  # risky long cast in melee
        elif kind=='channel':
            v=sk['ticks']*((sk['mn']+sk['mx'])/2)*lm + me.sp*0.4
        elif kind=='finisher_damage':
            if me.combo<2: continue
            v=(sk['base']+sk['per_combo']*me.combo)*lm + 30 + me.combo*8
        elif kind=='finisher_dot':
            if me.combo<2: continue
            v=(sk['base']+sk['per_combo']*me.combo)*lm + 15
        elif kind=='finisher_stun':
            if me.combo<2 or foe.stun>0: continue
            v=35+me.combo*10
        elif kind=='finisher_haste':
            if me.combo<1 or me.haste_t>3: continue
            v=25+me.combo*4
        elif kind=='finisher_debuff':
            if me.combo<2 or 'armor_pct' in foe.debuffs: continue
            v=18+me.combo*5
        elif kind=='dot':
            already=any(d.get('src')==name for d in foe.dots)
            v=0 if already else (sk['total']*lm*0.6+18)
        elif kind=='snare':
            v=(0 if foe.snare>0 else 30) if foe.dist_runner else 0
        elif kind=='aoe_root':
            v=45 if (melee_foe(foe,me) and foe.root<=0) else 5
        elif kind=='cc_poly':
            v=40 if (foe.hp/foe.maxhp>0.3 and me.hp/me.maxhp<0.55 and foe.poly<=0) else 8
        elif kind=='gap_close':
            v=50 if (not melee_range) else 0
        elif kind=='incapacitate':
            v=(34 if me.cls=='rogue' else 22) if (melee_range and foe.incap<=0) else 0
        elif kind=='buff':
            stat=sk['stat']
            if stat in me.buffs: continue
            base={'ap':22,'armor':18,'dodge':38 if hp_frac<0.5 else 12,'dmg_reduction':20 if hp_frac<0.6 else 8}.get(stat,10)
            v=base
        elif kind=='debuff':
            if sk['stat'] in foe.debuffs: continue
            v=16
        elif kind=='shield':
            v=40 if hp_frac<0.6 else 10
        elif kind=='energy_gain':
            v=30 if me.energy<8 else 0
        if v>0: cands.append((v,name,sk))
    if not cands: return None
    cands.sort(reverse=True)
    return cands[0][1]

def melee_foe(foe,me):  # is the foe a melee threat currently near me
    return foe.cls in ('warrior','rogue')
# attach a convenience attr used above
for _f in ():
    pass

# ----------------------------------------------------------------------------
# DUEL
# ----------------------------------------------------------------------------
DT=0.1
TIME_LIMIT=45.0

def cast_skill(me, foe, name):
    sk=SKILLS[name]; me.used[name]+=1
    # pay costs
    if sk['econ']=='energy': me.energy-=sk.get('cost',0)
    if sk['econ']=='adren': me.adren-=adren_req(sk)
    if sk.get('recharge',0)>0: me.cd[name]=sk['recharge']
    gcd = 1.0 if me.cls=='rogue' else 1.5
    if sk['cast']>0:
        me.cast=[name, sk['cast']]
        me.gcd=max(me.gcd, gcd)
        return
    me.gcd=max(me.gcd, gcd)
    resolve_effect(me,foe,name)

def resolve_effect(me, foe, name):
    sk=SKILLS[name]; kind=sk['kind']; lm=line_mult(me,sk)
    # stealth breaks on offensive action
    offensive = kind in ('attack_weapon','attack_direct','attack_spell','channel','dot',
                          'finisher_damage','finisher_dot','finisher_stun','finisher_debuff',
                          'aoe_root','cc_poly','incapacitate','snare')
    was_stealth=me.stealth
    if offensive: me.stealth=False
    combo_spent=me.combo
    if kind=='attack_weapon':
        raw=weapon_swing_damage(me, sk.get('weapon_mult',1.0), sk.get('bonus',0)*lm)
        dmg,_=resolve_physical(me,foe,raw,can_dodge=not sk.get('cannot_be_dodged'))
        if sk.get('builds_combo') and dmg>0: me.combo=min(5,me.combo+sk['builds_combo'])
        if sk.get('apply_snare') and dmg>0:
            foe.snare=sk['snare_dur']; foe.snare_val=sk['apply_snare']
    elif kind=='attack_direct':
        dmg,_=resolve_physical(me,foe, random.uniform(sk['mn'],sk['mx'])*lm)
        if sk.get('apply_atkspeed_slow'): foe.atkspeed_mult=1+sk['apply_atkspeed_slow']
    elif kind=='attack_spell':
        dmg,_=resolve_spell(me,foe, random.uniform(sk['mn'],sk['mx'])*lm, sk['cast'], sk.get('school'))
        if sk.get('apply_snare'): foe.snare=sk['snare_dur']; foe.snare_val=sk['apply_snare']
    elif kind=='channel':
        # resolved over time; set channel ticks
        me.cast=None  # channel handled as instant burst of ticks for simplicity
        for _ in range(sk['ticks']):
            resolve_spell(me,foe, sk['mn']*lm, 1.5, sk.get('school'))
        dmg=0
    elif kind=='dot':
        per=(sk['total']*lm)/(sk['dur']/sk['interval'])
        if me.cls!='warrior' and not sk.get('physical'): per+=me.sp*(sk['dur']/15)/(sk['dur']/sk['interval'])
        foe.dots=[d for d in foe.dots if d.get('src')!=name]
        foe.dots.append(dict(src=name,dmg=per,ticks=int(sk['dur']/sk['interval']),interval=sk['interval'],next=sk['interval'],physical=sk.get('physical',True)))
        if sk.get('builds_combo'): me.combo=min(5,me.combo+sk['builds_combo'])
    elif kind=='finisher_damage':
        amt=(sk['base']+sk['per_combo']*combo_spent+random.uniform(0,sk['variance']))*lm
        resolve_physical(me,foe,amt); me.combo=0
    elif kind=='finisher_dot':
        total=(sk['base']+sk['per_combo']*combo_spent)*lm
        ticks=int(sk['dur']/sk['interval']); per=total/ticks
        foe.dots.append(dict(src=name,dmg=per,ticks=ticks,interval=sk['interval'],next=sk['interval'],physical=True))
        me.combo=0
    elif kind=='finisher_stun':
        foe.stun=max(foe.stun, sk['base']+sk['per_combo']*combo_spent)
        me.behind_until=max(me.behind_until, foe.stun+1.5); me.combo=0
    elif kind=='finisher_haste':
        me.haste_t=sk['basedur']+sk['per_combo']*combo_spent; me.atkspeed_mult/=sk['mult']; me.combo=0
    elif kind=='finisher_debuff':
        foe.debuffs['armor_pct']=(sk['per_combo']*combo_spent, sk['dur']); me.combo=0
    elif kind=='snare':
        foe.snare=sk['dur']; foe.snare_val=sk['value']
        if sk.get('mn'): resolve_physical(me,foe, random.uniform(sk['mn'],sk['mx']))
    elif kind=='aoe_root':
        foe.root=max(foe.root,sk['dur']); resolve_spell(me,foe,random.uniform(sk['mn'],sk['mx']),0,sk.get('school'))
    elif kind=='cc_poly':
        foe.poly=sk['dur']; foe.dots=[]  # poly clears dots in WoW
    elif kind=='gap_close':
        me.dist=0.0
        if sk.get('stun'): foe.stun=max(foe.stun,sk['stun'])
        if sk.get('adrenaline_gain'): me.adren+=sk['adrenaline_gain']
    elif kind=='incapacitate':
        foe.incap=sk['dur']
        if sk.get('sets_behind'): me.behind_until=sk['dur']+2
    elif kind=='buff':
        me.buffs[sk['stat']]=(sk['value'],sk['dur'])
        if sk.get('attacker_slow'): pass
    elif kind=='debuff':
        foe.debuffs[sk['stat']]=(sk['value'],sk['dur'])
    elif kind=='shield':
        me.shield=sk['value']
    elif kind=='energy_gain':
        me.energy=min(me.max_energy,me.energy+sk['amount'])

def tick_timers(f):
    for t in ('gcd','stun','root','poly','incap','snare','behind_until','haste_t'):
        v=getattr(f,t)
        if v>0: setattr(f,t,max(0.0,v-DT))
    if f.haste_t<=0 and f.atkspeed_mult<1.0: f.atkspeed_mult=1.0
    if f.snare<=0: f.snare_val=0.0
    # buffs/debuffs expiry
    for d in (f.buffs,f.debuffs):
        for k in list(d):
            val,exp=d[k]; exp-=DT
            if exp<=0: del d[k]
            else: d[k]=(val,exp)
    # energy regen
    f.energy=min(f.max_energy, f.energy + f.energy_regen*DT)
    # cast progress
    if f.cast is not None:
        f.cast[1]-=DT
        if f.cast[1]<=0:
            nm=f.cast[0]; f.cast=None; 
            # only complete if not interrupted by control
            if not f.controlled():
                resolve_effect(f, f._foe, nm)

def tick_swing(f, foe):
    # auto-attack when in melee (or wand at range for mage)
    if f.controlled() or f.cast is not None: return
    in_range = f.dist<=5.0
    is_mage=f.cls=='mage'
    if is_mage and not in_range:
        # wand at range
        f.swing_t-=DT
        if f.swing_t<=0:
            f.swing_t=f.wpn['spd']
            resolve_spell(f,foe, random.uniform(f.wpn['mn'],f.wpn['mx']),0,'arcane')
        return
    if not in_range: return
    f.swing_t-=DT*(1.0/max(0.5,f.atkspeed_mult))
    if f.swing_t<=0:
        f.swing_t=f.wpn['spd']
        raw=weapon_swing_damage(f)
        dmg,_=resolve_physical(f,foe,raw)
        if f.cls=='warrior':
            f.adren+=1
            foe.adren+=0  # taking hits handled on victim below
        # victim gains adrenaline from being hit (if warrior)
        if foe.cls=='warrior': foe.adren+=1

def tick_dots(f):
    dead=[]
    for d in f.dots:
        d['next']-=DT
        if d['next']<=0:
            d['next']+=d['interval']
            dmg=d['dmg']
            if not d['physical']: pass
            apply_damage(f, dmg, False)
            d['ticks']-=1
            if d['ticks']<=0: dead.append(d)
    for d in dead: f.dots.remove(d)

def tick_movement(f, foe):
    # mage kites if foe is melee and close; melee chase
    if f.rooted(): return
    spd=f.move*(1-f.snare_val if f.snare>0 else 1.0)
    if f.cls=='mage':
        # kite: keep distance if foe is melee class and within ~12
        if foe.cls in('warrior','rogue') and f.dist<12 and (f.cast is None):
            f.dist=min(30, f.dist+spd*DT)
    else:
        # close the gap
        if f.dist>5:
            f.dist=max(0,f.dist-spd*DT)

# convenience flag used in AI
class _Foe:
    pass

def run_duel(bA, bB, verbose=False):
    A=Fighter(bA); B=Fighter(bB)
    A._foe=B; B._foe=A
    # helper attrs for AI
    for X,Y in ((A,B),(B,A)):
        X.dist_runner = (Y.cls in ('warrior','rogue'))
    t=0.0
    # stealth opener positioning: melee start a bit closer
    if A.cls!='mage' and B.cls=='mage': A.dist=B.dist=20.0
    while t<TIME_LIMIT:
        if A.hp<=0 or B.hp<=0: break
        for me,foe in ((A,B),(B,A)):
            tick_timers(me)
        if A.hp<=0 or B.hp<=0: break
        for me,foe in ((A,B),(B,A)):
            tick_dots(me)
        if A.hp<=0 or B.hp<=0: break
        for me,foe in ((A,B),(B,A)):
            tick_movement(me,foe)
        for me,foe in ((A,B),(B,A)):
            tick_swing(me,foe)
        if A.hp<=0 or B.hp<=0: break
        for me,foe in ((A,B),(B,A)):
            me.dist=foe.dist=(A.dist if me is A else B.dist)  # shared 1-D distance
        # share a single distance value
        d=min(A.dist,B.dist); A.dist=B.dist=d
        for me,foe in ((A,B),(B,A)):
            act=choose_action(me,foe)
            if act: cast_skill(me,foe,act)
        t+=DT
    if A.hp<=0 and B.hp<=0: return 0
    if B.hp<=0: return 1
    if A.hp<=0: return -1
    # timeout: higher hp fraction wins; near-equal = draw
    fa=A.hp/A.maxhp; fb=B.hp/B.maxhp
    if abs(fa-fb)<0.05: return 0
    return 1 if fa>fb else -1

# ----------------------------------------------------------------------------
# HARNESS
# ----------------------------------------------------------------------------
def build_signature(b):
    return f"{b.primary[:3]}/{b.secondary[:3]}"

def main():
    print("="*72)
    print("THE HOLLOW - GW1-on-WoCC Build Diversity Sim (PvP duels)")
    print("Professions: Warrior x Mage x Rogue | single energy + adrenaline graft")
    print("="*72)

    # sanity duels
    print("\n[SANITY] level-20 baseline fighters:")
    for cls in ('warrior','mage','rogue'):
        f=Fighter(random_build(cls,cls))
        print(f"  {cls:7s} hp={f.maxhp:4d} ap={f.ap:3d} sp={f.sp:3d} crit={f.crit*100:4.1f}% "
              f"dodge={f.dodge*100:4.1f}% armor={f.armor} energy={f.max_energy}")

    # population
    N_BUILDS=240
    DUELS_PER=160
    pop=[random_build() for _ in range(N_BUILDS)]
    # ensure coverage of all ordered prof pairs
    profs=['warrior','mage','rogue']
    for p in profs:
        for s in profs:
            pop.append(random_build(p,s))

    print(f"\n[RUN] {len(pop)} random builds, {DUELS_PER} duels each vs random opponents...")
    results=[]
    skill_in_winners=Counter(); skill_in_pop=Counter()
    pair_w=defaultdict(lambda:[0,0])
    for b in pop:
        for n in b.skills: skill_in_pop[n]+=1
    for i,b in enumerate(pop):
        w=draw=l=0
        for _ in range(DUELS_PER):
            opp=random.choice(pop)
            if opp is b: continue
            r=run_duel(b,opp)
            if r==1: w+=1
            elif r==-1: l+=1
            else: draw+=1
        g=w+draw+l
        wr=(w+0.5*draw)/g if g else 0.5
        results.append((wr,b,w,draw,l))
        sig=build_signature(b); pair_w[sig][0]+=w; pair_w[sig][1]+=g
    results.sort(reverse=True, key=lambda x:x[0])

    wrs=[r[0] for r in results]
    top=results[0]; bottom=results[-1]
    # winners = top quartile
    q=max(1,len(results)//4)
    for wr,b,*_ in results[:q]:
        for n in b.skills: skill_in_winners[n]+=1

    print("\n"+"="*72); print("WIN-RATE DISTRIBUTION (vs the field)"); print("="*72)
    print(f"  builds: {len(results)}   mean WR: {statistics.mean(wrs)*100:.1f}%  "
          f"median: {statistics.median(wrs)*100:.1f}%  stdev: {statistics.pstdev(wrs)*100:.1f}%")
    print(f"  best build : {top[0]*100:5.1f}%  [{top[1].primary}/{top[1].secondary}]  skills={top[1].skills}")
    print(f"  worst build: {bottom[0]*100:5.1f}%  [{bottom[1].primary}/{bottom[1].secondary}]")
    # histogram
    buckets=defaultdict(int)
    for wr in wrs: buckets[min(95,int(wr*100)//5*5)]+=1
    print("\n  WR%   count")
    for k in sorted(buckets):
        print(f"  {k:3d}+  {'#'*buckets[k]} ({buckets[k]})")
    viable=sum(1 for wr in wrs if 0.45<=wr<=0.55)
    strong=sum(1 for wr in wrs if wr>=0.60)
    weak=sum(1 for wr in wrs if wr<=0.40)
    print(f"\n  builds in 45-55% (balanced band): {viable} ({viable/len(wrs)*100:.0f}%)")
    print(f"  builds >=60% (strong/dominant):    {strong} ({strong/len(wrs)*100:.0f}%)")
    print(f"  builds <=40% (weak):               {weak} ({weak/len(wrs)*100:.0f}%)")

    print("\n"+"="*72); print("PROFESSION-PAIR WIN RATES"); print("="*72)
    for sig,(wsum,gsum) in sorted(pair_w.items(), key=lambda x:-(x[1][0]/max(1,x[1][1]))):
        print(f"  {sig:9s} {wsum/max(1,gsum)*100:5.1f}%   (n={gsum})")

    print("\n"+"="*72); print("SKILL USAGE: pick-rate in TOP QUARTILE vs overall"); print("="*72)
    print(f"  {'skill':18s} {'top25%':>7s} {'overall':>8s}  signal")
    rows=[]
    for n in SKILLS:
        tp=skill_in_winners[n]/q if q else 0
        op=skill_in_pop[n]/len(pop)
        rows.append((tp,op,n))
    for tp,op,n in sorted(rows,reverse=True):
        flag=''
        if tp==0 and op>0.1: flag='<- DECORATIVE (never in winners)'
        elif tp>op*1.6 and tp>0.25: flag='<- strong pick'
        print(f"  {n:18s} {tp*100:6.0f}% {op*100:7.0f}%  {flag}")
    never=[n for tp,op,n in rows if tp==0 and op>0.08]

    # ---- WITHIN-PROFESSION (MIRROR) DIVERSITY: the clean read on the bet ----
    by_sig=defaultdict(list)
    for wr,b,*_ in results: by_sig[build_signature(b)].append(b)
    print("\n"+"="*72); print("WITHIN-PROFESSION (MIRROR) DIVERSITY  [isolates build from class balance]"); print("="*72)
    print("  same-profession builds fought round-robin against each other:")
    print(f"  {'pair':9s} {'builds':>6s}  {'spread':>7s} {'topWR':>6s}   read")
    mirror_summary={}
    for sig,builds in sorted(by_sig.items()):
        bl=builds[:14]
        if len(bl)<4: continue
        wins=defaultdict(float); games=defaultdict(int)
        for i in range(len(bl)):
            for j in range(len(bl)):
                if i==j: continue
                for _ in range(4):
                    r=run_duel(bl[i],bl[j])
                    games[i]+=1; games[j]+=1
                    if r==1: wins[i]+=1
                    elif r==-1: wins[j]+=1
                    else: wins[i]+=0.5; wins[j]+=0.5
        mwr=[wins[k]/games[k] for k in range(len(bl)) if games[k]]
        if len(mwr)<2: continue
        spread=statistics.pstdev(mwr)*100
        topwr=max(mwr)*100
        read=('diverse' if (topwr<68 and spread<18) else
              'DOMINANT-BUILD' if topwr>=72 else 'mixed')
        mirror_summary[sig]=(len(bl),spread,topwr,read)
        print(f"  {sig:9s} {len(bl):6d}  {spread:6.1f}% {topwr:5.1f}%   {read}")
    all_top=[v[2] for v in mirror_summary.values()] or [50.0]
    mirror_dom=sum(1 for v in mirror_summary.values() if v[2]>=72)
    mean_top=statistics.mean(all_top)
    print(f"\n  pairs with a dominant build (mirror top-WR >=72%): {mirror_dom}/{len(mirror_summary)}")
    print(f"  mean within-profession top-WR: {mean_top:.1f}%   (lower = flatter ladder = more viable builds)")
    print("  NOTE: random builds include many weak ones, so a high top-WR here partly")
    print("        reflects bad builds losing - the frontier test below is the clean read.")

    # ---- COMPETITIVE FRONTIER: do the BEST builds beat EACH OTHER, or is one a king? ----
    front=[b for _,b,*_ in results[:24]]
    fwins=defaultdict(float); fgames=defaultdict(int)
    for i in range(len(front)):
        for j in range(len(front)):
            if i==j: continue
            for _ in range(8):
                r=run_duel(front[i],front[j]); fgames[i]+=1; fgames[j]+=1
                if r==1: fwins[i]+=1
                elif r==-1: fwins[j]+=1
                else: fwins[i]+=0.5; fwins[j]+=0.5
    fwr=sorted([fwins[k]/fgames[k] for k in range(len(front)) if fgames[k]], reverse=True)
    front_top=fwr[0]*100; front_spread=statistics.pstdev(fwr)*100
    front_band=sum(1 for x in fwr if 0.40<=x<=0.60)
    front_profs=Counter(build_signature(b) for b in front)
    front_ok = front_top < 70 and front_band >= len(fwr)//2
    print("\n"+"="*72); print("COMPETITIVE FRONTIER  [top 24 builds vs each other - is one a king?]"); print("="*72)
    print(f"  frontier top-WR {front_top:.1f}%   spread {front_spread:.1f}%   in 40-60% band: {front_band}/{len(fwr)}")
    print(f"  frontier WRs: "+" ".join(f"{x*100:.0f}" for x in fwr))
    print(f"  frontier composition: {dict(front_profs)}")

    print("\n"+"="*72); print("VERDICT vs constitution sec.8 gate"); print("="*72)
    dom = top[0]>=0.60
    spread_ok = viable/len(wrs) >= 0.30
    decorative_frac = len(never)/len(SKILLS)
    mirror_ok = mean_top < 70 and mirror_dom <= max(1,len(mirror_summary)//3)
    prof_overall={}
    for p in ('warrior','mage','rogue'):
        ws=sum(wsum for sig,(wsum,gsum) in pair_w.items() if sig.startswith(p[:3]))
        gs=sum(gsum for sig,(wsum,gsum) in pair_w.items() if sig.startswith(p[:3]))
        prof_overall[p]=ws/max(1,gs)
    prof_gap=max(prof_overall.values())-min(prof_overall.values())

    vlines=[]
    def emit(s=''):
        print(s); vlines.append(s)
    emit(f"  [{'FAIL' if dom else 'PASS'}] dominance (vs field): best build {top[0]*100:.1f}% (gate <60%)")
    emit(f"  [{'PASS' if spread_ok else 'WEAK'}] viable spread: {viable/len(wrs)*100:.0f}% of builds in 45-55% (gate >=30%)")
    emit(f"  [{'PASS' if decorative_frac<0.20 else 'WEAK'}] decorative skills: {len(never)}/{len(SKILLS)} never in winners ({decorative_frac*100:.0f}%)")
    emit(f"  [{'PASS' if mirror_ok else 'WEAK'}] within-profession diversity (random builds): mean mirror top-WR {mean_top:.1f}% (gate <70%)")
    emit(f"  [{'PASS' if front_ok else 'WEAK'}] competitive frontier: top build {front_top:.1f}% vs other top builds (gate <70%); {front_band}/{len(fwr)} in 40-60%")
    emit(f"  [obs ] profession balance gap: {prof_gap*100:.0f}pts  (war {prof_overall['warrior']*100:.0f}% / mag {prof_overall['mage']*100:.0f}% / rog {prof_overall['rogue']*100:.0f}%)")
    if never: emit(f"        never-in-winners: {never}")
    bet_core = front_ok and decorative_frac<0.25
    emit("")
    emit("  >>> BUILD-CRAFTING DEPTH (the bet): "+("SUPPORTED (directional)." if bet_core else "STRAINED (directional)."))
    if bet_core:
        emit("      Within a controlled profession, many builds are viable and the bar")
        emit("      is not full of dead skills - the graft carries depth.")
    else:
        emit("      A dominant build and/or dead skills persist within professions.")
    emit(f"      Profession BALANCE is a SEPARATE axis: gap {prof_gap*100:.0f}pts -> "
         + ("fine for a first pass." if prof_gap<0.20 else "needs more tuning (expected; the fallback anticipates this)."))
    emit("  (Directional only: shared greedy AI, mapped GW1 economy, representative kits, ~EST values.)")

    # ---- write results artifact ----
    import datetime
    path='/mnt/user-data/outputs/hollow-build-sim-results.txt'
    with open(path,'w') as f:
        w=f.write
        w("THE HOLLOW - GW1-on-WoCC BUILD DIVERSITY SIM - RESULTS\n"+"="*64+"\n")
        w(f"generated {datetime.date.today().isoformat()}  seed 1337\n\n")
        w("QUESTION (constitution sec.8): does grafting Guild Wars 1 build-crafting\n")
        w("(primary+secondary professions, an 8-skill bar drawn from both, attribute\n")
        w("points spread across both) onto World of ClaudeCraft's real WoW-Classic\n")
        w("combat math yield real build diversity, or collapse to one dominant build\n")
        w("/ a bar full of decorative skills?\n\n")
        w("SETUP\n")
        w("  professions : Warrior x Mage x Rogue (PvP duels, 1v1)\n")
        w("  graft       : single energy bar (base 30) + adrenaline for warrior strikes\n")
        w(f"  population  : {len(pop)} random legal builds + all 9 ordered profession-pairs\n")
        w(f"  volume      : {DUELS_PER} duels/build vs field (~{len(pop)*DUELS_PER//1000}k) plus mirror round-robins\n")
        w("  grounding   : armor/hit/crit/AP/SP formulas and ability data pulled from\n")
        w("                levy-street/world-of-claudecraft source (see sim header)\n\n")
        w("WIN-RATE vs FIELD\n")
        w(f"  mean {statistics.mean(wrs)*100:.1f}%   median {statistics.median(wrs)*100:.1f}%   stdev {statistics.pstdev(wrs)*100:.1f}%\n")
        w(f"  best  {top[0]*100:5.1f}%  [{top[1].primary}/{top[1].secondary}]\n")
        w(f"  worst {bottom[0]*100:5.1f}%  [{bottom[1].primary}/{bottom[1].secondary}]\n")
        w(f"  balanced band 45-55%: {viable} ({viable/len(wrs)*100:.0f}%)   strong>=60%: {strong} ({strong/len(wrs)*100:.0f}%)   weak<=40%: {weak} ({weak/len(wrs)*100:.0f}%)\n\n")
        w("PROFESSION-PAIR WIN RATES\n")
        for sig,(wsum,gsum) in sorted(pair_w.items(), key=lambda x:-(x[1][0]/max(1,x[1][1]))):
            w(f"  {sig:9s} {wsum/max(1,gsum)*100:5.1f}%  (n={gsum})\n")
        w("\nWITHIN-PROFESSION (MIRROR) DIVERSITY  [isolates build from class balance]\n")
        for sig,(n,spread,topwr,read) in sorted(mirror_summary.items()):
            w(f"  {sig:9s} builds={n:2d}  spread={spread:4.1f}%  top={topwr:5.1f}%  {read}\n")
        w(f"  mean within-profession top-WR {mean_top:.1f}%  (lower = flatter ladder = more viable builds)\n")
        w(f"  dominant-build pairs: {mirror_dom}/{len(mirror_summary)}\n")
        w("  (random builds include weak ones; frontier below is the clean read)\n\n")
        w("COMPETITIVE FRONTIER  [top 24 builds round-robined against each other]\n")
        w(f"  top {front_top:.1f}%   spread {front_spread:.1f}%   in 40-60% band {front_band}/{len(fwr)}\n")
        w(f"  composition: {dict(front_profs)}\n\n")
        w("DECORATIVE-SKILL CHECK (never used by top-quartile builds)\n")
        w(f"  {len(never)}/{len(SKILLS)}: {never if never else 'none'}\n\n")
        w("VERDICT\n")
        for ln in vlines: w(ln+"\n")
        w("\nNEXT (if pursuing ratify): more tuning iterations on the cost mapping and\n")
        w("attribute scaling, a smarter per-build policy, then the authoritative\n")
        w("re-run on the live engine sim rather than this faithful port.\n")
    print(f"\n[written] {path}")

if __name__=='__main__':
    main()
