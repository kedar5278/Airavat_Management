import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/guard/:path*",
    "/api/guard/:path*",
    "/__clerk/:path*",
  ],
};
