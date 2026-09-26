"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { jsPDF } from "jspdf";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Guard = { id: string; name: string; phone: string; email: string; aadhaar: string; gender: string; dob: string; address: string; designation: string; site: string; salary: number; joinDate: string; status: "Active" | "Inactive"; shift: string; workType: string; photo?: string };
type Invoice = { id: string; client: string; amount: number; date: string; status: string; description: string };
type Attendance = Record<string, Record<string, "Present" | "Absent" | "Leave">>;
type View = "Dashboard" | "Guard List" | "Register Guard" | "Attendance" | "Invoices";
const today = () => new Date().toISOString().slice(0, 10);
const getDeviceId = () => { let id = localStorage.getItem("airavat-device-id"); if (!id) { id = crypto.randomUUID(); localStorage.setItem("airavat-device-id", id); } return id; };
const rowToGuard = (g: Record<string, unknown>): Guard => ({ id: String(g.id), name: String(g.name), phone: String(g.phone), email: String(g.email ?? ""), aadhaar: String(g.aadhaar), gender: String(g.gender), dob: String(g.dob), address: String(g.address), designation: String(g.designation), site: String(g.site ?? ""), salary: Number(g.salary), joinDate: String(g.join_date), status: g.status === "Inactive" ? "Inactive" : "Active", shift: String(g.shift), workType: String(g.work_type), photo: typeof g.photo_path === "string" ? g.photo_path : undefined });
const guardToRow = (g: Guard) => ({ id: g.id, name: g.name, phone: g.phone, email: g.email, aadhaar: g.aadhaar, gender: g.gender, dob: g.dob, address: g.address, designation: g.designation, site: g.site, salary: g.salary, join_date: g.joinDate, status: g.status, shift: g.shift, work_type: g.workType, photo_path: g.photo ?? null });

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
      <div className="side-label">MAIN MENU</div>
      {([ ["Dashboard", "▦"], ["Guard List", "♙"], ["Register Guard", "＋"], ["Attendance", "▣"], ["Invoices", "▤"] ] as [View,string][]).map(([item, icon]) => <button key={item} onClick={() => go(item)} className={`nav-item ${view === item ? "nav-active" : ""}`}><span>{icon}</span>{item}{view === item && <i />}</button>)}
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar admin-avatar">A</div><div><strong>Administrator</strong><small>admin@airavat.in</small></div></div><button className="logout" onClick={logout}>↪ &nbsp; Log out</button></div>
    </aside>
    <main className="main-area"><header className="mobile-head"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service logo" width={36} height={36} className="brand-logo" /><strong>AIRAVAT</strong></header>
      {view === "Dashboard" && <Dashboard guards={guards} active={active} onNavigate={go} />}
      {view === "Guard List" && <Roster guards={filtered} allCount={guards.length} active={active} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onAdd={() => go("Register Guard")} onSelect={setSelected} onToggle={g => setGuards(prev => prev.map(x => x.id === g.id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" } : x))} onDelete={g => { if (window.confirm(`Delete ${g.name} from the roster?`)) { setGuards(prev => prev.filter(x => x.id !== g.id)); const sb = getSupabaseBrowserClient(); if (sb) void sb.from("guards").delete().eq("id", g.id); } }} />}
      {view === "Register Guard" && <RegisterGuard onSave={async g => { const sb = getSupabaseBrowserClient(); if (!sb) throw new Error("Supabase is not configured."); if (g.photo?.startsWith("data:")) { const blob = await (await fetch(g.photo)).blob(); const path = `${g.id}/${Date.now()}.jpg`; const { error } = await sb.storage.from("guard-photos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true }); if (error) throw error; g.photo = path; } const { error } = await sb.from("guards").insert(guardToRow(g)); if (error) throw error; setGuards(prev => [g, ...prev]); flash(`${g.name} registered successfully.`); go("Guard List"); }} onCancel={() => go("Guard List")} />}
      {view === "Attendance" && <AttendancePage guards={guards} attendance={attendance} setAttendance={setAttendance} date={attendanceDate} setDate={setAttendanceDate} />}
      {view === "Invoices" && <InvoicesPage invoices={invoices} onNew={() => setInvoiceForm(true)} />}
      {selected && <Profile guard={selected} onClose={() => setSelected(null)} onEdit={() => { setSelected(null); flash("Profile editing is coming soon."); }} />}
      {invoiceForm && <InvoiceModal onClose={() => setInvoiceForm(false)} onSave={async invoice => { const sb = getSupabaseBrowserClient(); if (!sb) return; const { error } = await sb.from("invoices").insert({ id: invoice.id, client: invoice.client, amount: invoice.amount, issue_date: invoice.date, status: invoice.status, description: invoice.description }); if (error) { flash(`Invoice not saved: ${error.message}`); return; } setInvoices(prev => [invoice, ...prev]); setInvoiceForm(false); flash("Invoice created."); }} />}
      {notice && <div className="toast">✓ &nbsp;{notice}</div>}
    </main>
  </div>;
}

function Login({ ready, onLogin }: { ready: boolean; onLogin: (id: string, password: string) => Promise<void> }) {
  const [mode,setMode]=useState<"admin"|"guard">("admin");
  const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [show,setShow]=useState(false); const [pending,setPending]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>setHydrated(true),0);return()=>window.clearTimeout(timer);},[]);
  const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const configured=Boolean(projectUrl&&anonKey&&!/YOUR_|example\.com|your-project|your_supabase/i.test(projectUrl+" "+anonKey));
  if(!hydrated)return <div className="login-screen"><div className="login-brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service" width={112} height={108} className="login-logo"/><h1>AIRAVAT</h1><div className="gold-kicker">SECURITY SERVICE</div><p>સર્વદા શક્તિશાળી</p></div><div className="login-card login-hydrating" role="status">Loading secure sign-in…</div><p className="login-footer">© 2026 Airavat Security Service · Jamnagar, Gujarat</p></div>;
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError("");setPending(true);try{
    if(mode==="guard"){const response=await fetch("/api/guard/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:username,phone:password})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error??"Guard sign in failed.");window.location.href="/guard";return;}
    await onLogin(username,password);
  }catch(cause){setError(cause instanceof Error?cause.message:"Sign in failed.");}finally{setPending(false);}};
  return <div className="login-screen"><div className="login-brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service" width={112} height={108} className="login-logo"/><h1>AIRAVAT</h1><div className="gold-kicker">SECURITY SERVICE</div><p>સર્વદા શક્તિશાળી</p></div>
    <div className="login-card">
      <div className="login-role-switch"><button type="button" className={mode==="admin"?"active":""} onClick={()=>{setMode("admin");setError("");setUsername("");setPassword("");}}>Login as Admin</button><button type="button" className={mode==="guard"?"active":""} onClick={()=>{setMode("guard");setError("");setUsername("");setPassword("");}}>Login as Guard</button></div>
      {mode==="admin"?<form onSubmit={submit}><div className="login-heading"><span>♙</span><div><h2>Admin Portal</h2><p>Verified sign-in · maximum two active devices</p></div></div>{!configured&&<p className="setup-message">Supabase URL/key is missing or still uses template values.</p>}<label>Admin ID<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required /></label><label>Password<div className="password-box"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={()=>setShow(!show)}>{show?"Hide":"Show"}</button></div></label>{error&&<p className="login-error">{error}</p>}<button className="login-submit" disabled={pending||!ready}>{pending?"Signing in…":"Sign in"}</button></form>
      :<div><div className="login-heading"><span>♙</span><div><h2>Guard Portal</h2><p>Open the guard attendance portal.</p></div></div><button type="button" className="login-submit" onClick={()=>{window.location.href="/guard";}}>Open Guard Portal</button></div>}
    </div><p className="login-footer">© 2026 Airavat Security Service · Jamnagar, Gujarat</p>
  </div>;
}
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span>{eyebrow}</span><i>●</i></div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Dashboard({ guards, active, onNavigate }: { guards: Guard[]; active: number; onNavigate: (v: View) => void }) {
  const cards: { icon: string; badge: string; title: string; description: string; action: string; page: View; color: string }[] = [
    { icon: "♙+", badge: "REGISTRATION", title: "Register New Guard", description: "Enroll guards with full profile details, shift assignment, and deployment information.", action: "Open Registration Form", page: "Register Guard", color: "blue" },
    { icon: "♙", badge: "PERSONNEL", title: "Guard Roster & Profiles", description: "Search the active roster, filter by status, and manage guard profiles.", action: "View Guard List", page: "Guard List", color: "blue" },
    { icon: "▣", badge: "OPERATIONS", title: "Daily Attendance Tracker", description: "Mark attendance and review present, absent, and leave records by day.", action: "Open Attendance Sheet", page: "Attendance", color: "green" },
    { icon: "▤", badge: "FINANCE", title: "Invoice & Billing Generator", description: "Create client invoices and keep a searchable billing record.", action: "Create / View Invoices", page: "Invoices", color: "gold" },
  ];
  return <div className="content-wrap"><PageHeading eyebrow="Admin Control Center" title="Welcome back, Admin 👋" subtitle={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · workforce overview`} action={<button className="primary-button" onClick={() => onNavigate("Register Guard")}>＋ &nbsp; Add New Guard</button>} /><section className="summary-row"><Metric label="TOTAL ENROLLED PERSONNEL" value={guards.length} note="Roster count" icon="♙" tone="blue" /><Metric label="ACTIVE DEPLOYMENTS" value={active} note="On duty" icon="♙" tone="green" /><Metric label="INACTIVE / ON LEAVE" value={guards.length - active} note="Standby" icon="♙" tone="red" /></section><div className="section-heading"><div><h2>Management modules</h2><p>Choose an area to manage your security operation.</p></div><span className="live-pill">● SUPABASE CONNECTED</span></div><div className="module-grid">{cards.map(card => <button className="module-card" key={card.title} onClick={() => onNavigate(card.page)}><div className="module-top"><div className={`module-icon ${card.color}`}>{card.icon}</div><span className="module-badge">{card.badge}</span></div><h3>{card.title}</h3><p>{card.description}</p><div className="module-link">{card.action}<span>›</span></div></button>)}</div><div className="storage-note"><span>▤</span><div><strong>Supabase database is active</strong><p>Roster, attendance, and invoices sync through your protected Supabase project.</p></div></div></div>;
}
function Metric({ label, value, note, icon, tone }: { label: string; value: number; note: string; icon: string; tone: string }) { return <div className="metric"><div><span className="metric-label">{label}</span><strong className={`metric-value ${tone}`}>{value}</strong><small>{note}</small></div><span className={`metric-icon ${tone}`}>{icon}</span></div>; }

function Roster({ guards, allCount, active, query, setQuery, filter, setFilter, onAdd, onSelect, onToggle, onDelete }: { guards: Guard[]; allCount: number; active: number; query: string; setQuery: (s: string) => void; filter: string; setFilter: (s: string) => void; onAdd: () => void; onSelect: (g: Guard) => void; onToggle: (g: Guard) => void; onDelete: (g: Guard) => void }) {
  return <div className="content-wrap"><PageHeading eyebrow="Personnel directory" title="Security Personnel Roster" subtitle={`${allCount} total enrolled guards · ${active} on active deployment`} action={<button className="primary-button" onClick={onAdd}>＋ &nbsp; Enroll New Guard</button>} /><section className="summary-row roster-stats"><Metric label="TOTAL ENROLLED PERSONNEL" value={allCount} note="Roster count" icon="♙" tone="blue" /><Metric label="ACTIVE DEPLOYMENTS" value={active} note="On duty" icon="♙" tone="green" /><Metric label="INACTIVE / ON LEAVE" value={allCount-active} note="Standby" icon="♙" tone="red" /></section><div className="roster-toolbar"><div className="search-wrap"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, guard ID, site, designation, phone, or Aadhaar…" /></div><div className="filter-buttons">{["All", "Active", "Inactive"].map(x => <button key={x} onClick={() => setFilter(x)} className={filter === x ? "selected-filter" : ""}>{x}</button>)}</div></div><div className="table-wrap"><table><thead><tr><th>GUARD ID</th><th>PHOTO & NAME</th><th>CONTACT</th><th>DESIGNATION</th><th>SITE DEPLOYED</th><th>SALARY</th><th>JOIN DATE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{guards.map(g => <tr key={g.id}><td><span className="id-tag">{g.id}</span></td><td><button className="person-cell" onClick={() => onSelect(g)}><GuardPhoto path={g.photo} label={g.name} className="avatar" /><span><strong>{g.name}</strong><small>{g.gender} · DOB: {g.dob ? new Date(`${g.dob}T00:00:00`).toLocaleDateString("en-IN") : "—"}</small></span></button></td><td>{g.phone}<small className="cell-sub">{g.email || "—"}</small></td><td><span className="designation-tag">{g.designation}</span></td><td className="site-cell">{g.site || "Unassigned"}</td><td>₹{g.salary.toLocaleString("en-IN")}<small className="cell-sub">/mo</small></td><td>{new Date(`${g.joinDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td><td><span className={`status ${g.status.toLowerCase()}`}>{g.status}</span></td><td><div className="actions"><button title="View profile" onClick={() => onSelect(g)}>◉</button><button title={g.status === "Active" ? "Mark inactive" : "Activate"} onClick={() => onToggle(g)}>{g.status === "Active" ? "⏸" : "▶"}</button><button title="Delete" className="delete-action" onClick={() => onDelete(g)}>⌫</button></div></td></tr>)}{!guards.length && <tr><td colSpan={9} className="empty-state">No guards found. Try a different search or register a guard.</td></tr>}</tbody></table></div><p className="table-foot">Showing {guards.length} of {allCount} guards · Select a guard name to view the complete profile</p></div>;
}

function RegisterGuard({ onSave, onCancel }: { onSave: (g: Guard) => Promise<void>; onCancel: () => void }) {
  const [photo, setPhoto] = useState(""); const [workType, setWorkType] = useState("Permanent"); const [shift, setShift] = useState("Day Shift"); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null); const cameraStreamRef = useRef<MediaStream | null>(null); const fileInputRef = useRef<HTMLInputElement>(null); const [cameraOpen, setCameraOpen] = useState(false);
  const progress = 14;
  const uploadPhoto = (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; } const image = new window.Image(); image.onload = () => { const canvas = document.createElement("canvas"); const scale = Math.min(1, 1500 / Math.max(image.width, image.height)); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); setPhoto(canvas.toDataURL("image/jpeg", 0.82)); }; image.onerror = () => setError("Could not read the selected photo."); image.src = URL.createObjectURL(file); };
  const stopCamera = () => { cameraStreamRef.current?.getTracks().forEach(track => track.stop()); cameraStreamRef.current = null; setCameraOpen(false); };
  const openCamera = async () => { setError(""); if (!navigator.mediaDevices?.getUserMedia) { setError("Live camera needs HTTPS or localhost. Open this site in a supported browser."); return; } try { cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); setCameraOpen(true); } catch (cause) { const cameraError = cause instanceof Error ? cause : null; setError(cameraError?.name === "NotAllowedError" ? "Camera permission is blocked. Allow camera access in your browser settings and try again." : cameraError?.name === "NotFoundError" ? "No camera was found on this device." : "Could not open the camera. Check that it is connected and not being used by another app."); } };
  const captureCameraPhoto = () => { const video = videoRef.current; if (!video || !video.videoWidth) { setError("Camera is starting. Try again in a moment."); return; } const canvas = document.createElement("canvas"); const scale = Math.min(1, 1500 / Math.max(video.videoWidth, video.videoHeight)); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale); canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height); setPhoto(canvas.toDataURL("image/jpeg", 0.82)); stopCamera(); };
  useEffect(() => { if (cameraOpen && videoRef.current && cameraStreamRef.current) { videoRef.current.srcObject = cameraStreamRef.current; void videoRef.current.play().catch(() => {}); } }, [cameraOpen]);
  useEffect(() => () => { cameraStreamRef.current?.getTracks().forEach(track => track.stop()); }, []);
  return <div className="content-wrap form-page"><PageHeading eyebrow="Personal Enrollment" title="Security Guard Registration" subtitle="Fill in the details below. The guard profile will be saved to Supabase." /><form onSubmit={async e => { e.preventDefault(); setError(""); setSaving(true); const data = new FormData(e.currentTarget); const id = `GRD${crypto.randomUUID().slice(0,7).toUpperCase()}`; const name=String(data.get("name")); try { await onSave({ id, name, phone: String(data.get("phone")), email: String(data.get("email")), aadhaar: String(data.get("aadhaar")), gender: String(data.get("gender")), dob: String(data.get("dob")), address: String(data.get("address")), designation: String(data.get("designation")), site: String(data.get("site")), salary: Number(data.get("salary")), joinDate: String(data.get("joinDate")), status: "Active", shift, workType, photo: photo || undefined }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Guard record could not be saved."); } finally { setSaving(false); } }}>
    <div className="form-progress"><div><strong>Form Readiness</strong><span>{progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>Complete all required fields</small></div>
    <section className="form-section"><div className="form-section-title"><h2><span>1</span>Personal & Identification Information</h2><small>* Indicates mandatory field</small></div><div className="personal-layout"><div className="photo-column"><div className="photo-preview">{photo ? <Image src={photo} alt="Guard preview" width={200} height={200} unoptimized /> : <span><i>♙</i>Photo preview</span>}</div><input ref={fileInputRef} className="photo-input-hidden" type="file" accept="image/*" onChange={e => uploadPhoto(e.target.files?.[0])} /><button type="button" className="upload-button" onClick={() => void openCamera()}>📷 &nbsp; Take Photo</button><button type="button" className="upload-button upload-button-secondary" onClick={() => fileInputRef.current?.click()}>▧ &nbsp; Upload from File</button><small>Camera preview or choose an image file.</small></div><div className="form-fields"><div className="field-grid"><Field label="Full Name" name="name" placeholder="e.g. Ramesh Kumar Sharma" required /><Field label="Contact Number (Phone)" name="phone" placeholder="+91 9876543210" required type="tel" pattern="[+0-9 ()-]{10,18}" /><Field label="Email Address" name="email" placeholder="guard@airavatsecurity.in" type="email" /><Field label="Date of Birth" name="dob" required type="date" /><Field label="Aadhaar Card Number" name="aadhaar" placeholder="XXXX XXXX XXXX" required pattern="[0-9Xx ]{12,16}" /><label className="field"><span>Gender <b>*</b></span><select name="gender" required defaultValue=""><option value="" disabled>Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label></div></div></div><div className="field full-field"><span>Residential Address <b>*</b></span><input name="address" required placeholder="e.g. Plot 12, Khodiyar Colony, Jamnagar, Gujarat - 361006" /></div></section>
    <section className="form-section"><div className="form-section-title"><h2><span>2</span>Employment, Shift & Payment Details</h2><small>Operations & deployment</small></div><div className="field-grid employment-grid"><fieldset className="choice-field"><legend>Work Type <b>*</b></legend><div className="choice-row">{["Permanent", "Temporary"].map(w => <label className={`choice-card ${workType === w ? "choice-selected" : ""}`} key={w}><input type="radio" checked={workType === w} onChange={() => setWorkType(w)} /> <strong>{w}</strong><small>{w === "Permanent" ? "Full-time roster guard" : "Short-term / relief duty"}</small></label>)}</div></fieldset><fieldset className="choice-field"><legend>Preferred Shift <b>*</b></legend><div className="choice-row">{["Day Shift", "Night Shift", "Rotational"].map((s,i) => <label className={`shift-card ${shift === s ? "choice-selected" : ""}`} key={s}><input type="radio" checked={shift === s} onChange={() => setShift(s)} /><strong>{["☀", "☾", "▣"][i]}</strong><span>{s}</span><small>{["08:00 – 20:00", "20:00 – 08:00", "Any shift"][i]}</small></label>)}</div></fieldset><label className="field"><span>Designation / Role <b>*</b></span><select name="designation"><option>Security Guard</option><option>Head Guard</option><option>CCTV Operator</option><option>Supervisor</option><option>Patrolling Officer</option></select></label><Field label="Client Site Deployed" name="site" placeholder="Select or type a client site" /><Field label="Monthly Salary (INR)" name="salary" type="number" min="1" placeholder="18000" required /><Field label="Joining Date" name="joinDate" type="date" required defaultValue={today()} /></div><label className="field full-field"><span>Remarks & Special Notes</span><textarea name="remarks" placeholder="Any special instructions, uniform size, background verification notes…" /></label></section>
    <section className="form-section"><div className="form-section-title"><h2><span>3</span>Guard ID & System Record</h2><small>Saved to Supabase database</small></div><div className="field"><span>Assigned Guard ID</span><div className="id-preview">Auto-generated on save<span>UNIQUE ID</span></div><small>The guard ID is generated automatically when this record is saved.</small></div>{error && <p className="error-text">{error}</p>}</section>
    <div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel}>← &nbsp; Cancel & Back to Guard Roster</button><div><button className="secondary-button" type="reset" onClick={() => setPhoto("")}>Reset Form</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving to Supabase…" : "Enroll & Save Guard Record →"}</button></div></div>
  </form>{cameraOpen && <div className="camera-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) stopCamera(); }}><section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title"><div className="camera-dialog-heading"><h2 id="camera-title">Take guard photo</h2><button type="button" className="camera-close" onClick={stopCamera} aria-label="Close camera">×</button></div><video ref={videoRef} className="camera-video" autoPlay playsInline muted /><p>Position the guard in the frame, then capture.</p><div className="camera-actions"><button type="button" className="secondary-button" onClick={stopCamera}>Cancel</button><button type="button" className="primary-button" onClick={captureCameraPhoto}>Capture Photo</button></div></section></div>}</div>;
}
function Field({ label, name, placeholder, required, type="text", pattern, min, defaultValue }: { label: string; name: string; placeholder?: string; required?: boolean; type?: string; pattern?: string; min?: string; defaultValue?: string }) { return <label className="field"><span>{label} {required && <b>*</b>}</span><input name={name} type={type} placeholder={placeholder} required={required} pattern={pattern} min={min} defaultValue={defaultValue} /></label>; }

function AttendancePage({ guards, attendance, setAttendance, date, setDate }: { guards: Guard[]; attendance: Attendance; setAttendance: (a: Attendance) => void; date: string; setDate: (d: string) => void }) {
  const [evidence,setEvidence] = useState<Array<{guard_id:string;attendance_time:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;address:string|null;selfie_path:string|null;status:string}>>([]);
  const [selfies,setSelfies] = useState<Record<string,string>>({});
  const day = attendance[date] ?? {};
  const count = (s: string) => Object.values(day).filter(x => x === s).length;
  const mark = (id: string, status: "Present" | "Absent" | "Leave") => setAttendance({ ...attendance, [date]: { ...day, [id]: status } });

  useEffect(() => {
    const sb = getSupabaseBrowserClient(); if (!sb) return;
    let cancelled = false;
    void sb.from("guard_attendance").select("guard_id,attendance_time,latitude,longitude,accuracy,address,selfie_path,status").eq("attendance_date",date).then(async ({data,error}) => {
      if (cancelled || error) return;
      setEvidence(data ?? []);
      const signed: Record<string,string> = {};
      for (const row of data ?? []) {
        if (row.selfie_path) {
          const result = await sb.storage.from("guard-attendance-selfies").createSignedUrl(row.selfie_path,300);
          if (result.data?.signedUrl) signed[row.guard_id] = result.data.signedUrl;
        }
      }
      if (!cancelled) setSelfies(signed);
    });
    return () => { cancelled = true; };
  }, [date]);

  const guardName = (id:string) => guards.find(g => g.id === id)?.name ?? id;
  return <div className="content-wrap">
    <PageHeading eyebrow="Operations & deployment" title="Daily Attendance" subtitle="Record and review deployment attendance by date." action={<button className="secondary-button" onClick={() => window.print()}>▤ &nbsp; Print Sheet</button>} />
    <div className="attendance-date"><label className="field"><span>Attendance date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><button className="secondary-button" onClick={() => setAttendance({ ...attendance, [date]: Object.fromEntries(guards.filter(g => g.status === "Active").map(g => [g.id, "Present" as const])) })}>✓ &nbsp; Mark All Present</button></div>
    <div className="summary-row"><Metric label="PRESENT" value={count("Present")} note="On site" icon="✓" tone="green" /><Metric label="ABSENT" value={count("Absent")} note="Not on duty" icon="×" tone="red" /><Metric label="ON LEAVE" value={count("Leave")} note="Approved leave" icon="◷" tone="gold" /></div>
    <div className="table-wrap"><table><thead><tr><th>GUARD ID</th><th>GUARD NAME</th><th>DESIGNATION</th><th>DEPLOYMENT SITE</th><th>SHIFT</th><th>ATTENDANCE</th></tr></thead><tbody>{guards.map(g => <tr key={g.id}><td><span className="id-tag">{g.id}</span></td><td><strong>{g.name}</strong><small className="cell-sub">{g.phone}</small></td><td>{g.designation}</td><td>{g.site || "—"}</td><td>{g.shift}</td><td><div className="attendance-actions">{(["Present", "Absent", "Leave"] as const).map(s => <button key={s} onClick={() => mark(g.id,s)} className={`${s.toLowerCase()} ${day[g.id] === s ? "attendance-selected" : ""}`}>{s}</button>)}</div></td></tr>)}</tbody></table></div>
    <div className="section-heading" style={{marginTop:26}}><div><h2>Guard check-in details</h2><p>Selfie, exact time and captured location for the selected date.</p></div><span className="live-pill">{evidence.length} CHECK-INS</span></div>
    <div className="table-wrap"><table><thead><tr><th>GUARD</th><th>STATUS</th><th>TIME</th><th>LOCATION</th><th>ACCURACY</th><th>SELFIE</th></tr></thead><tbody>{evidence.map(r => <tr key={r.guard_id}><td><strong>{guardName(r.guard_id)}</strong><small className="cell-sub">{r.guard_id}</small></td><td><span className={`status ${r.status.toLowerCase()}`}>{r.status}</span></td><td>{r.attendance_time ? new Date(r.attendance_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—"}</td><td>{r.latitude != null && r.longitude != null ? <div><a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer" className="text-action">Open map</a>{r.address && <small className="cell-sub">{r.address}</small>}</div> : "—"}</td><td>{r.accuracy != null ? `±${Math.round(r.accuracy)} m` : "—"}</td><td>{selfies[r.guard_id] ? <a href={selfies[r.guard_id]} target="_blank" rel="noreferrer"><img src={selfies[r.guard_id]} alt={guardName(r.guard_id)} style={{width:44,height:44,objectFit:"cover",borderRadius:7}} /></a> : "—"}</td></tr>)}{!evidence.length && <tr><td colSpan={6} className="empty-state">No GPS/selfie check-in has been recorded for this date.</td></tr>}</tbody></table></div>
    <p className="table-foot">Attendance is saved to Supabase for {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "long" })}.</p>
  </div>;
}
function InvoicesPage({ invoices, onNew }: { invoices: Invoice[]; onNew: () => void }) {
  const total = invoices.reduce((sum,i) => sum+i.amount,0);
  return <div className="content-wrap"><PageHeading eyebrow="Finance & billing" title="Invoices & Billing" subtitle="Create client invoices and keep a searchable billing record." action={<button className="primary-button" onClick={onNew}>＋ &nbsp; Create Invoice</button>} /><div className="summary-row"><Metric label="TOTAL INVOICES" value={invoices.length} note="All records" icon="▤" tone="blue" /><Metric label="TOTAL BILLING" value={total} note="Invoice value (INR)" icon="₹" tone="green" /><Metric label="PAID INVOICES" value={invoices.filter(i=>i.status==="Paid").length} note="Payment received" icon="✓" tone="gold" /></div><div className="table-wrap"><table><thead><tr><th>INVOICE ID</th><th>CLIENT</th><th>DESCRIPTION</th><th>ISSUE DATE</th><th>AMOUNT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id}><td><span className="id-tag">{invoice.id}</span></td><td><strong>{invoice.client}</strong></td><td>{invoice.description}</td><td>{new Date(`${invoice.date}T00:00:00`).toLocaleDateString("en-IN")}</td><td>₹{invoice.amount.toLocaleString("en-IN")}</td><td><span className={`status ${invoice.status.toLowerCase()}`}>{invoice.status}</span></td><td><button className="text-action" onClick={() => window.print()}>Print</button></td></tr>)}{!invoices.length && <tr><td colSpan={7} className="empty-state"><span className="empty-icon">▤</span><strong>No invoices yet</strong><small>Create your first client invoice to get started.</small><button className="primary-button" onClick={onNew}>＋ &nbsp; Create Invoice</button></td></tr>}</tbody></table></div></div>;
}
function InvoiceModal({ onClose, onSave }: { onClose: () => void; onSave: (i: Invoice) => void }) { return <div className="modal-backdrop" onMouseDown={e => { if(e.target===e.currentTarget) onClose(); }}><form className="modal-card" onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); onSave({ id:`INV-${Date.now().toString().slice(-6)}`, client:String(d.get("client")), amount:Number(d.get("amount")), date:String(d.get("date")), status:String(d.get("status")), description:String(d.get("description")) }); }}><div className="modal-title"><div><span className="module-icon gold">▤</span><div><h2>Create Invoice</h2><p>Record a client billing item</p></div></div><button type="button" onClick={onClose}>×</button></div><div className="modal-fields"><Field label="Client / Company" name="client" placeholder="Client name" required /><Field label="Description" name="description" placeholder="Security services — September 2026" required /><Field label="Amount (INR)" name="amount" type="number" min="1" placeholder="25000" required /><Field label="Issue date" name="date" type="date" required defaultValue={today()} /><label className="field"><span>Payment status</span><select name="status"><option>Unpaid</option><option>Paid</option></select></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save Invoice</button></div></form></div>; }
function GuardPhoto({ path, label, className }: { path?: string; label: string; className: string }) {
  const [resolved, setResolved] = useState<{ path: string; src: string } | null>(null);
  useEffect(() => {
    if (!path || path.startsWith("data:") || path.startsWith("http")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.storage.from("guard-photos").createSignedUrl(path, 300).then((result: { data: { signedUrl: string } | null }) => { if (!cancelled && result.data) setResolved({ path, src: result.data.signedUrl }); });
    return () => { cancelled = true; };
  }, [path]);
  const src = path?.startsWith("data:") || path?.startsWith("http") ? path : resolved && resolved.path === path ? resolved.src : "";
  return src ? <Image src={src} alt={label} width={100} height={100} unoptimized className={className} /> : <span className={`${className} photo-placeholder`}>{label.split(" ").map(w => w[0]).join("").slice(0,2)}</span>;
}

async function downloadGuardPdf(guard: Guard) {
  const pdf = new jsPDF();
  pdf.setFillColor(8, 13, 66); pdf.rect(0, 0, 210, 32, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.text("AIRAVAT SECURITY SERVICE", 15, 15);
  pdf.setFontSize(10); pdf.text("SECURITY PERSONNEL PROFILE", 15, 23);
  pdf.setTextColor(25, 35, 58); pdf.setFontSize(16); pdf.text(guard.name, 15, 47);
  pdf.setFontSize(10); pdf.setTextColor(95, 105, 125); pdf.text(`${guard.id}   •   ${guard.designation}   •   ${guard.status}`, 15, 55);
  if (guard.photo) {
    try {
      let image = guard.photo;
      if (!image.startsWith("data:") && !image.startsWith("http")) {
        const sb = getSupabaseBrowserClient(); const { data, error } = await sb!.storage.from("guard-photos").createSignedUrl(image, 120);
        if (error || !data) throw error;
        image = data.signedUrl;
      }
      const blob = await (await fetch(image)).blob();
      image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      pdf.addImage(image, "JPEG", 165, 38, 30, 34);
    } catch { /* The PDF remains useful if the private photo is unavailable. */ }
  }
  const rows: [string,string][] = [["Phone",guard.phone],["Email",guard.email||"—"],["Aadhaar",guard.aadhaar],["Gender",guard.gender],["Date of birth",guard.dob],["Deployment site",guard.site||"Unassigned"],["Monthly salary",`INR ${guard.salary.toLocaleString("en-IN")}`],["Joining date",guard.joinDate],["Work type",guard.workType],["Preferred shift",guard.shift],["Address",guard.address]];
  let y=84;
  for (const [label,value] of rows) {
    pdf.setFont("helvetica","bold"); pdf.setTextColor(75,85,105); pdf.text(label.toUpperCase(),15,y);
    pdf.setFont("helvetica","normal"); pdf.setTextColor(25,35,58);
    const lines=pdf.splitTextToSize(value || "—",125); pdf.text(lines,75,y); y+=Math.max(10,lines.length*6);
    pdf.setDrawColor(228,232,239); pdf.line(15,y-4,195,y-4); y+=2;
  }
  pdf.setFontSize(8); pdf.setTextColor(135,145,160); pdf.text(`Generated ${new Date().toLocaleDateString("en-IN")} · Airavat Security Service`,15,285);
  pdf.save(`${guard.id}-${guard.name.trim().replace(/\s+/g,"-")}-profile.pdf`);
}

function Profile({ guard, onClose, onEdit }: { guard: Guard; onClose: () => void; onEdit: () => void }) { return <div className="modal-backdrop" onMouseDown={e => { if(e.target===e.currentTarget) onClose(); }}><div className="modal-card"><div className="modal-title"><div><GuardPhoto path={guard.photo} label={guard.name} className="avatar profile-avatar" /><div><h2>{guard.name}</h2><p>{guard.id} · {guard.designation}</p></div></div><button onClick={onClose}>×</button></div><div className="profile-status"><span className={`status ${guard.status.toLowerCase()}`}>{guard.status}</span><span>{guard.workType} · {guard.shift}</span></div><div className="profile-grid">{[["Phone",guard.phone],["Email",guard.email||"—"],["Aadhaar",guard.aadhaar],["Gender",guard.gender],["Date of birth",guard.dob],["Deployment site",guard.site||"Unassigned"],["Monthly salary",`₹${guard.salary.toLocaleString("en-IN")}`],["Joining date",guard.joinDate],["Address",guard.address]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Close</button><button className="secondary-button" onClick={() => void downloadGuardPdf(guard)}>Download profile PDF</button><button className="primary-button" onClick={onEdit}>Edit profile</button></div></div></div>; }
