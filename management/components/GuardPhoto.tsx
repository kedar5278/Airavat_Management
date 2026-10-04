"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";\nimport type { Guard } from "./management-types";\nimport { jsPDF } from "jspdf";

export default function GuardPhoto({ path, label, className }: { path?: string; label: string; className: string }) {
  const [resolved, setResolved] = useState<{ path: string; src: string } | null>(null);
  useEffect(() => {
    if (!path || path.startsWith("data:") || path.startsWith("http")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.storage.from("guard-photos").createSignedUrl(path, 300).then((result: { data: { signedUrl: string } | null }) => { if (!cancelled && result.data) setResolved({ path, src: result.data.signedUrl }); });
    return () => { cancelled = true; };
  }, [path]);
  const src = path?.startsWith("data:") || path?.startsWith("http") ? path : resolved && resolved.path === path ? resolved.src : "";
  return src ? <Image src={src} alt={label} width={100} height={100} unoptimized className={className} /> : <span className={`${className} photo-placeholder`}>{label.split(" ").map(w => w[0]).join("").slice(0,2)}</span>;
}

async function downloadGuardPdf(guard: Guard) {
  const pdf = new jsPDF();
  pdf.setFillColor(8, 13, 66); pdf.rect(0, 0, 210, 32, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.text("AIRAVAT SECURITY SERVICE", 15, 15);
  pdf.setFontSize(10); pdf.text("SECURITY PERSONNEL PROFILE", 15, 23);
  pdf.setTextColor(25, 35, 58); pdf.setFontSize(16); pdf.text(guard.name, 15, 47);
  pdf.setFontSize(10); pdf.setTextColor(95, 105, 125); pdf.text(`${guard.id}   •   ${guard.designation}   •   ${guard.status}`, 15, 55);
  if (guard.photo) {
    try {
      let image = guard.photo;
      if (!image.startsWith("data:") && !image.startsWith("http")) {
        const sb = getSupabaseBrowserClient(); const { data, error } = await sb!.storage.from("guard-photos").createSignedUrl(image, 120);
        if (error || !data) throw error;
        image = data.signedUrl;
      }
      const blob = await (await fetch(image)).blob();
      image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      pdf.addImage(image, "JPEG", 165, 38, 30, 34);
    } catch { /* The PDF remains useful if the private photo is unavailable. */ }
  }
  const rows: [string,string][] = [["Phone",guard.phone],["Email",guard.email||"—"],["Aadhaar",guard.aadhaar],["Gender",guard.gender],["Date of birth",guard.dob],["Deployment site",guard.site||"Unassigned"],["Monthly salary",`INR ${guard.salary.toLocaleString("en-IN")}`],["Joining date",guard.joinDate],["Work type",guard.workType],["Preferred shift",guard.shift],["Address",guard.address]];
  let y=84;
  for (const [label,value] of rows) {
    pdf.setFont("helvetica","bold"); pdf.setTextColor(75,85,105); pdf.text(label.toUpperCase(),15,y);
    pdf.setFont("helvetica","normal"); pdf.setTextColor(25,35,58);
    const lines=pdf.splitTextToSize(value || "—",125); pdf.text(lines,75,y); y+=Math.max(10,lines.length*6);
    pdf.setDrawColor(228,232,239); pdf.line(15,y-4,195,y-4); y+=2;
  }
  pdf.setFontSize(8); pdf.setTextColor(135,145,160); pdf.text(`Generated ${new Date().toLocaleDateString("en-IN")} · Airavat Security Service`,15,285);
  pdf.save(`${guard.id}-${guard.name.trim().replace(/\s+/g,"-")}-profile.pdf`);
}