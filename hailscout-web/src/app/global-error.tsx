"use client";

/**
 * Global error boundary — catches a throw in the ROOT layout itself, which
 * error.tsx can't reach. It replaces the whole document, so it must render
 * its own <html>/<body> and can't rely on globals.css being loaded — hence
 * inline styles in the brand slate+cyan palette.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#0B1120",
          color: "#F1F5F9",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#06B6D4",
              margin: 0,
            }}
          >
            Something broke
          </p>
          <h1 style={{ marginTop: 8, fontSize: 24, fontWeight: 500 }}>
            HailScout hit an error
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#94A3B8" }}>
            Your data is fine — this is on our side.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              fontSize: 14,
              borderRadius: 8,
              border: "none",
              background: "#0891B2",
              color: "white",
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
