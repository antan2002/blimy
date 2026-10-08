import { createClient } from "@supabase/supabase-js";
import { getAuthToken, storeAuthToken, removeAuthToken } from "@/features/window/services/auth-api";

import { getSupabaseAuthStorageKey } from "./auth-storage-key";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "dummy-anon-key";
const STORAGE_KEY = getSupabaseAuthStorageKey(supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: STORAGE_KEY,
    flowType: "pkce",
    storage: {
      getItem: async (key: string) => {
        const token = await getAuthToken(key);
        if (!token) return null;
        if (key === STORAGE_KEY && !token.startsWith("{")) {
          return null;
        }
        return token;
      },
      setItem: async (key: string, value: string) => {
        await storeAuthToken(value, key);
      },
      removeItem: async (key: string) => {
        await removeAuthToken(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We will manually handle the deep link in Tauri
  },
});
