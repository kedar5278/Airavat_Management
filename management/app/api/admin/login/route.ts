import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const expectedId = process.env.ADMIN_LOGIN_ID;
  const expectedEmail = process.env.SUPABASE_ADMIN_EMAIL;
  if (!expectedId || !expectedEmail) return NextResponse.json({ error: "Admin login is not configured on the server." }, { status: 503 });
  const body = await request.json().catch(() => null) as { id?: string; password?: string; deviceId?: string; deviceName?: string } | null;
  if (!body?.id || !body.password || !body.deviceId) return NextResponse.json({ error: "Enter your admin ID and password." }, { status: 400 });
  const suppliedId = body.id.trim().toLowerCase();
  if (suppliedId !== expectedId.trim().toLowerCase() && suppliedId !== expectedEmail.trim().toLowerCase()) return NextResponse.json({ error: "Admin ID or password is incorrect." }, { status: 401 });
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: expectedEmail, password: body.password });
    if (error || !data.user) return NextResponse.json({ error: "Admin ID or password is incorrect." }, { status: 401 });
    const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (adminError) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Supabase admin database setup is incomplete. Run the full supabase/schema.sql file in this project's SQL Editor, then try again." }, { status: 503 });
    }
    if (!admin) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "This Supabase account is not authorized as an admin." }, { status: 403 });
    }
    const { data: slot, error: slotError } = await supabase.rpc("claim_admin_device", { p_device_id: body.deviceId, p_device_name: (body.deviceName ?? "Browser").slice(0, 120) });
    if (slotError || !slot?.allowed) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: slotError?.message ?? "Admin is already signed in on two devices. Sign out one device and try again." }, { status: 409 });
    }
    const cookieStore = await cookies();
    cookieStore.set("airavat-device-id", body.deviceId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect to Supabase.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
