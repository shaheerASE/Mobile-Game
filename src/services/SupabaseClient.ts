import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// ---------------------------------------------------------------------------
// Singleton Supabase client.
//
// Reads the publishable (anon) key — safe to expose to the browser; row-level
// security on the server is what actually protects data. Session is persisted
// to localStorage so the anonymous identity survives reloads.
// ---------------------------------------------------------------------------

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars are present; lets the game degrade gracefully offline. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Not fatal — the game still runs fully offline. Warn so misconfig is obvious.
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — ' +
      'running in offline-only mode.'
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? 'http://localhost',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);
