import { SignIn } from "@clerk/nextjs";

export default function GuardSignInPage() {
  return (
    <main className="guard-auth-shell">
      <div className="guard-auth-brand">
        <strong>AIRAVAT</strong>
        <span>Security Guard Portal</span>
      </div>
      <SignIn
        routing="path"
        path="/guard/sign-in"
        signUpUrl="/guard/sign-up"
        forceRedirectUrl="/guard"
        appearance={{ elements: { card: "guard-clerk-card" } }}
      />
    </main>
  );
}
