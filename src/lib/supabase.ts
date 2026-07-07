import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Surfaced early so a missing .env is obvious, not a silent blank screen.
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.",
  );
}

/** Authenticated researcher client (uses the logged-in session). */
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/**
 * Participant client scoped to a single interview session. The per-session
 * access token is sent as `x-session-token`; Supabase RLS uses it so a
 * participant can only read/write their own session, messages and audio.
 */
export function participantClient(sessionToken: string) {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-session-token": sessionToken } },
  });
}
