import { createClient } from "@supabase/supabase-js";
import { getAuthToken, storeAuthToken, removeAuthToken } from "@/features/window/services/auth-api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "dummy-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "blimy_auth_token",
    flowType: "pkce",
    storage: {
      getItem: async (key: string) => {
        return await getAuthToken(key);
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
