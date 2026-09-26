"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import "./guard.css";

type Guard = { id:string; name:string; email:string; phone:string; designation:string; site:string; shift:string; status:string; photo_path?:string|null };
type Attendance = { attendance_date:string; attendance_time:string|null; latitude:number|null; longitude:number|null; selfie_path:string|null; status:string };

const text = {
  en:{profile:"My Profile",attendance:"Mark Attendance",history:"My Attendance",present:"Present",done:"Attendance marked",login:"Continue with Google",logout:"Log out",take:"Take Selfie",retake:"Retake Selfie",location:"Get Current Location",submit:"Submit Attendance",already:"Attendance already marked today.",missing:"Please take a selfie and allow your current location.",notFound:"No active guard profile is linked to this Google account.",loading:"Loading..."},
  gu:{profile:"મારી પ્રોફાઇલ",attendance:"હાજરી આપો",history:"મારી હાજરી",present:"હાજર",done:"હાજરી નોંધાઈ ગઈ",login:"Google થી ચાલુ રાખો",logout:"લૉગ આઉટ",take:"સેલ્ફી લો",retake:"ફરી સેલ્ફી લો",location:"વર્તમાન લોકેશન મેળવો",submit:"હાજરી સબમિટ કરો",already:"આજની હાજરી પહેલેથી નોંધાઈ છે.",missing:"કૃપા કરીને સેલ્ફી લો અને વર્તમાન લોકેશનની મંજૂરી આપો.",notFound:"આ Google એકાઉન્ટ સાથે કોઈ સક્રિય ગાર્ડ પ્રોફાઇલ જોડાયેલી નથી.",loading:"લોડ થઈ રહ્યું છે..."}
};

export default function GuardPortal(){
  const [lang,setLang]=useState<"en"|"gu">("en");
  const [user,setUser]=useState<{email?:string;user_metadata?:{full_name?:string;avatar_url?:string}}|null>(null);
  const [guard,setGuard]=useState<Guard|null>(null);
  const [rows,setRows]=useState<Attendance[]>([]);
  const [selfie,setSelfie]=useState("");
  const [location,setLocation]=useState<{lat:number;lng:number}|null>(null);
  const [camera,setCamera]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const t=text[lang];

  const load=async()=>{
    const sb=getSupabaseBrowserClient(); if(!sb){setLoading(false);return;}
    const {data:{user}}=await sb.auth.getUser();
    setUser(user ? {email:user.email,user_metadata:user.user_metadata} : null);
    if(!user){setLoading(false);return;}
    const {data:g}=await sb.from("guards").select("id,name,email,phone,designation,site,shift,status,photo_path").eq("email",user.email ?? "").eq("status","Active").maybeSingle();
    if(!g){setLoading(false);return;}
    setGuard(g);
    const {data:a}=await sb.from("guard_attendance").select("attendance_date,attendance_time,latitude,longitude,selfie_path,status").eq("guard_id",g.id).order("attendance_date",{ascending:false}).limit(90);
    setRows(a ?? []);
    setLoading(false);
  };

  useEffect(()=>{void load(); return ()=>{streamRef.current?.getTracks().forEach(x=>x.stop());};},[]);
  useEffect(()=>{if(camera && videoRef.current && streamRef.current) videoRef.current.srcObject=streamRef.current;},[camera]);

  const login=async()=>{
    const sb=getSupabaseBrowserClient(); if(!sb)return;
    await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/guard"}});
  };
  const startCamera=async()=>{
    try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});streamRef.current=s;setCamera(true);}catch{setMessage("Camera permission is required.");}
  };
  const capture=()=>{
    const v=videoRef.current;if(!v)return;
    const c=document.createElement("canvas");c.width=v.videoWidth||720;c.height=v.videoHeight||960;c.getContext("2d")?.drawImage(v,0,0,c.width,c.height);
    setSelfie(c.toDataURL("image/jpeg",0.82));streamRef.current?.getTracks().forEach(x=>x.stop());streamRef.current=null;setCamera(false);
  };
  const getLocation=()=>{
    setMessage("");
    navigator.geolocation.getCurrentPosition(p=>setLocation({lat:p.coords.latitude,lng:p.coords.longitude}),()=>setMessage("Location permission is required."),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  };
  const submit=async()=>{
    if(!guard||!selfie||!location){setMessage(t.missing);return;}
    if(rows.some(r=>r.attendance_date===new Date().toISOString().slice(0,10))){setMessage(t.already);return;}
    setBusy(true);setMessage("");
    try{
      const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase is not configured.");
      const blob=await (await fetch(selfie)).blob();
      const path=guard.id+"/"+new Date().toISOString().replace(/[:.]/g,"-")+".jpg";
      const up=await sb.storage.from("guard-attendance-selfies").upload(path,blob,{contentType:"image/jpeg",upsert:false});
      if(up.error)throw up.error;
      const now=new Date();
      const ins=await sb.from("guard_attendance").insert({guard_id:guard.id,attendance_date:now.toISOString().slice(0,10),status:"Present",attendance_time:now.toISOString(),latitude:location.lat,longitude:location.lng,selfie_path:path,marked_by_user_id:(await sb.auth.getUser()).data.user?.id});
      if(ins.error)throw ins.error;
      setMessage(t.done);setSelfie("");setLocation(null);await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Attendance could not be saved.");}
    finally{setBusy(false);}
  };

  if(loading)return <main className="guard-shell"><div className="guard-card">{t.loading}</div></main>;
  if(!user)return <main className="guard-shell"><div className="guard-card guard-login-card"><div className="guard-logo">A</div><h1>AIRAVAT</h1><p>Guard Attendance Portal</p><button className="guard-google" onClick={login}>G&nbsp; {t.login}</button></div></main>;
  if(!guard)return <main className="guard-shell"><div className="guard-card"><h2>{t.notFound}</h2><button className="guard-outline" onClick={()=>getSupabaseBrowserClient()?.auth.signOut().then(()=>location.reload())}>{t.logout}</button></div></main>;

  const today=new Date().toISOString().slice(0,10);
  const already=rows.some(r=>r.attendance_date===today);
  return <main className="guard-shell">
    <header className="guard-top"><div><strong>AIRAVAT</strong><span>Security Guard Portal</span></div><div className="guard-top-actions"><button onClick={()=>setLang(lang==="en"?"gu":"en")}>{lang==="en"?"ગુજરાતી":"English"}</button><button onClick={()=>getSupabaseBrowserClient()?.auth.signOut().then(()=>location.reload())}>{t.logout}</button></div></header>
    <section className="guard-wrap">
      <div className="guard-profile"><div className="guard-avatar">{guard.name.slice(0,1).toUpperCase()}</div><div><h1>{guard.name}</h1><p>{guard.id} · {guard.designation}</p><small>{guard.site||"Site not assigned"} · {guard.shift}</small></div></div>
      <section className="guard-card attendance-card"><h2>{t.attendance}</h2>{already?<div className="guard-success">{t.already}</div>:<>
        {camera?<div className="camera-box"><video ref={videoRef} autoPlay playsInline muted/><button className="guard-primary" onClick={capture}>{t.take}</button></div>:selfie?<div className="selfie-preview"><img src={selfie} alt="Attendance selfie"/><button className="guard-outline" onClick={()=>void startCamera()}>{t.retake}</button></div>:<button className="big-attendance" onClick={()=>void startCamera()}>📷<span>{t.take}</span></button>}
        <button className={location?"guard-success":"guard-location"} onClick={getLocation}>{location?"✓ Location captured":"📍 "+t.location}</button>
        <button className="guard-primary full" disabled={busy} onClick={()=>void submit()}>{busy?"Saving...":t.submit}</button>
        {message&&<p className="guard-message">{message}</p>}
      </>}</section>
      <section className="guard-card"><h2>{t.history}</h2><div className="guard-history">{rows.length?rows.map(r=><div className="history-row" key={r.attendance_date}><div><strong>{new Date(r.attendance_date+"T00:00:00").toLocaleDateString(lang==="gu"?"gu-IN":"en-IN",{day:"2-digit",month:"short",year:"numeric"})}</strong><small>{r.attendance_time?new Date(r.attendance_time).toLocaleTimeString(lang==="gu"?"gu-IN":"en-IN",{hour:"2-digit",minute:"2-digit"}):"—"}</small></div><span>{r.status}</span>{r.latitude!=null&&r.longitude!=null&&<a href={"https://www.google.com/maps?q="+r.latitude+","+r.longitude} target="_blank" rel="noreferrer">📍</a>}</div>):<p className="guard-muted">No attendance records yet.</p>}</div></section>
    </section>
  </main>;
}
