"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Guard, View } from "./management-types";
import { rowToGuard, guardToRow } from "./management-utils";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Roster from "./Roster";
import RegisterGuard from "./RegisterGuard";
import Profile from "./Profile";

const getDeviceId = () => { let id = localStorage.getItem("airavat-device-id"); if (!id) { id = crypto.randomUUID(); localStorage.setItem("airavat-device-id", id); } return id; };

export default function ManagementApp() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("Dashboard");
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Guard | null>(null);
  const [notice, setNotice] = useState("");
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { if (mounted) { setAuthReady(true); setSessionChecking(false); } return; }
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!user) { setLoggedIn(false); setAuthReady(true); setSessionChecking(false); return; }
        const heartbeat = await fetch("/api/admin/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId() }), cache: "no-store" });
        if (mounted) { setLoggedIn(heartbeat.ok); setAuthReady(true); setSessionChecking(false); }
      } catch {
        if (mounted) { setLoggedIn(false); setAuthReady(true); setSessionChecking(false); }
      }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setInterval(() => {
      void fetch("/api/admin/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId() }) }).then(r => { if (!r.ok) { setLoggedIn(false); flash("Your device login expired. Please sign in again."); } });
    }, 40000);
    return () => window.clearInterval(timer);
  }, [loggedIn]);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void Promise.all([
      supabase.from("guards").select("*").order("created_at", { ascending: false }),
    ]).then(([guardResult]) => {
      const failure = guardResult.error;
      if (failure) throw failure;
      if (cancelled) return;
      setGuards((guardResult.data ?? []).map(rowToGuard));
      setDatabaseReady(true);
    }).catch(e => { if (!cancelled) { setNotice(`Supabase data could not load: ${e.message ?? "Check that supabase/schema.sql has been run."}`); setDatabaseReady(true); } });
    return () => { cancelled = true; };
  }, [loggedIn]);
  useEffect(() => { if (loggedIn && databaseReady) { const sb = getSupabaseBrowserClient(); if (sb && guards.length) void sb.from("guards").upsert(guards.map(guardToRow)).then((result: { error: { message: string } | null }) => { if (result.error) setNotice(`Could not save guard records: ${result.error.message}`); }); } }, [guards, loggedIn, databaseReady]);

  const active = guards.filter(g => g.status === "Active").length;
  const filtered = useMemo(() => guards.filter(g => (filter === "All" || g.status === filter) && `${g.name} ${g.id} ${g.site} ${g.phone} ${g.aadhaar} ${g.designation}`.toLowerCase().includes(query.toLowerCase())), [guards, query, filter]);
  const go = (next: View) => { setSelected(null); setView(next); };
  const logout = () => { void fetch("/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId() }) }); setLoggedIn(false); setDatabaseReady(false); };

  if (sessionChecking) return <div className="login-screen"><div className="login-brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service" width={112} height={108} className="login-logo"/><h1>AIRAVAT</h1><div className="gold-kicker">SECURITY SERVICE</div><p>સર્વદા શક્તિશાળી</p></div><div className="login-card login-hydrating" role="status">Checking secure session…</div><p className="login-footer">© 2026 Airavat Security Service · Jamnagar, Gujarat</p></div>;
  if (!loggedIn) return <Login ready={authReady} onLogin={async (id, password) => {
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password, deviceId: getDeviceId(), deviceName: navigator.userAgent }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Sign in failed.");
    setLoggedIn(true);
  }} />;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service logo" width={44} height={44} className="brand-logo" /><div><strong>AIRAVAT</strong><small>Security Management</small></div></div>
      <div className="side-label">MAIN MENU</div>
      {([ ["Dashboard", "▦"], ["Guard List", "♙"], ["Register Guard", "＋"] ] as [View,string][]).map(([item, icon]) => <button key={item} onClick={() => go(item)} className={`nav-item ${view === item ? "nav-active" : ""}`}><span>{icon}</span>{item}{view === item && <i />}</button>)}
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar admin-avatar">A</div><div><strong>Administrator</strong><small>admin@airavat.in</small></div></div><button className="logout" onClick={logout}>↪ &nbsp; Log out</button></div>
    </aside>
    <main className="main-area"><header className="mobile-head"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service logo" width={36} height={36} className="brand-logo" /><strong>AIRAVAT</strong></header>
      {view === "Dashboard" && <Dashboard guards={guards} active={active} onNavigate={go} />}
      {view === "Guard List" && <><Roster guards={filtered} allCount={guards.length} active={active} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onAdd={() => go("Register Guard")} onSelect={setSelected} onToggle={g => setGuards(prev => prev.map(x => x.id === g.id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" } : x))} onDelete={g => { if (!window.confirm(`Delete ${g.name} from the roster?`)) return; const sb = getSupabaseBrowserClient() as any; if (!sb) { flash("Supabase is not configured."); return; } void sb.from("guards").delete().eq("id", g.id).select("id").then(({ data, error }: { data: Array<{ id: string }> | null; error: { message: string } | null }) => { if (error) { flash(`Guard was not deleted: ${error.message}`); return; } if (!data?.length) { flash("Guard could not be deleted. Check your admin database permissions."); return; } setGuards(prev => prev.filter(x => x.id !== g.id)); flash(`${g.name} deleted from the roster and Supabase.`); }).catch((error: unknown) => flash(`Guard was not deleted: ${error instanceof Error ? error.message : "Unknown error"}`)); }} /></>}
      {view === "Register Guard" && <RegisterGuard onSave={async g => { const sb = getSupabaseBrowserClient(); if (!sb) throw new Error("Supabase is not configured."); if (g.photo?.startsWith("data:")) { const blob = await (await fetch(g.photo)).blob(); const path = `${g.id}/${Date.now()}.jpg`; const { error } = await sb.storage.from("guard-photos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true }); if (error) throw error; g.photo = path; } const { error } = await sb.from("guards").insert(guardToRow(g)); if (error) throw error; setGuards(prev => [g, ...prev]); flash(`${g.name} registered successfully.`); go("Guard List"); }} onCancel={() => go("Guard List")} />}
      {selected && <Profile guard={selected} onClose={() => setSelected(null)} onEdit={() => { setSelected(null); flash("Profile editing is coming soon."); }} />}
      {notice && <div className="toast">✓ &nbsp;{notice}</div>}
    </main>
  </div>;
}
