"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, useToast } from "@/components/ui";
import { api } from "@/lib/client-api";
import "@xterm/xterm/css/xterm.css";

/**
 * Real host web terminal backed by a server-side bash session.
 * Output is polled over HTTP; input is POSTed per keystroke.
 */
export function WebTerminal() {
  const holder = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "closed">("idle");
  const sessionRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  async function start() {
    if (status === "connecting" || status === "connected") return;
    setStatus("connecting");

    // Load xterm only in the browser.
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);

    let session: string;
    try {
      const res = await api<{ id: string }>("/api/admin/terminal", "POST");
      session = res.id;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open terminal", "error");
      setStatus("idle");
      return;
    }
    sessionRef.current = session;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      theme: { background: "#05060a", foreground: "#e4e4e7", cursor: "#f97316" },
      convertEol: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    if (holder.current) {
      holder.current.innerHTML = "";
      term.open(holder.current);
      try {
        fit.fit();
      } catch {
        // container not laid out yet
      }
    }
    term.focus();

    // Send keystrokes to the server.
    term.onData((data) => {
      api(`/api/admin/terminal/${session}`, "POST", { data }).catch(() => {});
    });

    // Poll output.
    let cursor = 0;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const out = await api<{ data: string; cursor: number; alive: boolean }>(
          `/api/admin/terminal/${session}?from=${cursor}`,
        );
        if (out.data) {
          term.write(out.data);
          cursor = out.cursor;
        }
        if (!out.alive) {
          setStatus("closed");
          stopped = true;
          return;
        }
      } catch {
        setStatus("closed");
        stopped = true;
        return;
      }
      setTimeout(poll, 250);
    };
    void poll();

    const onResize = () => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener("resize", onResize);

    cleanupRef.current = () => {
      stopped = true;
      window.removeEventListener("resize", onResize);
      term.dispose();
      if (sessionRef.current) {
        api(`/api/admin/terminal/${sessionRef.current}`, "DELETE").catch(() => {});
        sessionRef.current = null;
      }
    };

    setStatus("connected");
  }

  function stop() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus("idle");
  }

  // Kill the session if the user navigates away.
  useEffect(() => () => cleanupRef.current?.(), []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "connected"
                ? "animate-pulse bg-emerald-400"
                : status === "connecting"
                  ? "bg-amber-400"
                  : status === "closed"
                    ? "bg-red-400"
                    : "bg-zinc-600"
            }`}
          />
          <span className="text-zinc-300">
            {status === "connected"
              ? "Connected to host shell"
              : status === "connecting"
                ? "Connecting…"
                : status === "closed"
                  ? "Session closed"
                  : "Not connected"}
          </span>
        </span>
        <div className="flex gap-2">
          {status === "connected" ? (
            <Button size="sm" variant="danger" onClick={stop}>
              <Icon name="power" size={13} /> End session
            </Button>
          ) : (
            <Button size="sm" variant="primary" loading={status === "connecting"} onClick={status === "closed" ? () => { stop(); void start(); } : start}>
              <Icon name="terminal" size={13} /> {status === "closed" ? "Reconnect" : "Connect"}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#05060a]">
        <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-xs text-zinc-500">host shell — bash</span>
        </div>
        {status === "idle" ? (
          <div className="grid h-[440px] place-items-center text-center">
            <div>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                <Icon name="terminal" size={22} />
              </div>
              <p className="text-sm font-medium text-white">Host web terminal</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Opens a real bash shell on the server that runs this panel. Click connect to start.
              </p>
              <Button className="mt-4" variant="primary" onClick={start}>
                <Icon name="terminal" size={14} /> Connect
              </Button>
            </div>
          </div>
        ) : (
          <div ref={holder} className="h-[440px] w-full p-2" />
        )}
      </div>

      <p className="text-xs text-zinc-600">
        ⚠ This is a real root/host shell. Commands execute on the server immediately. Sessions auto-close after 15 minutes idle.
      </p>
    </div>
  );
}
