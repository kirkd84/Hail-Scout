import { AppShell } from "@/components/app/app-shell";

/**
 * Authenticated app pages depend on the session and query params at request
 * time, so the whole /app segment renders dynamically (never statically
 * prerendered). This also avoids useSearchParams() prerender bailouts.
 */
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
