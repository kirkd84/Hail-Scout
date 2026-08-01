"use client";

/**
 * Shared marketing header + footer — "Storm Instrument" chrome.
 *
 * Header: wordmark + a curated inline nav (lg+) + Sign in / Request
 * access per the button system, plus a menu button available at EVERY
 * width. The menu panel indexes all marketing pages — previously the
 * 11-link inline nav overflowed between md and xl, so the full index
 * now lives in the menu and only five primary links render inline.
 *
 * Mobile behavior is intentionally preserved exactly: 44px tap targets
 * throughout, the panel closes on navigation, and the page cannot
 * scroll behind an open menu.
 *
 * Footer: brand line + grouped link grid with mono micro-labels and a
 * quiet contour texture over the card ground.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";

const NAV: { href: string; label: string }[] = [
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
  { href: "/live", label: "Live storms" },
  { href: "/alerts", label: "Alerts" },
  { href: "/storms", label: "Storm catalog" },
  { href: "/stats", label: "By the numbers" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/claim", label: "Claim lookup" },
  { href: "/case-studies", label: "Playbooks" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
];

/** The short set that fits inline at lg+ — everything else is in the menu. */
const PRIMARY_NAV: { href: string; label: string }[] = [
  { href: "/#how", label: "How it works" },
  { href: "/live", label: "Live storms" },
  { href: "/storms", label: "Storm catalog" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu on navigation — otherwise it stays open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Don't let the page scroll behind an open menu.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Wordmark size="md" pulse />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* Sign in moves into the menu on the narrowest screens so the
              primary CTA and the menu button both stay comfortably tappable. */}
          <Link
            href="/sign-in"
            className="hidden min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/request-access"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-copper-700 sm:px-5"
          >
            Request access
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? (
                <path d="M6 6 L18 18 M18 6 L6 18" />
              ) : (
                <path d="M3 6 H21 M3 12 H21 M3 18 H21" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-menu"
          aria-label="All pages"
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-background"
        >
          <div className="container grid grid-cols-1 py-2 pb-4 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center border-b border-border/40 text-[15px] text-foreground/85 transition-colors hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center text-[15px] font-medium text-copper sm:hidden"
            >
              Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

const FOOTER_GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Product",
    links: [
      { href: "/live", label: "Live storms" },
      { href: "/alerts", label: "Alerts" },
      { href: "/storms", label: "Storm catalog" },
      { href: "/claim", label: "Claim lookup" },
      { href: "/api", label: "API" },
    ],
  },
  {
    label: "Proof",
    links: [
      { href: "/accuracy", label: "Accuracy" },
      { href: "/stats", label: "By the numbers" },
      { href: "/case-studies", label: "Playbooks" },
      { href: "/compare", label: "Compare" },
    ],
  },
  {
    label: "Get started",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/request-access", label: "Request access" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="section-contour border-t border-border bg-card">
      <div className="container py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr] lg:gap-16">
          <div className="max-w-xs">
            <Wordmark size="sm" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Storm intelligence for roofing crews.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_GROUPS.map((g) => (
              <nav key={g.label} aria-label={g.label}>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {g.label}
                </p>
                <ul className="mt-2">
                  {g.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            © {new Date().getFullYear()} Hail GPS
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Built for the field
          </p>
        </div>
      </div>
    </footer>
  );
}
