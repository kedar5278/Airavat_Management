import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test login is disabled in production." }, { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server Supabase key is missing." }, { status: 503 });
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: guard, error } = await sb.from("guards").select("id").eq("status","Active").limit(1).maybeSingle();
  if (error || !guard) return NextResponse.json({ error: error?.message || "Create one Active guard first." }, { status: 404 });
  const store = await cookies();
  store.set("airavat-guard-id", guard.id, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 3600 });
  return NextResponse.redirect(new URL("/guard", "http://localhost:3000"));
}
