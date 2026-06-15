import { ABILITIES, CLASSES } from '../sim/data';
import {
  TALENTS,
  type ClassTalents,
  type GlobalModEffect,
  type SpecDef,
  type StatModEffect,
  type TalentChoiceOption,
  type TalentEffect,
  type TalentNode,
} from '../sim/content/talents';
import type { PlayerClass } from '../sim/types';
import { getLanguage, languageTag, type SupportedLanguage } from './i18n';
import { tEntity } from './entity_i18n';

export type TalentTranslationKind = 'talentNode' | 'talentChoice' | 'talentSpec' | 'talentMastery';
export type TalentTranslationField = 'name' | 'description';

export type TalentTranslationRequest =
  | { kind: 'talentNode'; node: TalentNode; field: TalentTranslationField }
  | { kind: 'talentChoice'; choice: TalentChoiceOption; field: TalentTranslationField }
  | { kind: 'talentSpec'; spec: SpecDef; field: TalentTranslationField }
  | { kind: 'talentMastery'; spec: SpecDef; field: TalentTranslationField };

export interface TalentTranslationManifestEntry {
  kind: TalentTranslationKind;
  id: string;
  classId: PlayerClass;
  specId?: string;
  field: TalentTranslationField;
  source: string;
}

type StatKey = keyof StatModEffect;
type GlobalKey = keyof GlobalModEffect;

interface TalentLocaleText {
  statLabels: Record<StatKey | GlobalKey | 'damage' | 'cost' | 'cooldown' | 'castTime', string>;
  roleLabels: Record<'tank' | 'healer' | 'dps', string>;
  perRank: string;
  noEffect: string;
  chooseOne: (name: string) => string;
  specDescription: (className: string, role: string, abilityName: string) => string;
  grant: (abilityName: string) => string;
  increase: (target: string, amount: string, perRank: string) => string;
  reduce: (target: string, amount: string, perRank: string) => string;
}

const abilityIdByName = new Map(Object.values(ABILITIES).map((ability) => [ability.name, ability.id]));

const enText: TalentLocaleText = {
  statLabels: {
    str: 'Strength',
    agi: 'Agility',
    sta: 'Stamina',
    int: 'Intellect',
    spi: 'Spirit',
    armor: 'armor',
    ap: 'attack power',
    crit: 'critical strike chance',
    dodge: 'dodge chance',
    apPct: 'attack power',
    staPct: 'Stamina',
    armorPct: 'armor',
    maxHpPct: 'maximum health',
    meleeDmgPct: 'melee ability damage',
    spellDmgPct: 'spell damage',
    healPct: 'healing done',
    threatPct: 'threat generated',
    damage: 'damage',
    cost: 'cost',
    cooldown: 'cooldown',
    castTime: 'cast time',
  },
  roleLabels: { tank: 'tank', healer: 'healer', dps: 'damage' },
  perRank: ' per rank',
  noEffect: 'Provides a specialization benefit.',
  chooseOne: (name) => `Choose one ${name} option.`,
  specDescription: (className, role, abilityName) => `${className} specialization focused on ${role}. Signature ability: ${abilityName}.`,
  grant: (abilityName) => `Grants ${abilityName}.`,
  increase: (target, amount, perRank) => `Increases ${target} by ${amount}${perRank}.`,
  reduce: (target, amount, perRank) => `Reduces ${target} by ${amount}${perRank}.`,
};

const localeText: Record<SupportedLanguage, TalentLocaleText> = {
  en: enText,
  en_CA: enText,
  es: {
    statLabels: {
      str: 'Fuerza', agi: 'Agilidad', sta: 'Aguante', int: 'Intelecto', spi: 'Espiritu', armor: 'armadura',
      ap: 'poder de ataque', crit: 'probabilidad de golpe critico', dodge: 'probabilidad de esquivar',
      apPct: 'poder de ataque', staPct: 'Aguante', armorPct: 'armadura', maxHpPct: 'salud maxima',
      meleeDmgPct: 'dano de habilidades cuerpo a cuerpo', spellDmgPct: 'dano con hechizos', healPct: 'sanacion realizada',
      threatPct: 'amenaza generada', damage: 'dano', cost: 'coste', cooldown: 'reutilizacion', castTime: 'tiempo de lanzamiento',
    },
    roleLabels: { tank: 'tanque', healer: 'sanacion', dps: 'dano' },
    perRank: ' por rango',
    noEffect: 'Aporta una ventaja de especializacion.',
    chooseOne: (name) => `Elige una opcion de ${name}.`,
    specDescription: (className, role, abilityName) => `Especializacion de ${className} centrada en ${role}. Habilidad distintiva: ${abilityName}.`,
    grant: (abilityName) => `Otorga ${abilityName}.`,
    increase: (target, amount, perRank) => `Aumenta ${target} en ${amount}${perRank}.`,
    reduce: (target, amount, perRank) => `Reduce ${target} en ${amount}${perRank}.`,
  },
  es_ES: {} as TalentLocaleText,
  fr_FR: {
    statLabels: {
      str: 'Force', agi: 'Agilite', sta: 'Endurance', int: 'Intelligence', spi: 'Esprit', armor: 'armure',
      ap: 'puissance d attaque', crit: 'chances de coup critique', dodge: 'chances d esquive',
      apPct: 'puissance d attaque', staPct: 'Endurance', armorPct: 'armure', maxHpPct: 'points de vie maximum',
      meleeDmgPct: 'degats des techniques de melee', spellDmgPct: 'degats des sorts', healPct: 'soins prodigues',
      threatPct: 'menace generee', damage: 'degats', cost: 'cout', cooldown: 'temps de recharge', castTime: 'temps d incantation',
    },
    roleLabels: { tank: 'tank', healer: 'soigneur', dps: 'degats' },
    perRank: ' par rang',
    noEffect: 'Apporte un avantage de specialisation.',
    chooseOne: (name) => `Choisissez une option de ${name}.`,
    specDescription: (className, role, abilityName) => `Specialisation de ${className} axee sur ${role}. Technique signature : ${abilityName}.`,
    grant: (abilityName) => `Octroie ${abilityName}.`,
    increase: (target, amount, perRank) => `Augmente ${target} de ${amount}${perRank}.`,
    reduce: (target, amount, perRank) => `Reduit ${target} de ${amount}${perRank}.`,
  },
  fr_CA: {} as TalentLocaleText,
  it_IT: {
    statLabels: {
      str: 'Forza', agi: 'Agilita', sta: 'Tempra', int: 'Intelletto', spi: 'Spirito', armor: 'armatura',
      ap: 'potenza d attacco', crit: 'probabilita di critico', dodge: 'probabilita di schivata',
      apPct: 'potenza d attacco', staPct: 'Tempra', armorPct: 'armatura', maxHpPct: 'salute massima',
      meleeDmgPct: 'danni delle abilita da mischia', spellDmgPct: 'danni magici', healPct: 'cure effettuate',
      threatPct: 'minaccia generata', damage: 'danni', cost: 'costo', cooldown: 'tempo di recupero', castTime: 'tempo di lancio',
    },
    roleLabels: { tank: 'difesa', healer: 'cura', dps: 'danno' },
    perRank: ' per grado',
    noEffect: 'Fornisce un beneficio di specializzazione.',
    chooseOne: (name) => `Scegli un opzione di ${name}.`,
    specDescription: (className, role, abilityName) => `Specializzazione da ${className} concentrata su ${role}. Abilita distintiva: ${abilityName}.`,
    grant: (abilityName) => `Conferisce ${abilityName}.`,
    increase: (target, amount, perRank) => `Aumenta ${target} di ${amount}${perRank}.`,
    reduce: (target, amount, perRank) => `Riduce ${target} di ${amount}${perRank}.`,
  },
  de_DE: {
    statLabels: {
      str: 'Starke', agi: 'Beweglichkeit', sta: 'Ausdauer', int: 'Intelligenz', spi: 'Willenskraft', armor: 'Rustung',
      ap: 'Angriffskraft', crit: 'kritische Trefferchance', dodge: 'Ausweichchance',
      apPct: 'Angriffskraft', staPct: 'Ausdauer', armorPct: 'Rustung', maxHpPct: 'maximale Gesundheit',
      meleeDmgPct: 'Schaden von Nahkampffahigkeiten', spellDmgPct: 'Zauberschaden', healPct: 'gewirkte Heilung',
      threatPct: 'erzeugte Bedrohung', damage: 'Schaden', cost: 'Kosten', cooldown: 'Abklingzeit', castTime: 'Wirkzeit',
    },
    roleLabels: { tank: 'Tank', healer: 'Heilung', dps: 'Schaden' },
    perRank: ' pro Rang',
    noEffect: 'Gewahrt einen Spezialisierungsvorteil.',
    chooseOne: (name) => `Wahle eine Option fur ${name}.`,
    specDescription: (className, role, abilityName) => `${className}-Spezialisierung mit Fokus auf ${role}. Signaturfahigkeit: ${abilityName}.`,
    grant: (abilityName) => `Gewahrt ${abilityName}.`,
    increase: (target, amount, perRank) => `Erhoht ${target} um ${amount}${perRank}.`,
    reduce: (target, amount, perRank) => `Verringert ${target} um ${amount}${perRank}.`,
  },
  zh_CN: {
    statLabels: {
      str: '力量', agi: '敏捷', sta: '耐力', int: '智力', spi: '精神', armor: '护甲',
      ap: '攻击强度', crit: '暴击几率', dodge: '闪避几率', apPct: '攻击强度', staPct: '耐力',
      armorPct: '护甲', maxHpPct: '最大生命值', meleeDmgPct: '近战技能伤害', spellDmgPct: '法术伤害',
      healPct: '治疗量', threatPct: '威胁值', damage: '伤害', cost: '消耗', cooldown: '冷却时间', castTime: '施法时间',
    },
    roleLabels: { tank: '坦克', healer: '治疗', dps: '伤害输出' },
    perRank: '/每级',
    noEffect: '提供一个专精增益。',
    chooseOne: (name) => `选择一个${name}选项。`,
    specDescription: (className, role, abilityName) => `${className}专精，侧重${role}。标志技能：${abilityName}。`,
    grant: (abilityName) => `获得${abilityName}。`,
    increase: (target, amount, perRank) => `使${target}提高${amount}${perRank}。`,
    reduce: (target, amount, perRank) => `使${target}降低${amount}${perRank}。`,
  },
  zh_TW: {
    statLabels: {
      str: '力量', agi: '敏捷', sta: '耐力', int: '智力', spi: '精神', armor: '護甲',
      ap: '攻擊強度', crit: '致命一擊機率', dodge: '閃避機率', apPct: '攻擊強度', staPct: '耐力',
      armorPct: '護甲', maxHpPct: '最大生命值', meleeDmgPct: '近戰技能傷害', spellDmgPct: '法術傷害',
      healPct: '治療量', threatPct: '威脅值', damage: '傷害', cost: '消耗', cooldown: '冷卻時間', castTime: '施法時間',
    },
    roleLabels: { tank: '坦克', healer: '治療', dps: '傷害輸出' },
    perRank: '/每級',
    noEffect: '提供一個專精增益。',
    chooseOne: (name) => `選擇一個${name}選項。`,
    specDescription: (className, role, abilityName) => `${className}專精，側重${role}。代表技能：${abilityName}。`,
    grant: (abilityName) => `獲得${abilityName}。`,
    increase: (target, amount, perRank) => `使${target}提高${amount}${perRank}。`,
    reduce: (target, amount, perRank) => `使${target}降低${amount}${perRank}。`,
  },
  ko_KR: {
    statLabels: {
      str: '힘', agi: '민첩', sta: '체력', int: '지능', spi: '정신력', armor: '방어도',
      ap: '전투력', crit: '치명타율', dodge: '회피율', apPct: '전투력', staPct: '체력',
      armorPct: '방어도', maxHpPct: '최대 생명력', meleeDmgPct: '근접 능력 피해', spellDmgPct: '주문 피해',
      healPct: '치유량', threatPct: '생성 위협', damage: '피해', cost: '소모량', cooldown: '재사용 대기시간', castTime: '시전 시간',
    },
    roleLabels: { tank: '방어', healer: '치유', dps: '피해' },
    perRank: '/등급',
    noEffect: '전문화 보너스를 제공합니다.',
    chooseOne: (name) => `${name} 선택지 하나를 고르세요.`,
    specDescription: (className, role, abilityName) => `${role}에 집중하는 ${className} 전문화입니다. 대표 능력: ${abilityName}.`,
    grant: (abilityName) => `${abilityName}을 얻습니다.`,
    increase: (target, amount, perRank) => `${target}이 ${amount}${perRank} 증가합니다.`,
    reduce: (target, amount, perRank) => `${target}이 ${amount}${perRank} 감소합니다.`,
  },
  ja_JP: {
    statLabels: {
      str: '筋力', agi: '敏捷性', sta: 'スタミナ', int: '知力', spi: '精神力', armor: '防御力',
      ap: '攻撃力', crit: 'クリティカル率', dodge: '回避率', apPct: '攻撃力', staPct: 'スタミナ',
      armorPct: '防御力', maxHpPct: '最大体力', meleeDmgPct: '近接アビリティダメージ', spellDmgPct: '呪文ダメージ',
      healPct: '回復量', threatPct: '生成脅威', damage: 'ダメージ', cost: 'コスト', cooldown: 'クールダウン', castTime: '詠唱時間',
    },
    roleLabels: { tank: 'タンク', healer: '回復', dps: 'ダメージ' },
    perRank: '/ランク',
    noEffect: '専門化ボーナスを提供します。',
    chooseOne: (name) => `${name}の選択肢を1つ選びます。`,
    specDescription: (className, role, abilityName) => `${role}に重点を置く${className}専門化。シグネチャ能力: ${abilityName}。`,
    grant: (abilityName) => `${abilityName}を習得します。`,
    increase: (target, amount, perRank) => `${target}を${amount}${perRank}増加させます。`,
    reduce: (target, amount, perRank) => `${target}を${amount}${perRank}減少させます。`,
  },
  pt_BR: {
    statLabels: {
      str: 'Forca', agi: 'Agilidade', sta: 'Vigor', int: 'Intelecto', spi: 'Espirito', armor: 'armadura',
      ap: 'poder de ataque', crit: 'chance de acerto critico', dodge: 'chance de esquiva',
      apPct: 'poder de ataque', staPct: 'Vigor', armorPct: 'armadura', maxHpPct: 'vida maxima',
      meleeDmgPct: 'dano de habilidades corpo a corpo', spellDmgPct: 'dano magico', healPct: 'cura realizada',
      threatPct: 'ameaca gerada', damage: 'dano', cost: 'custo', cooldown: 'recarga', castTime: 'tempo de conjuracao',
    },
    roleLabels: { tank: 'tanque', healer: 'cura', dps: 'dano' },
    perRank: ' por grau',
    noEffect: 'Concede um beneficio de especializacao.',
    chooseOne: (name) => `Escolha uma opcao de ${name}.`,
    specDescription: (className, role, abilityName) => `Especializacao de ${className} focada em ${role}. Habilidade assinatura: ${abilityName}.`,
    grant: (abilityName) => `Concede ${abilityName}.`,
    increase: (target, amount, perRank) => `Aumenta ${target} em ${amount}${perRank}.`,
    reduce: (target, amount, perRank) => `Reduz ${target} em ${amount}${perRank}.`,
  },
  ru_RU: {
    statLabels: {
      str: 'Сила', agi: 'Ловкость', sta: 'Выносливость', int: 'Интеллект', spi: 'Дух', armor: 'броня',
      ap: 'сила атаки', crit: 'шанс критического удара', dodge: 'шанс уклонения',
      apPct: 'сила атаки', staPct: 'Выносливость', armorPct: 'броня', maxHpPct: 'максимальное здоровье',
      meleeDmgPct: 'урон боевых умений', spellDmgPct: 'урон заклинаний', healPct: 'исцеление',
      threatPct: 'создаваемая угроза', damage: 'урон', cost: 'стоимость', cooldown: 'время восстановления', castTime: 'время применения',
    },
    roleLabels: { tank: 'защиту', healer: 'исцеление', dps: 'урон' },
    perRank: ' за ранг',
    noEffect: 'Дает бонус специализации.',
    chooseOne: (name) => `Выберите один вариант для ${name}.`,
    specDescription: (className, role, abilityName) => `Специализация класса ${className} с упором на ${role}. Ключевая способность: ${abilityName}.`,
    grant: (abilityName) => `Дает ${abilityName}.`,
    increase: (target, amount, perRank) => `Увеличивает ${target} на ${amount}${perRank}.`,
    reduce: (target, amount, perRank) => `Снижает ${target} на ${amount}${perRank}.`,
  },
};

localeText.es_ES = localeText.es;
localeText.fr_CA = localeText.fr_FR;

const titleTerms: Partial<Record<SupportedLanguage, Record<string, string>>> = {
  es: {
    Improved: 'mejorado', Divine: 'divina', Strength: 'fuerza', Spiritual: 'espiritual', Focus: 'enfoque', Devotion: 'devocion',
    Aura: 'aura', Benediction: 'bendicion', Conviction: 'conviccion', Holy: 'sagrado', Calling: 'llamado', Favor: 'favor',
    Sanctified: 'santificada', Light: 'luz', Protection: 'proteccion', Retribution: 'retribucion', Arms: 'armas', Fury: 'furia',
    Shield: 'escudo', Slam: 'embate', Thunder: 'trueno', Clap: 'trueno', Sunder: 'hender', Armor: 'armadura', Heroic: 'heroico',
    Strike: 'golpe', Mortal: 'mortal', Bloodthirst: 'sed de sangre', Whirlwind: 'torbellino', Berserker: 'rabioso', Rage: 'ira',
    Toughness: 'dureza', Cruelty: 'crueldad', Deflection: 'desvio', Tactical: 'tactica', Mastery: 'maestria', Anticipation: 'anticipacion',
    Bladed: 'afilada', Savagery: 'ferocidad', Second: 'segundo', Wind: 'aliento', Deep: 'profundas', Wounds: 'heridas',
    Weapon: 'arma', Blademaster: 'maestro de armas', Sweeping: 'barridos', Strikes: 'golpes', Impale: 'empalar', Poleaxe: 'alabarda',
    Specialization: 'especializacion', Unbridled: 'desatada', Wrath: 'ira', Cleave: 'rajar', Enrage: 'enfurecer', Flurry: 'rafaga',
    Blood: 'sangre', Craze: 'frenesi', Bulwark: 'baluarte', Taunt: 'provocar', Last: 'ultima', Stand: 'resistencia', Vengeance: 'venganza',
    Arcane: 'arcano', Fire: 'fuego', Frost: 'escarcha', Mind: 'mente', Resilience: 'resiliencia', Barrier: 'barrera', Wave: 'ola',
    Blast: 'explosion', Cold: 'frio', Snap: 'rapidez', Combat: 'combate', Subtlety: 'sutileza', Assassination: 'asesinato',
    Survival: 'supervivencia', Beast: 'bestias', Marksmanship: 'punteria', Restoration: 'restauracion', Shadow: 'sombra',
    Discipline: 'disciplina', Elemental: 'elemental', Enhancement: 'mejora', Balance: 'equilibrio', Feral: 'feral', Demonology: 'demonologia',
    Affliction: 'afliccion', Destruction: 'destruccion', Healing: 'sanacion', Guardian: 'guardian', Nature: 'naturaleza',
    Spirit: 'espiritu', Power: 'poder', Infusion: 'infusion', Darkness: 'oscuridad', Ruin: 'ruina', Silence: 'silencio',
  },
  fr_FR: {
    Improved: 'ameliore', Divine: 'divine', Strength: 'force', Spiritual: 'spirituel', Focus: 'focalisation', Devotion: 'devotion',
    Aura: 'aura', Benediction: 'benediction', Conviction: 'conviction', Holy: 'sacre', Calling: 'appel', Favor: 'faveur',
    Sanctified: 'sanctifiee', Light: 'lumiere', Protection: 'protection', Retribution: 'vindicticte', Arms: 'armes', Fury: 'fureur',
    Shield: 'bouclier', Slam: 'heurt', Thunder: 'tonnerre', Clap: 'frappe', Sunder: 'fracasser', Armor: 'armure', Heroic: 'heroique',
    Strike: 'frappe', Mortal: 'mortel', Bloodthirst: 'soif de sang', Whirlwind: 'tourbillon', Berserker: 'berserker', Rage: 'rage',
    Toughness: 'robustesse', Cruelty: 'cruaute', Deflection: 'deviation', Tactical: 'tactique', Mastery: 'maitrise', Anticipation: 'anticipation',
    Bladed: 'lame', Savagery: 'sauvagerie', Second: 'second', Wind: 'souffle', Deep: 'profondes', Wounds: 'blessures',
    Weapon: 'arme', Blademaster: 'maitre-lame', Sweeping: 'balayantes', Strikes: 'frappes', Impale: 'empaler', Poleaxe: 'hast',
    Specialization: 'specialisation', Unbridled: 'dechainee', Wrath: 'courroux', Cleave: 'enchaînement', Enrage: 'enrager',
    Flurry: 'rafale', Blood: 'sang', Craze: 'folie', Bulwark: 'rempart', Taunt: 'provocation', Last: 'dernier', Stand: 'rempart',
    Vengeance: 'vengeance', Arcane: 'arcane', Fire: 'feu', Frost: 'givre', Mind: 'esprit', Resilience: 'resilience', Barrier: 'barriere',
    Wave: 'onde', Blast: 'explosion', Cold: 'froid', Snap: 'instant', Combat: 'combat', Subtlety: 'finesse', Assassination: 'assassinat',
    Survival: 'survie', Beast: 'betes', Marksmanship: 'precision', Restoration: 'restauration', Shadow: 'ombre', Discipline: 'discipline',
    Elemental: 'elementaire', Enhancement: 'amelioration', Balance: 'equilibre', Feral: 'farouche', Demonology: 'demonologie',
    Affliction: 'affliction', Destruction: 'destruction', Healing: 'soin', Guardian: 'gardien', Nature: 'nature', Spirit: 'esprit',
    Power: 'puissance', Infusion: 'infusion', Darkness: 'tenebres', Ruin: 'ruine', Silence: 'silence',
  },
  it_IT: {
    Improved: 'migliorato', Divine: 'divina', Strength: 'forza', Spiritual: 'spirituale', Focus: 'concentrazione', Devotion: 'devozione',
    Aura: 'aura', Benediction: 'benedizione', Conviction: 'convinzione', Holy: 'sacro', Calling: 'vocazione', Favor: 'favore',
    Light: 'luce', Protection: 'protezione', Retribution: 'castigo', Arms: 'armi', Fury: 'furia', Shield: 'scudo', Slam: 'schianto',
    Thunder: 'tuono', Clap: 'colpo', Armor: 'armatura', Heroic: 'eroico', Strike: 'colpo', Mortal: 'mortale', Whirlwind: 'turbine',
    Berserker: 'berserker', Rage: 'rabbia', Toughness: 'robustezza', Cruelty: 'crudelta', Deflection: 'deviazione',
    Tactical: 'tattica', Mastery: 'maestria', Anticipation: 'anticipazione', Savagery: 'ferocia', Second: 'secondo',
    Wind: 'vento', Wounds: 'ferite', Weapon: 'arma', Specialization: 'specializzazione', Vengeance: 'vendetta',
    Arcane: 'arcano', Fire: 'fuoco', Frost: 'gelo', Mind: 'mente', Barrier: 'barriera', Combat: 'combattimento',
    Subtlety: 'scaltrezza', Survival: 'sopravvivenza', Shadow: 'ombra', Discipline: 'disciplina', Elemental: 'elementale',
    Balance: 'equilibrio', Feral: 'ferino', Healing: 'cura', Guardian: 'guardiano', Nature: 'natura', Spirit: 'spirito',
    Power: 'potere', Darkness: 'oscurita', Ruin: 'rovina', Silence: 'silenzio',
  },
  de_DE: {
    Improved: 'verbessert', Divine: 'gottlich', Strength: 'starke', Spiritual: 'spirituell', Focus: 'fokus', Devotion: 'hingabe',
    Aura: 'aura', Benediction: 'segen', Conviction: 'uberzeugung', Holy: 'heilig', Calling: 'ruf', Favor: 'gunst',
    Light: 'licht', Protection: 'schutz', Retribution: 'vergeltung', Arms: 'waffen', Fury: 'furor', Shield: 'schild', Slam: 'schlag',
    Thunder: 'donner', Clap: 'knall', Armor: 'rustung', Heroic: 'heldenhaft', Strike: 'stoss', Mortal: 'todlich',
    Whirlwind: 'wirbelwind', Berserker: 'berserker', Rage: 'wut', Toughness: 'zahigkeit', Cruelty: 'grausamkeit',
    Deflection: 'ablenkung', Tactical: 'taktisch', Mastery: 'meisterschaft', Anticipation: 'vorahnung', Savagery: 'wildheit',
    Second: 'zweiter', Wind: 'atem', Wounds: 'wunden', Weapon: 'waffen', Specialization: 'spezialisierung',
    Vengeance: 'vergeltung', Arcane: 'arkan', Fire: 'feuer', Frost: 'frost', Mind: 'geist', Barrier: 'barriere',
    Combat: 'kampf', Subtlety: 'tauschung', Survival: 'uberleben', Shadow: 'schatten', Discipline: 'disziplin',
    Elemental: 'elementar', Balance: 'gleichgewicht', Feral: 'wildheit', Healing: 'heilung', Guardian: 'wachter',
    Nature: 'natur', Spirit: 'geist', Power: 'macht', Darkness: 'dunkelheit', Ruin: 'ruin', Silence: 'stille',
  },
  zh_CN: {
    Improved: '强化', Divine: '神圣', Strength: '力量', Spiritual: '精神', Focus: '专注', Devotion: '虔诚', Aura: '光环',
    Holy: '圣光', Light: '之光', Protection: '防护', Retribution: '惩戒', Arms: '武器', Fury: '狂怒', Shield: '盾牌',
    Slam: '猛击', Thunder: '雷霆', Clap: '一击', Armor: '护甲', Heroic: '英勇', Strike: '打击', Mortal: '致死',
    Whirlwind: '旋风', Berserker: '狂暴', Rage: '之怒', Toughness: '坚韧', Cruelty: '残忍', Deflection: '招架',
    Tactical: '战术', Mastery: '掌握', Anticipation: '预知', Savagery: '野性', Second: '复苏', Wind: '之风',
    Wounds: '创伤', Weapon: '武器', Specialization: '专精', Vengeance: '复仇', Arcane: '奥术', Fire: '火焰',
    Frost: '冰霜', Mind: '心智', Barrier: '屏障', Combat: '战斗', Subtlety: '敏锐', Survival: '生存',
    Shadow: '暗影', Discipline: '戒律', Elemental: '元素', Balance: '平衡', Feral: '野性', Healing: '治疗',
    Guardian: '守护者', Nature: '自然', Spirit: '精神', Power: '能量', Darkness: '黑暗', Ruin: '毁灭', Silence: '沉默',
  },
  zh_TW: {
    Improved: '強化', Divine: '神聖', Strength: '力量', Spiritual: '精神', Focus: '專注', Devotion: '虔誠', Aura: '光環',
    Holy: '聖光', Light: '之光', Protection: '防護', Retribution: '懲戒', Arms: '武器', Fury: '狂怒', Shield: '盾牌',
    Slam: '猛擊', Thunder: '雷霆', Clap: '一擊', Armor: '護甲', Heroic: '英勇', Strike: '打擊', Mortal: '致死',
    Whirlwind: '旋風', Berserker: '狂暴', Rage: '之怒', Toughness: '堅韌', Cruelty: '殘忍', Deflection: '招架',
    Tactical: '戰術', Mastery: '掌握', Anticipation: '預知', Savagery: '野性', Second: '復甦', Wind: '之風',
    Wounds: '創傷', Weapon: '武器', Specialization: '專精', Vengeance: '復仇', Arcane: '秘法', Fire: '火焰',
    Frost: '冰霜', Mind: '心智', Barrier: '屏障', Combat: '戰鬥', Subtlety: '敏銳', Survival: '生存',
    Shadow: '暗影', Discipline: '戒律', Elemental: '元素', Balance: '平衡', Feral: '野性', Healing: '治療',
    Guardian: '守護者', Nature: '自然', Spirit: '精神', Power: '能量', Darkness: '黑暗', Ruin: '毀滅', Silence: '沉默',
  },
  ko_KR: {
    Improved: '강화', Divine: '신성', Strength: '힘', Spiritual: '정신', Focus: '집중', Devotion: '헌신', Aura: '오라',
    Holy: '성스러운', Light: '빛', Protection: '보호', Retribution: '징벌', Arms: '무기', Fury: '분노', Shield: '방패',
    Slam: '강타', Thunder: '천둥', Clap: '벼락', Armor: '방어구', Heroic: '영웅', Strike: '일격', Mortal: '치명상',
    Whirlwind: '소용돌이', Berserker: '광전사', Rage: '분노', Toughness: '강인함', Cruelty: '잔혹함', Deflection: '막기',
    Tactical: '전술', Mastery: '숙련', Anticipation: '예견', Savagery: '야성', Second: '재기', Wind: '바람',
    Wounds: '상처', Weapon: '무기', Specialization: '전문화', Vengeance: '복수', Arcane: '비전', Fire: '화염',
    Frost: '냉기', Mind: '정신', Barrier: '보호막', Combat: '전투', Subtlety: '잠행', Survival: '생존',
    Shadow: '암흑', Discipline: '수양', Elemental: '정기', Balance: '조화', Feral: '야성', Healing: '치유',
    Guardian: '수호자', Nature: '자연', Spirit: '정신', Power: '힘', Darkness: '어둠', Ruin: '파멸', Silence: '침묵',
  },
  ja_JP: {
    Improved: '強化', Divine: '神聖', Strength: '筋力', Spiritual: '精神', Focus: '集中', Devotion: '献身', Aura: 'オーラ',
    Holy: '聖なる', Light: '光', Protection: '防御', Retribution: '報復', Arms: '武器', Fury: '憤怒', Shield: '盾',
    Slam: '強打', Thunder: '雷鳴', Clap: '一撃', Armor: '防具', Heroic: '英雄', Strike: '打撃', Mortal: '致死',
    Whirlwind: '旋風', Berserker: 'バーサーカー', Rage: '怒り', Toughness: '頑強', Cruelty: '残虐', Deflection: '受け流し',
    Tactical: '戦術', Mastery: '熟達', Anticipation: '予測', Savagery: '野性', Second: '再起', Wind: '風',
    Wounds: '傷', Weapon: '武器', Specialization: '専門化', Vengeance: '復讐', Arcane: '秘術', Fire: '火炎',
    Frost: '凍気', Mind: '精神', Barrier: '障壁', Combat: '戦闘', Subtlety: '隠密', Survival: '生存',
    Shadow: '影', Discipline: '規律', Elemental: '元素', Balance: '均衡', Feral: '野性', Healing: '回復',
    Guardian: '守護者', Nature: '自然', Spirit: '精神', Power: '力', Darkness: '闇', Ruin: '破滅', Silence: '沈黙',
  },
  pt_BR: {
    Improved: 'aprimorado', Divine: 'divina', Strength: 'forca', Spiritual: 'espiritual', Focus: 'foco', Devotion: 'devocao',
    Aura: 'aura', Holy: 'sagrado', Light: 'luz', Protection: 'protecao', Retribution: 'retribuicao', Arms: 'armas',
    Fury: 'furia', Shield: 'escudo', Slam: 'impacto', Thunder: 'trovao', Clap: 'golpe', Armor: 'armadura',
    Heroic: 'heroico', Strike: 'golpe', Mortal: 'mortal', Whirlwind: 'redemoinho', Berserker: 'berserker', Rage: 'raiva',
    Toughness: 'tenacidade', Cruelty: 'crueldade', Deflection: 'deflexao', Tactical: 'tatica', Mastery: 'maestria',
    Anticipation: 'antecipacao', Savagery: 'selvageria', Second: 'segundo', Wind: 'vento', Wounds: 'feridas',
    Weapon: 'arma', Specialization: 'especializacao', Vengeance: 'vinganca', Arcane: 'arcano', Fire: 'fogo',
    Frost: 'gelo', Mind: 'mente', Barrier: 'barreira', Combat: 'combate', Subtlety: 'sutileza', Survival: 'sobrevivencia',
    Shadow: 'sombra', Discipline: 'disciplina', Elemental: 'elemental', Balance: 'equilibrio', Feral: 'feral',
    Healing: 'cura', Guardian: 'guardiao', Nature: 'natureza', Spirit: 'espirito', Power: 'poder',
    Darkness: 'escuridao', Ruin: 'ruina', Silence: 'silencio',
  },
  ru_RU: {
    Improved: 'Улучшенный', Divine: 'Божественная', Strength: 'Сила', Spiritual: 'Духовный', Focus: 'Фокус', Devotion: 'Преданность',
    Aura: 'Аура', Holy: 'Свет', Light: 'Свет', Protection: 'Защита', Retribution: 'Воздаяние', Arms: 'Оружие',
    Fury: 'Неистовство', Shield: 'Щит', Slam: 'Сокрушение', Thunder: 'Громовой', Clap: 'удар', Armor: 'Броня',
    Heroic: 'Героический', Strike: 'удар', Mortal: 'Смертельный', Whirlwind: 'Вихрь', Berserker: 'Берсерк', Rage: 'Ярость',
    Toughness: 'Стойкость', Cruelty: 'Жестокость', Deflection: 'Отражение', Tactical: 'Тактическое', Mastery: 'Мастерство',
    Anticipation: 'Предвидение', Savagery: 'Свирепость', Second: 'Второе', Wind: 'дыхание', Wounds: 'раны',
    Weapon: 'Оружейное', Specialization: 'специализация', Vengeance: 'Месть', Arcane: 'Тайная магия', Fire: 'Огонь',
    Frost: 'Лед', Mind: 'разум', Barrier: 'барьер', Combat: 'Бой', Subtlety: 'Скрытность', Survival: 'Выживание',
    Shadow: 'Тьма', Discipline: 'Послушание', Elemental: 'Стихии', Balance: 'Баланс', Feral: 'Сила зверя',
    Healing: 'Исцеление', Guardian: 'Защитник', Nature: 'Природа', Spirit: 'Дух', Power: 'Сила',
    Darkness: 'Мрак', Ruin: 'Руина', Silence: 'Безмолвие',
  },
};

titleTerms.es_ES = titleTerms.es;
titleTerms.fr_CA = titleTerms.fr_FR;

function talentClassData(): ClassTalents[] {
  return Object.values(TALENTS).filter((ct): ct is ClassTalents => ct !== undefined);
}

function formatNumber(value: number, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(languageTag(lang), { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number, lang: SupportedLanguage): string {
  return `${formatNumber(Math.abs(value) * 100, lang)}%`;
}

function statAmount(stat: StatKey, value: number, lang: SupportedLanguage): string {
  return stat === 'crit' || stat === 'dodge' || stat.endsWith('Pct')
    ? formatPercent(value, lang)
    : formatNumber(Math.abs(value), lang);
}

function translateTitle(source: string, lang: SupportedLanguage): string {
  if (lang === 'en' || lang === 'en_CA') return source;
  const abilityId = abilityIdByName.get(source);
  if (abilityId) return tEntity({ kind: 'ability', id: abilityId, field: 'name' });
  const improved = source.match(/^Improved (.+)$/);
  if (improved) {
    const base = translateTitle(improved[1], lang);
    if (lang === 'zh_CN' || lang === 'zh_TW' || lang === 'ja_JP' || lang === 'ko_KR') return `${titleTerms[lang]?.Improved ?? ''}${base}`;
    return `${base} ${titleTerms[lang]?.Improved ?? 'improved'}`.trim();
  }
  const terms = titleTerms[lang] ?? {};
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  let translated = source;
  for (const key of keys) {
    translated = translated.replace(new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), terms[key]);
  }
  if (lang === 'zh_CN' || lang === 'zh_TW' || lang === 'ja_JP') translated = translated.replace(/\s+/g, '');
  return translated;
}

function abilityName(id: string): string {
  return tEntity({ kind: 'ability', id, field: 'name' });
}

function effectDescription(effect: TalentEffect | undefined, maxRank: number, lang: SupportedLanguage): string {
  if (!effect) return localeText[lang].noEffect;
  const text = localeText[lang];
  const perRank = maxRank > 1 ? text.perRank : '';
  const parts: string[] = [];

  if (effect.grant) parts.push(text.grant(abilityName(effect.grant.ability)));

  const stats = effect.stats ?? {};
  for (const [key, value] of Object.entries(stats) as [StatKey, number][]) {
    if (value === undefined || value === 0) continue;
    const label = text.statLabels[key];
    parts.push(text.increase(label, statAmount(key, value, lang), perRank));
  }

  const global = effect.global ?? {};
  for (const [key, value] of Object.entries(global) as [GlobalKey, number][]) {
    if (value === undefined || value === 0) continue;
    parts.push(text.increase(text.statLabels[key], formatPercent(value, lang), perRank));
  }

  for (const mod of effect.ability ?? []) {
    const name = abilityName(mod.ability);
    if (mod.dmgPct) parts.push(text.increase(`${name} ${text.statLabels.damage}`, formatPercent(mod.dmgPct, lang), perRank));
    if (mod.flatDmg) parts.push(text.increase(`${name} ${text.statLabels.damage}`, formatNumber(Math.abs(mod.flatDmg), lang), perRank));
    if (mod.costPct) parts.push((mod.costPct < 0 ? text.reduce : text.increase)(`${name} ${text.statLabels.cost}`, formatPercent(mod.costPct, lang), perRank));
    if (mod.cooldownPct) parts.push((mod.cooldownPct < 0 ? text.reduce : text.increase)(`${name} ${text.statLabels.cooldown}`, formatPercent(mod.cooldownPct, lang), perRank));
    if (mod.castPct) parts.push((mod.castPct < 0 ? text.reduce : text.increase)(`${name} ${text.statLabels.castTime}`, formatPercent(mod.castPct, lang), perRank));
  }

  return parts.length > 0 ? parts.join(' ') : text.noEffect;
}

function className(id: PlayerClass): string {
  return tEntity({ kind: 'class', id, field: 'name' });
}

export function tTalent(request: TalentTranslationRequest): string {
  const lang = getLanguage();
  if (lang === 'en' || lang === 'en_CA') {
    if (request.kind === 'talentMastery') {
      return request.field === 'name' ? request.spec.mastery.name : request.spec.mastery.description;
    }
    if (request.kind === 'talentSpec') return request.spec[request.field];
    if (request.kind === 'talentChoice') return request.choice[request.field];
    return request.node[request.field];
  }

  if (request.kind === 'talentMastery') {
    return request.field === 'name'
      ? translateTitle(request.spec.mastery.name, lang)
      : effectDescription(request.spec.mastery.effect, 1, lang);
  }
  if (request.kind === 'talentSpec') {
    return request.field === 'name'
      ? translateTitle(request.spec.name, lang)
      : localeText[lang].specDescription(className(request.spec.class), localeText[lang].roleLabels[request.spec.role], abilityName(request.spec.signature));
  }
  if (request.kind === 'talentChoice') {
    return request.field === 'name'
      ? translateTitle(request.choice.name, lang)
      : effectDescription(request.choice.effect, 1, lang);
  }
  if (request.field === 'name') return translateTitle(request.node.name, lang);
  if (request.node.kind === 'choice') return localeText[lang].chooseOne(translateTitle(request.node.name, lang));
  return effectDescription(request.node.effect, request.node.maxRank, lang);
}

export function talentTranslationManifest(): TalentTranslationManifestEntry[] {
  const entries: TalentTranslationManifestEntry[] = [];
  for (const ct of talentClassData()) {
    for (const spec of ct.specs) {
      entries.push({ kind: 'talentSpec', id: spec.id, classId: spec.class, field: 'name', source: spec.name });
      entries.push({ kind: 'talentSpec', id: spec.id, classId: spec.class, field: 'description', source: spec.description });
      entries.push({ kind: 'talentMastery', id: `${spec.id}.mastery`, classId: spec.class, specId: spec.id, field: 'name', source: spec.mastery.name });
      entries.push({ kind: 'talentMastery', id: `${spec.id}.mastery`, classId: spec.class, specId: spec.id, field: 'description', source: spec.mastery.description });
    }
    for (const node of ct.nodes) {
      entries.push({ kind: 'talentNode', id: node.id, classId: ct.class, specId: node.specId, field: 'name', source: node.name });
      entries.push({ kind: 'talentNode', id: node.id, classId: ct.class, specId: node.specId, field: 'description', source: node.description });
      for (const choice of node.choices ?? []) {
        entries.push({ kind: 'talentChoice', id: `${node.id}.${choice.id}`, classId: ct.class, specId: node.specId, field: 'name', source: choice.name });
        entries.push({ kind: 'talentChoice', id: `${node.id}.${choice.id}`, classId: ct.class, specId: node.specId, field: 'description', source: choice.description });
      }
    }
  }
  return entries;
}

export function renderTalentManifestEntry(entry: TalentTranslationManifestEntry): string {
  const ct = TALENTS[entry.classId];
  if (!ct) return entry.source;
  if (entry.kind === 'talentSpec' || entry.kind === 'talentMastery') {
    const spec = ct.specs.find((candidate) => candidate.id === (entry.kind === 'talentSpec' ? entry.id : entry.specId));
    if (!spec) return entry.source;
    return tTalent({ kind: entry.kind, spec, field: entry.field });
  }
  const [nodeId, choiceId] = entry.id.split('.');
  const node = ct.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return entry.source;
  if (entry.kind === 'talentChoice') {
    const choice = node.choices?.find((candidate) => candidate.id === choiceId);
    if (!choice) return entry.source;
    return tTalent({ kind: 'talentChoice', choice, field: entry.field });
  }
  return tTalent({ kind: 'talentNode', node, field: entry.field });
}
