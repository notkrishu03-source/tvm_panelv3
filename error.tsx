"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[panel] render error:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-line bg-panel/90 p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-300">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The panel could not render this page. This is most often a database connection problem.
        </p>

        <div className="mt-5 rounded-lg border border-line bg-bg/70 p-4 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Troubleshooting</p>
          <ol className="space-y-1.5 text-xs text-zinc-400">
            <li>
              1. Check the database probe: <code className="font-mono text-zinc-200">curl localhost:3000/api/health</code>
            </li>
            <li>
              2. Start PostgreSQL: <code className="font-mono text-zinc-200">service postgresql start</code>
            </li>
            <li>
              3. Apply the schema: <code className="font-mono text-zinc-200">npx drizzle-kit push --force</code>
            </li>
            <li>
              4. Read the logs: <code className="font-mono text-zinc-200">pm2 logs tvm-panel</code>
            </li>
          </ol>
        </div>

        {error.digest && <p className="mt-4 font-mono text-[11px] text-zinc-600">digest: {error.digest}</p>}

        <button
          onClick={reset}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-black transition hover:bg-brand-soft"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
