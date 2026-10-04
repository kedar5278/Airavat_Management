import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const deviceId = url.searchParams.get("deviceId");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !deviceId) {
      return NextResponse.json({ error: "Valid attendance date and device session are required." }, { status: 400 });
    }

    const server = await getSupabaseServerClient();
    const { data: { user } } = await server.auth.getUser();
    if (!user) return NextResponse.json({ error: "Session expired." }, { status: 401 });

    const { data: allowed, error: deviceError } = await server.rpc("heartbeat_admin_device", {
      p_device_id: deviceId,
    });
    if (deviceError || !allowed?.allowed) {
      return NextResponse.json({ error: "This admin device session has expired." }, { status: 409 });
    }

    const admin = getSupabaseAdminClient();

    let query = admin
      .from("guard_attendance")
      .select("guard_id,attendance_date,attendance_time,latitude,longitude,accuracy,address,selfie_path,status");

    if (guardId) query = query.eq("guard_id", guardId);
    if (month) {
      const start = month + "-01";
      const [year, monthNumber] = month.split("-").map(Number);
      const endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
      query = query.gte("attendance_date", start).lte("attendance_date", endDate);
    } else if (date) {
      query = query.eq("attendance_date", date);
    }

    const { data, error } = await query
      .order("attendance_date", { ascending: false })
      .order("attendance_time", { ascending: false });

    if (error) throw error;

    const rows = [];
    for (const row of data ?? []) {
      let selfie_url: string | null = null;
      if (row.selfie_path) {
        const signed = await admin.storage
          .from("guard-attendance-selfies")
          .createSignedUrl(row.selfie_path, 600);
        selfie_url = signed.data?.signedUrl ?? null;
      }
      rows.push({ ...row, selfie_url });
    }

    return NextResponse.json({ evidence: rows });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : "Could not load attendance details.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
