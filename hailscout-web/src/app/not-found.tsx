import Link from "next/link";

/** Branded 404 — replaces Next's default unstyled not-found page. */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-panel">
        <p className="font-mono text-[10px] uppercase tracking-wide-caps text-copper">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page moved or never existed. Let&apos;s get you back to the storms.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
