import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { deviceId?: string };
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    const { data, error } = await supabase.rpc("heartbeat_admin_device", { p_device_id: body.deviceId });
    if (error || !data?.allowed) return NextResponse.json({ error: "This device session has expired. Sign in again." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not renew device session." }, { status: 503 }); }
}
