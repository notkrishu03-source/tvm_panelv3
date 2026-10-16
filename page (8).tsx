import { PageHeader } from "@/components/ui";
import { WebTerminal } from "@/components/WebTerminal";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminTerminalPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Web terminal" subtitle="A real bash shell on the panel host, in your browser" />
      <WebTerminal />
    </>
  );
}
