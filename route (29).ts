import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Liveness + database probe. Returns the failure reason so operators can
 * diagnose a broken deployment from `curl /api/health` alone.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected", latencyMs: Date.now() - started });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;

    let hint = "Check DATABASE_URL in .env and that PostgreSQL is running.";
    if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
      hint = "PostgreSQL is not running or not listening. Try: service postgresql start";
    } else if (code === "28P01" || message.includes("password authentication")) {
      hint = "Wrong database user/password in DATABASE_URL.";
    } else if (code === "3D000" || message.includes("does not exist")) {
      hint = "Database does not exist. Create it, then run: npx drizzle-kit push --force";
    } else if (code === "42P01" || message.includes("relation")) {
      hint = "Tables are missing. Run: npx drizzle-kit push --force";
    } else if (message.includes("ENOTFOUND")) {
      hint = "Database host in DATABASE_URL cannot be resolved.";
    }

    console.error("[health] database check failed:", message);
    return Response.json({ ok: false, database: "error", error: message, code, hint }, { status: 500 });
  }
}
