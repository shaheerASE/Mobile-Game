import { isSupabaseConfigured, supabase } from './SupabaseClient';
import type { ProfileRow } from '../types/supabase';

// ---------------------------------------------------------------------------
// Auth lifecycle: anonymous sign-in + profile-row existence.
//
// Anonymous auth means the player never sees a login screen — an identity is
// minted on first launch and persisted to localStorage. M4 will add linking to
// a real account on top of the same uid.
// ---------------------------------------------------------------------------

class AuthService {
  /** Current authenticated user id, or null when offline / unconfigured. */
  async signInIfNeeded(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) return sessionData.session.user.id;

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        console.warn('[Auth] anonymous sign-in failed:', error?.message);
        return null;
      }
      return data.user.id;
    } catch (err) {
      console.warn('[Auth] sign-in error:', err);
      return null;
    }
  }

  /**
   * Ensure a profiles row exists for this user. A DB trigger normally creates
   * it at sign-up, but we defensively insert defaults if it's missing.
   * Returns the row plus whether the server profile is "pristine" (never played)
   * — the migration gate uses that to decide whether to push legacy local data.
   */
  async ensureProfile(
    userId: string
  ): Promise<{ profile: ProfileRow | null; pristine: boolean }> {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (existing) {
        return { profile: existing, pristine: this.isPristine(existing) };
      }

      // Row missing — create defaults. Server defaults fill the rest.
      const { data: created, error } = await supabase
        .from('profiles')
        .insert({ id: userId })
        .select()
        .single();

      if (error) {
        console.warn('[Auth] ensureProfile insert failed:', error.message);
        return { profile: null, pristine: true };
      }
      return { profile: created, pristine: true };
    } catch (err) {
      console.warn('[Auth] ensureProfile error:', err);
      return { profile: null, pristine: false };
    }
  }

  /** A profile that has never earned anything — safe to seed from local data. */
  private isPristine(p: ProfileRow): boolean {
    return p.coins === 0 && p.xp === 0 && p.best_score === 0;
  }
}

export const authService = new AuthService();
