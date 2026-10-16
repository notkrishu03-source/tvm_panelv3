"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Button, CopyButton, Field } from "@/components/ui";
import { inputCls } from "@/lib/styles";
import { SSHX_INSTALL_CMD, isValidSshxUrl } from "@/lib/sshx";

/**
 * Embeds a live sshx web terminal, or shows setup instructions when no
 * session is attached yet.
 */
export function SshxTerminal({
  url,
  label,
  canEdit,
  busy,
  onSave,
  height = 460,
}: {
  url: string | null;
  /** What this terminal connects to, e.g. "web-01" or "node tvm-node-01". */
  label: string;
  canEdit: boolean;
  busy?: boolean;
  onSave: (url: string | null) => Promise<unknown>;
  height?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !isValidSshxUrl(trimmed)) {
      setError("That does not look like an sshx link (https://sshx.io/s/…#key)");
      return;
    }
    setError(null);
    await onSave(trimmed || null);
    setEditing(false);
  }

  if (url && !editing) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm text-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live sshx session attached to <strong>{label}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <CopyButton value={url} label="Copy link" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-emerald-200 transition hover:bg-white/10"
            >
              <Icon name="external" size={12} /> New tab
            </a>
            {canEdit && (
              <>
                <button
                  onClick={() => { setValue(url); setEditing(true); }}
                  className="rounded-md px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
                >
                  Change
                </button>
                <button
                  onClick={() => onSave(null)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                >
                  Detach
                </button>
              </>
            )}
          </div>
        </div>

        <iframe
          src={url}
          title={`Live terminal — ${label}`}
          style={{ height }}
          className="w-full rounded-xl border border-line bg-black"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-clipboard-write"
          allow="clipboard-read; clipboard-write"
        />

        <p className="text-xs text-zinc-600">
          Anyone with this link gets a real shell — the key is in the URL fragment. Detach the session when you are done.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel/90 p-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon name="terminal" size={20} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Live terminal (sshx)</h3>
            <p className="text-xs text-zinc-500">Attach a real shell session to {label}</p>
          </div>
        </div>

        <ol className="mb-4 space-y-3 text-sm text-zinc-400">
          <li>
            <span className="text-zinc-300">1.</span> Run this inside {label}:
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-black/60 px-3 py-2">
              <code className="break-all font-mono text-xs text-brand-soft">{SSHX_INSTALL_CMD}</code>
              <CopyButton value={SSHX_INSTALL_CMD} />
            </div>
          </li>
          <li>
            <span className="text-zinc-300">2.</span> It prints a link like{" "}
            <code className="font-mono text-xs text-zinc-300">https://sshx.io/s/AbCd#key</code>
          </li>
          <li>
            <span className="text-zinc-300">3.</span> Paste it below to open the terminal right here.
          </li>
        </ol>

        {canEdit ? (
          <form onSubmit={submit} className="space-y-3">
            <Field label="sshx session link">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://sshx.io/s/XXXXXXXX#key"
                autoFocus={editing}
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" loading={busy}>
                <Icon name="zap" size={14} /> Attach terminal
              </Button>
              {editing && (
                <Button type="button" variant="ghost" onClick={() => { setEditing(false); setError(null); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : (
          <p className="rounded-lg border border-line bg-bg/60 px-4 py-3 text-sm text-zinc-500">
            No live session attached. Ask an administrator to attach one.
          </p>
        )}
      </div>
    </div>
  );
}
