import { MIGRATED_KEY, SAVE_KEY, SAVE_VERSION } from '../config/GameConfig';
import type { CharacterId, SkillId } from '../types';
import type { ProfileRow } from '../types/supabase';
import { defaultSave, type SaveData, type SkillLevels } from './SaveTypes';

const VALID_CHARACTERS: CharacterId[] = ['ranger', 'bruiser', 'phantom'];

/**
 * Singleton that owns the in-memory save object and syncs it to localStorage.
 * All mutations go through this class so persistence is always consistent.
 *
 * M3: the cloud profile is authoritative. `loadFromServer` OVERWRITES the local
 * cache; local writes are still made optimistically but are reconciled against
 * the server (see Backend). This class stays network-free on purpose.
 */
class SaveService {
  private data: SaveData;

  constructor() {
    this.data = this.loadFromStorage();
  }

  private loadFromStorage(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return this.migrate(parsed);
    } catch {
      return defaultSave();
    }
  }

  /** Fill in missing fields from newer versions and bump the version number. */
  private migrate(raw: Partial<SaveData>): SaveData {
    const def = defaultSave();
    const save: SaveData = {
      version: SAVE_VERSION,
      profile: { ...def.profile, ...(raw.profile ?? {}) },
      upgrades: { ...def.upgrades, ...(raw.upgrades ?? {}) },
      characters: raw.characters ?? def.characters
    };
    // Ranger is always owned.
    if (!save.characters.includes('ranger')) save.characters.push('ranger');
    this.persist(save);
    return save;
  }

  private persist(save: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // localStorage may be unavailable in some environments — fail silently.
    }
  }

  get(): SaveData {
    return this.data;
  }

  addCoins(amount: number): void {
    this.data.profile.coins += amount;
    this.persist(this.data);
  }

  spendCoins(amount: number): boolean {
    if (this.data.profile.coins < amount) return false;
    this.data.profile.coins -= amount;
    this.persist(this.data);
    return true;
  }

  setSkillLevel(id: SkillId, level: number): void {
    this.data.upgrades[id] = level;
    this.persist(this.data);
  }

  unlockCharacter(id: CharacterId): void {
    if (!this.data.characters.includes(id)) {
      this.data.characters.push(id);
      this.persist(this.data);
    }
  }

  equipCharacter(id: CharacterId): void {
    this.data.profile.equippedCharacter = id;
    this.persist(this.data);
  }

  /** Wipe the save — useful for testing; not exposed to players in this milestone. */
  reset(): void {
    this.data = defaultSave();
    this.persist(this.data);
  }

  // --- M3: cloud sync helpers (network-free) -----------------------------

  /**
   * SERVER-AUTHORITATIVE load: overwrite the local cache with the cloud profile.
   * Currencies, account stats, upgrades, characters and equip all come from the
   * server — local values are discarded (see amendment #1).
   */
  loadFromServer(row: ProfileRow): void {
    this.data.profile.coins = row.coins;
    this.data.profile.gems = row.gems;
    this.data.profile.level = row.level;
    this.data.profile.xp = row.xp;
    this.data.profile.bestScore = row.best_score;
    this.data.profile.equippedCharacter = this.sanitizeChar(row.equipped_character);
    this.data.upgrades = this.mergeUpgrades(row.upgrades);
    this.data.characters = this.sanitizeCharacters(row.characters);
    this.persist(this.data);
  }

  /** Map the local cache into the `profiles` column shape for upsert/push. */
  toServerShape(): {
    coins: number;
    gems: number;
    level: number;
    xp: number;
    best_score: number;
    upgrades: SkillLevels;
    characters: string[];
    equipped_character: string;
  } {
    return {
      coins: this.data.profile.coins,
      gems: this.data.profile.gems,
      level: this.data.profile.level,
      xp: this.data.profile.xp,
      best_score: this.data.profile.bestScore,
      upgrades: { ...this.data.upgrades },
      characters: [...this.data.characters],
      equipped_character: this.data.profile.equippedCharacter
    };
  }

  /** True when the local cache holds real M2 progress worth migrating up. */
  hasLocalProgress(): boolean {
    const p = this.data.profile;
    return (
      p.coins > 0 ||
      p.gems > 0 ||
      p.bestScore > 0 ||
      this.data.characters.length > 1 ||
      Object.values(this.data.upgrades).some((v) => v > 0)
    );
  }

  isMigrated(): boolean {
    try {
      return localStorage.getItem(MIGRATED_KEY) === '1';
    } catch {
      return false;
    }
  }

  markMigrated(): void {
    try {
      localStorage.setItem(MIGRATED_KEY, '1');
    } catch {
      // ignore
    }
  }

  private sanitizeChar(id: string): CharacterId {
    return (VALID_CHARACTERS as string[]).includes(id) ? (id as CharacterId) : 'ranger';
  }

  private sanitizeCharacters(ids: string[]): CharacterId[] {
    const valid = ids.filter((id) => (VALID_CHARACTERS as string[]).includes(id)) as CharacterId[];
    if (!valid.includes('ranger')) valid.unshift('ranger');
    return valid;
  }

  /** Fill any missing skill keys with 0 and drop unknown keys. */
  private mergeUpgrades(raw: unknown): SkillLevels {
    const merged = defaultSave().upgrades;
    if (raw && typeof raw === 'object') {
      for (const key of Object.keys(merged) as SkillId[]) {
        const v = (raw as Record<string, unknown>)[key];
        if (typeof v === 'number' && Number.isFinite(v)) merged[key] = v;
      }
    }
    return merged;
  }
}

// Singleton instance exported for use across all scenes.
export const saveService = new SaveService();
