import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET() {
  const id = (await cookies()).get("airavat-guard-id")?.value;
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Guard login server key is not configured." }, { status: 503 });
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: guard, error } = await sb.from("guards").select("id,name,phone,email,designation,site,shift,status,photo_path").eq("id", id).eq("status", "Active").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  if (!guard) return NextResponse.json({ error: "Guard profile not found." }, { status: 401 });
  const { data: attendance } = await sb.from("guard_attendance").select("attendance_date,attendance_time,latitude,longitude,selfie_path,status").eq("guard_id", id).order("attendance_date", { ascending: false }).limit(90);
  return NextResponse.json({ guard, attendance: attendance ?? [] });
}
