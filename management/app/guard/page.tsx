"use client";

import { useEffect, useRef, useState } from "react";
import "./guard.css";

type Attendance={attendance_date:string;attendance_time:string|null;latitude:number|null;longitude:number|null;accuracy:number|null;address:string|null;selfie_path:string|null;status:string};

const TEST_GUARD={id:"TEST-GUARD-001",name:"Test Guard",phone:"0000000000",email:"",designation:"Security Guard",site:"Test Site",shift:"Day Shift",status:"Active"};
const text={
  en:{loading:"Loading...",attendance:"Mark Attendance",history:"My Attendance",take:"Take Selfie",retake:"Retake Selfie",location:"Get Current Location",submit:"Submit Attendance",already:"Attendance already marked today.",missing:"Please take a selfie and allow your current location.",done:"Attendance marked successfully.",camera:"Camera permission is required.",geo:"Location permission is required."},
  gu:{loading:"લોડ થઈ રહ્યું છે...",attendance:"હાજરી આપો",history:"મારી હાજરી",take:"સેલ્ફી લો",retake:"ફરી સેલ્ફી લો",location:"વર્તમાન લોકેશન મેળવો",submit:"હાજરી સબમિટ કરો",already:"આજની હાજરી પહેલેથી નોંધાઈ છે.",missing:"કૃપા કરીને સેલ્ફી લો અને વર્તમાન લોકેશનની મંજૂરી આપો.",done:"હાજરી સફળતાપૂર્વક નોંધાઈ ગઈ.",camera:"કેમેરાની મંજૂરી જરૂરી છે.",geo:"લોકેશનની મંજૂરી જરૂરી છે."}
};

export default function GuardPortal(){
  const [lang,setLang]=useState<"en"|"gu">("en");
  const [rows,setRows]=useState<Attendance[]>([]);
  const [selfie,setSelfie]=useState("");
  const [loc,setLoc]=useState<{lat:number;lng:number;accuracy:number}|null>(null);
  const [address,setAddress]=useState("");
  const [camera,setCamera]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const t=text[lang];
  const mapKey=process.env.NEXT_PUBLIC_MAPTILER_KEY;

  useEffect(()=>{
    try{setRows(JSON.parse(localStorage.getItem("airavat-test-attendance")||"[]"));}catch{}
    return()=>streamRef.current?.getTracks().forEach(x=>x.stop());
  },[]);
  useEffect(()=>{if(camera&&videoRef.current&&streamRef.current)videoRef.current.srcObject=streamRef.current;},[camera]);

  const startCamera=async()=>{
    try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});streamRef.current=s;setCamera(true);setMessage("");}
    catch{setMessage(t.camera);}
  };
  const capture=()=>{
    const v=videoRef.current;if(!v)return;
    const c=document.createElement("canvas");c.width=v.videoWidth||720;c.height=v.videoHeight||960;c.getContext("2d")?.drawImage(v,0,0,c.width,c.height);
    setSelfie(c.toDataURL("image/jpeg",0.82));streamRef.current?.getTracks().forEach(x=>x.stop());streamRef.current=null;setCamera(false);
  };
  const getLocation=()=>{
    setMessage("");
    navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}),()=>setMessage(t.geo),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  };
  const submit=async()=>{
    if(!selfie||!loc){setMessage(t.missing);return;}
    setBusy(true);setMessage("");
    const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const row={attendance_date:date,attendance_time:new Date().toISOString(),latitude:loc.lat,longitude:loc.lng,accuracy:loc.accuracy,address:address||null,selfie_path:null,status:"Present" as const};
    const next=[row,...rows.filter(x=>x.attendance_date!==date)];
    localStorage.setItem("airavat-test-attendance",JSON.stringify(next));
    setRows(next);setSelfie("");setLoc(null);setAddress("");setMessage(t.done);setBusy(false);
  };

  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const already=rows.some(r=>r.attendance_date===today);

  return <main className="guard-shell">
    <header className="guard-top"><div><strong>AIRAVAT</strong><span>Security Guard Portal</span></div><div className="guard-top-actions"><button onClick={()=>setLang(lang==="en"?"gu":"en")}>{lang==="en"?"ગુજરાતી":"English"}</button></div></header>
    <section className="guard-wrap">
      <div className="guard-profile"><div className="guard-avatar">{TEST_GUARD.name.slice(0,1)}</div><div><h1>{TEST_GUARD.name}</h1><p>{TEST_GUARD.id} · {TEST_GUARD.designation}</p><small>{TEST_GUARD.site} · {TEST_GUARD.shift}</small></div></div>
      <section className="guard-card attendance-card"><h2>{t.attendance}</h2>{already?<div className="guard-success">{t.already}</div>:<>
        {camera?<div className="camera-box"><video ref={videoRef} autoPlay playsInline muted/><button className="guard-primary" onClick={capture}>{t.take}</button></div>:selfie?<div className="selfie-preview"><img src={selfie} alt="Attendance selfie"/><button className="guard-outline" onClick={()=>void startCamera()}>{t.retake}</button></div>:<button className="big-attendance" onClick={()=>void startCamera()}>📷<span>{t.take}</span></button>}
        <button className={loc?"guard-success":"guard-location"} onClick={getLocation}>{loc?"✓ Location captured":"📍 "+t.location}</button>
        {loc&&<div className="location-details"><div><strong>GPS accuracy:</strong> {Math.round(loc.accuracy)} m</div>{address&&<div><strong>Address:</strong> {address}</div>}{mapKey&&<iframe title="Attendance location map" src={`https://api.maptiler.com/maps/streets-v4/?key=${encodeURIComponent(mapKey)}#15/${loc.lat}/${loc.lng}`} loading="lazy" className="guard-map"/>}<a className="guard-outline location-map-link" href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=18/${loc.lat}/${loc.lng}`} target="_blank" rel="noreferrer">Open Map</a></div>}
        <button className="guard-primary full" disabled={busy} onClick={()=>void submit()}>{busy?"Saving...":t.submit}</button>
        {message&&<p className="guard-message">{message}</p>}
      </>}</section>
      <section className="guard-card"><h2>{t.history}</h2><div className="guard-history">{rows.length?rows.map(r=><div className="history-row" key={r.attendance_date}><div><strong>{new Date(r.attendance_date+"T00:00:00").toLocaleDateString(lang==="gu"?"gu-IN":"en-IN",{day:"2-digit",month:"short",year:"numeric"})}</strong><small>{r.attendance_time?new Date(r.attendance_time).toLocaleTimeString(lang==="gu"?"gu-IN":"en-IN",{hour:"2-digit",minute:"2-digit"}):"—"}{r.accuracy!=null?` · ±${Math.round(r.accuracy)}m`:""}</small></div><span>{r.status}</span>{r.latitude!=null&&r.longitude!=null&&<a href={"https://www.openstreetmap.org/?mlat="+r.latitude+"&mlon="+r.longitude+"#map=18/"+r.latitude+"/"+r.longitude} target="_blank" rel="noreferrer">📍</a>}</div>):<p className="guard-muted">No attendance records yet.</p>}</div></section>
    </section>
  </main>;
}
