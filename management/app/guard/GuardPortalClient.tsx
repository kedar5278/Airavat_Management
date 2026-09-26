"use client";

import { useEffect, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";

type Guard={id:string;name:string;email:string;phone:string;designation:string;site:string;shift:string;work_type:string;status:string;address:string;join_date:string;dob:string};
type Attendance={attendance_date:string;attendance_time:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;address:string|null;selfie_path:string|null;selfie_url:string|null;status:string};

export default function GuardPortalClient(){
  const [guard,setGuard]=useState<Guard|null>(null);
  const [attendance,setAttendance]=useState<Attendance[]>([]);
  const [tab,setTab]=useState<"profile"|"attendance">("attendance");
  const [selfie,setSelfie]=useState("");
  const [loc,setLoc]=useState<{lat:number;lng:number;accuracy:number}|null>(null);
  const [address,setAddress]=useState("");
  const [camera,setCamera]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const mapKey=process.env.NEXT_PUBLIC_MAPTILER_KEY;

  const load=async()=>{
    setLoading(true);setMessage("");
    const r=await fetch("/api/guard/attendance",{cache:"no-store"});
    const d=await r.json();
    if(!r.ok){setMessage(d.error||"Could not load guard profile.");setLoading(false);return;}
    setGuard(d.guard);setAttendance(d.attendance||[]);setLoading(false);
  };
  useEffect(()=>{void load();return()=>streamRef.current?.getTracks().forEach(x=>x.stop());},[]);
  useEffect(()=>{if(camera&&videoRef.current&&streamRef.current)videoRef.current.srcObject=streamRef.current;},[camera]);

  const startCamera=async()=>{
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
      streamRef.current=s;setCamera(true);setMessage("");
    }catch{setMessage("Camera permission is required.");}
  };
  const capture=()=>{
    const v=videoRef.current;if(!v)return;
    const c=document.createElement("canvas");c.width=v.videoWidth||720;c.height=v.videoHeight||960;c.getContext("2d")?.drawImage(v,0,0,c.width,c.height);
    setSelfie(c.toDataURL("image/jpeg",0.82));streamRef.current?.getTracks().forEach(x=>x.stop());streamRef.current=null;setCamera(false);
  };
  const getLocation=()=>{
    setMessage("");setAddress("");
    navigator.geolocation.getCurrentPosition(async p=>{
      const next={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};setLoc(next);
      if(mapKey){
        try{
          const r=await fetch("https://api.maptiler.com/geocoding/"+next.lng+","+next.lat+".json?language=en&key="+encodeURIComponent(mapKey));
          const d=await r.json();setAddress(d?.features?.[0]?.place_name||d?.features?.[0]?.text||"");
        }catch{}
      }
    },()=>setMessage("Location permission is required."),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  };
  const submit=async()=>{
    if(!selfie||!loc){setMessage("Take a selfie and capture your current location first.");return;}
    setBusy(true);setMessage("");
    const r=await fetch("/api/guard/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selfie,latitude:loc.lat,longitude:loc.lng,accuracy:loc.accuracy,address})});
    const d=await r.json();
    if(!r.ok){setMessage(d.error||"Attendance could not be saved.");setBusy(false);return;}
    setSelfie("");setLoc(null);setAddress("");setMessage("Attendance marked successfully.");await load();setBusy(false);
  };

  const alreadyToday=attendance.some(x=>x.attendance_date===new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date()));
  const mapSrc=loc&&mapKey?"https://api.maptiler.com/maps/streets-v4/static/"+loc.lng+","+loc.lat+",16/800x320.png?key="+encodeURIComponent(mapKey)+"&markers="+loc.lng+","+loc.lat:"";

  if(loading)return <main className="guard-shell"><div className="guard-loading">Loading guard portal...</div></main>;

  if(!guard)return <main className="guard-shell"><div className="guard-wrap"><section className="guard-card guard-denied"><h2>Guard access unavailable</h2><p>{message||"This Google account is not registered as an active guard."}</p><UserButton afterSignOutUrl="/guard"/></section></div></main>;

  return <main className="guard-shell">
    <header className="guard-top"><div><strong>AIRAVAT</strong><span>Security Guard Portal</span></div><div className="guard-top-actions"><UserButton/></div></header>
    <section className="guard-wrap">
      <div className="guard-profile"><div className="guard-avatar">{guard.name.slice(0,1).toUpperCase()}</div><div><h1>{guard.name}</h1><p>{guard.id} · {guard.designation}</p><small>{guard.site||"No site assigned"} · {guard.shift}</small></div></div>
      <nav className="guard-tabs"><button className={tab==="attendance"?"active":""} onClick={()=>setTab("attendance")}>Attendance</button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}>Profile</button></nav>

      {tab==="profile"?<section className="guard-card"><h2>My Profile</h2><div className="guard-profile-grid">
        {[["Name",guard.name],["Guard ID",guard.id],["Email",guard.email],["Phone",guard.phone],["Designation",guard.designation],["Site",guard.site||"Unassigned"],["Shift",guard.shift],["Work Type",guard.work_type],["Date of Birth",guard.dob],["Joining Date",guard.join_date],["Address",guard.address]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v||"—"}</strong></div>)}
      </div></section>:<>
        <section className="guard-card attendance-card"><h2>Mark Attendance</h2>
          {alreadyToday?<div className="guard-success">Attendance already marked for today.</div>:<>
            {camera?<div className="camera-box"><video ref={videoRef} autoPlay playsInline muted/><button className="guard-primary" onClick={capture}>Capture Selfie</button></div>:selfie?<div className="selfie-preview"><img src={selfie} alt="Attendance selfie"/><button className="guard-outline" onClick={()=>void startCamera()}>Retake Selfie</button></div>:<button className="big-attendance" onClick={()=>void startCamera()}>📷<span>Take Selfie</span></button>}
            <button className={loc?"guard-success":"guard-location"} onClick={getLocation}>{loc?"✓ Location captured":"📍 Get Current Location"}</button>
            {loc&&<div className="location-details"><div><strong>GPS accuracy:</strong> ±{Math.round(loc.accuracy)} m</div>{address&&<div><strong>Address:</strong> {address}</div>}{mapSrc&&<img className="guard-map" src={mapSrc} alt="Captured attendance location map"/>}<a className="guard-outline location-map-link" href={"https://www.openstreetmap.org/?mlat="+loc.lat+"&mlon="+loc.lng+"#map=18/"+loc.lat+"/"+loc.lng} target="_blank" rel="noreferrer">Open map</a></div>}
            <button className="guard-primary full" disabled={busy} onClick={()=>void submit()}>{busy?"Saving...":"Submit Attendance"}</button>
            {message&&<p className="guard-message">{message}</p>}
          </>}
        </section>
        <section className="guard-card"><h2>My Attendance</h2><div className="guard-history">{attendance.length?attendance.map(r=><div className="history-row" key={r.attendance_date}><div><strong>{new Date(r.attendance_date+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</strong><small>{r.attendance_time?new Date(r.attendance_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—"}{r.accuracy!=null?" · ±"+Math.round(r.accuracy)+"m":""}</small></div><span>{r.status}</span>{r.selfie_url&&<a href={r.selfie_url} target="_blank" rel="noreferrer"><img src={r.selfie_url} alt="Attendance selfie" className="history-selfie"/></a>}{r.latitude!=null&&r.longitude!=null&&<a href={"https://www.openstreetmap.org/?mlat="+r.latitude+"&mlon="+r.longitude+"#map=18/"+r.latitude+"/"+r.longitude} target="_blank" rel="noreferrer">📍</a>}</div>):<p className="guard-muted">No attendance records yet.</p>}</div></section>
      </>}
    </section>
  </main>;
}
