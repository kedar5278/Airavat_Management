"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import ClerkGuardProfiles from "@/components/ClerkGuardProfiles";
import type { Guard, Invoice, Attendance, View } from "./management-types";
import { today, rowToGuard, guardToRow } from "./management-utils";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Roster from "./Roster";
import RegisterGuard from "./RegisterGuard";
import AttendancePage from "./AttendancePage";
import InvoicesPage from "./InvoicesPage";
import Profile from "./Profile";
import InvoiceModal from "./InvoiceModal";

const getDeviceId = () => { let id = localStorage.getItem("airavat-device-id"); if (!id) { id = crypto.randomUUID(); localStorage.setItem("airavat-device-id", id); } return id; };

export default function ManagementApp() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [attendance, setAttendance] = useState<Attendance>({});
  const [databaseReady, setDatabaseReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("Dashboard");
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Guard | null>(null);
  const [notice, setNotice] = useState("");
  const [invoiceForm, setInvoiceForm] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(today());
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setAuthReady(true)); return; }
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) { setAuthReady(true); return; }
      const heartbeat = await fetch("/api/admin/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId() }) });
      if (mounted) setLoggedIn(heartbeat.ok);
      setAuthReady(true);
    })().catch(() => { if (mounted) setAuthReady(true); });
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
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("guard_attendance").select("guard_id,attendance_date,status"),
    ]).then(([guardResult, invoiceResult, attendanceResult]) => {
      const failure = guardResult.error ?? invoiceResult.error ?? attendanceResult.error;
      if (failure) throw failure;
      if (cancelled) return;
      setGuards((guardResult.data ?? []).map(rowToGuard));
      setInvoices((invoiceResult.data ?? []).map((i: { id: string; client: string; description: string; amount: number | string; issue_date: string; status: string }) => ({ id: i.id, client: i.client, description: i.description, amount: Number(i.amount), date: i.issue_date, status: i.status })));
      const byDate: Attendance = {};
      for (const row of attendanceResult.data ?? []) { byDate[row.attendance_date] ??= {}; byDate[row.attendance_date][row.guard_id] = row.status; }
      setAttendance(byDate);
      setDatabaseReady(true);
    }).catch(e => { if (!cancelled) { setNotice(`Supabase data could not load: ${e.message ?? "Check that supabase/schema.sql has been run."}`); setDatabaseReady(true); } });
    return () => { cancelled = true; };
  }, [loggedIn]);
  useEffect(() => { if (loggedIn && databaseReady) { const sb = getSupabaseBrowserClient(); if (sb && guards.length) void sb.from("guards").upsert(guards.map(guardToRow)).then((result: { error: { message: string } | null }) => { if (result.error) setNotice(`Could not save guard records: ${result.error.message}`); }); } }, [guards, loggedIn, databaseReady]);
  useEffect(() => { if (loggedIn && databaseReady) { const sb = getSupabaseBrowserClient(); if (sb && invoices.length) void sb.from("invoices").upsert(invoices.map(i => ({ id: i.id, client: i.client, description: i.description, amount: i.amount, issue_date: i.date, status: i.status }))).then((result: { error: { message: string } | null }) => { if (result.error) setNotice(`Could not save invoices: ${result.error.message}`); }); } }, [invoices, loggedIn, databaseReady]);
  useEffect(() => { if (loggedIn && databaseReady) { const sb = getSupabaseBrowserClient(); if (sb) { const rows = Object.entries(attendance).flatMap(([date, records]) => Object.entries(records).map(([guard_id, status]) => ({ guard_id, attendance_date: date, status }))); if (rows.length) void sb.from("guard_attendance").upsert(rows).then((result: { error: { message: string } | null }) => { if (result.error) setNotice(`Could not save attendance: ${result.error.message}`); }); } } }, [attendance, loggedIn, databaseReady]);

  const active = guards.filter(g => g.status === "Active").length;
  const filtered = useMemo(() => guards.filter(g => (filter === "All" || g.status === filter) && `${g.name} ${g.id} ${g.site} ${g.phone} ${g.aadhaar} ${g.designation}`.toLowerCase().includes(query.toLowerCase())), [guards, query, filter]);
  const go = (next: View) => { setSelected(null); setView(next); };
  const logout = () => { void fetch("/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId() }) }); setLoggedIn(false); setDatabaseReady(false); };

  if (!loggedIn) return <Login ready={authReady} onLogin={async (id, password) => {
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password, deviceId: getDeviceId(), deviceName: navigator.userAgent }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Sign in failed.");
    setLoggedIn(true);
  }} />;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service logo" width={44} height={44} className="brand-logo" /><div><strong>AIRAVAT</strong><small>Security Management</small></div></div>
      <div className="side-label">MAIN MENU</div><button className="nav-item" onClick={() => flash("Button is working.")}><span>✓</span>Test Button</button>
      {([ ["Dashboard", "▦"], ["Guard List", "♙"], ["Register Guard", "＋"], ["Attendance", "▣"], ["Invoices", "▤"] ] as [View,string][]).map(([item, icon]) => <button key={item} onClick={() => go(item)} className={`nav-item ${view === item ? "nav-active" : ""}`}><span>{icon}</span>{item}{view === item && <i />}</button>)}
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar admin-avatar">A</div><div><strong>Administrator</strong><small>admin@airavat.in</small></div></div><button className="logout" onClick={logout}>↪ &nbsp; Log out</button></div>
    </aside>
    <main className="main-area"><header className="mobile-head"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service logo" width={36} height={36} className="brand-logo" /><strong>AIRAVAT</strong></header>
      {view === "Dashboard" && <Dashboard guards={guards} active={active} onNavigate={go} />}
      {view === "Guard List" && <><Roster guards={filtered} allCount={guards.length} active={active} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onAdd={() => go("Register Guard")} onSelect={setSelected} onToggle={g => setGuards(prev => prev.map(x => x.id === g.id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" } : x))} onDelete={g => { if (window.confirm(`Delete ${g.name} from the roster?`)) { setGuards(prev => prev.filter(x => x.id !== g.id)); const sb = getSupabaseBrowserClient(); if (sb) void sb.from("guards").delete().eq("id", g.id); } }} /><ClerkGuardProfiles /></>}
      {view === "Register Guard" && <RegisterGuard onSave={async g => { const sb = getSupabaseBrowserClient(); if (!sb) throw new Error("Supabase is not configured."); if (g.photo?.startsWith("data:")) { const blob = await (await fetch(g.photo)).blob(); const path = `${g.id}/${Date.now()}.jpg`; const { error } = await sb.storage.from("guard-photos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true }); if (error) throw error; g.photo = path; } const { error } = await sb.from("guards").insert(guardToRow(g)); if (error) throw error; setGuards(prev => [g, ...prev]); flash(`${g.name} registered successfully.`); go("Guard List"); }} onCancel={() => go("Guard List")} />}
      {view === "Attendance" && <AttendancePage guards={guards} attendance={attendance} setAttendance={setAttendance} date={attendanceDate} setDate={setAttendanceDate} />}
      {view === "Invoices" && <InvoicesPage invoices={invoices} onNew={() => setInvoiceForm(true)} />}
      {selected && <Profile guard={selected} onClose={() => setSelected(null)} onEdit={() => { setSelected(null); flash("Profile editing is coming soon."); }} />}
      {invoiceForm && <InvoiceModal onClose={() => setInvoiceForm(false)} onSave={async invoice => { const sb = getSupabaseBrowserClient(); if (!sb) return; const { error } = await sb.from("invoices").insert({ id: invoice.id, client: invoice.client, amount: invoice.amount, issue_date: invoice.date, status: invoice.status, description: invoice.description }); if (error) { flash(`Invoice not saved: ${error.message}`); return; } setInvoices(prev => [invoice, ...prev]); setInvoiceForm(false); flash("Invoice created."); }} />}
      {notice && <div className="toast">✓ &nbsp;{notice}</div>}
    </main>
  </div>;
}
