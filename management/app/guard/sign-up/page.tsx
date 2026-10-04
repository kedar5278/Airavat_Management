import { SignUp } from "@clerk/nextjs";

export default function GuardSignUpPage() {
  return (
    <main className="guard-auth-shell">
      <div className="guard-auth-brand">
        <strong>AIRAVAT</strong>
        <span>Security Guard Registration</span>
      </div>
      <SignUp
        routing="path"
        path="/guard/sign-up"
        signInUrl="/guard/sign-in"
        forceRedirectUrl="/guard"
        appearance={{ elements: { card: "guard-clerk-card" } }}
      />
    </main>
  );
}
