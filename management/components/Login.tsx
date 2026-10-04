"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Login({ ready, onLogin }: { ready: boolean; onLogin: (id: string, password: string) => Promise<void> }) {
  const [mode,setMode]=useState<"admin"|"guard">("admin");
  const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [show,setShow]=useState(false); const [pending,setPending]=useState(false);
  const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const configured=Boolean(projectUrl&&anonKey&&!/YOUR_|example\.com|your-project|your_supabase/i.test(projectUrl+" "+anonKey));
  if(!ready)return <div className="login-screen"><div className="login-brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service" width={112} height={108} className="login-logo"/><h1>AIRAVAT</h1><div className="gold-kicker">SECURITY SERVICE</div><p>સર્વદા શક્તિશાળી</p></div><div className="login-card login-hydrating" role="status">Checking secure session…</div><p className="login-footer">© 2026 Airavat Security Service · Jamnagar, Gujarat</p></div>;
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError("");setPending(true);try{
    if(mode==="guard"){const response=await fetch("/api/guard/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:username,phone:password})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error??"Guard sign in failed.");window.location.href="/guard";return;}
    await onLogin(username,password);
  }catch(cause){setError(cause instanceof Error?cause.message:"Sign in failed.");}finally{setPending(false);}};
  return <div className="login-screen"><div className="login-brand"><Image src="/airavat-logo-navy.jpg" alt="Airavat Security Service" width={112} height={108} className="login-logo"/><h1>AIRAVAT</h1><div className="gold-kicker">SECURITY SERVICE</div><p>સર્વદા શક્તિશાળી</p></div>
    <div className="login-card">
      <div className="login-role-switch"><button type="button" className={mode==="admin"?"active":""} onClick={()=>{setMode("admin");setError("");setUsername("");setPassword("");}}>Login as Admin</button><button type="button" className={mode==="guard"?"active":""} onClick={()=>{setMode("guard");setError("");setUsername("");setPassword("");}}>Login as Guard</button></div>
      {mode==="admin"?<form onSubmit={submit}><div className="login-heading"><span>♙</span><div><h2>Admin Portal</h2><p>Verified sign-in · maximum two active devices</p></div></div>{!configured&&<p className="setup-message">Supabase URL/key is missing or still uses template values.</p>}<label>Admin ID<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required /></label><label>Password<div className="password-box"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={()=>setShow(!show)}>{show?"Hide":"Show"}</button></div></label>{error&&<p className="login-error">{error}</p>}<button className="login-submit" disabled={pending}>{pending?"Signing in…":"Sign in"}</button></form>
      :<div><div className="login-heading"><span>♙</span><div><h2>Guard Portal</h2><p>Login or create your guard account to continue.</p></div></div><button type="button" className="login-submit" onClick={()=>{window.location.href="/guard";}}>Login / Sign up as Guard</button></div>}
    </div><p className="login-footer">© 2026 Airavat Security Service · Jamnagar, Gujarat</p>
  </div>;
}