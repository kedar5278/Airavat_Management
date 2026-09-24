import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    let deviceId = "";
    if (typeof window !== "undefined") {
      deviceId = localStorage.getItem("airavat-device-id") ?? "";
      if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem("airavat-device-id", deviceId); }
    }
    client = createBrowserClient(url, key, { global: { headers: deviceId ? { "x-airavat-device-id": deviceId } : {} } });
  }
  return client;
}
