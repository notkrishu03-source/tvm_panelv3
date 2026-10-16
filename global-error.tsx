"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#090a0f",
          color: "#e4e4e7",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>TuffNode TVM — startup error</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#a1a1aa" }}>
            The panel failed to start rendering. Check that PostgreSQL is running and DATABASE_URL is correct, then
            restart with <code>pm2 restart tvm-panel</code>.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 11, color: "#52525b", fontFamily: "monospace" }}>digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#f97316",
              color: "#000",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
