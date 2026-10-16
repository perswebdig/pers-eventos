"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0a0f1e",
          color: "#e6eaf5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 20 }}>
            Ocorreu um erro inesperado ao carregar o aplicativo. Tente novamente.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.5, marginBottom: 20 }}>
              ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              background: "#3b6ff5",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
