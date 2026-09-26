import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { id?: string; phone?: string } | null;
  const id = body?.id?.trim();
  const phone = (body?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!id || phone.length !== 10) return NextResponse.json({ error: "Enter your Guard ID and registered mobile number." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Guard login server key is not configured." }, { status: 503 });

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: guard, error } = await sb.from("guards").select("id,name,phone,email,designation,site,shift,status,photo_path").eq("id", id).eq("status", "Active").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  if (!guard || guard.phone.replace(/\D/g, "").slice(-10) !== phone) return NextResponse.json({ error: "Guard ID or mobile number is incorrect." }, { status: 401 });

  const store = await cookies();
  store.set("airavat-guard-id", guard.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return NextResponse.json({ ok: true });
}
