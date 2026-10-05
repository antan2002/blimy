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
        const token = await getAuthToken(key);
        if (!token) return null;
        // Supabase expects a JSON object for the main session token. Legacy tokens are JWTs (e.g., 'ey...').
        // Hide legacy tokens from Supabase to prevent gotrue-js from failing to parse
        // them as JSON and subsequently deleting them from secure storage.
        if (key === "blimy_auth_token" && !token.startsWith("{")) {
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
