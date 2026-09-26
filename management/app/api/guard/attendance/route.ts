import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const todayIndia=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

async function getGuardForUser(){
  const {userId}=await auth();
  if(!userId)return {userId:null,guard:null,error:"Unauthorized"};
  const user=await currentUser();
  const email=user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  if(!email)return {userId,guard:null,error:"Your Google account has no email address."};
  const sb=getSupabaseAdminClient();
  const result=await sb.from("guards").select("id,name,email,phone,designation,site,shift,work_type,status,address,join_date,dob").ilike("email",email).eq("status","Active").maybeSingle();
  if(result.error)throw result.error;
  return {userId,guard:result.data,error:null};
}

export async function GET(){
  try{
    const {guard,error}=await getGuardForUser();
    if(error)return NextResponse.json({error},{status:401});
    if(!guard)return NextResponse.json({error:"This Gmail is not registered as an active guard."},{status:403});
    const sb=getSupabaseAdminClient();
    const result=await sb.from("guard_attendance").select("attendance_date,attendance_time,latitude,longitude,accuracy,address,selfie_path,status").eq("guard_id",guard.id).order("attendance_date",{ascending:false});
    if(result.error)throw result.error;
    const attendance=[];
    for(const row of result.data??[]){
      let selfie_url=null;
      if(row.selfie_path){
        const signed=await sb.storage.from("guard-attendance-selfies").createSignedUrl(row.selfie_path,300);
        selfie_url=signed.data?.signedUrl??null;
      }
      attendance.push({...row,selfie_url});
    }
    return NextResponse.json({guard,attendance,today:todayIndia()});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load guard data."},{status:503});
  }
}

export async function POST(request:Request){
  try{
    const {userId,guard,error}=await getGuardForUser();
    if(error)return NextResponse.json({error},{status:401});
    if(!guard)return NextResponse.json({error:"This Gmail is not registered as an active guard."},{status:403});
    const body=await request.json() as {selfie?:string;latitude?:number;longitude?:number;accuracy?:number;address?:string};
    if(!body.selfie||typeof body.latitude!=="number"||typeof body.longitude!=="number")return NextResponse.json({error:"Selfie and current location are required."},{status:400});
    if(!Number.isFinite(body.latitude)||!Number.isFinite(body.longitude)||!Number.isFinite(body.accuracy??0))return NextResponse.json({error:"Invalid location data."},{status:400});
    const sb=getSupabaseAdminClient();
    const date=todayIndia();
    const existing=await sb.from("guard_attendance").select("guard_id").eq("guard_id",guard.id).eq("attendance_date",date).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data)return NextResponse.json({error:"Attendance is already marked today."},{status:409});
    const match=body.selfie.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if(!match)return NextResponse.json({error:"Invalid selfie image."},{status:400});
    const mime=match[1],bytes=Buffer.from(match[2],"base64");
    if(bytes.length>4000000)return NextResponse.json({error:"Selfie is too large."},{status:413});
    const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
    const path=guard.id+"/"+date+"-"+Date.now()+"."+ext;
    const upload=await sb.storage.from("guard-attendance-selfies").upload(path,bytes,{contentType:mime,upsert:false});
    if(upload.error)throw upload.error;
    const insert=await sb.from("guard_attendance").insert({guard_id:guard.id,attendance_date:date,status:"Present",attendance_time:new Date().toISOString(),latitude:body.latitude,longitude:body.longitude,accuracy:body.accuracy??null,address:body.address?.slice(0,500)||null,selfie_path:path,marked_by_clerk_user_id:userId});
    if(insert.error){await sb.storage.from("guard-attendance-selfies").remove([path]);throw insert.error;}
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Attendance could not be saved."},{status:503});
  }
}
