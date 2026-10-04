import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/guard(.*)",
    "/api/guard(.*)",
  ],
};
