"use client";

import { useEffect, useState } from "react";
import type { Guard, Attendance } from "./management-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import PageHeading from "./PageHeading";
import Metric from "./Metric";

export default function AttendancePage({ guards, attendance, setAttendance, date, setDate }: { guards: Guard[]; attendance: Attendance; setAttendance: (a: Attendance) => void; date: string; setDate: (d: string) => void }) {
  const [evidence,setEvidence] = useState<Array<{guard_id:string;attendance_time:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;address:string|null;selfie_path:string|null;status:string}>>([]);
  const [selfies,setSelfies] = useState<Record<string,string>>({});
  const [selectedGuardId,setSelectedGuardId] = useState<string|null>(null);
  const selectedGuard = selectedGuardId ? guards.find(g => g.id === selectedGuardId) ?? null : null;
  const selectedEvidence = selectedGuardId ? evidence.find(r => r.guard_id === selectedGuardId) ?? null : null;
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
    <div className="section-heading" style={{marginTop:26}}><div><h2>Guards</h2><p>Select a guard to view today's attendance, coordinates and check-in proof.</p></div><span className="live-pill">{evidence.length} CHECK-INS</span></div>
    <div className="table-wrap"><table><thead><tr><th>GUARD</th><th>DEPLOYMENT SITE</th><th>SHIFT</th><th>STATUS</th><th>CHECK-IN</th><th>ACTION</th></tr></thead><tbody>{guards.map(g => { const checkIn=evidence.find(x=>x.guard_id===g.id); const status=checkIn?.status ?? day[g.id] ?? "Not marked"; return <tr key={g.id}><td><strong>{g.name}</strong><small className="cell-sub">{g.id}</small></td><td>{g.site || "—"}</td><td>{g.shift}</td><td><span className={status==="Present" ? "status present" : status==="Absent" ? "status absent" : status==="Leave" ? "status leave" : "status"}>{status}</span></td><td>{checkIn?.attendance_time ? new Date(checkIn.attendance_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—"}</td><td><button className="secondary-button" onClick={() => setSelectedGuardId(g.id)}>View Attendance</button></td></tr>; })}{!guards.length && <tr><td colSpan={6} className="empty-state">No guards registered yet.</td></tr>}</tbody></table></div>

    {selectedGuard && <section className="guard-checkin-panel"><div className="section-heading"><div><h2>{selectedGuard.name}</h2><p>{selectedGuard.designation} · {selectedGuard.site || "No site assigned"} · {selectedGuard.shift}</p></div><button className="secondary-button" onClick={() => setSelectedGuardId(null)}>Close</button></div>{selectedEvidence ? <div className="guard-checkin-grid"><div className="checkin-info-card"><span className="status present">{selectedEvidence.status}</span><div className="checkin-detail"><strong>Check-in time</strong><span>{selectedEvidence.attendance_time ? new Date(selectedEvidence.attendance_time).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"medium"}) : "—"}</span></div><div className="checkin-detail"><strong>Coordinates</strong><span>{selectedEvidence.latitude != null && selectedEvidence.longitude != null ? selectedEvidence.latitude.toFixed(6)+", "+selectedEvidence.longitude.toFixed(6) : "Not captured"}</span></div><div className="checkin-detail"><strong>GPS accuracy</strong><span>{selectedEvidence.accuracy != null ? "±"+Math.round(selectedEvidence.accuracy)+" m" : "—"}</span></div><div className="checkin-detail"><strong>Address</strong><span>{selectedEvidence.address || "Address not captured"}</span></div>{selectedEvidence.latitude != null && selectedEvidence.longitude != null && <a className="secondary-button location-action" href={"https://www.google.com/maps?q="+selectedEvidence.latitude+","+selectedEvidence.longitude} target="_blank" rel="noreferrer">📍 Open Coordinates on Map</a>}</div><div className="checkin-selfie-card">{selfies[selectedGuard.id] ? <a href={selfies[selectedGuard.id]} target="_blank" rel="noreferrer"><img src={selfies[selectedGuard.id]} alt={selectedGuard.name+" attendance selfie"} /></a> : <div className="empty-state">No attendance selfie available.</div>}</div></div> : <div className="empty-state guard-no-checkin"><strong>No attendance recorded for {selectedGuard.name}.</strong><span>This guard has not submitted today's check-in yet, so there are no coordinates or selfie to display.</span></div>}</section>}

    <p className="table-foot">Attendance is saved to Supabase for {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "long" })}.</p>
  </div>;
}