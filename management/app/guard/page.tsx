"use client";

import { useEffect, useRef, useState } from "react";
import "./guard.css";

type Guard={id:string;name:string;phone:string;email:string;designation:string;site:string;shift:string;status:string;photo_path?:string|null};
type Attendance={attendance_date:string;attendance_time:string|null;latitude:number|null;longitude:number|null;selfie_path:string|null;status:string};

const text={
  en:{loading:"Loading...",profile:"My Profile",attendance:"Mark Attendance",history:"My Attendance",take:"Take Selfie",retake:"Retake Selfie",location:"Get Current Location",submit:"Submit Attendance",already:"Attendance already marked today.",missing:"Please take a selfie and allow your current location.",logout:"Log out",back:"Back to Login",done:"Attendance marked successfully."},
  gu:{loading:"લોડ થઈ રહ્યું છે...",profile:"મારી પ્રોફાઇલ",attendance:"હાજરી આપો",history:"મારી હાજરી",take:"સેલ્ફી લો",retake:"ફરી સેલ્ફી લો",location:"વર્તમાન લોકેશન મેળવો",submit:"હાજરી સબમિટ કરો",already:"આજની હાજરી પહેલેથી નોંધાઈ છે.",missing:"કૃપા કરીને સેલ્ફી લો અને વર્તમાન લોકેશનની મંજૂરી આપો.",logout:"લૉગ આઉટ",back:"લૉગિન પર પાછા જાઓ",done:"હાજરી સફળતાપૂર્વક નોંધાઈ ગઈ."}
};

export default function GuardPortal(){
  const [lang,setLang]=useState<"en"|"gu">("en");
  const [guard,setGuard]=useState<Guard|null>(null);
  const [rows,setRows]=useState<Attendance[]>([]);
  const [selfie,setSelfie]=useState("");
  const [loc,setLoc]=useState<{lat:number;lng:number}|null>(null);
  const [camera,setCamera]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const t=text[lang];

  const load=async()=>{
    const r=await fetch("/api/guard/session",{cache:"no-store"});
    if(!r.ok){window.location.href="/";return;}
    const data=await r.json();
    setGuard(data.guard);setRows(data.attendance??[]);setLoading(false);
  };
  useEffect(()=>{void load();return()=>streamRef.current?.getTracks().forEach(x=>x.stop());},[]);
  useEffect(()=>{if(camera&&videoRef.current&&streamRef.current)videoRef.current.srcObject=streamRef.current;},[camera]);

  const startCamera=async()=>{
    try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});streamRef.current=s;setCamera(true);setMessage("");}
    catch{setMessage("Camera permission is required.");}
  };
  const capture=()=>{
    const v=videoRef.current;if(!v)return;
    const c=document.createElement("canvas");c.width=v.videoWidth||720;c.height=v.videoHeight||960;c.getContext("2d")?.drawImage(v,0,0,c.width,c.height);
    setSelfie(c.toDataURL("image/jpeg",0.82));streamRef.current?.getTracks().forEach(x=>x.stop());streamRef.current=null;setCamera(false);
  };
  const getLocation=()=>{
    setMessage("");
    navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}),()=>setMessage("Location permission is required."),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  };
  const submit=async()=>{
    if(!selfie||!loc){setMessage(t.missing);return;}
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/guard/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selfie,latitude:loc.lat,longitude:loc.lng})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error??"Attendance could not be saved.");
      setMessage(t.done);setSelfie("");setLoc(null);await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Attendance could not be saved.");}
    finally{setBusy(false);}
  };
  const logout=async()=>{await fetch("/api/guard/logout",{method:"POST"});window.location.href="/";};

  if(loading)return <main className="guard-shell"><div className="guard-card">{t.loading}</div></main>;
  if(!guard)return null;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const already=rows.some(r=>r.attendance_date===today);

  return <main className="guard-shell">
    <header className="guard-top"><div><strong>AIRAVAT</strong><span>Security Guard Portal</span></div><div className="guard-top-actions"><button onClick={()=>setLang(lang==="en"?"gu":"en")}>{lang==="en"?"ગુજરાતી":"English"}</button><button onClick={()=>void logout()}>{t.logout}</button></div></header>
    <section className="guard-wrap">
      <div className="guard-profile"><div className="guard-avatar">{guard.name.slice(0,1).toUpperCase()}</div><div><h1>{guard.name}</h1><p>{guard.id} · {guard.designation}</p><small>{guard.site||"Site not assigned"} · {guard.shift}</small></div></div>
      <section className="guard-card attendance-card"><h2>{t.attendance}</h2>{already?<div className="guard-success">{t.already}</div>:<>
        {camera?<div className="camera-box"><video ref={videoRef} autoPlay playsInline muted/><button className="guard-primary" onClick={capture}>{t.take}</button></div>:selfie?<div className="selfie-preview"><img src={selfie} alt="Attendance selfie"/><button className="guard-outline" onClick={()=>void startCamera()}>{t.retake}</button></div>:<button className="big-attendance" onClick={()=>void startCamera()}>📷<span>{t.take}</span></button>}
        <button className={loc?"guard-success":"guard-location"} onClick={getLocation}>{loc?"✓ Location captured":"📍 "+t.location}</button>
        <button className="guard-primary full" disabled={busy} onClick={()=>void submit()}>{busy?"Saving...":t.submit}</button>
        {message&&<p className="guard-message">{message}</p>}
      </>}</section>
      <section className="guard-card"><h2>{t.history}</h2><div className="guard-history">{rows.length?rows.map(r=><div className="history-row" key={r.attendance_date}><div><strong>{new Date(r.attendance_date+"T00:00:00").toLocaleDateString(lang==="gu"?"gu-IN":"en-IN",{day:"2-digit",month:"short",year:"numeric"})}</strong><small>{r.attendance_time?new Date(r.attendance_time).toLocaleTimeString(lang==="gu"?"gu-IN":"en-IN",{hour:"2-digit",minute:"2-digit"}):"—"}</small></div><span>{r.status}</span>{r.latitude!=null&&r.longitude!=null&&<a href={"https://www.google.com/maps?q="+r.latitude+","+r.longitude} target="_blank" rel="noreferrer">📍</a>}</div>):<p className="guard-muted">No attendance records yet.</p>}</div></section>
    </section>
  </main>;
}
