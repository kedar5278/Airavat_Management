"use client";

import { useEffect, useState } from "react";
import type { Guard, Attendance } from "./management-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import PageHeading from "./PageHeading";
import Metric from "./Metric";

export default function AttendancePage({ guards, attendance, setAttendance, date, setDate }: { guards: Guard[]; attendance: Attendance; setAttendance: (a: Attendance) => void; date: string; setDate: (d: string) => void }) {
  const [evidence,setEvidence] = useState<Array<{guard_id:string;attendance_time:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;address:string|null;selfie_path:string|null;status:string}>>([]);
  const [selfies,setSelfies] = useState<Record<string,string>>({});
  const [monthlyEvidence,setMonthlyEvidence] = useState<typeof evidence>([]);
  const [monthlyLoading,setMonthlyLoading] = useState(false);
  const [selectedGuardId,setSelectedGuardId] = useState<string|null>(null);
  const selectedGuard = selectedGuardId ? guards.find(g => g.id === selectedGuardId) ?? null : null;
  const selectedEvidence = selectedGuardId ? evidence.find(r => r.guard_id === selectedGuardId) ?? null : null;
  const selectedMonth = /^\\d{4}-\\d{2}-\\d{2}$/.test(date) ? date.slice(0, 7) : "";
  const day = attendance[date] ?? {};
  const count = (s: string) => Object.values(day).filter(x => x === s).length;
  const mark = (id: string, status: "Present" | "Absent" | "Leave") => setAttendance({ ...attendance, [date]: { ...day, [id]: status } });

  useEffect(() => {
    if (!selectedGuardId) {
      setMonthlyEvidence([]);
      return;
    }
    let cancelled = false;
    const getDeviceId = () => {
      let id = window.localStorage.getItem("airavat-device-id");
      if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem("airavat-device-id", id);
      }
      return id;
    };
    setMonthlyLoading(true);
    void fetch("/api/admin/attendance-details?month="+encodeURIComponent(selectedMonth)+"&guardId="+encodeURIComponent(selectedGuardId)+"&deviceId="+encodeURIComponent(getDeviceId()), { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) setMonthlyEvidence(response.ok ? (payload.evidence ?? []) : []);
      })
      .catch(() => { if (!cancelled) setMonthlyEvidence([]); })
      .finally(() => { if (!cancelled) setMonthlyLoading(false); });
    return () => { cancelled = true; };
  }, [selectedGuardId, selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    const getDeviceId = () => {
      let id = window.localStorage.getItem("airavat-device-id");
      if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem("airavat-device-id", id);
      }
      return id;
    };
    void fetch("/api/admin/attendance-details?date="+encodeURIComponent(date)+"&deviceId="+encodeURIComponent(getDeviceId()), { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setEvidence([]);
          setSelfies({});
          return;
        }
        const rows = payload.evidence ?? [];
        setEvidence(rows);
        const signed: Record<string,string> = {};
        for (const row of rows) {
          if (row.selfie_url) signed[row.guard_id] = row.selfie_url;
        }
        setSelfies(signed);
      })
      .catch(() => {
        if (!cancelled) {
          setEvidence([]);
          setSelfies({});
        }
      });
    return () => { cancelled = true; };
  }, [date]);

  const guardName = (id:string) => guards.find(g => g.id === id)?.name ?? id;
  return <div className="content-wrap">
    <PageHeading eyebrow="Operations & deployment" title="Daily Attendance" subtitle="Record and review deployment attendance by date." action={<button className="secondary-button" onClick={() => window.print()}>▤ &nbsp; Print Sheet</button>} />
    <div className="attendance-date"><label className="field"><span>Attendance date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><button className="secondary-button" onClick={() => setAttendance({ ...attendance, [date]: Object.fromEntries(guards.filter(g => g.status === "Active").map(g => [g.id, "Present" as const])) })}>✓ &nbsp; Mark All Present</button></div>
    <div className="summary-row"><Metric label="PRESENT" value={count("Present")} note="On site" icon="✓" tone="green" /><Metric label="ABSENT" value={count("Absent")} note="Not on duty" icon="×" tone="red" /><Metric label="ON LEAVE" value={count("Leave")} note="Approved leave" icon="◷" tone="gold" /></div>
    <div className="section-heading" style={{marginTop:26}}><div><h2>Guards</h2><p>Select a guard to view today's attendance, coordinates and check-in proof.</p></div><span className="live-pill">{evidence.length} CHECK-INS</span></div>
    <div className="table-wrap"><table><thead><tr><th>GUARD</th><th>DEPLOYMENT SITE</th><th>SHIFT</th><th>STATUS</th><th>CHECK-IN</th><th>ACTION</th></tr></thead><tbody>{guards.map(g => { const checkIn=evidence.find(x=>x.guard_id===g.id); const status=checkIn?.status ?? day[g.id] ?? "Not marked"; return <tr key={g.id}><td><strong>{g.name}</strong><small className="cell-sub">{g.id}</small></td><td>{g.site || "—"}</td><td>{g.shift}</td><td><span className={status==="Present" ? "status present" : status==="Absent" ? "status absent" : status==="Leave" ? "status leave" : "status"}>{status}</span></td><td>{checkIn?.attendance_time ? new Date(checkIn.attendance_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—"}</td><td><button className="secondary-button" onClick={() => setSelectedGuardId(g.id)}>View Attendance</button></td></tr>; })}{!guards.length && <tr><td colSpan={6} className="empty-state">No guards registered yet.</td></tr>}</tbody></table></div>

    {selectedGuard && <section className="guard-checkin-panel">
      <div className="section-heading">
        <div>
          <h2>{selectedGuard.name} — Monthly Attendance</h2>
          <p>{selectedGuard.designation} · {selectedGuard.site || "No site assigned"} · {selectedGuard.shift}</p>
        </div>
        <button className="secondary-button" onClick={() => setSelectedGuardId(null)}>Close</button>
      </div>
      <div className="attendance-month-summary">
        <strong>{monthlyEvidence.length} attendance record{monthlyEvidence.length === 1 ? "" : "s"}</strong>
        <span>{selectedMonth ? new Date(selectedMonth+"-01T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"}) : "Select a valid date"}</span>
      </div>
      {monthlyLoading ? <div className="empty-state">Loading monthly attendance...</div> : monthlyEvidence.length ? (
        <div className="table-wrap monthly-attendance-table">
          <table>
            <thead><tr><th>DATE</th><th>STATUS</th><th>CHECK-IN</th><th>COORDINATES</th><th>ACCURACY</th><th>LOCATION</th><th>SELFIE</th></tr></thead>
            <tbody>{monthlyEvidence.map((row) => {
              const time = row.attendance_time ? new Date(row.attendance_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—";
              return <tr key={row.guard_id+"-"+row.attendance_date}>
                <td><strong>{new Date(row.attendance_date+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</strong></td>
                <td><span className="status present">{row.status}</span></td>
                <td>{time}</td>
                <td>{row.latitude != null && row.longitude != null ? <a href={"https://www.google.com/maps?q="+row.latitude+","+row.longitude} target="_blank" rel="noreferrer">{row.latitude.toFixed(6)}, {row.longitude.toFixed(6)}</a> : "—"}</td>
                <td>{row.accuracy != null ? "±"+Math.round(row.accuracy)+" m" : "—"}</td>
                <td>{row.address || "—"}</td>
                <td>{row.selfie_url ? <a href={row.selfie_url} target="_blank" rel="noreferrer" className="monthly-selfie-link">View</a> : "—"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      ) : <div className="empty-state guard-no-checkin"><strong>No attendance records for this guard.</strong><span>No check-ins were found for the selected month.</span></div>}
    </section>}

    <p className="table-foot">Attendance is saved to Supabase for {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "long" })}.</p>
  </div>;
}