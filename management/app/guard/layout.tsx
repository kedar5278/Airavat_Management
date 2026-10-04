import { ClerkProvider } from "@clerk/nextjs";

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
