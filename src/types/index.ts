// Shared type definitions used across systems and entities.

/** Mutable player stats. Upgrades mutate this object in place. */
export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  /** Multiplier applied to every weapon's base damage. */
  damageMult: number;
  /** Multiplier applied to every weapon's fire interval (lower = faster). */
  fireRateMult: number;
  /** Radius within which gems are sucked toward the player. */
  pickupRadius: number;
}

export type WeaponId = 'bolt' | 'orb';

/** A weapon instance owned by the player. */
export interface Weapon {
  id: WeaponId;
  /** Base time between shots in ms (before fireRateMult). */
  baseInterval: number;
  /** Base damage per projectile (before damageMult). */
  baseDamage: number;
  projectileSpeed: number;
  /** Number of projectiles fired per volley. */
  count: number;
  /** ms until the next shot is allowed. Managed by WeaponSystem. */
  cooldown: number;
}

export type UpgradeKind =
  | 'damage'
  | 'fireRate'
  | 'moveSpeed'
  | 'maxHp'
  | 'pickup'
  | 'weaponOrb';

export interface UpgradeChoice {
  kind: UpgradeKind;
  title: string;
  description: string;
}

// --- Meta-progression types -------------------------------------------

export type SkillId =
  | 'vitality'
  | 'power'
  | 'swiftness'
  | 'magnetism'
  | 'greed'
  | 'headStart'
  | 'secondWind';

export type CharacterId = 'ranger' | 'bruiser' | 'phantom';

/**
 * Everything the GameScene needs from the meta layer to initialise a run.
 * Produced by MetaBonusResolver from the current SaveData.
 */
export interface RunConfig {
  baseStats: PlayerStats;
  startingWeapon: Weapon;
  /** In-run level the player spawns at (1 = default, Head Start adds levels). */
  startLevel: number;
  /** Fraction of maxHp restored on second wind; null if skill not owned. */
  secondWindReviveFrac: number | null;
  /** Coin earnings multiplier (1.0 = no bonus). */
  greedMult: number;
}

/** Snapshot of a finished run, handed to the Game Over screen. */
export interface RunResult {
  survivedMs: number;
  kills: number;
  level: number;
  score: number;
  coinsEarned: number;
  /** Server-confirmed coins for this run (set when submit_match succeeded). */
  serverCoins?: number;
  /** Server-confirmed account XP gained this run. */
  serverXp?: number;
  /** True when the run was queued offline; coinsEarned is a display estimate. */
  isOffline?: boolean;
}
