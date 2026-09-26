import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return NextResponse.json({error:"Server Supabase key is not configured."},{status:503});
  const sb=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:guard,error}=await sb.from("guards").select("id,name,phone,email,designation,site,shift,status,photo_path").eq("status","Active").order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:503});
  if(!guard)return NextResponse.json({error:"No Active guard found. Register one guard first."},{status:404});
  const {data:attendance}=await sb.from("guard_attendance").select("attendance_date,attendance_time,latitude,longitude,selfie_path,status").eq("guard_id",guard.id).order("attendance_date",{ascending:false}).limit(90);
  return NextResponse.json({guard,attendance:attendance??[]});
}
