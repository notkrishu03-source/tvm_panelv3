"use client";

import { SshxTerminal } from "@/components/SshxTerminal";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";

export function NodeSshx({ nodeId, nodeName, url }: { nodeId: number; nodeName: string; url: string | null }) {
  const { run, busy } = useRun();
  return (
    <SshxTerminal
      url={url}
      label={`node ${nodeName}`}
      canEdit
      busy={busy === "sshx"}
      height={420}
      onSave={(next) =>
        run("sshx", () => api(`/api/admin/nodes/${nodeId}`, "PATCH", { sshxUrl: next }), {
          success: next ? "Live terminal attached" : "Live terminal detached",
        })
      }
    />
  );
}
