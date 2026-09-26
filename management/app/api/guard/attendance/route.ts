import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const todayIndia=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as {guardId?:string;selfie?:string;latitude?:number;longitude?:number}|null;
  const guardId=body?.guardId?.trim();
  if(!guardId||!body?.selfie||typeof body.latitude!=="number"||typeof body.longitude!=="number")return NextResponse.json({error:"Selfie and current location are required."},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return NextResponse.json({error:"Server Supabase key is not configured."},{status:503});
  const sb=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:guard}=await sb.from("guards").select("id,status").eq("id",guardId).eq("status","Active").maybeSingle();
  if(!guard)return NextResponse.json({error:"Active guard not found."},{status:404});
  const date=todayIndia();
  const {data:existing}=await sb.from("guard_attendance").select("guard_id").eq("guard_id",guardId).eq("attendance_date",date).maybeSingle();
  if(existing)return NextResponse.json({error:"Attendance already marked today."},{status:409});
  const comma=body.selfie.indexOf(",");
  const bytes=Buffer.from(comma>=0?body.selfie.slice(comma+1):"","base64");
  if(!bytes.length||bytes.length>4000000)return NextResponse.json({error:"Selfie is too large or invalid."},{status:400});
  const path=guardId+"/"+Date.now()+".jpg";
  const upload=await sb.storage.from("guard-attendance-selfies").upload(path,bytes,{contentType:"image/jpeg",upsert:false});
  if(upload.error)return NextResponse.json({error:upload.error.message},{status:503});
  const {error}=await sb.from("guard_attendance").insert({guard_id:guardId,attendance_date:date,status:"Present",attendance_time:new Date().toISOString(),latitude:body.latitude,longitude:body.longitude,selfie_path:path});
  if(error){await sb.storage.from("guard-attendance-selfies").remove([path]);return NextResponse.json({error:error.message},{status:503});}
  return NextResponse.json({ok:true});
}
