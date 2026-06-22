// ---------------------------------------------------------------------------
// Supabase database types.
//
// Hand-authored to match supabase/migrations/20260622000001_m3_server_authoritative.sql.
// Mirrors the shape `supabase gen types typescript` would emit. Regenerate from
// desktop after schema changes:
//   supabase gen types typescript --project-id mygbxodwktbsrrevxcol > src/types/supabase.ts
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          level: number;
          xp: number;
          coins: number;
          gems: number;
          best_score: number;
          upgrades: Json;
          characters: string[];
          equipped_character: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          level?: number;
          xp?: number;
          coins?: number;
          gems?: number;
          best_score?: number;
          upgrades?: Json;
          characters?: string[];
          equipped_character?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          level?: number;
          xp?: number;
          coins?: number;
          gems?: number;
          best_score?: number;
          upgrades?: Json;
          characters?: string[];
          equipped_character?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      match_results: {
        Row: {
          id: string;
          user_id: string;
          score: number;
          coins_earned: number;
          xp_earned: number;
          duration_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score: number;
          coins_earned?: number;
          xp_earned?: number;
          duration_seconds: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score?: number;
          coins_earned?: number;
          xp_earned?: number;
          duration_seconds?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'match_results_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      leaderboard_entries: {
        Row: {
          user_id: string;
          season: string;
          best_score: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          season: string;
          best_score?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          season?: string;
          best_score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leaderboard_entries_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      submit_match: {
        Args: { p_duration: number; p_kills: number; p_level: number };
        Returns: { score: number; coins: number; xp: number }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

/** Convenience aliases for the profiles row used across the client. */
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type MatchResultRow = Database['public']['Tables']['match_results']['Row'];
export type SubmitMatchResult = { score: number; coins: number; xp: number };
