import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airavat Security Management",
  description: "Security personnel, attendance, and invoice management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
