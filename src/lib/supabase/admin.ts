import "server-only";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

// Server-only Supabase client.
//
// Prefers SUPABASE_SERVICE_ROLE_KEY (bypasses RLS — required once migration
// 0002 revokes anon access) and falls back to the publishable key so
// pre-lockdown deployments keep working during the switchover.
//
// The service key is a full-privilege secret: it must NEVER get a
// NEXT_PUBLIC_ prefix, and the `import "server-only"` guard above makes any
// accidental client-bundle import a build error.
export function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}
