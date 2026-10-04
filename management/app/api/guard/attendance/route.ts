import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const todayIndia=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [value.message, value.details, value.hint, value.code].filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length) return parts.join(" | ");
  }
  return String(error || "Unknown guard data error.");
}


async function getGuardForUser(){
  const {userId}=await auth();
  if(!userId)return {userId:null,guard:null,email:null,error:"Unauthorized"};
  const user=await currentUser();
  const email=user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  if(!email)return {userId,guard:null,email:null,error:"Your Clerk account has no email address."};

  const sb=getSupabaseAdminClient() as any;
  const result=await sb
    .from("guards")
    .select("id,name,email,phone,designation,site,shift,work_type,status,address,join_date,dob")
    .ilike("email",email)
    .eq("status","Active")
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(result.error)throw result.error;
  if(result.data)return {userId,guard:result.data,email,error:null};

  // During local development, allow a newly-created Clerk account to test
  // the complete guard portal without requiring an Admin Guard List record.
  // Production still requires the normal admin-created guard record.
  if(process.env.NODE_ENV !== "production"){
    const testId="DEV-"+userId.replace(/[^a-zA-Z0-9]/g,"").slice(-12).toUpperCase();
    const testGuard={
      id:testId,
      name:[user?.firstName,user?.lastName].filter(Boolean).join(" ") || "Test Guard",
      phone:user?.phoneNumbers?.[0]?.phoneNumber || "0000000000",
      email,
      aadhaar:"DEV-TEST",
      gender:"Not specified",
      dob:"2000-01-01",
      address:"Development Test Account",
      designation:"Security Guard",
      site:process.env.GUARD_DEV_SITE?.trim() || "Development Test Site",
      salary:0,
      join_date:todayIndia(),
      status:"Active",
      shift:"Day Shift",
      work_type:"Development Test",
    };
    const created=await sb.from("guards").upsert(testGuard,{onConflict:"id"}).select("id,name,email,phone,designation,site,shift,work_type,status,address,join_date,dob").single();
    if(created.error)throw created.error;
    return {userId,guard:created.data,email,error:null};
  }

  return {userId,guard:null,email,error:null};
}

export async function GET(){
  try{
    const {guard,email,error}=await getGuardForUser();
    if(error)return NextResponse.json({error},{status:401});
    if(!guard)return NextResponse.json({error:`No active guard found for Clerk email: ${email ?? "no email"}. Ask the admin to register your guard with this same email.`},{status:403});
    const sb=getSupabaseAdminClient() as any;
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
    const detail=errorMessage(error);
    console.error("[guard/attendance GET]",detail);
    return NextResponse.json({error:`Could not load guard data: ${detail}`},{status:503});
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
    const bucketName = "guard-attendance-selfies";
    let bucket = sb.storage.from(bucketName);
    let upload = await bucket.upload(path, bytes, { contentType: mime, upsert: false });

    if (upload.error && /bucket not found/i.test(upload.error.message)) {
      const created = await sb.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 4000000,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      if (created.error && !/already exists/i.test(created.error.message)) {
        throw new Error(`Could not create attendance photo storage bucket: ${created.error.message}`);
      }

      // Recreate the storage client after creating the bucket, then retry once.
      bucket = sb.storage.from(bucketName);
      upload = await bucket.upload(path, bytes, { contentType: mime, upsert: false });
    }

    if (upload.error) throw upload.error;
    const insert=await sb.from("guard_attendance").insert({guard_id:guard.id,attendance_date:date,status:"Present",attendance_time:new Date().toISOString(),latitude:body.latitude,longitude:body.longitude,accuracy:body.accuracy??null,address:body.address?.slice(0,500)||null,selfie_path:path,marked_by_clerk_user_id:userId});
    if(insert.error){await bucket.remove([path]);throw insert.error;}
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:errorMessage(error)},{status:503});
  }
}
