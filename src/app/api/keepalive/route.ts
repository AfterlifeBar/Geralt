import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Hit daily by Vercel Cron (see vercel.json) so the free-tier Supabase
// project never reaches its inactivity pause.
export async function GET() {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("stocks").select("code").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
