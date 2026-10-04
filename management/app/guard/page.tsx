import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import GuardPortalClient from "./GuardPortalClient";
import "./guard.css";

export default async function GuardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/guard/sign-in");
  return <GuardPortalClient />;
}
