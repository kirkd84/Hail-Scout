"use client";

/**
 * App-shell error boundary — keeps the navigation alive when a single
 * authenticated panel (map, reports, storm sheet…) throws at render.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-panel">
        <p className="font-mono text-[10px] uppercase tracking-wide-caps text-copper">
          Something broke
        </p>
        <h1 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
          This panel hit an error
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your data is fine — this is a display error on our side. Retry, or
          switch pages and come back.
          {error.digest ? ` Reference: ${error.digest}` : ""}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
