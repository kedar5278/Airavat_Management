import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 100, orderBy: "-created_at" });

    return NextResponse.json({
      users: users.data.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Unnamed guard",
        username: user.username,
        imageUrl: user.imageUrl,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        phone: user.primaryPhoneNumber?.phoneNumber ?? "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Clerk users.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
