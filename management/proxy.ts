import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/?setup=supabase", request.url));
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    global: { headers: { "x-airavat-device-id": request.cookies.get("airavat-device-id")?.value ?? "" } },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/?login=required", request.url));
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.redirect(new URL("/api/admin/logout?reason=unauthorized", request.url));
  const deviceId = request.cookies.get("airavat-device-id")?.value;
  const { data: lease } = await supabase.rpc("heartbeat_admin_device", { p_device_id: deviceId });
  if (!lease?.allowed) return NextResponse.redirect(new URL("/?login=required", request.url));
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
