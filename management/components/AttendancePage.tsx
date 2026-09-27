"use client";

import { useEffect, useState } from "react";
import type { Guard, Attendance } from "./management-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import PageHeading from "./PageHeading";
import Metric from "./Metric";

export default function AttendancePage({ guards, attendance, setAttendance, date, setDate }: { guards: Guard[]; attendance: Attendance; setAttendance: (a: Attendance) => void; date: string; setDate: (d: string) => void }) {
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