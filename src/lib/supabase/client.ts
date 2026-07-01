import { createClient } from "@supabase/supabase-js";
import { createPreferenceAwareAuthStorage } from "./auth-storage";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

const url = getSupabaseUrl();
const key = getSupabaseAnonKey();

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        storage: createPreferenceAwareAuthStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
