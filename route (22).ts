import { z } from "zod";
import { ApiError, route } from "@/lib/api";
import { kill, readOutput, writeInput } from "@/lib/terminal";

export const dynamic = "force-dynamic";

const inputSchema = z.object({ data: z.string().max(10_000) });

// Poll output since `?from=<cursor>`.
export const GET = route<{ id: string }>(
  async ({ req, user, params }) => {
    const from = Number(new URL(req.url).searchParams.get("from") ?? "0");
    const out = readOutput(params.id, user.id, Number.isFinite(from) ? from : 0);
    if (!out) throw new ApiError(404, "Terminal session not found");
    return out;
  },
  { admin: true },
);

// Write keystrokes to the shell.
export const POST = route<{ id: string }, typeof inputSchema>(
  async ({ user, params, body }) => {
    if (!writeInput(params.id, user.id, body.data)) {
      throw new ApiError(404, "Terminal session not found");
    }
    return { ok: true };
  },
  { admin: true, schema: inputSchema },
);

export const DELETE = route<{ id: string }>(
  async ({ params }) => {
    kill(params.id);
    return { ok: true };
  },
  { admin: true },
);
