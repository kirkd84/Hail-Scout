"use client";

/**
 * Shared marketing header + footer.
 *
 * Mobile: the nav is a real menu rather than being hidden entirely — on a
 * phone the header previously offered only "Sign in" and "Get started", so
 * every other page was unreachable without scrolling to the footer. Tap
 * targets are held at 44px (the iOS/Android minimum) throughout.
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
  { href: "/case-studies", label: "Customers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
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
      <div className="container flex h-16 items-center justify-between gap-2">
        <Wordmark size="md" pulse />

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            href="/sign-in"
            className="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
          >
            Get started <span aria-hidden>→</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary md:hidden"
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
          id="mobile-menu"
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-background md:hidden"
        >
          <div className="container flex flex-col py-2">
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

const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: "/live", label: "Live storms" },
  { href: "/alerts", label: "Alerts" },
  { href: "/storms", label: "Storm catalog" },
  { href: "/stats", label: "By the numbers" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/pricing", label: "Pricing" },
  { href: "/case-studies", label: "Customers" },
  { href: "/claim", label: "Claim lookup" },
  { href: "/api", label: "API" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-10 md:py-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center md:gap-8">
          <Wordmark size="sm" />
          {/* Two columns on a phone keeps the footer from becoming a very long
              single list while still giving each link a real tap target. */}
          <nav className="grid w-full grid-cols-2 gap-x-6 text-sm text-muted-foreground sm:w-auto sm:grid-cols-3 md:flex md:flex-wrap md:items-center md:gap-x-6">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="flex min-h-10 items-center transition-colors hover:text-foreground md:min-h-0"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
