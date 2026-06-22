import { supabase } from './SupabaseClient';
import { saveService } from '../save/SaveService';
import type { ProfileRow, SubmitMatchResult } from '../types/supabase';

// ---------------------------------------------------------------------------
// Thin typed wrappers over the Supabase client. All methods resolve to null /
// false on failure so callers can degrade gracefully offline — they never throw.
// ---------------------------------------------------------------------------

class ApiService {
  /** Fetch the authenticated user's profile row. */
  async fetchProfile(userId: string): Promise<ProfileRow | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.warn('[Api] fetchProfile failed:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[Api] fetchProfile error:', err);
      return null;
    }
  }

  /**
   * Push the local cache up to the profiles row (used for the one-time legacy
   * migration and for skill/character purchase write-through).
   */
  async pushProfile(userId: string): Promise<boolean> {
    try {
      const payload = { id: userId, ...saveService.toServerShape() };
      const { error } = await supabase.from('profiles').upsert(payload);
      if (error) {
        console.warn('[Api] pushProfile failed:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Api] pushProfile error:', err);
      return false;
    }
  }

  /**
   * Submit a finished run. The server computes and persists the rewards; we only
   * send the raw run stats. Returns the server-computed {score, coins, xp}, or
   * null if the call failed (caller should queue to the outbox).
   */
  async submitMatch(
    durationSeconds: number,
    kills: number,
    level: number
  ): Promise<SubmitMatchResult | null> {
    try {
      const { data, error } = await supabase.rpc('submit_match', {
        p_duration: durationSeconds,
        p_kills: kills,
        p_level: level
      });
      if (error) {
        console.warn('[Api] submitMatch failed:', error.message);
        return null;
      }
      // The RPC returns a single-row table.
      const row = Array.isArray(data) ? data[0] : (data as SubmitMatchResult | null);
      return row ?? null;
    } catch (err) {
      console.warn('[Api] submitMatch error:', err);
      return null;
    }
  }
}

export const apiService = new ApiService();
