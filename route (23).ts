import { route } from "@/lib/api";
import { createSession } from "@/lib/terminal";

export const dynamic = "force-dynamic";

// Open a new host shell session for the current admin.
export const POST = route(async ({ user }) => createSession(user.id), { admin: true });
