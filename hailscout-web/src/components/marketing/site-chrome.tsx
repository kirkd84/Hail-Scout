/**
 * Shared marketing header + footer. Newly added in Phase 14.1.
 * Older marketing pages still inline their own copies — safe to migrate
 * incrementally.
 */

import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Wordmark size="md" pulse />
                <nav className="hidden items-center gap-6 md:flex">
          <Link href="/#how"          className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
          <Link href="/#faq"          className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
          <Link href="/live"          className="text-sm text-muted-foreground hover:text-foreground transition-colors">Live storms</Link>
          <Link href="/alerts"        className="text-sm text-muted-foreground hover:text-foreground transition-colors">Alerts</Link>
          <Link href="/storms"        className="text-sm text-muted-foreground hover:text-foreground transition-colors">Storm catalog</Link>
          <Link href="/stats"         className="text-sm text-muted-foreground hover:text-foreground transition-colors">By the numbers</Link>
          <Link href="/accuracy"      className="text-sm text-muted-foreground hover:text-foreground transition-colors">Accuracy</Link>
          <Link href="/claim"         className="text-sm text-muted-foreground hover:text-foreground transition-colors">Claim lookup</Link>
          <Link href="/case-studies"  className="text-sm text-muted-foreground hover:text-foreground transition-colors">Customers</Link>
          <Link href="/pricing"       className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/compare"       className="text-sm text-muted-foreground hover:text-foreground transition-colors">Compare</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="inline-flex rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
          >
            Get started <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <Wordmark size="sm" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/live" className="hover:text-foreground">Live storms</Link>
            <Link href="/alerts" className="hover:text-foreground">Alerts</Link>
            <Link href="/storms" className="hover:text-foreground">Storm catalog</Link>
            <Link href="/stats" className="hover:text-foreground">By the numbers</Link>
            <Link href="/accuracy" className="hover:text-foreground">Accuracy</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/case-studies" className="hover:text-foreground">Customers</Link>
            <Link href="/claim" className="hover:text-foreground">Claim lookup</Link>
            <Link href="/api" className="hover:text-foreground">API</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
