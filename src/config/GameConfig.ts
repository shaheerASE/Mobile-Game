// ---------------------------------------------------------------------------
// Single source of truth for ALL tuning values — gameplay AND meta.
// Designers should only ever need to touch this file to balance the game.
// ---------------------------------------------------------------------------

import type { CharacterId, PlayerStats, SkillId, UpgradeKind, Weapon } from '../types';

/** Logical render resolution (portrait). Scale.FIT letterboxes to fit. */
export const VIEW = {
  width: 720,
  height: 1280
} as const;

/** The arena is larger than the view so the camera has room to follow. */
export const WORLD = {
  width: 2400,
  height: 2400
} as const;

export const COLORS = {
  background: 0x0b0e1a,
  grid: 0x161b2e,
  player: 0x4cd5ff,
  projectile: 0xfff27a,
  projectileOrb: 0xff7ad5,
  enemy: 0xff5a6e,
  enemyFast: 0xff9d3d,
  enemyTank: 0xb15aff,
  gem: 0x6cff8f,
  joystickBase: 0xffffff,
  joystickThumb: 0xffffff,
  hpBar: 0xff5a6e,
  hpBarBg: 0x3a0d14,
  xpBar: 0x4cd5ff,
  xpBarBg: 0x10243a,
  coin: 0xffd966,
  panel: 0x161b2e,
  panelBorder: 0x2a3358,
  btnPrimary: 0x4cd5ff,
  btnDanger: 0xff5a6e,
  text: 0xffffff,
  textMuted: 0x8899bb
} as const;

export const PLAYER: PlayerStats & { radius: number; hitCooldown: number } = {
  maxHp: 100,
  moveSpeed: 230,
  damageMult: 1,
  fireRateMult: 1,
  pickupRadius: 90,
  radius: 22,
  hitCooldown: 600
};

/** The weapon the player starts every run with. */
export const STARTING_WEAPON: Weapon = {
  id: 'bolt',
  baseInterval: 650,
  baseDamage: 18,
  projectileSpeed: 620,
  count: 1,
  cooldown: 0
};

/** Definition for the unlockable second weapon (granted via in-run upgrade). */
export const ORB_WEAPON: Weapon = {
  id: 'orb',
  baseInterval: 1100,
  baseDamage: 26,
  projectileSpeed: 460,
  count: 3,
  cooldown: 0
};

export const PROJECTILE = {
  radius: 8,
  lifespanMs: 1400,
  poolMax: 400
} as const;

// --- Enemies -------------------------------------------------------------
export type EnemyKind = 'grunt' | 'fast' | 'tank';

export interface EnemyDef {
  kind: EnemyKind;
  color: number;
  radius: number;
  baseHp: number;
  baseSpeed: number;
  contactDamage: number;
  xp: number;
  weight: number;
  minMinute: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: {
    kind: 'grunt',
    color: COLORS.enemy,
    radius: 20,
    baseHp: 30,
    baseSpeed: 70,
    contactDamage: 8,
    xp: 1,
    weight: 70,
    minMinute: 0
  },
  fast: {
    kind: 'fast',
    color: COLORS.enemyFast,
    radius: 16,
    baseHp: 20,
    baseSpeed: 120,
    contactDamage: 6,
    xp: 2,
    weight: 25,
    minMinute: 1
  },
  tank: {
    kind: 'tank',
    color: COLORS.enemyTank,
    radius: 30,
    baseHp: 120,
    baseSpeed: 48,
    contactDamage: 16,
    xp: 5,
    weight: 12,
    minMinute: 2
  }
};

export const ENEMY_POOL_MAX = 600;

// --- Spawner & difficulty ramp ------------------------------------------
export const SPAWN = {
  rampIntervalSec: 60,
  baseIntervalMs: 900,
  intervalDecayPerMinute: 0.82,
  minIntervalMs: 140,
  baseBatch: 2,
  batchGrowthPerMinute: 1,
  maxBatch: 18,
  hpGrowthPerMinute: 0.18,
  speedGrowthPerMinute: 0.06,
  offscreenMargin: 80,
  maxAlive: 500
} as const;

// --- Gems / XP -----------------------------------------------------------
export const GEM = {
  radius: 9,
  poolMax: 600,
  magnetSpeed: 520,
  collectDistance: 18
} as const;

export const XP = {
  baseRequirement: 5,
  growth: 1.35,
  flatPerLevel: 2
} as const;

export function xpForLevel(level: number): number {
  return Math.round(
    XP.baseRequirement * Math.pow(XP.growth, level - 1) +
      XP.flatPerLevel * (level - 1)
  );
}

// --- In-run upgrades (offered on level-up) --------------------------------
export interface UpgradeDef {
  kind: UpgradeKind;
  title: string;
  description: string;
  unique?: boolean;
}

export const UPGRADES: UpgradeDef[] = [
  { kind: 'damage',    title: '+25% Damage',      description: 'All weapons hit harder.' },
  { kind: 'fireRate',  title: '+15% Fire Rate',   description: 'Weapons fire more often.' },
  { kind: 'moveSpeed', title: '+12% Move Speed',  description: 'Dodge faster.' },
  { kind: 'maxHp',     title: '+20 Max HP',       description: 'Raise max HP and heal a little.' },
  { kind: 'pickup',    title: '+30% Pickup Range', description: 'Vacuum gems from farther away.' },
  { kind: 'weaponOrb', title: 'New Weapon: Orbs', description: 'Launch a spread of homing orbs.', unique: true }
];

export const UPGRADE_VALUES = {
  damageMult: 0.25,
  fireRateMult: 0.15,
  moveSpeedMult: 0.12,
  maxHpFlat: 20,
  maxHpHeal: 15,
  pickupMult: 0.3
} as const;

// --- Scoring (in-run) ----------------------------------------------------
export const SCORE = {
  perSecond: 10,
  perKill: 12,
  perLevel: 100
} as const;

export function computeScore(survivedMs: number, kills: number, level: number): number {
  return Math.floor(
    (survivedMs / 1000) * SCORE.perSecond +
      kills * SCORE.perKill +
      level * SCORE.perLevel
  );
}

// =========================================================================
// META-PROGRESSION — everything below is new in Milestone 2
// =========================================================================

// --- Coin earnings -------------------------------------------------------
export const COIN_FORMULA = {
  perSecond: 0.5,
  perKill: 1,
  perLevel: 5
} as const;

/** greedMult = 1 + GREED_MULT_PER_LEVEL * greedSkillLevel */
export const GREED_MULT_PER_LEVEL = 0.2;

export function computeCoins(
  survivedMs: number,
  kills: number,
  levelReached: number,
  greedMult: number
): number {
  const raw =
    (survivedMs / 1000) * COIN_FORMULA.perSecond +
    kills * COIN_FORMULA.perKill +
    levelReached * COIN_FORMULA.perLevel;
  return Math.floor(raw * greedMult);
}

// --- Skill tree ----------------------------------------------------------
export interface SkillDef {
  id: SkillId;
  title: string;
  description: string;
  maxLevel: number;
  /** Human-readable effect shown on the upgrade card. */
  effectLabel: string;
}

/** Cost in coins to advance from currentLevel → currentLevel+1. */
export function skillCost(currentLevel: number): number {
  return Math.round(100 * Math.pow(1.6, currentLevel));
}

export const SKILLS: Record<SkillId, SkillDef> = {
  vitality: {
    id: 'vitality',
    title: 'Vitality',
    description: 'Increases base max HP.',
    maxLevel: 5,
    effectLabel: '+20 Max HP per level'
  },
  power: {
    id: 'power',
    title: 'Power',
    description: 'Boosts all weapon damage.',
    maxLevel: 5,
    effectLabel: '+15% Damage per level'
  },
  swiftness: {
    id: 'swiftness',
    title: 'Swiftness',
    description: 'Increases base move speed.',
    maxLevel: 5,
    effectLabel: '+8% Move Speed per level'
  },
  magnetism: {
    id: 'magnetism',
    title: 'Magnetism',
    description: 'Expands gem pickup radius.',
    maxLevel: 4,
    effectLabel: '+25% Pickup Radius per level'
  },
  greed: {
    id: 'greed',
    title: 'Greed',
    description: 'Multiplies coins earned after each run.',
    maxLevel: 4,
    effectLabel: '+20% Coin Multiplier per level'
  },
  headStart: {
    id: 'headStart',
    title: 'Head Start',
    description: 'Begin each run at a higher in-run level.',
    maxLevel: 3,
    effectLabel: '+1 Starting Level per level'
  },
  secondWind: {
    id: 'secondWind',
    title: 'Second Wind',
    description: 'Revive once per run at partial HP when you die.',
    maxLevel: 2,
    effectLabel: 'Revive at 30% HP (level 1) / 50% HP (level 2)'
  }
};

/** Per-level stat deltas applied to base stats at run start. */
export const SKILL_STAT_DELTA: Record<SkillId, Partial<PlayerStats>> = {
  vitality:   { maxHp: 20 },
  power:      { damageMult: 0.15 },
  swiftness:  { moveSpeed: 0 },   // handled multiplicatively in MetaBonusResolver
  magnetism:  { pickupRadius: 0 }, // handled multiplicatively
  greed:      {},                  // handled via greedMult, not PlayerStats
  headStart:  {},                  // handled via startLevel, not PlayerStats
  secondWind: {}                   // handled via secondWindReviveFrac
};

/** Multiplicative per-level boosts (applied as * (1 + n*rate)^levels). */
export const SKILL_MULT_DELTA: Partial<Record<SkillId, { stat: keyof PlayerStats; rate: number }>> = {
  swiftness: { stat: 'moveSpeed',    rate: 0.08 },
  magnetism: { stat: 'pickupRadius', rate: 0.25 }
};

/** Revive fraction per second-wind level (index = level-1). */
export const SECOND_WIND_REVIVE_FRACS = [0.3, 0.5] as const;

// --- Characters ----------------------------------------------------------
export interface CharacterDef {
  id: CharacterId;
  name: string;
  description: string;
  /** Hex color used for the character avatar texture. */
  color: number;
  /** Coin cost to unlock; 0 = free. */
  cost: number;
  startingWeapon: Weapon;
  /** Flat / multiplicative stat deltas applied ON TOP of skill-tree bonuses. */
  passive: Partial<PlayerStats>;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'Balanced fighter with a faster firing bolt.',
    color: 0x4cd5ff,
    cost: 0,
    startingWeapon: { ...STARTING_WEAPON },
    passive: { fireRateMult: -0.1 }  // negative = faster (fireRateMult is interval multiplier)
  },
  bruiser: {
    id: 'bruiser',
    name: 'Bruiser',
    description: 'Tanky brawler: more HP, slower on their feet.',
    color: 0xff9d3d,
    cost: 500,
    startingWeapon: { ...STARTING_WEAPON },
    passive: { maxHp: 40, moveSpeed: -18 }
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    description: 'Glass-cannon speedster who starts with the Orb spread weapon.',
    color: 0xb15aff,
    cost: 1200,
    startingWeapon: { ...ORB_WEAPON },
    passive: { moveSpeed: 46, maxHp: -15 }
  }
};

// Save/meta constants
// v2 adds server-authoritative account fields (level/xp/bestScore) to the profile.
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'bh_save';
/** Set once the local M2 save has been migrated up to the cloud profile. */
export const MIGRATED_KEY = 'bh_migrated';
