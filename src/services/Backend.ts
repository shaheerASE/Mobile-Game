import { authService } from './AuthService';
import { apiService } from './ApiService';
import { saveService } from '../save/SaveService';
import { outbox, type QueuedRun } from '../save/outbox';
import { isSupabaseConfigured } from './SupabaseClient';

// ---------------------------------------------------------------------------
// Backend coordinator — the single place that ties auth + API + save together.
//
// Owns the `online` flag the rest of the game reads. Currencies and progression
// are SERVER-AUTHORITATIVE: the cloud profile always overwrites the local cache,
// and coin-spending actions are disabled while offline.
// ---------------------------------------------------------------------------

export interface SubmitOutcome {
  /** Server-computed coins for THIS run (display value on Game Over). */
  coins: number;
  xp: number;
  /** True when the run was queued offline rather than committed server-side. */
  isOffline: boolean;
}

class Backend {
  /** True once signed in AND a profile is reachable. */
  online = false;
  private userId: string | null = null;
  private bootstrapped = false;

  /**
   * Full launch sequence. Order matters (amendment #2): ensure the profile,
   * migrate legacy local data UP only if the cloud profile is pristine, and
   * THEN load from the server. Never load before migrating.
   */
  async bootstrap(): Promise<void> {
    this.bootstrapped = true;

    if (!isSupabaseConfigured) {
      this.online = false;
      return;
    }

    const uid = await authService.signInIfNeeded();
    if (!uid) {
      this.online = false;
      return;
    }
    this.userId = uid;

    // 1. ensure a profile row exists (server trigger usually has already).
    const { profile, pristine } = await authService.ensureProfile(uid);
    if (!profile) {
      // Signed in but profile unreachable — treat as offline this session.
      this.online = false;
      return;
    }
    this.online = true;

    // 2. one-time legacy migration: push local M2 progress UP, but only when
    //    the cloud profile has never been played and we haven't migrated yet.
    if (!saveService.isMigrated()) {
      if (pristine && saveService.hasLocalProgress()) {
        const pushed = await apiService.pushProfile(uid);
        if (pushed) saveService.markMigrated();
      } else {
        // Nothing to migrate (cloud already has progress, or no local data).
        saveService.markMigrated();
      }
    }

    // 3. NOW load from server — authoritative overwrite of the local cache.
    await this.refreshProfile();

    // 4. drain any runs queued while offline, then refetch so the server total
    //    wins. The drain RE-SUBMITS only; it never credits coins locally.
    await this.drainOutbox();
  }

  /** Refetch the cloud profile and overwrite the local cache. */
  async refreshProfile(): Promise<boolean> {
    if (!this.online || !this.userId) return false;
    const row = await apiService.fetchProfile(this.userId);
    if (!row) return false;
    saveService.loadFromServer(row);
    return true;
  }

  /**
   * Submit a finished run. On success the rewards are server-computed and the
   * local cache is refreshed from the server. On failure the raw stats are
   * queued (display-only fallback coins are shown but NOT committed).
   */
  async submitRun(durationSeconds: number, kills: number, level: number): Promise<SubmitOutcome> {
    if (this.online) {
      const result = await apiService.submitMatch(durationSeconds, kills, level);
      if (result) {
        await this.refreshProfile();
        return { coins: result.coins, xp: result.xp, isOffline: false };
      }
    }
    // Offline / unconfigured / failed — queue raw stats for a later retry.
    outbox.push({ durationSeconds, kills, level });
    return { coins: 0, xp: 0, isOffline: true };
  }

  /**
   * Write the local cache up to the server after a coin-spend (skill / character
   * purchase). Returns false if the push failed; the caller should refresh from
   * the server to snap back to the authoritative state.
   */
  async pushProgress(): Promise<boolean> {
    if (!this.online || !this.userId) return false;
    return apiService.pushProfile(this.userId);
  }

  private async drainOutbox(): Promise<void> {
    if (!this.online) return;
    const queued = outbox.drain();
    if (queued.length === 0) return;

    const failed: QueuedRun[] = [];
    for (const run of queued) {
      const ok = await apiService.submitMatch(run.durationSeconds, run.kills, run.level);
      if (!ok) failed.push(run);
    }
    if (failed.length > 0) outbox.restore(failed);

    // Server-wins: refetch so the authoritative total reflects the drained runs.
    await this.refreshProfile();
  }

  isReady(): boolean {
    return this.bootstrapped;
  }
}

export const backend = new Backend();
