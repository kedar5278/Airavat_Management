import { auth } from "@clerk/nextjs/server";
import { SignIn } from "@clerk/nextjs";
import GuardPortalClient from "./GuardPortalClient";
import "./guard.css";

export default async function GuardPage(){
  const { userId } = await auth();
  if(!userId){
    return <main className="guard-auth-shell"><div className="guard-auth-brand"><strong>AIRAVAT</strong><span>Security Guard Portal</span></div><SignIn routing="hash" withSignUp={false} forceRedirectUrl="/guard" appearance={{elements:{card:"guard-clerk-card"}}}/></main>;
  }
  return <GuardPortalClient />;
}
