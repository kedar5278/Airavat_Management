import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function logout(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const body = request.method === "POST" ? await request.json().catch(() => ({})) as { deviceId?: string } : {};
    if (body.deviceId) await supabase.rpc("release_admin_device", { p_device_id: body.deviceId });
    await supabase.auth.signOut({ scope: "local" });
    (await cookies()).delete("airavat-device-id");
  } catch { /* Always clear the local UI session even if the network is unavailable. */ }
  return request.method === "GET" ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.json({ ok: true });
}
export async function POST(request: Request) { return logout(request); }
export async function GET(request: Request) { return logout(request); }
