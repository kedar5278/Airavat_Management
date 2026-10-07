import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Airavat Security Management",
  description: "Security personnel, attendance, and invoice management.",
  manifest: "/manifest.webmanifest",
  applicationName: "Airavat Security Management",
  appleWebApp: {
    capable: true,
    title: "Airavat Management",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/airavat-logo-navy.jpg",
    apple: "/airavat-logo-navy.jpg",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
