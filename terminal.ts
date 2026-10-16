import "server-only";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";

/**
 * Real host web-terminal sessions.
 *
 * Each session is a long-lived `bash` process whose stdout+stderr are buffered
 * in a ring and polled over HTTP by the browser (xterm.js). This runs ACTUAL
 * commands on the server that hosts the panel, so it is admin-only and every
 * session is tied to the admin who opened it.
 *
 * No native dependencies (uses child_process), so it works in any container.
 * It is pipe-based rather than a full PTY: line-oriented commands work great;
 * full-screen TUIs (vim, htop) are limited.
 */

type Session = {
  id: string;
  userId: number;
  proc: ChildProcessWithoutNullStreams;
  buffer: string;
  cursor: number; // total bytes ever produced
  lastSeen: number;
  alive: boolean;
  exitInfo: string | null;
};

const MAX_BUFFER = 200_000; // keep last ~200 KB of output
const IDLE_MS = 15 * 60_000; // kill sessions idle for 15 min
const MAX_PER_USER = 3;

const globalForTerm = globalThis as typeof globalThis & {
  __tvmTerminals?: Map<string, Session>;
};
const sessions = (globalForTerm.__tvmTerminals ??= new Map<string, Session>());

function sweep() {
  const now = Date.now();
  for (const s of sessions.values()) {
    if (!s.alive || now - s.lastSeen > IDLE_MS) kill(s.id);
  }
}

function append(s: Session, chunk: string) {
  s.buffer += chunk;
  s.cursor += chunk.length;
  if (s.buffer.length > MAX_BUFFER) s.buffer = s.buffer.slice(-MAX_BUFFER);
}

export function createSession(userId: number): { id: string } {
  sweep();
  const mine = [...sessions.values()].filter((s) => s.userId === userId && s.alive);
  // Recycle the oldest if the user is at the limit.
  if (mine.length >= MAX_PER_USER) {
    mine.sort((a, b) => a.lastSeen - b.lastSeen);
    kill(mine[0].id);
  }

  const id = randomBytes(16).toString("hex");
  const proc = spawn("bash", ["--norc", "-i"], {
    cwd: process.env.HOME || "/root",
    env: { ...process.env, TERM: "xterm-256color", PS1: "\\u@\\h:\\w\\$ " },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: Session = {
    id,
    userId,
    proc,
    buffer: "",
    cursor: 0,
    lastSeen: Date.now(),
    alive: true,
    exitInfo: null,
  };

  proc.stdout.setEncoding("utf8");
  proc.stderr.setEncoding("utf8");
  proc.stdout.on("data", (d: string) => append(session, d));
  proc.stderr.on("data", (d: string) => append(session, d));
  proc.on("exit", (code, signal) => {
    session.alive = false;
    session.exitInfo = `\r\n[process exited: code=${code ?? "null"} signal=${signal ?? "none"}]\r\n`;
    append(session, session.exitInfo);
  });
  proc.on("error", (err) => {
    session.alive = false;
    append(session, `\r\n[failed to start shell: ${err.message}]\r\n`);
  });

  append(session, `Connected to ${hostname()} — real host shell (admin)\r\n`);

  sessions.set(id, session);
  return { id };
}

function hostname() {
  try {
    // os import kept local to avoid pulling it into client bundles
    return require("node:os").hostname();
  } catch {
    return "host";
  }
}

function get(id: string, userId: number): Session | null {
  const s = sessions.get(id);
  if (!s || s.userId !== userId) return null;
  s.lastSeen = Date.now();
  return s;
}

export function writeInput(id: string, userId: number, data: string): boolean {
  const s = get(id, userId);
  if (!s) return false;
  if (!s.alive) return true;
  try {
    s.proc.stdin.write(data);
  } catch {
    // stdin may have closed; ignore
  }
  return true;
}

export function readOutput(
  id: string,
  userId: number,
  from: number,
): { data: string; cursor: number; alive: boolean } | null {
  const s = get(id, userId);
  if (!s) return null;
  // Translate the absolute cursor into an offset within the retained buffer.
  const bufStart = s.cursor - s.buffer.length;
  const safeFrom = Math.max(from, bufStart);
  const data = safeFrom >= bufStart ? s.buffer.slice(safeFrom - bufStart) : s.buffer;
  return { data, cursor: s.cursor, alive: s.alive };
}

export function kill(id: string): void {
  const s = sessions.get(id);
  if (!s) return;
  try {
    if (s.alive) s.proc.kill("SIGKILL");
  } catch {
    // already dead
  }
  s.alive = false;
  // Keep a moment so the client can fetch the exit notice, then drop it.
  setTimeout(() => sessions.delete(id), 5000);
}

export function listSessions(userId: number) {
  sweep();
  return [...sessions.values()]
    .filter((s) => s.userId === userId)
    .map((s) => ({ id: s.id, alive: s.alive, lastSeen: s.lastSeen }));
}
