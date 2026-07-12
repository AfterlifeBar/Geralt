import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load ../.env.local (relative to this file) into a plain object.
export function loadEnv() {
  return Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

// Anon-key Supabase client built from .env.local — the same credentials the
// app uses, so scripts exercise the exact RLS path production will.
export function createAnonClient() {
  const env = loadEnv();
  return {
    env,
    client: createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}
